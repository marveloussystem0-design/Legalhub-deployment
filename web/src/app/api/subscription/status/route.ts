import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/utils/supabase/server';
import { getAdvocateCaseCount, getEffectiveSubscription } from '@/lib/billing/access';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = await createClient();
    const admin = await createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const subscription = await getEffectiveSubscription(admin, user.id);
    const caseCount = await getAdvocateCaseCount(admin, user.id);
    const selectionRequired =
      profile?.role === 'advocate' &&
      subscription.effectivePlan === 'basic' &&
      caseCount > 30;

    let selectableCases: Array<{
      id: string;
      title: string | null;
      case_number: string | null;
      status: string | null;
      updated_at: string | null;
    }> = [];

    if (selectionRequired) {
      const { data: participantLinks } = await admin
        .from('case_participants')
        .select('case_id')
        .eq('user_id', user.id)
        .eq('role', 'advocate');

      const { data: ownedCaseLinks } = await admin
        .from('cases')
        .select('id')
        .eq('created_by', user.id);

      const caseIds = Array.from(
        new Set([
          ...(participantLinks || []).map((row: { case_id: string }) => row.case_id),
          ...(ownedCaseLinks || []).map((row: { id: string }) => row.id),
        ])
      );

      if (caseIds.length > 0) {
        const { data: cases } = await admin
          .from('cases')
          .select('id, title, case_number, status, updated_at')
          .in('id', caseIds)
          .order('updated_at', { ascending: false });

        selectableCases = (cases || []) as typeof selectableCases;
      }
    }

    return NextResponse.json({
      subscription,
      caseCount,
      selectionRequired,
      selectableCases,
      requiredSelectionCount: selectionRequired ? 30 : 0,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load subscription status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
