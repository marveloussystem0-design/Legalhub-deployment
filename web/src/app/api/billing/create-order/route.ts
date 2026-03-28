import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/utils/supabase/server';
import { isPlanType, SUBSCRIPTION_PLANS } from '@/lib/billing/plans';
import { getRazorpayClient } from '@/lib/billing/razorpay';

export const runtime = 'nodejs';

type CreateOrderPayload = {
  planType?: string;
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const admin = await createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as CreateOrderPayload;
    const planType = body.planType || '';

    if (!isPlanType(planType)) {
      return NextResponse.json({ error: 'Invalid plan type' }, { status: 400 });
    }

    const plan = SUBSCRIPTION_PLANS[planType];
    const razorpay = getRazorpayClient();

    const order = await razorpay.orders.create({
      amount: plan.amountPaise,
      currency: plan.currency,
      receipt: `sub_${user.id.slice(0, 8)}_${Date.now()}`,
      notes: {
        userId: user.id,
        planType,
      },
    });

    const amountInr = plan.amountPaise / 100;
    const { error: paymentInsertError } = await admin
      .from('payments')
      .insert({
        user_id: user.id,
        amount: amountInr,
        currency: plan.currency,
        payment_type: 'subscription',
        payment_status: 'pending',
        payment_method: 'razorpay',
        payment_gateway_id: order.id,
        razorpay_order_id: order.id,
        metadata: {
          plan_type: planType,
          plan_label: plan.label,
        },
      });

    if (paymentInsertError) {
      return NextResponse.json({ error: paymentInsertError.message }, { status: 500 });
    }

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      plan,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create Razorpay order';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
