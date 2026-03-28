import type { PlanType } from '@/lib/billing/plans';

type VerificationSource = 'pro' | 'badge' | 'admin' | 'manual' | null | undefined;

type VerificationInput = {
  isVerified: boolean | null | undefined;
  verificationSource?: VerificationSource;
  badgeExpiresAt?: string | null;
  subscriptionPlan?: PlanType | null;
  subscriptionStatus?: string | null;
  subscriptionEndDate?: string | null;
  subscriptionGraceEndsAt?: string | null;
};

export type DerivedVerification = {
  isVerified: boolean;
  source: VerificationSource;
  expiresAt: string | null;
};

function addGraceDays(endDate: string | null) {
  if (!endDate) return null;
  const next = new Date(endDate);
  next.setDate(next.getDate() + 3);
  return next.toISOString();
}

export function deriveVerificationStatus(input: VerificationInput): DerivedVerification {
  const source = input.verificationSource ?? null;
  const now = new Date();

  if (source === 'pro') {
    const graceEndsAt = input.subscriptionGraceEndsAt ?? addGraceDays(input.subscriptionEndDate ?? null);
    const planIsValid = input.subscriptionPlan === 'pro'
      && (input.subscriptionStatus === 'active' || input.subscriptionStatus === 'pending')
      && !!graceEndsAt
      && new Date(graceEndsAt) >= now;

    return {
      isVerified: planIsValid,
      source,
      expiresAt: graceEndsAt,
    };
  }

  if (source === 'badge') {
    const badgeValid = !!input.badgeExpiresAt && new Date(input.badgeExpiresAt) >= now;
    return {
      isVerified: badgeValid,
      source,
      expiresAt: input.badgeExpiresAt ?? null,
    };
  }

  return {
    isVerified: Boolean(input.isVerified),
    source,
    expiresAt: null,
  };
}
