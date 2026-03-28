import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { deriveVerificationStatus } from '@/lib/verification/access';

type AdvocateRow = {
  user_id: string;
  full_name: string | null;
  specialization: string[] | null;
  experience_years: number | null;
  profile_photo_url: string | null;
  bio: string | null;
  bar_council_state: string | null;
  is_verified: boolean | null;
  verification_source: 'pro' | 'badge' | 'admin' | 'manual' | null;
  badge_expires_at: string | null;
};

type CreatedCaseRow = {
  id: string;
  created_by: string;
  case_type: string | null;
};

type ParticipantCase = {
  id: string;
  case_type: string | null;
};

type ParticipantCaseRow = {
  user_id: string;
  cases: ParticipantCase | ParticipantCase[] | null;
};

type SubscriptionRow = {
  user_id: string;
  plan_type: 'basic' | 'medium' | 'pro';
  status: 'active' | 'pending' | 'expired' | 'cancelled';
  end_date: string | null;
};

const firstCase = (value: ParticipantCaseRow['cases']): ParticipantCase | null => {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
};

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const admin = await createAdminClient();

    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const user = token
      ? (await supabase.auth.getUser(token)).data.user
      : (await supabase.auth.getUser()).data.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: advocates, error: advocateError } = await admin
        .from('advocates')
        .select(
          'user_id, full_name, specialization, experience_years, profile_photo_url, bio, bar_council_state, is_verified, verification_source, badge_expires_at'
        );

    if (advocateError) {
      return NextResponse.json({ error: advocateError.message }, { status: 500 });
    }

    const list = (advocates || []) as AdvocateRow[];
    const ids = list.map((a) => a.user_id);
    if (ids.length === 0) return NextResponse.json({ advocates: [] });

    const [createdResult, participantResult, subscriptionResult] = await Promise.all([
      admin
        .from('cases')
        .select('id, created_by, case_type')
        .in('created_by', ids),
      admin
        .from('case_participants')
        .select('user_id, cases(id, case_type)')
        .in('user_id', ids)
        .eq('role', 'advocate'),
      admin
        .from('subscriptions')
        .select('user_id, plan_type, status, end_date')
        .in('user_id', ids)
        .order('end_date', { ascending: false })
    ]);

    const planMap = new Map<string, 'basic' | 'medium' | 'pro'>();
    const now = new Date();
    for (const sub of ((subscriptionResult.data || []) as SubscriptionRow[])) {
      if (planMap.has(sub.user_id)) continue;
      if (!(sub.status === 'active' || sub.status === 'pending')) continue;
      if (!sub.end_date) continue;

      const endDate = new Date(sub.end_date);
      const graceEnd = new Date(endDate);
      graceEnd.setDate(graceEnd.getDate() + 3);
      if (graceEnd >= now) {
        planMap.set(sub.user_id, sub.plan_type);
      }
    }

    const priorityOf = (plan: 'basic' | 'medium' | 'pro') =>
      plan === 'pro' ? 3 : plan === 'medium' ? 2 : 1;

    const caseMapByAdvocate = new Map<string, Map<string, string>>();

    for (const row of ((createdResult.data || []) as CreatedCaseRow[])) {
      const current = caseMapByAdvocate.get(row.created_by) || new Map<string, string>();
      current.set(row.id, row.case_type || 'General');
      caseMapByAdvocate.set(row.created_by, current);
    }

    for (const row of ((participantResult.data || []) as ParticipantCaseRow[])) {
      const c = firstCase(row.cases);
      if (!c) continue;
      const current = caseMapByAdvocate.get(row.user_id) || new Map<string, string>();
      if (!current.has(c.id)) current.set(c.id, c.case_type || 'General');
      caseMapByAdvocate.set(row.user_id, current);
    }

    const payload = list.map((a) => {
      const cases = caseMapByAdvocate.get(a.user_id) || new Map<string, string>();
      const byType: Record<string, number> = {};
      cases.forEach((caseType) => {
        byType[caseType] = (byType[caseType] || 0) + 1;
      });
      const plan = planMap.get(a.user_id) || 'basic';
      const derivedVerification = deriveVerificationStatus({
        isVerified: a.is_verified,
        verificationSource: a.verification_source,
        badgeExpiresAt: a.badge_expires_at,
        subscriptionPlan: plan,
        subscriptionStatus: planMap.has(a.user_id) ? 'active' : 'expired',
        subscriptionEndDate: ((subscriptionResult.data || []) as SubscriptionRow[]).find((sub) => sub.user_id === a.user_id)?.end_date ?? null,
      });

      return {
        ...a,
        is_verified: derivedVerification.isVerified,
        listing_priority: priorityOf(plan),
        subscription_plan: plan,
        sponsored_label: plan === 'pro' ? 'Best Pick' : plan === 'medium' ? 'Priority' : null,
        stats: {
          total: cases.size,
          byType
        }
      };
    });

    payload.sort((a, b) => {
      if (b.listing_priority !== a.listing_priority) return b.listing_priority - a.listing_priority;
      const aExp = a.experience_years || 0;
      const bExp = b.experience_years || 0;
      return bExp - aExp;
    });

    return NextResponse.json({ advocates: payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load advocates';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
