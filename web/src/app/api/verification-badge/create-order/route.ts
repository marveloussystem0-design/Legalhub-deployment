import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/utils/supabase/server';
import { getRazorpayClient } from '@/lib/billing/razorpay';
import {
  VERIFY_BADGE_CURRENCY,
  VERIFY_BADGE_LABEL,
  VERIFY_BADGE_PRICE_PAISE,
} from '@/lib/billing/verify-badge';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const supabase = await createClient();
    const admin = await createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('role, is_verified')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.role !== 'advocate') {
      return NextResponse.json({ error: 'Only advocates can purchase the verify badge' }, { status: 403 });
    }

    if (profile?.is_verified) {
      return NextResponse.json({ error: 'Advocate is already verified' }, { status: 400 });
    }

    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount: VERIFY_BADGE_PRICE_PAISE,
      currency: VERIFY_BADGE_CURRENCY,
      receipt: `badge_${user.id.slice(0, 8)}_${Date.now()}`,
      notes: {
        userId: user.id,
        purchaseType: 'verify_badge',
      },
    });

    const amountInr = VERIFY_BADGE_PRICE_PAISE / 100;
    const { error: paymentInsertError } = await admin
      .from('payments')
      .insert({
        user_id: user.id,
        amount: amountInr,
        currency: VERIFY_BADGE_CURRENCY,
        payment_type: 'service',
        payment_status: 'pending',
        payment_method: 'razorpay',
        payment_gateway_id: order.id,
        razorpay_order_id: order.id,
        metadata: {
          purchase_type: 'verify_badge',
          purchase_label: VERIFY_BADGE_LABEL,
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
      badge: {
        label: VERIFY_BADGE_LABEL,
        amountPaise: VERIFY_BADGE_PRICE_PAISE,
        currency: VERIFY_BADGE_CURRENCY,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create verify badge order';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
