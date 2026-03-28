'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { parseScraperResult, isMetadataSparse, generateCaseTitle } from "@/lib/ecourts/processor";
import { TNEcourtsScraper } from '@/lib/scrapers/tn-ecourts-scraper';
import fs from 'fs/promises';
import path from 'path';
import { assertCanAddCase } from '@/lib/billing/access';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Unexpected error';
}

function normalizeCaseStatus(
  status: string | null | undefined,
  fallback: 'open' | 'closed' = 'open'
): 'open' | 'closed' {
  if (status === 'open' || status === 'closed') return status;
  return fallback;
}



export async function updateCaseStatus(caseId: string, status: 'open' | 'closed', outcome?: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  try {
    const updateData: Record<string, unknown> = { status };
    if (status === 'closed' && outcome) {
        updateData.outcome = outcome;
        updateData.outcome_date = new Date().toISOString();
    } else if (status === 'open') {
        updateData.outcome = null;
        updateData.outcome_date = null;
    }

    const { error } = await supabase
      .from('cases')
      .update(updateData)
      .eq('id', caseId)

    if (error) throw error

    // Notify user about status change
    await supabase.from('notifications').insert({
        user_id: user.id,
        title: `Case Status Updated`,
        message: `Case status changed to ${status}${outcome ? ` (${outcome})` : ''}`,
        type: status === 'closed' ? 'warning' : 'info',
        is_read: false,
        link: `/dashboard/advocate/cases/${caseId}`
    });

    revalidatePath(`/dashboard/advocate/cases/${caseId}`)
    revalidatePath('/dashboard/advocate')
    revalidatePath('/dashboard/advocate/cases')
    return { success: true }
  } catch (error: unknown) {
    console.error('Update status error:', error)
    return { error: getErrorMessage(error) }
  }
}


export async function addParticipant(caseId: string, userId: string, role: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  try {
    const { error } = await supabase
      .from('case_participants')
      .insert({
        case_id: caseId,
        user_id: userId,
        role
      })

    if (error) throw error

    revalidatePath(`/dashboard/advocate/cases/${caseId}`)
    return { success: true }
  } catch (error: unknown) {
    console.error('Add participant error:', error)
    return { error: getErrorMessage(error) }
  }
}

export async function removeParticipantFromCase(caseId: string, userId: string, role: string) {
  const supabase = await createClient()
  const admin = await createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  try {
    const [{ data: ownedCase }, { data: advocateParticipant }] = await Promise.all([
      admin
        .from('cases')
        .select('id')
        .eq('id', caseId)
        .eq('created_by', user.id)
        .maybeSingle(),
      admin
        .from('case_participants')
        .select('id')
        .eq('case_id', caseId)
        .eq('user_id', user.id)
        .eq('role', 'advocate')
        .maybeSingle()
    ])

    if (!ownedCase && !advocateParticipant) {
      return { error: 'You do not have permission to manage participants in this case.' }
    }

    const { error: deleteParticipantError } = await admin
      .from('case_participants')
      .delete()
      .eq('case_id', caseId)
      .eq('user_id', userId)
      .eq('role', role)

    if (deleteParticipantError) throw deleteParticipantError

    const { error: deletePreferenceError } = await admin
      .from('case_user_preferences')
      .delete()
      .eq('case_id', caseId)
      .eq('user_id', userId)

    if (deletePreferenceError) throw deletePreferenceError

    revalidatePath(`/dashboard/advocate/cases/${caseId}`)
    revalidatePath('/dashboard/advocate/cases')
    return { success: true }
  } catch (error: unknown) {
    console.error('Remove participant error:', error)
    return { error: getErrorMessage(error) }
  }
}

export async function uploadDocument(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const title = formData.get('title') as string;
  const filePath = formData.get('filePath') as string;
  const fileSize = parseInt(formData.get('fileSize') as string);
  const fileType = formData.get('fileType') as string;
  const caseId = formData.get('caseId') as string;

  if (!title || !filePath || !caseId) return { error: 'Missing required fields' }

  try {
    const { error } = await supabase
      .from('documents')
      .insert({
          title,
          file_url: filePath,
          file_size: fileSize,
          file_type: fileType,
          uploaded_by: user.id,
          case_id: caseId,
      })

    if (error) {
        console.error('DB Insert Error:', error);
        return { error: `Failed to save: ${error.message}` }
    }

    revalidatePath(`/dashboard/advocate/cases/${caseId}`)
    return { success: true }
  } catch (error: unknown) {
    console.error('Upload document error:', error)
    return { error: getErrorMessage(error) }
  }
}


