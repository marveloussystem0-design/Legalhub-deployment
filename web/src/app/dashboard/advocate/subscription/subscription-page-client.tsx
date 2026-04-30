'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadRazorpayScript } from '@/lib/billing/client-razorpay';

/* ─────────────────────────── types ─────────────────────────── */
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

type PaymentRecord = {
  id: string;
  amount: number | null;
  currency: string | null;
  payment_status: string | null;
  payment_method: string | null;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
  metadata: { plan_type?: string; plan_label?: string } | null;
  created_at: string | null;
};

/* ─────────────────────── style constants ─────────────────────── */
const PLAN_CONFIG: Record<
  PlanType,
  {
    gradient: string;
    badge: string;
    badgeText: string;
    btn: string;
    glow: string;
    icon: string;
    popular: boolean;
  }
> = {
  basic: {
    gradient: 'from-slate-900 via-slate-800 to-slate-900',
    badge: 'bg-slate-700 text-slate-200',
    badgeText: 'Starter',
    btn: 'bg-white text-slate-900 hover:bg-slate-100',
    glow: '',
    icon: '⚡',
    popular: false,
  },
  medium: {
    gradient: 'from-teal-900 via-teal-800 to-emerald-900',
    badge: 'bg-teal-500/30 text-teal-200 border border-teal-500/40',
    badgeText: 'Popular',
    btn: 'bg-teal-400 text-teal-950 hover:bg-teal-300',
    glow: 'ring-2 ring-teal-400/40 shadow-teal-500/20',
    icon: '🚀',
    popular: true,
  },
  pro: {
    gradient: 'from-amber-900 via-yellow-900 to-orange-900',
    badge: 'bg-amber-400/20 text-amber-200 border border-amber-400/40',
    badgeText: 'Pro',
    btn: 'bg-amber-400 text-amber-950 hover:bg-amber-300',
    glow: 'ring-2 ring-amber-400/30 shadow-amber-500/20',
    icon: '👑',
    popular: false,
  },
};

/* ─────────────────────────── helpers ─────────────────────────── */
function formatINR(paise: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getDaysLeft(endDate: string | null): { days: number; label: string; urgent: boolean } {
  if (!endDate) return { days: 0, label: 'No expiry set', urgent: false };
  const diffMs = new Date(endDate).getTime() - Date.now();
  const days = Math.max(0, Math.ceil(diffMs / 86_400_000));
  return {
    days,
    label: days === 0 ? 'Expires today' : `${days} day${days === 1 ? '' : 's'} left`,
    urgent: days <= 7,
  };
}

function statusColor(status: string | null) {
  if (status === 'success') return 'text-emerald-400';
  if (status === 'failed') return 'text-rose-400';
  return 'text-slate-400';
}

function statusLabel(status: string | null) {
  if (status === 'success') return 'Paid';
  if (status === 'failed') return 'Failed';
  return 'Pending';
}

/* ─────────────────────────── toast ─────────────────────────── */
function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-4 shadow-2xl text-sm font-medium animate-slide-up ${
        type === 'success'
          ? 'bg-emerald-900 border border-emerald-600 text-emerald-100'
          : 'bg-rose-900 border border-rose-600 text-rose-100'
      }`}
    >
      <span className="text-lg">{type === 'success' ? '✅' : '❌'}</span>
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100 text-lg leading-none">
        ×
      </button>
    </div>
  );
}

/* ─────────────────────── skeleton loaders ─────────────────────── */
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-white/5 ${className ?? ''}`} />
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-36 w-full rounded-3xl" />
      <div className="grid gap-6 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-96 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
