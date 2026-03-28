import { createClient, createAdminClient } from "@/utils/supabase/server";
import AdvocateSearchGrid from "./advocate-search-grid";
import { deriveVerificationStatus } from "@/lib/verification/access";

type AdvocateRow = {
  user_id: string;
  full_name: string;
  specialization: string[] | null;
  experience_years: number | null;
  profile_photo_url: string | null;
  bio: string | null;
  bar_council_state: string | null;
  is_verified: boolean | null;
  verification_source: 'pro' | 'badge' | 'admin' | 'manual' | null;
  badge_expires_at: string | null;
};

type SubscriptionRow = {
  user_id: string;
  plan_type: 'basic' | 'medium' | 'pro';
  status: string;
  end_date: string | null;
  grace_ends_at: string | null;
};

type CreatedCaseRow = {
  id: string;
  created_by: string | null;
  case_type: string | null;
};

type ParticipantCase = {
  id: string;
  case_type: string | null;
};

type ParticipantCaseRow = {
  user_id: string | null;
  case_id: string;
  cases: ParticipantCase | ParticipantCase[] | null;
};

const firstParticipantCase = (value: ParticipantCaseRow["cases"]): ParticipantCase | null => {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
};

export default async function FindAdvocatePage() {
  const supabase = await createClient();
  const admin = await createAdminClient();

  // 1. Fetch all advocates with profile data (Public RLS)
  const { data: advocates } = await supabase
    .from('advocates')
    .select(`
      user_id,
      full_name,
      specialization,
      experience_years,
      profile_photo_url,
      bio,
      bar_council_state,
      is_verified,
      verification_source,
      badge_expires_at
    `);

  // 2. Fetch case counts from both sources using admin client to bypass RLS:
  //    a) cases.created_by  (eCourts synced — the primary source)
  //    b) case_participants (manually assigned cases)
  const advocateIds = ((advocates as AdvocateRow[] | null) || []).map((adv) => adv.user_id);

  const [casesCreated, casesParticipated, subscriptions] = await Promise.all([
    admin
      .from('cases')
      .select('id, created_by, case_type'),
    admin
      .from('case_participants')
      .select('user_id, case_id, cases(id, case_type)')
      .eq('role', 'advocate'),
    advocateIds.length > 0
      ? admin
          .from('subscriptions')
          .select('user_id, plan_type, status, end_date, grace_ends_at')
          .in('user_id', advocateIds)
          .in('status', ['active', 'pending'])
          .order('end_date', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  // 3. Build per-advocate case maps (deduped by case id)
  const advocateCaseMaps: Record<string, Map<string, string>> = {};

  const ensureMap = (uid: string) => {
    if (!advocateCaseMaps[uid]) advocateCaseMaps[uid] = new Map();
  };

  (casesCreated.data as CreatedCaseRow[] | null)?.forEach((c) => {
    if (!c.created_by) return;
    ensureMap(c.created_by);
    advocateCaseMaps[c.created_by].set(c.id, c.case_type || 'General');
  });

  (casesParticipated.data as ParticipantCaseRow[] | null)?.forEach((p) => {
    const uid = p.user_id;
    const c = firstParticipantCase(p.cases);
    if (!uid || !c) return;
    ensureMap(uid);
    if (!advocateCaseMaps[uid].has(c.id)) {
      advocateCaseMaps[uid].set(c.id, c.case_type || 'General');
    }
  });

  // 4. Build stats map
  const statsMap: Record<string, { total: number; byType: Record<string, number> }> = {};

  Object.entries(advocateCaseMaps).forEach(([uid, caseMap]) => {
    const byType: Record<string, number> = {};
    caseMap.forEach((caseType) => {
      byType[caseType] = (byType[caseType] || 0) + 1;
    });
    statsMap[uid] = { total: caseMap.size, byType };
  });

  const subscriptionMap = new Map<string, { plan_type: 'basic' | 'medium' | 'pro'; status: string; end_date: string | null; grace_ends_at: string | null }>();
  (((subscriptions as { data?: unknown[] | null })?.data || []) as Array<{ user_id: string; plan_type: 'basic' | 'medium' | 'pro'; status: string; end_date: string | null; grace_ends_at: string | null }>).forEach((sub) => {
    if (!subscriptionMap.has(sub.user_id)) {
      subscriptionMap.set(sub.user_id, sub);
    }
  });

  // 5. Merge into advocates
  const advocatesWithStats = ((advocates as AdvocateRow[] | null)?.map((adv) => {
    const sub = subscriptionMap.get(adv.user_id);
    const isVerified = deriveVerificationStatus({
      isVerified: adv.is_verified,
      verificationSource: adv.verification_source,
      badgeExpiresAt: adv.badge_expires_at,
      subscriptionPlan: sub?.plan_type ?? null,
      subscriptionStatus: sub?.status ?? null,
      subscriptionEndDate: sub?.end_date ?? null,
      subscriptionGraceEndsAt: sub?.grace_ends_at ?? null,
    }).isVerified;

    return {
      user_id: adv.user_id,
      full_name: adv.full_name,
      specialization: adv.specialization ?? undefined,
      experience_years: adv.experience_years ?? undefined,
      profile_photo_url: adv.profile_photo_url ?? undefined,
      bio: adv.bio ?? undefined,
      bar_council_state: adv.bar_council_state ?? undefined,
      is_verified: isVerified || undefined,
      subscription_plan: sub?.plan_type ?? 'basic',
      listing_priority: sub?.plan_type === 'pro' ? 3 : sub?.plan_type === 'medium' ? 2 : 1,
      sponsored_label: sub?.plan_type === 'pro' ? 'Best Pick' : sub?.plan_type === 'medium' ? 'Priority' : null,
      stats: statsMap[adv.user_id] || { total: 0, byType: {} },
    };
  }) || []);

  return (
    <div className="py-4">
      <AdvocateSearchGrid initialAdvocates={advocatesWithStats} />
    </div>
  );
}
