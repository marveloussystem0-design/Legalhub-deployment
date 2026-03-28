'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadRazorpayScript } from '@/lib/billing/client-razorpay';

type PlanType = 'basic' | 'medium' | 'pro';

type SubscriptionPlan = {
  type: PlanType;
  label: string;
  amountPaise: number;
  currency: 'INR';
  description: string;
  features: string[];
};

type CurrentSubscription = {
  id: string;
  plan_type: PlanType;
  status: string;
  start_date: string | null;
  end_date: string | null;
  amount: number | null;
  currency: string | null;
};

type BillingPayload = {
  plans: SubscriptionPlan[];
  currentSubscription: CurrentSubscription | null;
  razorpayKeyId: string | null;
};

type RazorpayOrderResponse = {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string | null;
  plan: SubscriptionPlan;
};

const planStyles: Record<PlanType, { card: string; badge: string; button: string }> = {
  basic: {
    card: 'border-slate-200 bg-white',
    badge: 'bg-slate-100 text-slate-700',
    button: 'bg-slate-900 hover:bg-slate-800 text-white',
  },
  medium: {
    card: 'border-teal-200 bg-teal-50/40',
    badge: 'bg-teal-100 text-teal-800',
    button: 'bg-teal-600 hover:bg-teal-700 text-white',
  },
  pro: {
    card: 'border-amber-200 bg-amber-50/60',
    badge: 'bg-amber-100 text-amber-800',
    button: 'bg-amber-500 hover:bg-amber-600 text-white',
  },
};

function formatPrice(amountPaise: number) {
  return `Rs. ${(amountPaise / 100).toLocaleString('en-IN')}`;
}

function formatDate(value: string | null) {
  if (!value) return 'Not available';
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getDaysLeft(endDate: string | null) {
  if (!endDate) return 'No renewal date';
  const now = new Date();
  const end = new Date(endDate);
  const diffMs = end.getTime() - now.getTime();
  const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  return `${diffDays} day${diffDays === 1 ? '' : 's'} left`;
}

export default function SubscriptionPageClient() {
  const router = useRouter();
  const [data, setData] = useState<BillingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingPlan, setProcessingPlan] = useState<PlanType | null>(null);

  useEffect(() => {
    let active = true;

    async function loadBillingState() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/billing/current', { cache: 'no-store' });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load subscription details');
        }

        if (active) {
          setData(payload as BillingPayload);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load subscription details');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadBillingState();
    return () => {
      active = false;
    };
  }, []);

  const currentPlan = data?.currentSubscription?.plan_type ?? null;

  const currentPlanLabel = useMemo(() => {
    return data?.plans.find((plan) => plan.type === currentPlan)?.label ?? 'No plan';
  }, [currentPlan, data?.plans]);

  async function handlePlanAction(planType: PlanType) {
    try {
      setProcessingPlan(planType);
      setError(null);

      const scriptReady = await loadRazorpayScript();
      if (!scriptReady || !window.Razorpay) {
        throw new Error('Failed to load Razorpay checkout');
      }

      const orderResponse = await fetch('/api/billing/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planType }),
      });

      const orderPayload = await orderResponse.json();
      if (!orderResponse.ok) {
        throw new Error(orderPayload.error || 'Failed to create order');
      }

      const order = orderPayload as RazorpayOrderResponse;

      const razorpay = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Law App',
        description: `${order.plan.label} subscription`,
        order_id: order.orderId,
        prefill: {},
        notes: {
          planType,
        },
        theme: {
          color: '#0f766e',
        },
        handler: async (response: Record<string, string>) => {
          const verifyResponse = await fetch('/api/billing/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              planType,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            }),
          });

          const verifyPayload = await verifyResponse.json();
          if (!verifyResponse.ok) {
            throw new Error(verifyPayload.error || 'Payment verification failed');
          }

          router.refresh();

          const refreshResponse = await fetch('/api/billing/current', { cache: 'no-store' });
          const refreshPayload = await refreshResponse.json();
          if (!refreshResponse.ok) {
            throw new Error(refreshPayload.error || 'Failed to refresh subscription');
          }

          setData(refreshPayload as BillingPayload);
          setProcessingPlan(null);
        },
        modal: {
          ondismiss: () => {
            setProcessingPlan(null);
          },
        },
      });

      razorpay.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process subscription');
      setProcessingPlan(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">Subscription</h1>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
          Loading subscription details...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold text-slate-900">Subscription</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Renew the current plan or move to a different plan from here. Billing remains advocate-only.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Current subscription</p>
            <h2 className="text-2xl font-bold text-slate-900">{currentPlanLabel}</h2>
          </div>
          <div className="text-sm text-slate-600">
            <p>Ends on {formatDate(data?.currentSubscription?.end_date ?? null)}</p>
            <p>{getDaysLeft(data?.currentSubscription?.end_date ?? null)}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        {(data?.plans || []).map((plan) => {
          const styles = planStyles[plan.type];
          const isCurrent = currentPlan === plan.type;
          const isProcessing = processingPlan === plan.type;
          const actionLabel = isCurrent ? 'Renew plan' : `Switch to ${plan.label}`;

          return (
            <article
              key={plan.type}
              className={`rounded-3xl border p-6 shadow-sm ${styles.card}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">{plan.label}</h3>
                  <p className="mt-2 text-sm text-slate-600">{plan.description}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${styles.badge}`}>
                  {isCurrent ? 'Current' : plan.type}
                </span>
              </div>

              <div className="mt-6">
                <p className="text-3xl font-bold text-slate-900">{formatPrice(plan.amountPaise)}</p>
                <p className="mt-1 text-sm text-slate-500">per month</p>
              </div>

              <ul className="mt-6 space-y-3 text-sm text-slate-700">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-current opacity-70" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => handlePlanAction(plan.type)}
                disabled={isProcessing}
                className={`mt-8 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${styles.button}`}
              >
                {isProcessing ? 'Processing...' : actionLabel}
              </button>
            </article>
          );
        })}
      </section>
    </div>
  );
}