export async function importCaseFromECourts(formData: FormData) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const cnr = formData.get('cnrNumber') as string;
  const captcha = formData.get('captcha') as string;
  const sessionId = formData.get('sessionId') as string;

  if (!cnr || !captcha || !sessionId) return { error: 'Missing required fields' };

  const normalizedCnr = cnr.toUpperCase().trim();
  if (normalizedCnr.length !== 16) {
    return { error: 'Invalid CNR Number. Must be exactly 16 characters.' };
  }

  try {
    const findExistingSharedCase = async (lookup: {
      cnrNumber?: string | null;
      cino?: string | null;
      caseNumber?: string | null;
    }) => {
      if (lookup.cnrNumber) {
        const { data } = await admin
          .from('cases')
          .select('id, title, case_number')
          .eq('cnr_number', lookup.cnrNumber)
          .maybeSingle();
        if (data) return data;
      }

      if (lookup.cino) {
        const { data } = await admin
          .from('cases')
          .select('id, title, case_number')
          .eq('cino', lookup.cino)
          .maybeSingle();
        if (data) return data;
      }

      if (lookup.caseNumber) {
        const { data } = await admin
          .from('cases')
          .select('id, title, case_number')
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

      if (existingParticipant) {
        return { alreadyLinked: true as const, error: null };
      }

      const { error } = await admin
        .from('case_participants')
        .insert({
          case_id: caseId,
          user_id: user.id,
          role: 'advocate'
        });

      return { alreadyLinked: false as const, error };
    };

    const existingCase = await findExistingSharedCase({
      cnrNumber: normalizedCnr,
      cino: normalizedCnr
    });

    if (existingCase) {
      const { data: existingParticipant } = await admin
        .from('case_participants')
        .select('id')
        .eq('case_id', existingCase.id)
        .eq('user_id', user.id)
        .eq('role', 'advocate')
        .maybeSingle();

      if (existingParticipant) {
        return { error: 'Case already exists in your dashboard.' };
      }

      const access = await assertCanAddCase(admin, user.id);
      if (!access.ok) {
        return { error: access.message };
      }

      const participantResult = await ensureAdvocateParticipant(existingCase.id);
      if (participantResult.error) throw participantResult.error;

      revalidatePath('/dashboard/advocate');
      return {
        success: true,
        caseId: existingCase.id,
        message: 'Existing case linked to your profile.',
        existing: true
      };
    }

    const result = await TNEcourtsScraper.submitCaptcha(sessionId, captcha, normalizedCnr);

    if (!result.success || !result.data) {
      if (result.data?.raw_html) {
        try {
          const debugPath = path.join(process.cwd(), 'public', `scrape_fail_${normalizedCnr}.html`);
          await fs.writeFile(debugPath, result.data.raw_html);
        } catch (e) {
          console.error('Failed to save debug HTML', e);
        }
      }

      return { error: result.error || 'Failed to fetch case details via Scraper' };
    }

    const parsed = parseScraperResult(result, normalizedCnr);
    if (!parsed) return { error: 'Failed to parse case data' };

    const {
      petitioner,
      respondent,
      courtName,
      caseType,
      filingDate,
      caseNumber,
      caseStatus,
      nextHearingDate,
      metadata,
      registrationDate,
      disposalDate,
      disposalNature,
      judgeName
    } = parsed;
    const cnrNumber = parsed.caseNumber || normalizedCnr;

    const normalizedStatus = normalizeCaseStatus(caseStatus);

    if ((!petitioner && !respondent) || isMetadataSparse(metadata)) {
      return { error: 'Could not fetch case details. The eCourts portal might be busy or the CNR is invalid. Please try again.' };
    }

    const access = await assertCanAddCase(admin, user.id);
    if (!access.ok) {
      return { error: access.message };
    }

    const insertPayload = {
      title: generateCaseTitle(petitioner, respondent, normalizedCnr),
      case_number: caseNumber || normalizedCnr,
      case_type: caseType || 'Unknown',
      court_name: courtName || 'Unknown Court',
      filing_date: filingDate,
      status: normalizedStatus,
      created_by: user.id,
      next_hearing_date: nextHearingDate,
      petitioner_name: petitioner,
      respondent_name: respondent,
      cnr_number: normalizedCnr,
      cino: cnrNumber,
      disposal_nature: disposalNature || null,
      outcome_date: disposalDate || null,
      metadata: {
        ...metadata,
        synced_at: new Date().toISOString()
      }
    };

    const { data: caseData, error: insertError } = await admin
      .from('cases')
      .insert(insertPayload)
      .select()
      .single();

    if (
      insertError?.message?.includes('cases_case_number_key') ||
      insertError?.message?.includes('cases_cino_key') ||
      insertError?.message?.includes('cases_cnr_number_key')
    ) {
      const rescuedCase = await findExistingSharedCase({
        cnrNumber: normalizedCnr,
        cino: cnrNumber,
        caseNumber: caseNumber || normalizedCnr
      });

      if (rescuedCase) {
        const participantResult = await ensureAdvocateParticipant(rescuedCase.id);
        if (participantResult.error) throw participantResult.error;

        revalidatePath('/dashboard/advocate');
        return {
          success: true,
          caseId: rescuedCase.id,
          message: participantResult.alreadyLinked
            ? 'Case already exists in your dashboard.'
            : 'Existing case linked to your profile.',
          existing: true
        };
      }
    }

    if (insertError || !caseData) {
      throw insertError || new Error('Failed to create case');
    }

    const participantResult = await ensureAdvocateParticipant(caseData.id);
    if (participantResult.error) {
      console.error('Failed to link importing user as participant:', participantResult.error);
    }

    const { data: ecData, error: ecError } = await admin
      .from('ecourts_cases')
      .upsert({
        cnr_number: normalizedCnr,
        case_number: caseNumber || normalizedCnr,
        court_name: courtName || 'Unknown Court',
        status: normalizedStatus,
        registration_date: registrationDate || null,
        judge_name: judgeName || null,
        last_synced_at: new Date().toISOString()
      }, { onConflict: 'cnr_number' })
      .select('id')
      .single();

    if (!ecError && ecData) {
      await admin.from('case_ecourts_links').upsert({
        case_id: caseData.id,
        ecourts_case_id: ecData.id,
        linked_by: user.id,
        auto_sync_enabled: true
      }, { onConflict: 'case_id,ecourts_case_id' });
    }

    revalidatePath('/dashboard/advocate');
    return { success: true, caseId: caseData.id };

  } catch (error: unknown) {
    console.error('Import Error:', error);
    return { error: getErrorMessage(error) };
  }
}

