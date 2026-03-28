import { NextResponse } from 'next/server';
import { TNEcourtsScraper } from '@/lib/scrapers/tn-ecourts-scraper';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import {
  parseScraperResult,
  type ScraperResult,
  isMetadataSparse,
  scrubMetadata,
  generateCaseTitle
} from '@/lib/ecourts/processor';
import { assertCanAddCase } from '@/lib/billing/access';


/**
 * Parse eCourts date DD-MM-YYYY → ISO
 */
function parseECourtsDate(dateStr: string): string | null {
  if (!dateStr || dateStr === '-' || dateStr.toLowerCase().includes('null')) return null;

  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).toISOString();
  }

  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeCaseStatus(
  status: string | null | undefined,
  fallback?: string | null
): 'open' | 'closed' {
  if (status === 'open' || status === 'closed') return status;
  if (fallback === 'open' || fallback === 'closed') return fallback;
  return 'open';
}

function normalizeUpcomingHearing(dateStr?: string | null): string | null {
  if (!dateStr) return null;

  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return null;

  // Normalize both dates to YYYY-MM-DD in IST (Asia/Kolkata)
  const hearingDate = new Date(parsed.getTime()).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  // Only return if it's today or in the future
  return hearingDate < todayDate ? null : parsed.toISOString();
}

interface HistoryEntryLike {
  hearing_date?: string | null;
  business_date?: string | null;
  purpose?: string | null;
  business?: string | null;
  judge?: string | null;
}

function chooseMergedHistory(
  existingHistory: HistoryEntryLike[] = [],
  nextHistory: HistoryEntryLike[] = []
) {
  if (!nextHistory.length) return existingHistory;
  if (!existingHistory.length) return nextHistory;

  const serialize = (history: HistoryEntryLike[]) =>
    JSON.stringify(
      history.map((entry) => ({
        hearing_date: entry?.hearing_date || '',
        business_date: entry?.business_date || '',
        purpose: entry?.purpose || '',
        business: entry?.business || '',
        judge: entry?.judge || '',
      }))
    );

  return serialize(existingHistory) === serialize(nextHistory) ? existingHistory : nextHistory;
}


/**
 * Propagate hearing history into relational table
 */
async function propagateHistory(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  caseId: string,
  history: Array<{
    hearing_date?: string;
    business_date?: string;
    purpose?: string;
    business?: string;
    judge?: string;
  }>
) {
  if (!history || history.length === 0) return;

  for (const h of history) {
    const iso = parseECourtsDate(
      h.hearing_date || h.business_date || ''
    );

    if (!iso) continue;

    const dateOnly = iso.split('T')[0];

    const { data: existing } = await supabase
      .from('case_hearings')
      .select('id')
      .eq('case_id', caseId)
      .gte('hearing_date', `${dateOnly}T00:00:00`)
      .lt('hearing_date', `${dateOnly}T23:59:59`)
      .maybeSingle();

    const payload = {
      case_id: caseId,
      hearing_date: iso,
      hearing_type: h.purpose || 'Hearing',
      notes:
        h.business ||
        `Judge: ${h.judge || 'Not specified'}`,
      status: 'disposed',
      updated_at: new Date().toISOString()
    };

    if (existing) {
      await supabase
        .from('case_hearings')
        .update(payload)
        .eq('id', existing.id);
    } else {
      await supabase
        .from('case_hearings')
        .insert({
          ...payload,
          created_at: new Date().toISOString()
        });
    }
  }
}



/**
 * POST /api/ecourts/sync
 */
