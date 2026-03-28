'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BadgeCheck, Loader2, Sparkles } from 'lucide-react';
import { loadRazorpayScript } from '@/lib/billing/client-razorpay';

type BadgeOrderResponse = {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string | null;
  badge: {
    label: string;
    amountPaise: number;
    currency: string;
  };
};

export function VerifyBadgeCard() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBuyBadge = async () => {
    try {
      setLoading(true);
      setError(null);

      const scriptReady = await loadRazorpayScript();
      if (!scriptReady || !window.Razorpay) {
        throw new Error('Failed to load Razorpay checkout');
      }

      const orderResponse = await fetch('/api/verification-badge/create-order', {
        method: 'POST',
      });
      const orderPayload = await orderResponse.json();

      if (!orderResponse.ok) {
        throw new Error(orderPayload.error || 'Failed to create verify badge order');
      }

      const order = orderPayload as BadgeOrderResponse;

      const razorpay = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Law App',
        description: `${order.badge.label} purchase`,
        order_id: order.orderId,
        theme: {
          color: '#4f46e5',
        },
        handler: async (response: Record<string, string>) => {
          const verifyResponse = await fetch('/api/verification-badge/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            }),
          });

          const verifyPayload = await verifyResponse.json();
          if (!verifyResponse.ok) {
            throw new Error(verifyPayload.error || 'Failed to activate verify badge');
          }

          router.refresh();
          setLoading(false);
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
      });

      razorpay.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to buy verify badge');
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="p-6 pb-4 border-b border-gray-100">
        <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          Verify Badge
          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs border border-indigo-200 font-medium">
            Add-on
          </span>
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Get a trust badge on your public advocate profile to improve credibility.
        </p>
        <p className="mt-2 text-sm font-semibold text-indigo-700">Rs. 70 / month</p>
      </div>

      <div className="p-6 space-y-4">
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
          <div className="flex items-start gap-3">
            <BadgeCheck className="h-5 w-5 text-indigo-600 mt-0.5" />
            <div className="text-sm text-indigo-900">
              <p className="font-semibold">Why buy this badge?</p>
              <ul className="mt-2 space-y-1 text-xs">
                <li>- Better trust signal in Find Advocate</li>
                <li>- More profile confidence for new clients</li>
                <li>- Stand out from non-badge advocates</li>
              </ul>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleBuyBadge}
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? 'Processing...' : 'Buy Verify Badge'}
        </button>
      </div>
    </div>
  );
}
