import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/utils/supabase/server';
import { verifyRazorpaySignature } from '@/lib/billing/razorpay';
import { VERIFY_BADGE_MONTHS } from '@/lib/billing/verify-badge';

type VerifyBadgePayload = {
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
};

export const runtime = 'nodejs';

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
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

    const body = (await req.json()) as VerifyBadgePayload;
    const razorpayOrderId = body.razorpayOrderId || '';
    const razorpayPaymentId = body.razorpayPaymentId || '';
    const razorpaySignature = body.razorpaySignature || '';

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

    const { data: existingPayment } = await admin
      .from('payments')
      .select('id, payment_status')
      .eq('user_id', user.id)
      .eq('razorpay_payment_id', razorpayPaymentId)
      .maybeSingle();

    if (existingPayment?.payment_status === 'success') {
      return NextResponse.json({ success: true, message: 'Verify badge already activated' });
    }

    const nowDate = new Date();
    const now = nowDate.toISOString();
    const badgeExpiresAt = addMonths(nowDate, VERIFY_BADGE_MONTHS).toISOString();

    const { error: paymentUpdateError } = await admin
      .from('payments')
      .update({
        payment_status: 'success',
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature,
        updated_at: now,
      })
      .eq('user_id', user.id)
      .eq('razorpay_order_id', razorpayOrderId);

    if (paymentUpdateError) {
      return NextResponse.json({ error: paymentUpdateError.message }, { status: 500 });
    }

    const [{ error: profilesError }, { error: advocatesError }] = await Promise.all([
      admin
        .from('profiles')
        .update({
          is_verified: true,
          verification_source: 'badge',
          badge_expires_at: badgeExpiresAt,
          updated_at: now,
        })
        .eq('id', user.id),
      admin
        .from('advocates')
        .update({
          is_verified: true,
          verification_source: 'badge',
          badge_expires_at: badgeExpiresAt,
        })
        .eq('user_id', user.id),
    ]);

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    if (advocatesError) {
      return NextResponse.json({ error: advocatesError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Verify badge activated successfully',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to verify badge payment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
