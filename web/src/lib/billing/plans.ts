export type PlanType = 'basic' | 'medium' | 'pro';

export type SubscriptionPlan = {
  type: PlanType;
  label: string;
  amountPaise: number;
  currency: 'INR';
  description: string;
  features: string[];
};

export const SUBSCRIPTION_PLANS: Record<PlanType, SubscriptionPlan> = {
  basic: {
    type: 'basic',
    label: 'Basic',
    amountPaise: 49900,
    currency: 'INR',
    description: 'For advocates getting started.',
    features: [
      'Add cases via CNR/manual',
      'Maximum 30 cases',
      'No bulk import',
      'No draft templates',
      'Email support',
    ],
  },
  medium: {
    type: 'medium',
    label: 'Medium',
    amountPaise: 99900,
    currency: 'INR',
    description: 'Recommended for regular practice.',
    features: [
      'Add cases via CNR/manual',
      'Bulk import enabled',
      'Minimal draft templates (enough for day-to-day work)',
      'Prioritized email support',
      'Priority placement in Find Advocate (after Pro)',
    ],
  },
  pro: {
    type: 'pro',
    label: 'Pro',
    amountPaise: 249900,
    currency: 'INR',
    description: 'Premium plan for high-volume advocates.',
    features: [
      'Everything in Medium',
      'Full draft templates unlocked',
      'Custom templates on request',
      'Highest placement in Find Advocate',
      'Fastest support priority',
      'Managed case updates by our team',
    ],
  },
};

export function isPlanType(value: string): value is PlanType {
  return value === 'basic' || value === 'medium' || value === 'pro';
}
