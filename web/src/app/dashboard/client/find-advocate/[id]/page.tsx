import { createClient, createAdminClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import { Briefcase, CheckCircle, MapPin, MessageSquare, Shield, TrendingUp } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
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

const firstParticipantCase = (value: ParticipantCaseRow["cases"]): ParticipantCase | null => {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
};

export default async function AdvocatePublicProfile(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const admin = await createAdminClient();

  const advocateId = params.id;
  if (!advocateId) return notFound();

  // 1. Fetch Advocate Details
  const { data: advocate, error: advError } = await supabase
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
    `)
    .eq('user_id', advocateId)
    .single();

  if (advError || !advocate) return notFound();

  // 2. Fetch ALL cases this advocate created (eCourts synced cases use created_by)
  //    AND cases they are a participant in — union both to avoid missing any
  //    Using admin client to bypass RLS since clients cannot view case details globally.
  const [casesCreated, casesParticipated, subscriptions] = await Promise.all([
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
      .limit(1),
  ]);

  // 3. Merge both sources, deduplicating by case id
  const caseMap = new Map<string, string>();

  (casesCreated.data as CreatedCaseRow[] | null)?.forEach((c) => {
    caseMap.set(c.id, c.case_type || 'General');
  });

  (casesParticipated.data as ParticipantCaseRow[] | null)?.forEach((p) => {
    const c = firstParticipantCase(p.cases);
    if (c && !caseMap.has(c.id)) {
      caseMap.set(c.id, c.case_type || 'General');
    }
  });

  // 4. Aggregate counts by type
  const typeCounts: Record<string, number> = {};
  caseMap.forEach((caseType) => {
    typeCounts[caseType] = (typeCounts[caseType] || 0) + 1;
  });

  const totalCases = caseMap.size;
  const specBreakdown = Object.entries(typeCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const advocateDataRaw = advocate as AdvocateRow;
  const currentSubscription = ((subscriptions.data || [])[0] || null) as {
    plan_type: 'basic' | 'medium' | 'pro';
    status: string;
    end_date: string | null;
    grace_ends_at: string | null;
  } | null;
  const advocateData = {
    ...advocateDataRaw,
    is_verified: deriveVerificationStatus({
      isVerified: advocateDataRaw.is_verified,
      verificationSource: advocateDataRaw.verification_source,
      badgeExpiresAt: advocateDataRaw.badge_expires_at,
      subscriptionPlan: currentSubscription?.plan_type ?? null,
      subscriptionStatus: currentSubscription?.status ?? null,
      subscriptionEndDate: currentSubscription?.end_date ?? null,
      subscriptionGraceEndsAt: currentSubscription?.grace_ends_at ?? null,
    }).isVerified,
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Card */}
      <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-50 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
          <Image
            src={advocateData.profile_photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(advocateData.full_name)}&background=0D9488&color=fff`}
            alt={advocateData.full_name}
            width={128}
            height={128}
            unoptimized
            className="h-32 w-32 rounded-2xl object-cover shadow-lg border-4 border-white"
          />

          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-gray-900">{advocateData.full_name}</h1>
              {advocateData.is_verified && (
                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1 font-bold border border-blue-200">
                  <Shield className="h-3 w-3 fill-current" /> Verified
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 text-gray-600 text-sm">
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4 text-gray-400" />
                {advocateData.bar_council_state || 'India'}
              </span>
              <span className="flex items-center gap-1">
                <Briefcase className="h-4 w-4 text-gray-400" />
                {advocateData.experience_years} Years Experience
              </span>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              {advocateData.specialization?.map((s: string) => (
                <span key={s} className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full border border-gray-200">
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full md:w-auto">
            <Link
              href={`/dashboard/client/messages?recipientId=${advocateData.user_id}`}
              className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95"
            >
              <MessageSquare className="h-5 w-5" />
              Connect Now
            </Link>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-teal-900 to-teal-800 rounded-2xl p-6 text-white text-center shadow-lg">
              <p className="text-teal-200 text-sm font-medium uppercase tracking-wider mb-1">Total Experience</p>
              <div className="text-5xl font-black text-white flex items-center justify-center gap-2">
                {advocateData.experience_years}
                <span className="text-2xl font-bold text-teal-400">Yrs</span>
              </div>
              <p className="text-teal-200 text-xs mt-2">Professional Practice</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col justify-center items-center">
              <div className="h-12 w-12 bg-teal-50 rounded-full flex items-center justify-center mb-3">
                <Briefcase className="h-6 w-6 text-teal-600" />
              </div>
              <div className="text-3xl font-bold text-gray-900">{totalCases}</div>
              <div className="text-sm text-gray-500 font-medium">Cases on Platform</div>
            </div>
          </div>

          {/* Case Type Breakdown */}
          {specBreakdown.length > 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-teal-600" />
                Cases by Type
              </h3>
              <div className="space-y-4">
                {specBreakdown.map((spec) => (
                  <div key={spec.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700 capitalize">{spec.name}</span>
                      <span className="font-bold text-gray-900">{spec.count} {spec.count === 1 ? 'Case' : 'Cases'}</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full transition-all duration-700"
                        style={{ width: `${Math.round((spec.count / totalCases) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 shadow-sm text-center">
              <Briefcase className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No cases recorded on platform yet.</p>
            </div>
          )}

          {/* Bio */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">About the Advocate</h3>
            <p className="text-gray-600 leading-relaxed whitespace-pre-line">
              {advocateData.bio || "No biography provided."}
            </p>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-teal-50 border border-teal-100 rounded-2xl p-6">
            <h3 className="font-bold text-teal-900 mb-2">Why hire {advocateData.full_name}?</h3>
            <ul className="space-y-3 mt-4">
              {(advocateData.experience_years ?? 0) > 0 && (
                <li className="flex items-start gap-2 text-sm text-teal-800">
                  <CheckCircle className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" />
                  <span>{advocateData.experience_years}+ years of professional practice</span>
                </li>
              )}
              {advocateData.is_verified && (
                <li className="flex items-start gap-2 text-sm text-teal-800">
                  <CheckCircle className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" />
                  <span>Verified Advocate</span>
                </li>
              )}
              {advocateData.specialization?.slice(0, 2).map((s: string) => (
                <li key={s} className="flex items-start gap-2 text-sm text-teal-800">
                  <CheckCircle className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" />
                  <span>Practices {s} Law</span>
                </li>
              ))}
              {totalCases > 0 && (
                <li className="flex items-start gap-2 text-sm text-teal-800">
                  <CheckCircle className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" />
                  <span>{totalCases} case{totalCases !== 1 ? 's' : ''} on this platform</span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
