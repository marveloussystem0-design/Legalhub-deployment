import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlanType } from '@/lib/billing/plans';

const BASIC_CASE_LIMIT = 30;
const GRACE_DAYS = 3;

type SubscriptionRow = {
  id: string;
  plan_type: PlanType;
  status: string;
  end_date: string | null;
  target_plan_type?: PlanType | null;
  downgrade_required?: boolean | null;
};

export type EffectiveSubscription = {
  effectivePlan: PlanType;
  lifecycleStatus: 'active' | 'grace' | 'expired' | 'none';
  expiresAt: string | null;
  graceEndsAt: string | null;
  canBulkImport: boolean;
  maxCases: number | null;
  downgradeRequired: boolean;
};

function addDays(isoDate: string, days: number) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export async function getEffectiveSubscription(
  admin: SupabaseClient,
  userId: string
): Promise<EffectiveSubscription> {
  const { data: activeOrPendingRows } = await admin
    .from('subscriptions')
    .select('id, plan_type, status, end_date, target_plan_type, downgrade_required')
    .eq('user_id', userId)
    .in('status', ['active', 'pending'])
    .order('end_date', { ascending: false })
    .limit(1);

  const latest = ((activeOrPendingRows || [])[0] || null) as SubscriptionRow | null;

  if (!latest) {
    return {
      effectivePlan: 'basic',
      lifecycleStatus: 'none',
      expiresAt: null,
      graceEndsAt: null,
      canBulkImport: false,
      maxCases: BASIC_CASE_LIMIT,
      downgradeRequired: false,
    };
  }

  const now = new Date();
  const expiresAt = latest.end_date;
  const graceEndsAt = expiresAt ? addDays(expiresAt, GRACE_DAYS) : null;
  const isActiveWindow = !!expiresAt && new Date(expiresAt) >= now;
  const isGraceWindow =
    !isActiveWindow &&
    !!graceEndsAt &&
    new Date(graceEndsAt) >= now &&
    (latest.status === 'active' || latest.status === 'pending');

  let lifecycleStatus: EffectiveSubscription['lifecycleStatus'] = 'expired';
  let effectivePlan: PlanType = 'basic';

  if (isActiveWindow && (latest.status === 'active' || latest.status === 'pending')) {
    lifecycleStatus = 'active';
    effectivePlan = latest.plan_type;
  } else if (isGraceWindow) {
    lifecycleStatus = 'grace';
    effectivePlan = latest.plan_type;
  }

  const planAfterDowngrade = latest.target_plan_type ?? effectivePlan;
  const finalPlan = latest.downgrade_required ? planAfterDowngrade : effectivePlan;
  const canBulkImport = finalPlan !== 'basic';

  return {
    effectivePlan: finalPlan,
    lifecycleStatus,
    expiresAt,
    graceEndsAt,
    canBulkImport,
    maxCases: finalPlan === 'basic' ? BASIC_CASE_LIMIT : null,
    downgradeRequired: Boolean(latest.downgrade_required),
  };
}

export async function getAdvocateCaseCount(admin: SupabaseClient, userId: string): Promise<number> {
  const [{ data: ownedCases }, { data: participantLinks }] = await Promise.all([
    admin
      .from('cases')
      .select('id')
      .eq('created_by', userId)
      .neq('status', 'archived'),
    admin
      .from('case_participants')
      .select('case_id')
      .eq('user_id', userId)
      .eq('role', 'advocate'),
  ]);

  const ownedIds = (ownedCases || []).map((row: { id: string }) => row.id);
  const participantIds = (participantLinks || []).map((row: { case_id: string }) => row.case_id);
  return new Set([...ownedIds, ...participantIds]).size;
}

export async function assertCanAddCase(admin: SupabaseClient, userId: string) {
  const subscription = await getEffectiveSubscription(admin, userId);

  if (subscription.downgradeRequired && subscription.effectivePlan === 'basic') {
    return {
      ok: false as const,
      code: 'DOWNGRADE_SELECTION_REQUIRED',
      message: 'Complete downgrade case selection to continue on Basic plan.',
      subscription,
    };
  }

  if (subscription.maxCases === null) {
    return { ok: true as const, subscription };
  }

  const caseCount = await getAdvocateCaseCount(admin, userId);
  if (caseCount >= subscription.maxCases) {
    return {
      ok: false as const,
      code: 'PLAN_CASE_LIMIT_REACHED',
      message: `Basic plan allows up to ${subscription.maxCases} cases. Upgrade to continue.`,
      subscription,
    };
  }

  return { ok: true as const, subscription };
}
