import { createClient, createAdminClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getEffectiveSubscription } from '@/lib/billing/access';

interface BulkImportCaseInput {
  cino?: string | null;
  case_number?: string | null;
  petitioner_name?: string | null;
  respondent_name?: string | null;
  status?: string | null;
  next_hearing?: {
    hearing_date?: string | null;
    hearing_type?: string | null;
  } | null;
  [key: string]: unknown;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Internal Server Error';
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const subscription = await getEffectiveSubscription(admin, user.id);
    if (!subscription.canBulkImport) {
      return NextResponse.json(
        { error: 'Bulk import is available only for Medium and Pro plans.', code: 'PLAN_FEATURE_NOT_AVAILABLE' },
        { status: 403 }
      );
    }

    if (subscription.downgradeRequired && subscription.effectivePlan === 'basic') {
      return NextResponse.json(
        { error: 'Complete downgrade case selection to continue on Basic plan.', code: 'DOWNGRADE_SELECTION_REQUIRED' },
        { status: 403 }
      );
    }

    const { cases } = await request.json() as { cases?: BulkImportCaseInput[] };
    
    if (!cases || !Array.isArray(cases)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    const results = {
      success: [] as Array<Record<string, unknown>>,
      errors: [] as Array<Record<string, unknown>>,
      duplicates: [] as Array<Record<string, unknown>>
    };

    const { data: currentProfile } = await admin
      .from('profiles')
      .select('email, role, phone, is_verified')
      .eq('id', user.id)
      .maybeSingle();

    const ensureLegacyUserRow = async () => {
      if (!currentProfile?.email || !currentProfile?.role) return;

      const { error } = await admin
        .from('users')
        .upsert({
          id: user.id,
          email: currentProfile.email,
          phone: currentProfile.phone || null,
          role: currentProfile.role,
          is_verified: currentProfile.is_verified ?? false
        }, { onConflict: 'id' });

      if (error) {
        console.error('Bulk import legacy users sync failed:', error);
      }
    };

    await ensureLegacyUserRow();

    const attachAdvocateToCase = async (caseId: string) => {
      let { error } = await admin
        .from('case_participants')
        .insert({
          case_id: caseId,
          user_id: user.id,
          role: 'advocate'
        });

      if (error?.message?.includes('case_participants_user_id_fkey')) {
        await ensureLegacyUserRow();

        const retry = await admin
          .from('case_participants')
          .insert({
            case_id: caseId,
            user_id: user.id,
            role: 'advocate'
          });

        error = retry.error;
      }

      return error;
    };

    const findExistingSharedCase = async (caseData: BulkImportCaseInput) => {
      if (caseData.cino) {
        const { data } = await admin
          .from('cases')
          .select('id, case_number, created_by')
          .eq('cino', caseData.cino)
          .maybeSingle();

        if (data) return data;
      }

      if (caseData.case_number) {
        const { data } = await admin
          .from('cases')
          .select('id, case_number, created_by')
          .eq('case_number', caseData.case_number)
          .maybeSingle();

        if (data) return data;
      }

      return null;
    };

    for (const caseData of cases) {
      const existingCase: { id: string; case_number: string | null; created_by?: string | null } | null =
        await findExistingSharedCase(caseData);

      // 3. If the shared case already exists, just attach this advocate.
      if (existingCase) {
        const { data: existingParticipant } = await supabase
          .from('case_participants')
          .select('case_id')
          .eq('case_id', existingCase.id)
          .eq('user_id', user.id)
          .eq('role', 'advocate')
          .maybeSingle();

        if (existingParticipant) {
          results.duplicates.push({
            cino: caseData.cino || null,
            case_number: existingCase.case_number || caseData.case_number || null,
            reason: 'Case already linked to this advocate'
          });
          continue;
        }

        const participantError = await attachAdvocateToCase(existingCase.id);

        if (participantError) {
          results.errors.push({
            case_number: existingCase.case_number || caseData.case_number,
            error: participantError.message
          });
          continue;
        }

        results.success.push({
          id: existingCase.id,
          case_number: existingCase.case_number || caseData.case_number,
          linked: true
        });
        continue;
      }

      // 4. Create a new shared case only when it doesn't already exist.
      const insertData = {
        ...caseData,
        title: `${caseData.petitioner_name} vs ${caseData.respondent_name}`,
        created_by: user.id,
        status: caseData.status || 'open',
        // Ensure next_hearing_date is populated in the cases table as well
        next_hearing_date: caseData.next_hearing?.hearing_date || null
      };

      // Remove non-table fields
      delete insertData.next_hearing;

      const { data: newCase, error: caseError } = await admin
        .from('cases')
        .insert(insertData)
        .select()
        .single();

      if (caseError) {
        if (
          caseError.message?.includes('cases_cino_key') ||
          caseError.message?.includes('cases_case_number_key')
        ) {
          const rescuedCase = await findExistingSharedCase(caseData);
          if (rescuedCase) {
            const existingParticipantError = await attachAdvocateToCase(rescuedCase.id);

            if (!existingParticipantError) {
              results.success.push({
                id: rescuedCase.id,
                case_number: rescuedCase.case_number || caseData.case_number,
                linked: true,
                recovered: true
              });
              continue;
            }
          }
        }

        results.errors.push({
          case_number: caseData.case_number,
          error: caseError.message
        });
        continue;
      }

      // Create Hearing Record
      if (caseData.next_hearing) {
        await admin.from('case_hearings').insert({
          case_id: newCase.id,
          hearing_date: caseData.next_hearing.hearing_date,
          hearing_type: caseData.next_hearing.hearing_type || 'Hearing',
          created_by: user.id
        });
      }

      // Link Advocate
      const newParticipantError = await attachAdvocateToCase(newCase.id);
      if (newParticipantError) {
        await admin.from('cases').delete().eq('id', newCase.id);
        results.errors.push({
          case_number: newCase.case_number || caseData.case_number,
          error: newParticipantError.message
        });
        continue;
      }

      results.success.push({
        id: newCase.id,
        case_number: newCase.case_number
      });
    }

    revalidatePath('/dashboard/advocate/cases');
    return NextResponse.json(results);

  } catch (error: unknown) {
    console.error('Bulk import error:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
