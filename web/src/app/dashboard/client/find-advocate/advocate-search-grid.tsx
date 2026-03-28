'use client';

import { useState } from 'react';
import { Search, Award, ArrowRight, Briefcase, ShieldCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface AdvocateStats {
  total: number;
  byType: Record<string, number>;
}

interface Advocate {
  user_id: string;
  full_name: string;
  specialization?: string[];
  experience_years?: number;
  profile_photo_url?: string;
  bio?: string;
  bar_council_state?: string;
  is_verified?: boolean;
  stats: AdvocateStats;
  subscription_plan?: 'basic' | 'medium' | 'pro';
  listing_priority?: number;
  sponsored_label?: string | null;
}

export default function AdvocateSearchGrid({ initialAdvocates }: { initialAdvocates: Advocate[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpec, setSelectedSpec] = useState('All');
  const [sortBy, setSortBy] = useState('cases');

  const filteredAdvocates = initialAdvocates.filter((adv) => {
    const matchesSearch =
      adv.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      adv.bar_council_state?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSpec =
      selectedSpec === 'All' ||
      adv.specialization?.some((s) => s.toLowerCase() === selectedSpec.toLowerCase());

    return matchesSearch && matchesSpec;
  }).sort((a, b) => {
    const priorityDiff = (b.listing_priority || 0) - (a.listing_priority || 0);
    if (priorityDiff !== 0) return priorityDiff;
    if (sortBy === 'cases') return (b.stats.total || 0) - (a.stats.total || 0);
    if (sortBy === 'experience') return (b.experience_years || 0) - (a.experience_years || 0);
    return 0;
  });

  const specializations = [
    'Criminal', 'Civil', 'Family', 'Corporate', 'Property', 'Tax', 'Immigration', 'IPR', 'Consumer',
  ];

  return (
    <div className="space-y-6">
      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm sticky top-0 z-20">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or state..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 md:pb-0">
          <select
            className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 outline-none focus:border-teal-500 cursor-pointer min-w-[140px]"
            value={selectedSpec}
            onChange={(e) => setSelectedSpec(e.target.value)}
          >
            <option value="All">All Areas</option>
            {specializations.map((s) => (
              <option key={s} value={s}>{s} Law</option>
            ))}
          </select>

          <select
            className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 outline-none focus:border-teal-500 cursor-pointer"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="cases">📊 Most Active</option>
            <option value="experience">🎓 Most Experienced</option>
          </select>
        </div>
      </div>

      {/* Advocates Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAdvocates.map((adv) => {
          // Top 2 case types for this advocate
          const topCaseTypes = Object.entries(adv.stats.byType)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([type]) => type);

          const isPro = adv.subscription_plan === 'pro';
          const isMedium = adv.subscription_plan === 'medium';
          const cardAccent = isPro
            ? 'border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white'
            : isMedium
            ? 'border-teal-200 bg-gradient-to-br from-teal-50/60 via-white to-white'
            : 'border-gray-200 bg-white';

          return (
            <div
              key={adv.user_id}
              className={`border rounded-2xl p-6 hover:shadow-lg transition-all duration-300 group flex flex-col relative overflow-hidden ${cardAccent}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <Image
                    src={
                      adv.profile_photo_url ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(adv.full_name)}&background=0D9488&color=fff`
                    }
                    alt={adv.full_name}
                    width={56}
                    height={56}
                    unoptimized
                    className={`h-14 w-14 rounded-full object-cover border-2 transition-colors flex-shrink-0 ${
                      adv.is_verified
                        ? 'border-sky-300 ring-4 ring-sky-50'
                        : 'border-gray-100 group-hover:border-teal-500'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="min-h-[28px] flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-gray-900 group-hover:text-teal-700 transition-colors leading-tight">
                        {adv.full_name}
                      </h3>
                      {adv.is_verified ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700 shadow-sm">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Verified
                        </span>
                      ) : null}
                      {isPro && adv.sponsored_label ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                          <Sparkles className="h-3.5 w-3.5" />
                          {adv.sponsored_label}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <Award className="h-3 w-3" />
                      {adv.experience_years ? `${adv.experience_years} Yrs Exp.` : 'New Advocate'}
                    </p>
                  </div>
                </div>

                {/* Case count badge */}
                {adv.stats.total > 0 && (
                  <div className="flex flex-col items-end text-teal-600 flex-shrink-0">
                    <span className="text-2xl font-black">{adv.stats.total}</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 text-right">
                      Cases
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-3 mb-5 flex-1">
                {/* Specialization tags from profile */}
                <div className="flex flex-wrap gap-1.5">
                  {adv.specialization?.slice(0, 3).map((s) => (
                    <span
                      key={s}
                      className="px-2.5 py-0.5 bg-gray-50 text-gray-600 text-xs font-medium rounded-full border border-gray-100 uppercase tracking-wide"
                    >
                      {s}
                    </span>
                  ))}
                  {(adv.specialization?.length || 0) > 3 && (
                    <span className="px-2 py-0.5 text-xs text-gray-400">
                      +{adv.specialization!.length - 3} more
                    </span>
                  )}
                </div>

                {/* Top case types from real activity */}
                {topCaseTypes.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Briefcase className="h-3 w-3 text-teal-500 flex-shrink-0" />
                    {topCaseTypes.map((type) => (
                      <span
                        key={type}
                        className="px-2 py-0.5 bg-teal-50 text-teal-700 text-xs font-semibold rounded-full border border-teal-100"
                      >
                        {type}
                      </span>
                    ))}
                    <span className="text-xs text-gray-400">cases handled</span>
                  </div>
                )}

                <p className="text-sm text-gray-500 line-clamp-2">
                  {adv.bio || 'No bio available.'}
                </p>
              </div>

              <Link
                href={`/dashboard/client/find-advocate/${adv.user_id}?name=${encodeURIComponent(adv.full_name)}`}
                className="w-full mt-auto py-2.5 bg-gray-900 hover:bg-teal-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 group-hover:shadow-lg text-sm"
              >
                View Profile
                <ArrowRight className="h-4 w-4 opacity-70 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          );
        })}
      </div>

      {filteredAdvocates.length === 0 && (
        <div className="text-center py-20">
          <div className="bg-gray-50 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="h-8 w-8 text-gray-300" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">No Advocates Found</h3>
          <p className="text-gray-500">Try adjusting your filters or search terms</p>
        </div>
      )}
    </div>
  );
}
