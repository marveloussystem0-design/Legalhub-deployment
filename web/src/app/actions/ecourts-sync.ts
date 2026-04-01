'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  parseScraperResult,
  scrubMetadata,
  isMetadataSparse,
  generateCaseTitle,
  type ScraperResult
} from '@/lib/ecourts/processor';

export interface CaptchaResponse {
  success: boolean;
  imageBase64?: string;
  sessionId?: string; // Encrypted/Stringified cookies
  error?: string;
}

export interface SyncResponse {
    success: boolean;
    data?: unknown;
    error?: string;
}

interface HistoryEntryLike {
  hearing_date?: string | null;
  business_date?: string | null;
  purpose?: string | null;
  business?: string | null;
  judge?: string | null;
}

type MetadataLike = {
  full_details?: Record<string, unknown>;
  history?: HistoryEntryLike[];
  [key: string]: unknown;
};

async function getTNEcourtsScraper() {
  const mod = await import('@/lib/scrapers/tn-ecourts-scraper');
  return mod.TNEcourtsScraper;
}

function normalizeEcourtsRuntimeError(error: unknown): string {
  const message = getErrorMessage(error);
  const lower = message.toLowerCase();

  if (
    lower.includes('failed to launch browser') ||
    lower.includes('could not find chrome') ||
    lower.includes('could not find chromium') ||
    lower.includes('browser was not found') ||
    lower.includes('spawn') ||
    lower.includes('executable')
  ) {
    return 'eCourts sync browser could not start on the server. Please contact support or retry shortly.';
  }

  if (
    lower.includes('net::err') ||
    lower.includes('failed to navigate') ||
    lower.includes('navigation timeout') ||
    lower.includes('timeout')
  ) {
    return 'Could not reach the eCourts portal right now. Please retry in a moment.';
  }

  return message;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Internal Server Error';
}

/**
 * Server Action: Fetches a fresh captcha from TN eCourts
 * Used by the "Add Case" and "Sync Case" modals.
 */
export async function fetchTNCaptchaAction(cnr?: string): Promise<CaptchaResponse> {
  try {
    console.log(`⚡ [Action] Requesting TN Captcha ${cnr ? 'for ' + cnr : ''}...`);
    const TNEcourtsScraper = await getTNEcourtsScraper();
    const result = await TNEcourtsScraper.fetchCaptcha(cnr);

    if (result.status === 'success' && result.imageBase64) {
      return {
        success: true,
        imageBase64: result.imageBase64,
        sessionId: result.sessionId
      };
    } else {
      return {
        success: false,
        error: 'Failed to retrieve captcha image.'
      };
    }
  } catch (error: unknown) {
    console.error('❌ [Action] Error in fetchTNCaptchaAction:', error);
    return {
      success: false,
      error: normalizeEcourtsRuntimeError(error)
    };
  }
}

/**
 * Server Action: Submits Captcha and Syncs Data
 */
/**
 * Parses eCourts date strings (DD-MM-YYYY) into ISO format.
 */
function parseECourtsDate(dateStr: string): string | null {
    if (!dateStr || dateStr.toLowerCase().includes('null') || dateStr === '-') return null;
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

  const hearingDate = parsed.toISOString().split('T')[0];
  const todayDate = new Date().toISOString().split('T')[0];

  return hearingDate < todayDate ? null : parsed.toISOString();
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
 * Propagates the full hearings history from scraped metadata into the relational database.
 */
async function propagateHistory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  caseId: string,
  history: HistoryEntryLike[]
) {
    if (!history || history.length === 0) return;

    for (const h of history) {
        const hearingDateRaw = h.hearing_date ?? h.business_date ?? null;
        if (!hearingDateRaw) continue;
        const hDate = parseECourtsDate(hearingDateRaw);
        if (!hDate) continue;

        const dateOnly = hDate.split('T')[0];
        
        // Upsert by matching date and case_id
        const { data: existing } = await supabase
            .from('case_hearings')
            .select('id')
            .eq('case_id', caseId)
            .gte('hearing_date', `${dateOnly}T00:00:00`)
            .lt('hearing_date', `${dateOnly}T23:59:59`)
            .maybeSingle();

        const payload = {
            case_id: caseId,
            hearing_date: hDate,
            hearing_type: h.purpose || 'Hearing',
            notes: h.business || `Judge: ${h.judge || 'Not Specified'}`,
            status: 'disposed' as const, // Past hearings are considered disposed/past
            updated_at: new Date().toISOString()
        };

        if (existing) {
            await supabase.from('case_hearings').update(payload).eq('id', existing.id);
        } else {
            await supabase.from('case_hearings').insert({ ...payload, created_at: new Date().toISOString() });
        }
    }
}

