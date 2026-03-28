'use client';

import { useState } from 'react';
import { User, Mail, Award, Briefcase, Calendar, FileText, Edit2, BadgeCheck } from "lucide-react";
import EditProfileForm from "./edit-profile-form";
import { VerifyBadgeCard } from "./verify-badge-card";
import { AdvocateVerificationCard } from "./advocate-verification-card";
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type AdvocateProfile = {
  full_name?: string | null;
  profile_photo_url?: string | null;
  bar_council_number?: string | null;
  bar_council_state?: string | null;
  specialization?: string[] | null;
  experience_years?: number | null;
  bio?: string | null;
  is_verified?: boolean | null;
  verification_source?: string | null;
  badge_expires_at?: string | null;
};

type UserProfile = {
  email?: string | null;
};

export default function ProfileContent({
  advocate,
  userData,
  planType,
}: {
  advocate: AdvocateProfile | null,
  userData: UserProfile | null,
  planType: 'basic' | 'medium' | 'pro'
}) {
  const [isEditing, setIsEditing] = useState(false);
  const router = useRouter();

  const handleSuccess = () => {
      setIsEditing(false);
      router.refresh(); // Refresh server data
  };

  if (isEditing) {
      return (
          <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
              <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                  <div>
                      <h1 className="text-2xl font-bold text-gray-900">Edit Profile</h1>
                      <p className="text-gray-500 mt-1">Update your professional details shared with clients.</p>
                  </div>
              </div>
              {/* Form Component - taking full width */}
              <EditProfileForm 
                  advocate={advocate} 
                  onCancel={() => setIsEditing(false)} 
                  onSuccess={handleSuccess} 
              />
          </div>
      );
  }

  return (

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Card (Left Column) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex flex-col items-center text-center">
              {advocate?.profile_photo_url ? (
                <Image
                  src={advocate.profile_photo_url || '/default-avatar.png'}
                  alt={advocate.full_name || 'Advocate'}
                  width={128}
                  height={128}
                  unoptimized
                  className="h-32 w-32 rounded-full object-cover mb-4 border-4 border-teal-100"
                />
              ) : (
                <div className="p-4 bg-teal-50 rounded-full mb-4">
                  <User className="h-16 w-16 text-teal-600" />
                </div>
              )}
              <h2 className="text-xl font-bold text-gray-900">{advocate?.full_name || 'Not Set'}</h2>
              <p className="text-sm text-gray-500 mt-1">{userData?.email}</p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <div className="px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-xs font-medium border border-teal-100">
                  Advocate
                </div>
                {advocate?.is_verified ? (
                  <div className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Verified
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {advocate?.is_verified ? (
            <AdvocateVerificationCard userProfile={advocate} />
          ) : planType === 'pro' ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-amber-900">Verification Included</h3>
              <p className="mt-2 text-sm text-amber-800">
                Your Pro plan includes verification. If this state does not refresh automatically, re-login once and the profile will sync.
              </p>
            </div>
          ) : (
            <VerifyBadgeCard />
          )}
        </div>

        {/* Profile Details (Right Column) */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">Professional Information</h3>
              <button
                onClick={() => setIsEditing(true)}
                className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-sm text-sm"
              >
                <Edit2 className="h-4 w-4" />
                Edit Profile
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <User className="h-5 w-5 text-teal-600 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Full Name</p>
                  <p className="text-gray-900 font-medium">{advocate?.full_name || 'Not set'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <Mail className="h-5 w-5 text-teal-600 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="text-gray-900 font-medium">{userData?.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <Award className="h-5 w-5 text-teal-600 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Bar Council Number</p>
                  <p className="text-gray-900 font-medium">{advocate?.bar_council_number || 'Not set'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <Award className="h-5 w-5 text-teal-600 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Bar Council State</p>
                  <p className="text-gray-900 font-medium">{advocate?.bar_council_state || 'Not set'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <Briefcase className="h-5 w-5 text-teal-600 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Specialization</p>
                  <p className="text-gray-900 font-medium">
                    {advocate?.specialization && advocate.specialization.length > 0
                      ? advocate.specialization.join(', ')
                      : 'Not set'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <Calendar className="h-5 w-5 text-teal-600 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Experience</p>
                  <p className="text-gray-900 font-medium">
                    {advocate?.experience_years ? `${advocate.experience_years} years` : 'Not set'}
                  </p>
                </div>
              </div>
            </div>

            {advocate?.bio && (
              <div className="mt-4 flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <FileText className="h-5 w-5 text-teal-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">Bio</p>
                  <p className="text-gray-700 text-sm">{advocate.bio}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
  );
}
