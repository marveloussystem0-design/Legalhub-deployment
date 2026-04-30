import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/utils/supabase/server';
import { isPlanType, SUBSCRIPTION_PLANS } from '@/lib/billing/plans';

export const runtime = 'nodejs';

/** Razorpay sends webhooks signed with HMAC-SHA256 over the raw body. */
function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return expected === signature;
}

function addOneMonth(date: Date) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
}

export async function POST(req: Request) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      // Not configured — skip silently so local dev isn't broken
      return NextResponse.json({ received: true });
    }

    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature') || '';

    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }

    const event = JSON.parse(rawBody) as {
      event: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            amount?: number;
            currency?: string;
            notes?: { userId?: string; planType?: string };
          };
        };
      };
    };

    if (event.event !== 'payment.captured') {
      return NextResponse.json({ received: true });
    }

    const entity = event.payload?.payment?.entity;
    if (!entity?.id || !entity.order_id || !entity.notes) {
      return NextResponse.json({ error: 'Missing payment entity data' }, { status: 400 });
    }

    const { userId, planType } = entity.notes;
    if (!userId || !planType || !isPlanType(planType)) {
      return NextResponse.json({ error: 'Invalid notes payload' }, { status: 400 });
    }

    const admin = await createAdminClient();

    // Idempotency — check if this payment was already processed
    const { data: existing } = await admin
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('razorpay_payment_id', entity.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ received: true });
    }

    const plan = SUBSCRIPTION_PLANS[planType];
    const amountInr = (entity.amount ?? plan.amountPaise) / 100;
    const now = new Date();
    const endDate = addOneMonth(now);
    const graceEndsAt = new Date(endDate);
    graceEndsAt.setDate(graceEndsAt.getDate() + 3);

    // Mark payment as success
    await admin
      .from('payments')
      .update({
        payment_status: 'success',
        razorpay_payment_id: entity.id,
        updated_at: now.toISOString(),
      })
      .eq('user_id', userId)
      .eq('razorpay_order_id', entity.order_id);

    // Cancel any existing active subscriptions
    await admin
      .from('subscriptions')
      .update({
        status: 'cancelled',
        effective_status: 'expired',
        updated_at: now.toISOString(),
      })
      .eq('user_id', userId)
      .eq('status', 'active');

    // Insert new subscription
    await admin.from('subscriptions').insert({
      user_id: userId,
      plan_type: planType,
      status: 'active',
      start_date: now.toISOString(),
      end_date: endDate.toISOString(),
      grace_ends_at: graceEndsAt.toISOString(),
      effective_status: 'active',
      billing_cycle: 'monthly',
      amount: amountInr,
      currency: plan.currency,
      razorpay_order_id: entity.order_id,
      razorpay_payment_id: entity.id,
      target_plan_type: null,
      downgrade_required: false,
      updated_at: now.toISOString(),
    });

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Webhook error';
    console.error('[razorpay-webhook]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
