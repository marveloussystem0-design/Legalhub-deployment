import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';

const VALID_PLANS = ['basic', 'medium', 'pro'] as const;
type Plan = (typeof VALID_PLANS)[number];

/**
 * DEV-ONLY route to manually set a subscription plan for testing.
 * Blocked in production automatically.
 *
 * Usage:
 *   GET /api/dev/set-plan?plan=medium
 *   GET /api/dev/set-plan?plan=pro
 *   GET /api/dev/set-plan?plan=basic
 */
export async function GET(req: Request) {
  // ── Block in production ──────────────────────────────────────
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development mode.' },
      { status: 403 }
    );
  }

  // ── Get plan from query param ────────────────────────────────
  const { searchParams } = new URL(req.url);
  const plan = searchParams.get('plan') as Plan | null;

  if (!plan || !VALID_PLANS.includes(plan)) {
    return NextResponse.json(
      {
        error: `Invalid plan. Use one of: ${VALID_PLANS.join(', ')}`,
        usage: '/api/dev/set-plan?plan=medium',
      },
      { status: 400 }
    );
  }

  // ── Get current logged-in user ───────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'You must be logged in to use this endpoint.' },
      { status: 401 }
    );
  }

  const admin = await createAdminClient();
  const now = new Date();
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + 1);
  const graceEndsAt = new Date(endDate);
  graceEndsAt.setDate(graceEndsAt.getDate() + 3);

  // ── Cancel any existing active subscriptions ─────────────────
  await admin
    .from('subscriptions')
    .update({
      status: 'cancelled',
      effective_status: 'expired',
      updated_at: now.toISOString(),
    })
    .eq('user_id', user.id)
    .eq('status', 'active');

  // ── Insert new test subscription ─────────────────────────────
  if (plan === 'basic') {
    // Basic = no subscription row needed, just cancel active ones
    return NextResponse.json({
      success: true,
      message: `✅ Plan set to BASIC (all active subscriptions cancelled).`,
      userId: user.id,
      plan,
    });
  }

  const amountMap: Record<Plan, number> = { basic: 0, medium: 999, pro: 1999 };

  const { error } = await admin.from('subscriptions').insert({
    user_id: user.id,
    plan_type: plan,
    status: 'active',
    start_date: now.toISOString(),
    end_date: endDate.toISOString(),
    grace_ends_at: graceEndsAt.toISOString(),
    effective_status: 'active',
    billing_cycle: 'monthly',
    amount: amountMap[plan],
    currency: 'INR',
    downgrade_required: false,
    target_plan_type: null,
    updated_at: now.toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: `✅ Plan set to ${plan.toUpperCase()} successfully! Refresh your app to see changes.`,
    userId: user.id,
    plan,
    validUntil: endDate.toISOString(),
  });
}
