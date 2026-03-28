import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/utils/supabase/server';
import { SUBSCRIPTION_PLANS } from '@/lib/billing/plans';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = await createClient();
    const admin = await createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: subscriptions, error } = await admin
      .from('subscriptions')
      .select('id, plan_type, status, start_date, end_date, amount, currency')
      .eq('user_id', user.id)
      .in('status', ['active', 'pending'])
      .order('end_date', { ascending: false })
      .limit(1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const subscription = (subscriptions || [])[0] || null;

    return NextResponse.json({
      plans: Object.values(SUBSCRIPTION_PLANS),
      currentSubscription: subscription,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch subscription';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
