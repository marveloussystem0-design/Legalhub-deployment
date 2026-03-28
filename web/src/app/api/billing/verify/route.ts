import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/utils/supabase/server';
import { isPlanType, SUBSCRIPTION_PLANS } from '@/lib/billing/plans';
import { verifyRazorpaySignature } from '@/lib/billing/razorpay';
import { getAdvocateCaseCount } from '@/lib/billing/access';

export const runtime = 'nodejs';

type VerifyPaymentPayload = {
  planType?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
};

function addOneMonth(date: Date) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const admin = await createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as VerifyPaymentPayload;
    const planType = body.planType || '';
    const razorpayOrderId = body.razorpayOrderId || '';
    const razorpayPaymentId = body.razorpayPaymentId || '';
    const razorpaySignature = body.razorpaySignature || '';

    if (!isPlanType(planType)) {
      return NextResponse.json({ error: 'Invalid plan type' }, { status: 400 });
    }

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json({ error: 'Missing payment verification fields' }, { status: 400 });
    }

    const isValidSignature = verifyRazorpaySignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });

    if (!isValidSignature) {
      await admin
        .from('payments')
        .update({
          payment_status: 'failed',
          razorpay_payment_id: razorpayPaymentId,
          razorpay_signature: razorpaySignature,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('razorpay_order_id', razorpayOrderId);

      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
    }

    const { data: existingSubscription } = await admin
      .from('subscriptions')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('razorpay_payment_id', razorpayPaymentId)
      .maybeSingle();

    if (existingSubscription) {
      return NextResponse.json({
        success: true,
        message: 'Subscription already verified',
      });
    }

    const plan = SUBSCRIPTION_PLANS[planType];
    const amountInr = plan.amountPaise / 100;
    const now = new Date();
    const endDate = addOneMonth(now);
    const graceEndsAt = new Date(endDate);
    graceEndsAt.setDate(graceEndsAt.getDate() + 3);

    const { data: previousSubscription } = await admin
      .from('subscriptions')
      .select('plan_type, status')
      .eq('user_id', user.id)
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error: paymentUpdateError } = await admin
      .from('payments')
      .update({
        payment_status: 'success',
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature,
        updated_at: now.toISOString(),
      })
      .eq('user_id', user.id)
      .eq('razorpay_order_id', razorpayOrderId);

    if (paymentUpdateError) {
      return NextResponse.json({ error: paymentUpdateError.message }, { status: 500 });
    }

    await admin
      .from('subscriptions')
      .update({
        status: 'cancelled',
        effective_status: 'expired',
        updated_at: now.toISOString(),
      })
      .eq('user_id', user.id)
      .eq('status', 'active');

    const { data: insertedSubscription, error: subscriptionInsertError } = await admin
      .from('subscriptions')
      .insert({
        user_id: user.id,
        plan_type: planType,
        status: 'active',
        start_date: now.toISOString(),
        end_date: endDate.toISOString(),
        grace_ends_at: graceEndsAt.toISOString(),
        effective_status: 'active',
        billing_cycle: 'monthly',
        amount: amountInr,
        currency: plan.currency,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        target_plan_type: null,
        downgrade_required: false,
        updated_at: now.toISOString(),
      })
      .select('id')
      .single();

    if (subscriptionInsertError) {
      return NextResponse.json({ error: subscriptionInsertError.message }, { status: 500 });
    }

    const isDowngradeToBasic =
      planType === 'basic' &&
      !!previousSubscription &&
      (previousSubscription.plan_type === 'medium' || previousSubscription.plan_type === 'pro');

    if (isDowngradeToBasic && insertedSubscription?.id) {
      const caseCount = await getAdvocateCaseCount(admin, user.id);
      if (caseCount > 30) {
        await admin
          .from('subscriptions')
          .update({
            target_plan_type: 'basic',
            downgrade_required: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', insertedSubscription.id);
      }
    }

    return NextResponse.json({
      success: true,
      subscription: {
        planType,
        status: 'active',
        startDate: now.toISOString(),
        endDate: endDate.toISOString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to verify payment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
