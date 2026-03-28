import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/utils/supabase/server';
import { getAdvocateCaseCount, getEffectiveSubscription } from '@/lib/billing/access';

export const runtime = 'nodejs';

type Payload = {
  keepCaseIds?: string[];
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const admin = await createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as Payload;
    const keepCaseIds = Array.from(new Set(body.keepCaseIds || []));

    const subscription = await getEffectiveSubscription(admin, user.id);
    const caseCount = await getAdvocateCaseCount(admin, user.id);

    if (subscription.effectivePlan !== 'basic' || caseCount <= 30) {
      return NextResponse.json({ error: 'Downgrade case selection is not required.' }, { status: 400 });
    }

    if (keepCaseIds.length !== 30) {
      return NextResponse.json({ error: 'Select exactly 30 cases to continue on Basic plan.' }, { status: 400 });
    }

    const { data: participantLinks } = await admin
      .from('case_participants')
      .select('case_id')
      .eq('user_id', user.id)
      .eq('role', 'advocate');

    const { data: ownedCaseLinks } = await admin
      .from('cases')
      .select('id')
      .eq('created_by', user.id);

    const visibleCaseIds = Array.from(
      new Set([
        ...(participantLinks || []).map((row: { case_id: string }) => row.case_id),
        ...(ownedCaseLinks || []).map((row: { id: string }) => row.id),
      ])
    );

    const visibleSet = new Set(visibleCaseIds);
    const invalidSelections = keepCaseIds.filter((id) => !visibleSet.has(id));
    if (invalidSelections.length > 0) {
      return NextResponse.json({ error: 'Selection includes invalid cases.' }, { status: 400 });
    }

    const removableCaseIds = visibleCaseIds.filter((id) => !keepCaseIds.includes(id));
    if (removableCaseIds.length === 0) {
      return NextResponse.json({ success: true, removed: 0 });
    }

    await admin
      .from('case_user_preferences')
      .delete()
      .eq('user_id', user.id)
      .in('case_id', removableCaseIds);

    await admin
      .from('case_participants')
      .delete()
      .eq('user_id', user.id)
      .eq('role', 'advocate')
      .in('case_id', removableCaseIds);

    const { data: removableCases } = await admin
      .from('cases')
      .select('id, created_by')
      .in('id', removableCaseIds);

    for (const row of removableCases || []) {
      if (row.created_by !== user.id) continue;

      const { data: remainingParticipants } = await admin
        .from('case_participants')
        .select('user_id')
        .eq('case_id', row.id);

      const remainingOwnerId =
        (remainingParticipants || []).find((p: { user_id: string }) => p.user_id !== user.id)?.user_id || null;

      if (remainingOwnerId) {
        await admin.from('cases').update({ created_by: remainingOwnerId }).eq('id', row.id);
      } else {
        await admin.from('cases').delete().eq('id', row.id);
      }
    }

    await admin
      .from('subscriptions')
      .update({
        downgrade_required: false,
        target_plan_type: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .in('status', ['active', 'pending']);

    return NextResponse.json({
      success: true,
      removed: removableCaseIds.length,
      message: 'Case selection saved. Your Basic plan is now active with 30 cases.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to apply downgrade case selection';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
