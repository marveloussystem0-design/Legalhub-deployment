'use client';

import { useState } from 'react';
import { updateClientProfile } from './actions';
import { Edit2, X, Save, Loader2, Upload, Camera } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type ClientProfile = {
  full_name?: string | null;
  profile_photo_url?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  address?: string | null;
};

export default function EditProfileForm({ client }: { client: ClientProfile | null }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const router = useRouter();

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

        // Get public URL instead of signed URL
        const { data: publicUrlData } = supabase.storage
          .from('case-documents')
          .getPublicUrl(filePath);

        if (publicUrlData?.publicUrl) {
          formData.append('profilePhotoUrl', publicUrlData.publicUrl);
        }
      }

      const result = await updateClientProfile(formData);

      if (result.error) {
        alert('Failed to update profile: ' + result.error);
      } else {
        alert('✅ Profile updated successfully!');
        setIsEditing(false);
        setPhotoFile(null);
        setPhotoPreview(null);
        router.refresh();
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

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="w-full bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all font-semibold shadow-sm hover:shadow active:scale-[0.99]"
      >
        <Edit2 className="h-4 w-4" />
        Edit Profile
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between">
         <h4 className="font-bold text-gray-900 text-lg">Edit Personal Information</h4>
         <button 
            type="button"
            onClick={() => setIsEditing(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
         >
            <X className="h-5 w-5" />
         </button>
      </div>

      {/* Profile Photo Upload */}
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
        {photoPreview || client?.profile_photo_url ? (
          <Image
            src={photoPreview || client?.profile_photo_url || '/default-avatar.png'}
            alt="Profile"
            width={80}
            height={80}
            unoptimized
            className="h-20 w-20 rounded-full object-cover border-4 border-white shadow-sm"
          />
        ) : (
          <div className="h-20 w-20 rounded-full bg-white border-2 border-dashed border-gray-300 flex items-center justify-center">
            <Camera className="h-8 w-8 text-gray-400" />
          </div>
        )}
        <div className="flex-1">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Profile Photo</label>
          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors text-sm font-medium shadow-sm">
            <Upload className="h-4 w-4" />
            {photoFile ? 'Change Photo' : 'Upload Photo'}
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </label>
          {photoFile && (
            <p className="text-xs text-teal-600 mt-2 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-teal-500 rounded-full"></span>
                {photoFile.name}
            </p>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">Full Name <span className="text-red-500">*</span></label>
          <input
            name="fullName"
            defaultValue={client?.full_name || ''}
            required
            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-shadow"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">City</label>
          <input
            name="city"
            defaultValue={client?.city || ''}
            placeholder="e.g., Mumbai"
            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-shadow"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">State</label>
          <input
            name="state"
            defaultValue={client?.state || ''}
            placeholder="e.g., Maharashtra"
            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-shadow"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">Pincode</label>
          <input
            name="pincode"
            defaultValue={client?.pincode || ''}
            placeholder="e.g., 400001"
            maxLength={6}
            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-shadow"
          />
        </div>

      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-gray-700">Address</label>
        <textarea
          name="address"
          rows={3}
          defaultValue={client?.address || ''}
          placeholder="Enter your full address..."
          className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none resize-none transition-shadow"
        />
      </div>

      <div className="flex gap-3 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          disabled={isLoading}
          className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors font-semibold"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg transition-all font-bold shadow-sm hover:shadow flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </form>
  );
}