═══════════════════════════════════════════════════════════════ */
export default function SubscriptionPageClient() {
  const router = useRouter();

  const [data, setData] = useState<BillingPayload | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<PlanType | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  /* ── Fetch billing state + payment history ── */
  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        const [billingRes, historyRes] = await Promise.all([
          fetch('/api/billing/current', { cache: 'no-store' }),
          fetch('/api/billing/history', { cache: 'no-store' }),
        ]);

        const billing = await billingRes.json();
        const history = await historyRes.json();

        if (!billingRes.ok) throw new Error(billing.error || 'Failed to load subscription');

        if (active) {
          setData(billing as BillingPayload);
          setPayments((history.payments as PaymentRecord[]) || []);
        }
      } catch (err) {
        if (active) {
          showToast(err instanceof Error ? err.message : 'Failed to load data', 'error');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [showToast]);

  const currentPlan = data?.currentSubscription?.plan_type ?? null;
  const currentPlanLabel = useMemo(
    () => data?.plans.find((p) => p.type === currentPlan)?.label ?? 'No active plan',
    [currentPlan, data?.plans]
  );
  const daysInfo = getDaysLeft(data?.currentSubscription?.end_date ?? null);

  /* ── Handle plan selection → Razorpay checkout ── */
  async function handlePlanAction(planType: PlanType) {
    try {
      setProcessingPlan(planType);

      const scriptReady = await loadRazorpayScript();
      if (!scriptReady || !window.Razorpay) {
        throw new Error('Could not load Razorpay. Check your internet connection.');
      }

      const orderRes = await fetch('/api/billing/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planType }),
      });
      const orderPayload = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderPayload.error || 'Failed to create order');

      const order = orderPayload as RazorpayOrderResponse;

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'LegalHub',
        description: `${order.plan.label} Plan — Monthly`,
        image: '/favicon.ico',
        order_id: order.orderId,
        prefill: {},
        notes: { planType },
        theme: { color: '#0d9488' },
        handler: async (response: Record<string, string>) => {
          try {
            const verifyRes = await fetch('/api/billing/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                planType,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });
            const verifyPayload = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyPayload.error || 'Payment verification failed');

            router.refresh();

            const [freshBilling, freshHistory] = await Promise.all([
              fetch('/api/billing/current', { cache: 'no-store' }).then((r) => r.json()),
              fetch('/api/billing/history', { cache: 'no-store' }).then((r) => r.json()),
            ]);

            setData(freshBilling as BillingPayload);
            setPayments((freshHistory.payments as PaymentRecord[]) || []);
            showToast(`🎉 ${order.plan.label} plan activated successfully!`, 'success');
          } catch (err) {
            showToast(err instanceof Error ? err.message : 'Payment verification failed', 'error');
          } finally {
            setProcessingPlan(null);
          }
        },
        modal: {
          ondismiss: () => setProcessingPlan(null),
        },
      });

      rzp.open();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to process subscription', 'error');
      setProcessingPlan(null);
    }
  }

  /* ── Render ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(1rem); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 0.3s ease-out both; }
      `}</style>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 md:p-10 text-white">
        <div className="max-w-6xl mx-auto space-y-10">

          {/* ── Page header ── */}
          <div className="space-y-1">
            <p className="text-teal-400 text-sm font-semibold tracking-widest uppercase">
              Billing &amp; Plans
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight text-white">
              Manage your subscription
            </h1>
            <p className="text-slate-400 text-base max-w-xl">
              Choose the plan that best fits your practice. All plans are billed monthly via Razorpay.
            </p>
          </div>

          {/* ── Current plan banner ── */}
          <section
            className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-8 shadow-xl"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 to-transparent pointer-events-none" />
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative">
              <div className="space-y-1">
                <p className="text-slate-400 text-sm">Active plan</p>
                <h2 className="text-3xl font-bold text-white">
                  {currentPlanLabel}
                  {currentPlan && (
                    <span className="ml-3 text-sm font-medium uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-full px-3 py-1">
                      Active
                    </span>
                  )}
                </h2>
                {data?.currentSubscription && (
                  <p className="text-slate-400 text-sm">
                    Started {formatDate(data.currentSubscription.start_date)}
                  </p>
                )}
              </div>

              <div className="flex flex-col items-start md:items-end gap-1">
                {data?.currentSubscription?.end_date ? (
                  <>
                    <p className="text-slate-300 text-sm">
                      Renews on{' '}
                      <span className="font-semibold text-white">
                        {formatDate(data.currentSubscription.end_date)}
                      </span>
                    </p>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                        daysInfo.urgent
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {daysInfo.urgent ? '⚠️' : '✅'} {daysInfo.label}
                    </span>
                  </>
                ) : (
                  <p className="text-slate-500 text-sm italic">No active subscription</p>
                )}
              </div>
            </div>
          </section>

          {/* ── Plan cards ── */}
          <section>
            <h2 className="text-xl font-bold text-white mb-6">Choose a plan</h2>
            <div className="grid gap-6 xl:grid-cols-3">
              {(data?.plans ?? []).map((plan) => {
                const cfg = PLAN_CONFIG[plan.type];
                const isCurrent = currentPlan === plan.type;
                const isProcessing = processingPlan === plan.type;
                const actionLabel = isCurrent ? 'Renew plan' : `Switch to ${plan.label}`;

                return (
                  <article
                    key={plan.type}
                    className={`relative rounded-3xl bg-gradient-to-br ${cfg.gradient} p-0.5 shadow-2xl ${cfg.glow} transition-transform duration-200 hover:-translate-y-1`}
                  >
                    {cfg.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                        <span className="bg-teal-400 text-teal-950 text-xs font-bold px-4 py-1 rounded-full shadow-lg uppercase tracking-widest">
                          Most Popular
                        </span>
                      </div>
                    )}

                    <div className="rounded-[calc(1.5rem-2px)] bg-slate-900/80 backdrop-blur p-7 h-full flex flex-col">
                      {/* Plan header */}
                      <div className="flex items-start justify-between mb-6">
                        <div>
                          <span className="text-3xl">{cfg.icon}</span>
                          <h3 className="mt-2 text-2xl font-bold text-white">{plan.label}</h3>
                          <p className="text-slate-400 text-sm mt-1">{plan.description}</p>
                        </div>
                        <span
                          className={`text-xs font-semibold px-3 py-1 rounded-full ${cfg.badge}`}
                        >
                          {isCurrent ? 'Current' : cfg.badgeText}
                        </span>
                      </div>

                      {/* Price */}
                      <div className="mb-6">
                        <p className="text-4xl font-extrabold text-white tracking-tight">
                          {formatINR(plan.amountPaise)}
                        </p>
                        <p className="text-slate-500 text-sm mt-1">per month · billed monthly</p>
                      </div>

                      {/* Features */}
                      <ul className="space-y-3 mb-8 flex-1">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-3 text-sm text-slate-300">
                            <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 text-xs font-bold">
                              ✓
                            </span>
                            {f}
                          </li>
                        ))}
                      </ul>

                      {/* CTA button */}
                      <button
                        id={`subscribe-${plan.type}`}
                        type="button"
                        onClick={() => handlePlanAction(plan.type)}
                        disabled={isProcessing}
                        className={`w-full rounded-2xl py-3.5 text-sm font-bold tracking-wide transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-teal-400 ${cfg.btn}`}
                      >
                        {isProcessing ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4A8 8 0 014 12z" />
                            </svg>
                            Processing…
                          </span>
                        ) : actionLabel}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* ── Payment history ── */}
          {payments.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white">Payment history</h2>
              <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 text-left">
                      <th className="px-6 py-4 font-medium">Date</th>
                      <th className="px-6 py-4 font-medium">Plan</th>
                      <th className="px-6 py-4 font-medium">Amount</th>
                      <th className="px-6 py-4 font-medium">Payment ID</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 text-slate-300">{formatDate(p.created_at)}</td>
                        <td className="px-6 py-4 text-white font-medium capitalize">
                          {p.metadata?.plan_label ?? p.metadata?.plan_type ?? '—'}
                        </td>
                        <td className="px-6 py-4 text-slate-200">
                          {p.amount != null
                            ? new Intl.NumberFormat('en-IN', {
                                style: 'currency',
                                currency: p.currency ?? 'INR',
                                maximumFractionDigits: 0,
                              }).format(p.amount)
                            : '—'}
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-400 text-xs">
                          {p.razorpay_payment_id ?? '—'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`font-semibold ${statusColor(p.payment_status)}`}>
                            {statusLabel(p.payment_status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Footer note ── */}
          <p className="text-center text-slate-600 text-xs pb-4">
            Payments are processed securely by{' '}
            <span className="text-slate-400 font-medium">Razorpay</span>. LegalHub does not store
            your card details.
          </p>
        </div>
      </div>
    </>
  );
}