export async function deleteCase(caseId: string) {
  const supabase = await createClient()
  const admin = await createAdminClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  try {
    const { data: caseData, error: caseError } = await admin
      .from('cases')
      .select('id, created_by')
      .eq('id', caseId)
      .maybeSingle();

    if (caseError) throw caseError;
    if (!caseData) {
      return { error: 'Case not found.' };
    }

    const { data: participationRows, error: participationError } = await admin
      .from('case_participants')
      .select('id, user_id')
      .eq('case_id', caseId)
      .eq('user_id', user.id);

    if (participationError) throw participationError;

    const hasDirectAccess = caseData.created_by === user.id || (participationRows?.length || 0) > 0;
    if (!hasDirectAccess) {
      return { error: 'You do not have permission to delete this case.' };
    }

    const { data: allParticipantRows, error: allParticipantsError } = await admin
      .from('case_participants')
      .select('id, user_id')
      .eq('case_id', caseId);

    if (allParticipantsError) throw allParticipantsError;

    const uniqueParticipantIds = new Set((allParticipantRows || []).map((row: { user_id: string }) => row.user_id));
    if (caseData.created_by) {
      uniqueParticipantIds.add(caseData.created_by);
    }

    const shouldUnlinkOnly = uniqueParticipantIds.size > 1;

    if (shouldUnlinkOnly) {
      const { error: unlinkError } = await admin
        .from('case_participants')
        .delete()
        .eq('case_id', caseId)
        .eq('user_id', user.id);

      if (unlinkError) throw unlinkError;

      const { error: deletePreferenceError } = await admin
        .from('case_user_preferences')
        .delete()
        .eq('case_id', caseId)
        .eq('user_id', user.id);

      if (deletePreferenceError) throw deletePreferenceError;

      if (caseData.created_by === user.id) {
        const remainingOwnerId = Array.from(uniqueParticipantIds).find((participantId) => participantId !== user.id) || null;
        const { error: ownerUpdateError } = await admin
          .from('cases')
          .update({ created_by: remainingOwnerId })
          .eq('id', caseId);

        if (ownerUpdateError) throw ownerUpdateError;
      }
    } else {
      const { error } = await admin
        .from('cases')
        .delete()
        .eq('id', caseId)

      if (error) throw error
    }

    revalidatePath('/dashboard/advocate')
    revalidatePath('/dashboard/advocate/cases')
    return { success: true, unlinked: shouldUnlinkOnly }
  } catch (error: unknown) {
    console.error('Delete case error:', error)
    return { error: getErrorMessage(error) }
  }
}