export async function POST(req: Request) {
  try {

    console.log('📱 Mobile sync request');

    const supabase = await createClient();
    const admin = await createAdminClient();


    /*
     AUTH
    */
    const authHeader = req.headers.get('Authorization');

    const token =
      authHeader?.startsWith('Bearer ')
        ? authHeader.substring(7)
        : null;

    let user;

    if (token) {
      const { data } =
        await supabase.auth.getUser(token);

      user = data.user;
    } else {
      const { data } =
        await supabase.auth.getUser();

      user = data.user;
    }

    if (!user)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );



    /*
     INPUT
    */
    const {
      sessionId,
      code,
      cnrNumber,
      caseId
    } = await req.json();
    const normalizedCnr = String(cnrNumber || '').toUpperCase().trim();

    if (!sessionId || !code || !normalizedCnr)
      return NextResponse.json(
        { error: 'Missing params' },
        { status: 400 }
      );



    /*
     SCRAPE
    */
    const result =
      await TNEcourtsScraper.submitCaptcha(
        sessionId,
        code,
        normalizedCnr
      );

    if (!result.success || !result.data) {

      return NextResponse.json(
        {
          success: false,
          error:
            result.error ||
            'Scrape failed'
        },
        { status: 422 }
      );
    }



    /*
     PROCESS
    */
    const parsed =
      parseScraperResult(
        result as ScraperResult,
        normalizedCnr
      );

    if (!parsed)
      return NextResponse.json(
        {
          success: false,
          error:
            'Processor failed'
        },
        { status: 500 }
      );


    const {

      petitioner,
      respondent,
      courtName,
      caseStatus,
      nextHearingDate,
      metadata

    } = parsed;
    const effectiveNextHearingDate = normalizeUpcomingHearing(nextHearingDate);


    /*
     SAFETY GUARD
    */
    if (
      !petitioner &&
      !respondent &&
      isMetadataSparse(metadata)
    ) {

      console.warn(
        'Sparse scrape blocked'
      );

      return NextResponse.json(
        {
          success: false,
          error:
            'Portal returned incomplete data. Retry.'
        },
        { status: 422 }
      );
    }

    const findExistingSharedCase = async (lookup: {
      cnrNumber?: string | null;
      cino?: string | null;
      caseNumber?: string | null;
    }) => {
      if (lookup.cnrNumber) {
        const { data } = await admin
          .from('cases')
          .select('id')
          .eq('cnr_number', lookup.cnrNumber)
          .maybeSingle();
        if (data) return data;
      }

      if (lookup.cino) {
        const { data } = await admin
          .from('cases')
          .select('id')
          .eq('cino', lookup.cino)
          .maybeSingle();
        if (data) return data;
      }

      if (lookup.caseNumber) {
        const { data } = await admin
          .from('cases')
          .select('id')
          .eq('case_number', lookup.caseNumber)
          .maybeSingle();
        if (data) return data;
      }

      return null;
    };

    const ensureAdvocateParticipant = async (caseId: string) => {
      const { data: existingParticipant } = await admin
        .from('case_participants')
        .select('id')
        .eq('case_id', caseId)
        .eq('user_id', user.id)
        .eq('role', 'advocate')
        .maybeSingle();

      if (existingParticipant) return { alreadyLinked: true };

      await admin
        .from('case_participants')
        .insert({
          case_id: caseId,
          user_id: user.id,
          role: 'advocate'
        });
      return { alreadyLinked: false };
    };



    /*
     CREATE OR LOAD CASE
    */
    let targetCaseId = caseId;


    if (!targetCaseId) {
      const existing = await findExistingSharedCase({
        cnrNumber: normalizedCnr,
        cino: normalizedCnr,
        caseNumber: parsed.caseNumber || normalizedCnr
      });


      if (existing)
        targetCaseId =
          existing.id;

      else {

        const { data: newCase, error: insertError }
          = await admin
            .from('cases')
            .insert({

              title:
                generateCaseTitle(
                  petitioner,
                  respondent,
                  parsed.caseNumber ||
                    normalizedCnr
                ),

              case_number:
                parsed.caseNumber ||
                normalizedCnr,

              case_type:
                parsed.caseType ||
                'Unknown',

              court_name:
                courtName ||
                'Unknown Court',

              filing_date:
                parsed.filingDate,

              petitioner_name:
                petitioner,

              respondent_name:
                respondent,

              status:
                normalizeCaseStatus(
                  caseStatus
                ),

              created_by:
                user.id,

              cnr_number:
                normalizedCnr,

              cino:
                normalizedCnr,

              disposal_nature:
                parsed.disposalNature || null,

              outcome_date:
                parsed.disposalDate || null,

              next_hearing_date:
                effectiveNextHearingDate,

              metadata:
                scrubMetadata({
                  ...metadata,
                  synced_at:
                    new Date().toISOString()
                })

            })
            .select('id')
            .single();


        if (
          insertError?.message?.includes('cases_case_number_key') ||
          insertError?.message?.includes('cases_cino_key') ||
          insertError?.message?.includes('cases_cnr_number_key')
        ) {
          const rescuedCase = await findExistingSharedCase({
            cnrNumber: normalizedCnr,
            cino: normalizedCnr,
            caseNumber: parsed.caseNumber || normalizedCnr
          });

          if (rescuedCase) {
            targetCaseId = rescuedCase.id;
          }
        }

        if (!targetCaseId && (insertError || !newCase)) {
          throw new Error(`Failed to create case: ${insertError?.message || 'Unknown error'}`);
        }

        if (!targetCaseId) {
          targetCaseId = newCase?.id ?? null;
        }


      }
    }

    if (!targetCaseId) {
      throw new Error('Unable to resolve target case for CNR sync');
    }

    const participantCheck = await admin
      .from('case_participants')
      .select('id')
      .eq('case_id', targetCaseId)
      .eq('user_id', user.id)
      .eq('role', 'advocate')
      .maybeSingle();

    if (!participantCheck.data) {
      const access = await assertCanAddCase(admin, user.id);
      if (!access.ok) {
        return NextResponse.json(
          { success: false, error: access.message, code: access.code },
          { status: 403 }
        );
      }
      await ensureAdvocateParticipant(targetCaseId);
    }



    /*
     LOAD EXISTING
    */
      const { data: existingCase }
      = await admin
        .from('cases')
        .select(
          'metadata, title, next_hearing_date, status'
        )
        .eq(
          'id',
          targetCaseId
        )
        .single();


    const existingMetadata =
      existingCase?.metadata || {};
    const normalizedStatus =
      normalizeCaseStatus(
        caseStatus,
        existingCase?.status
      );


    /*
     SAFE MERGE
    */
    const sparse =
      isMetadataSparse(
        metadata
      );


    let mergedMetadata = {

      ...existingMetadata,

      ...(sparse
        ? {}
        : metadata),

      full_details: {

        ...(existingMetadata.full_details ||
          {}),

        ...(sparse
          ? {}
          : metadata.full_details) ||
          {}

      },


      history:
        chooseMergedHistory(
          existingMetadata.history || [],
          metadata?.history || []
        ),


      synced_at:
        new Date().toISOString()

    };


    mergedMetadata =
      scrubMetadata(
        mergedMetadata
      );

    if (
      mergedMetadata?.full_details &&
      !effectiveNextHearingDate
    ) {
      delete mergedMetadata.full_details['Next Hearing Date'];
      delete mergedMetadata.full_details['Next Date (Purpose)'];
    }



    /*
     UPDATE MAIN CASE
    */
    const updatePayload: Record<string, unknown> =
      {

        metadata:
          mergedMetadata,

        status:
          normalizedStatus,

        cnr_number:
          normalizedCnr,

        cino:
          normalizedCnr

      };


    if (petitioner)
      updatePayload.petitioner_name =
        petitioner;

    if (respondent)
      updatePayload.respondent_name =
        respondent;

    if (courtName)
      updatePayload.court_name =
        courtName;

    if (parsed.caseType)
      updatePayload.case_type =
        parsed.caseType;

    if (parsed.filingDate)
      updatePayload.filing_date =
        parsed.filingDate;

    if (parsed.disposalNature)
      updatePayload.disposal_nature =
        parsed.disposalNature;

    if (parsed.disposalDate)
      updatePayload.outcome_date =
        parsed.disposalDate;


    if (effectiveNextHearingDate) {
      updatePayload.next_hearing_date =
        effectiveNextHearingDate;
    } else if (normalizedStatus === 'closed') {
      updatePayload.next_hearing_date =
        null;
    } else if (existingCase?.next_hearing_date) {
      // If the portal didn't give a new future date, check if our current one is still valid (upcoming)
      // This uses the same IST-aware logic to clear it if it just passed.
      updatePayload.next_hearing_date =
        normalizeUpcomingHearing(existingCase.next_hearing_date);
    } else {
      // Explicitly clear if no upcoming date exists in either source
      updatePayload.next_hearing_date = null;
    }


    const newTitle =
      generateCaseTitle(
        petitioner,
        respondent,
        parsed.caseNumber ||
          normalizedCnr
      );


    if (
      newTitle &&
      newTitle !==
        'Unknown Case'
    )
      updatePayload.title =
        newTitle;



    await admin
      .from('cases')
      .update(
        updatePayload
      )
      .eq(
        'id',
        targetCaseId
      );



    /*
     ecourts_cases
    */
    const { data: ec }
      = await admin
        .from(
          'ecourts_cases'
        )
        .upsert(
          {

            case_id:
              targetCaseId,

            cnr_number:
              normalizedCnr,

            status:
              normalizedStatus,

            next_hearing_date:
              effectiveNextHearingDate,

            last_synced_at:
              new Date().toISOString(),

            judge_name:
              parsed.judgeName,

            registration_date:
              parsed.registrationDate,

            filing_date:
              parsed.filingDate,

            petitioner:
              parsed.petitioner,

            respondent:
              parsed.respondent,

            court_name:
              parsed.courtName ||
              courtName ||
              'Unknown Court',

            case_type:
              parsed.caseType ||
              'Unknown',

            case_number:
              parsed.caseNumber ||
              normalizedCnr

          },

          {
            onConflict:
              'cnr_number'
          }
        )
        .select('id')
        .single();


    if (ec)
      await admin
        .from(
          'case_ecourts_links'
        )
        .upsert(
          {

            case_id:
              targetCaseId,

            ecourts_case_id:
              ec.id

          },
          {
            onConflict:
              'case_id,ecourts_case_id'
          }
        );



    /*
     HISTORY RELATIONAL
    */
    if (
      mergedMetadata.history
    )
      await propagateHistory(
        admin,
        targetCaseId,
        mergedMetadata.history
      );



    /*
     NEXT HEARING UPSERT
    */
    if (
      effectiveNextHearingDate
    ) {

      const dateOnly =
        effectiveNextHearingDate.split(
          'T'
        )[0];


      const {
        data: existing
      }
        = await admin
          .from(
            'case_hearings'
          )
          .select('id')
          .eq(
            'case_id',
            targetCaseId
          )
          .gte(
            'hearing_date',
            `${dateOnly}T00:00:00`
          )
          .lt(
            'hearing_date',
            `${dateOnly}T23:59:59`
          )
          .maybeSingle();


      const payload =
        {

          case_id:
            targetCaseId,

          hearing_date:
            effectiveNextHearingDate,

          hearing_type:
            parsed.hearings?.[0]
              ?.purpose ||
            'Hearing',

          status:
            'scheduled',

          updated_at:
            new Date().toISOString()

        };


      if (existing)
        await admin
          .from(
            'case_hearings'
          )
          .update(
            payload
          )
          .eq(
            'id',
            existing.id
          );

      else
        await admin
          .from(
            'case_hearings'
          )
          .insert({
            ...payload,
            created_at:
              new Date().toISOString()
          });
    }



    return NextResponse.json(
      {
        success: true,
        caseId:
          targetCaseId
      }
    );



  } catch (err: unknown) {

    console.error(
      err
    );

    const message =
      err instanceof Error
        ? err.message
        : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error:
          message
      },
      { status: 500 }
    );
  }
}



export async function OPTIONS() {

  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin':
          '*',
        'Access-Control-Allow-Methods':
          'POST, OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type, Authorization'
      }
    }
  );
}