export async function submitTNCaptchaAction(
sessionId: string, code: string, cnr: string, caseId?: string): Promise<SyncResponse> {
    try {
        console.log('⚡ [Action] Submitting TN Captcha...');
        const TNEcourtsScraper = await getTNEcourtsScraper();
        const result = await TNEcourtsScraper.submitCaptcha(sessionId, code, cnr);

        if (!result.success || !result.data) {
            const isKnownUserError = result.error?.includes('captcha') || result.error?.includes('not found');
            if (!isKnownUserError) {
                console.error('❌ [Sync] Scraper unexpected failure:', result.error);
            }
            return { success: false, error: result.error || 'Sync Failed' };
        }

        // Initialize DB and Parser
        const supabase = await createClient();
        const { data: authData } = await supabase.auth.getUser();
        const currentUser = authData.user;
        if (!currentUser) return { success: false, error: 'Unauthorized' };
        const parsed = parseScraperResult(result as ScraperResult, cnr);
        if (!parsed) return { success: false, error: 'Failed to process case data' };

        const { 
          petitioner, 
          respondent, 
          courtName, 
          caseStatus, 
          nextHearingDate, 
          metadata 
        } = parsed;
        const cnrNumber = parsed.caseNumber || cnr;
        const effectiveNextHearingDate = normalizeUpcomingHearing(nextHearingDate);
        
        // 2. Safety Guard: Prevent overwriting with "Unknown" or sparse data
        if (petitioner === 'Unknown' && respondent === 'Unknown' && isMetadataSparse(metadata)) {
             console.error('⚠️ [Sync Guard] Scraper returned "Unknown" names and sparse metadata. Aborting update to prevent data loss.');
             return { success: false, error: 'Case data not found or session expired. Please try again.' };
        }

        // 4. Identify Case to Update
        const finalSyncedAt = new Date().toISOString();
        let mergedMetadata: MetadataLike = (metadata as MetadataLike) || {};

        if (caseId) {
             // Ensure cross-platform visibility: case lists are participant-driven.
             const { data: existingParticipant } = await supabase
                .from('case_participants')
                .select('id')
                .eq('case_id', caseId)
                .eq('user_id', currentUser.id)
                .eq('role', 'advocate')
                .maybeSingle();

             if (!existingParticipant) {
                await supabase
                  .from('case_participants')
                  .insert({
                    case_id: caseId,
                    user_id: currentUser.id,
                    role: 'advocate'
                  });
             }

             // 4a. Fetch existing case to preserve data
             const { data: existingCase } = await supabase
                .from('cases')
                .select('metadata, next_hearing_date, status, title')
                .eq('id', caseId)
                .single();
             const normalizedStatus = normalizeCaseStatus(caseStatus, existingCase?.status);

              // 4b. Update ecourts_cases link (Upsert by CNR)
              const ecPayload: Record<string, unknown> = {
                cnr_number: cnr,
                last_synced_at: finalSyncedAt,
                status: normalizedStatus,
                next_hearing_date:
                  effectiveNextHearingDate ??
                  normalizeUpcomingHearing(existingCase?.next_hearing_date),
              };

              // Map cleaned fields from processor schema
              if (parsed.judgeName) ecPayload.judge_name = parsed.judgeName;
              if (parsed.registrationDate) ecPayload.registration_date = parsed.registrationDate;
              if (parsed.filingDate) ecPayload.filing_date = parsed.filingDate;
              if (parsed.petitioner) ecPayload.petitioner = parsed.petitioner;
              if (parsed.respondent) ecPayload.respondent = parsed.respondent;
              if (parsed.courtName) ecPayload.court_name = parsed.courtName;
              if (parsed.caseType) ecPayload.case_type = parsed.caseType;
              if (parsed.caseNumber) ecPayload.case_number = parsed.caseNumber;

              const { data: ecRecord, error: ecError } = await supabase
                .from('ecourts_cases')
                .upsert(ecPayload, { onConflict: 'cnr_number' })
                .select('id')
                .single();
             
             if (ecError) {
                console.error('❌ [Sync] ecourts_cases upsert error:', ecError);
             }

             if (ecRecord) {
                 // 4c. Ensure junction link exists (case_ecourts_links)
                 await supabase
                    .from('case_ecourts_links')
                    .upsert({
                        case_id: caseId,
                        ecourts_case_id: ecRecord.id
                    }, { onConflict: 'case_id,ecourts_case_id' });
             }
             
             // 5. Update Main Case Metadata (Rich Data Merging)
             // CRITICAL: Only merge if the new data isn't sparse or if it's strictly better
             const isNewDataSparse = isMetadataSparse(metadata);
             
             mergedMetadata = {
                ...(existingCase?.metadata || {}),
                ...(isNewDataSparse ? {} : (metadata || {})),
                full_details: {
                    ...(existingCase?.metadata?.full_details || {}),
                    ...((isNewDataSparse ? {} : metadata?.full_details) || {})
                },
                // Always preserve or add lists (don't overwrite history with empty)
                history: chooseMergedHistory(
                    existingCase?.metadata?.history || [],
                    metadata?.history || []
                ),
                synced_at: finalSyncedAt
             };

             // 5b. FINAL SCRUB: Clean any garbage from the merged metadata
             mergedMetadata = (scrubMetadata(mergedMetadata) || {}) as MetadataLike;
             if (mergedMetadata?.full_details && !effectiveNextHearingDate) {
                delete mergedMetadata.full_details['Next Hearing Date'];
                delete mergedMetadata.full_details['Next Date (Purpose)'];
             }

              const mainCaseUpdate: Record<string, unknown> = {
                    status: normalizedStatus,
                    cino: cnrNumber,
                    cnr_number: cnr,
                    metadata: mergedMetadata
             };

             // Restore Hearing Date Logic
             if (effectiveNextHearingDate) {
                mainCaseUpdate.next_hearing_date = effectiveNextHearingDate;
             } else if (normalizedStatus === 'closed') {
                mainCaseUpdate.next_hearing_date = null;
             } else if (existingCase?.next_hearing_date) {
                mainCaseUpdate.next_hearing_date = normalizeUpcomingHearing(existingCase.next_hearing_date);
             }

             if (petitioner) mainCaseUpdate.petitioner_name = petitioner;
             if (respondent) mainCaseUpdate.respondent_name = respondent;
             if (courtName) mainCaseUpdate.court_name = courtName;
             
             // Always refresh title if we have any name, or if it's currently "Unknown vs Unknown"
             const newTitle = generateCaseTitle(petitioner, respondent, parsed.caseNumber || cnr);
             if (newTitle !== 'Unknown Case' && (newTitle.includes(' vs ') || !existingCase?.title || existingCase.title.includes('Unknown'))) {
                mainCaseUpdate.title = newTitle;
             }

             const { error: mainUpdateError } = await supabase
                .from('cases')
                .update(mainCaseUpdate)
                .eq('id', caseId);

             if (mainUpdateError) {
                console.error('❌ [Sync] Main case update error:', mainUpdateError);
                return { success: false, error: 'Failed to update case record' };
             }

              // 6. Propagate Full History (Relational)
              if (mergedMetadata.history) {
                  await propagateHistory(supabase, caseId, mergedMetadata.history);
              }

              // 7. Ensure Next Hearing is correctly set as 'scheduled'
              if (effectiveNextHearingDate) {
                  const hearingDateOnly = effectiveNextHearingDate.split('T')[0];
                  const { data: existingHearing } = await supabase
                      .from('case_hearings')
                      .select('id')
                      .eq('case_id', caseId)
                      .gte('hearing_date', `${hearingDateOnly}T00:00:00`)
                      .lt('hearing_date', `${hearingDateOnly}T23:59:59`)
                      .maybeSingle();

                  const hearingPayload: Record<string, unknown> = {
                      case_id: caseId,
                      hearing_date: effectiveNextHearingDate,
                      hearing_type: parsed.hearings?.[0]?.purpose || 'Hearing',
                      status: 'scheduled',
                      updated_at: new Date().toISOString()
                  };

                  if (existingHearing) {
                      await supabase.from('case_hearings').update(hearingPayload).eq('id', existingHearing.id);
                  } else {
                      await supabase.from('case_hearings').insert({ ...hearingPayload, created_at: new Date().toISOString() });
                  }
              }
        }

        revalidatePath('/dashboard/advocate/cases');
        return { 
            success: true, 
            data: {
                ...result.data,
                syncedAt: finalSyncedAt
            } 
        };

    } catch (error: unknown) {
        console.error('❌ [Action] Error in submitTNCaptchaAction:', error);
        return { success: false, error: normalizeEcourtsRuntimeError(error) };
    }
}
