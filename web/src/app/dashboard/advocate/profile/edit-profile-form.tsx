'use client';

import { useState } from 'react';
import { updateAdvocateProfile } from './actions';
import { Save, Loader2, Upload, Camera } from 'lucide-react';
import Image from 'next/image';

type AdvocateProfile = {
  full_name?: string | null;
  profile_photo_url?: string | null;
  bar_council_number?: string | null;
  bar_council_state?: string | null;
  experience_years?: number | null;
  specialization?: string[] | null;
  bio?: string | null;
};

export default function EditProfileForm({ 
  advocate, 
  onCancel, 
  onSuccess 
}: { 
  advocate: AdvocateProfile | null, 
  onCancel: () => void, 
  onSuccess: () => void 
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      
      // Upload photo if selected
      if (photoFile) {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `profile-photos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('case-documents')
          .upload(filePath, photoFile);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from('case-documents')
          .getPublicUrl(filePath);

        if (publicUrlData?.publicUrl) {
          formData.append('profilePhotoUrl', publicUrlData.publicUrl);
        }
      }

      const result = await updateAdvocateProfile(formData);

      if (result.error) {
        alert('Failed to update profile: ' + result.error);
      } else {
        alert('✅ Profile updated successfully!');
        if (onSuccess) onSuccess();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert('Error: ' + message);
    }

    setIsLoading(false);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Profile Photo Upload */}
      <div className="flex items-center gap-8 p-6 bg-teal-50/50 rounded-xl border border-teal-100/50">
        {photoPreview || advocate?.profile_photo_url ? (
          <Image
            src={photoPreview || advocate?.profile_photo_url || '/default-avatar.png'}
            alt="Profile"
            width={96}
            height={96}
            unoptimized
            className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-md"
          />
        ) : (
          <div className="h-24 w-24 rounded-full bg-teal-100 flex items-center justify-center border-4 border-white shadow-md">
            <Camera className="h-8 w-8 text-teal-600" />
          </div>
        )}
        <div className="flex-1">
          <label className="block text-sm font-bold text-gray-900 mb-2">Profile Photo</label>
          <div className="flex items-center gap-3">
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors text-sm font-medium shadow-sm">
                <Upload className="h-4 w-4" />
                {photoFile ? 'Change Photo' : 'Upload New Photo'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
              {photoFile && (
                <span className="text-xs text-teal-700 font-medium bg-teal-50 px-2 py-1 rounded">
                    Selected: {photoFile.name}
                </span>
              )}
          </div>
          <p className="text-xs text-gray-400 mt-2">Recommended: Square JPG or PNG, max 2MB.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Full Name *</label>
          <input
            name="fullName"
            defaultValue={advocate?.full_name || ''}
            required
            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all outline-none shadow-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Bar Council Number</label>
          <input
            name="barCouncilNumber"
            defaultValue={advocate?.bar_council_number || ''}
            placeholder="e.g., D/1234/2020"
            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all outline-none shadow-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Bar Council State</label>
          <input
            name="barCouncilState"
            defaultValue={advocate?.bar_council_state || ''}
            placeholder="e.g., Delhi, Maharashtra"
            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all outline-none shadow-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Experience (Years)</label>
          <input
            name="experienceYears"
            type="number"
            min="0"
            max="70"
            defaultValue={advocate?.experience_years || ''}
            placeholder="e.g., 5"
            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all outline-none shadow-sm"
          />
        </div>
      </div>

      {/* Specialization Checkbox Grid */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-gray-700 block">Specialization Areas</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-5 bg-gray-50 border border-gray-200 rounded-xl">
           {[
               { label: 'Criminal Law', value: 'criminal' },
               { label: 'Civil Law', value: 'civil' },
               { label: 'Family Law', value: 'family' },
               { label: 'Corporate Law', value: 'corporate' },
               { label: 'Property Law', value: 'property' },
               { label: 'Tax Law', value: 'tax' },
               { label: 'Immigration', value: 'immigration' },
               { label: 'Intellectual Property', value: 'ipr' },
               { label: 'Consumer Protection', value: 'consumer' }
           ].map((spec) => {
               const currentSpecs = advocate?.specialization || [];
               const isChecked = currentSpecs.includes(spec.value) || currentSpecs.includes(spec.label);
               
               return (
                   <label key={spec.value} className="flex items-center gap-3 cursor-pointer hover:bg-white p-3 rounded-lg border border-transparent hover:border-gray-200 transition-all group select-none">
                       <div className="relative flex items-center">
                           <input 
                                type="checkbox" 
                                name="specialization"
                                value={spec.value}
                                defaultChecked={isChecked}
                                className="peer h-5 w-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                           />
                       </div>
                       <span className="text-gray-700 text-sm font-medium group-hover:text-teal-700">{spec.label}</span>
                   </label>
               );
           })}
        </div>
        <p className="text-xs text-gray-500 ml-1">Tip: Select all areas you are actively practicing in.</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-700">Professional Bio</label>
        <textarea
          name="bio"
          rows={5}
          defaultValue={advocate?.bio || ''}
          placeholder="Detailed description of your practice, notable cases, and expertise..."
          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all outline-none resize-none shadow-sm"
        />
      </div>

      <div className="flex gap-4 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-6 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-xl transition-colors font-semibold"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-70 text-white px-6 py-3 rounded-xl transition-colors font-bold flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Saving Changes...
            </>
          ) : (
            <>
              <Save className="h-5 w-5" />
              Save Profile Changes
            </>
          )}
        </button>
      </div>
    </form>
  );
}
