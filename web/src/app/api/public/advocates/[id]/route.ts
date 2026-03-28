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
  bar_council_number: string | null;
  verification_source: 'pro' | 'badge' | 'admin' | 'manual' | null;
  badge_expires_at: string | null;
};

type CreatedCaseRow = {
  id: string;
  case_type: string | null;
};

type ParticipantCase = {
  id: string;
  case_type: string | null;
};

type ParticipantCaseRow = {
  case_id: string;
  cases: ParticipantCase | ParticipantCase[] | null;
};

const firstCase = (value: ParticipantCaseRow['cases']): ParticipantCase | null => {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
};

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const advocateId = params.id;
    if (!advocateId) {
      return NextResponse.json({ error: 'Missing advocate id' }, { status: 400 });
    }

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

    const { data: advocate, error: advocateError } = await admin
        .from('advocates')
        .select(
          'user_id, full_name, specialization, experience_years, profile_photo_url, bio, bar_council_state, is_verified, bar_council_number, verification_source, badge_expires_at'
        )
        .eq('user_id', advocateId)
        .maybeSingle();

    if (advocateError) {
      return NextResponse.json({ error: advocateError.message }, { status: 500 });
    }
    if (!advocate) {
      return NextResponse.json({ error: 'Advocate not found' }, { status: 404 });
    }

    const [createdResult, participantResult, subscriptionResult] = await Promise.all([
      admin
        .from('cases')
        .select('id, case_type')
        .eq('created_by', advocateId),
      admin
        .from('case_participants')
        .select('case_id, cases(id, case_type)')
        .eq('user_id', advocateId)
        .eq('role', 'advocate'),
      admin
        .from('subscriptions')
        .select('plan_type, status, end_date, grace_ends_at')
        .eq('user_id', advocateId)
        .in('status', ['active', 'pending'])
        .order('end_date', { ascending: false })
        .limit(1)
    ]);

    const caseMap = new Map<string, string>();

    for (const c of ((createdResult.data || []) as CreatedCaseRow[])) {
      caseMap.set(c.id, c.case_type || 'General');
    }

    for (const p of ((participantResult.data || []) as ParticipantCaseRow[])) {
      const c = firstCase(p.cases);
      if (c && !caseMap.has(c.id)) {
        caseMap.set(c.id, c.case_type || 'General');
      }
    }

    const byType: Record<string, number> = {};
    caseMap.forEach((caseType) => {
      byType[caseType] = (byType[caseType] || 0) + 1;
    });

    const normalized = advocate as AdvocateRow;
    const currentSubscription = ((subscriptionResult.data || [])[0] || null) as {
      plan_type: 'basic' | 'medium' | 'pro';
      status: string;
      end_date: string | null;
      grace_ends_at: string | null;
    } | null;
    const derivedVerification = deriveVerificationStatus({
      isVerified: normalized.is_verified,
      verificationSource: normalized.verification_source,
      badgeExpiresAt: normalized.badge_expires_at,
      subscriptionPlan: currentSubscription?.plan_type ?? null,
      subscriptionStatus: currentSubscription?.status ?? null,
      subscriptionEndDate: currentSubscription?.end_date ?? null,
      subscriptionGraceEndsAt: currentSubscription?.grace_ends_at ?? null,
    });

    return NextResponse.json({
      advocate: {
        ...normalized,
        is_verified: derivedVerification.isVerified,
        // Keep mobile response-compatible keys.
        languages: null,
        bar_registration_number: normalized.bar_council_number || null,
        stats: {
          total: caseMap.size,
          byType
        }
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load advocate';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
