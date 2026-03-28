import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { User, Mail, MapPin, Award } from "lucide-react";
import EditProfileForm from "./edit-profile-form";
import Image from "next/image";

export default async function ClientProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Fetch client profile
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', user.id)
    .single();

  const { data: userData } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', user.id)
    .single();

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Profile Card */}
      <div className="lg:col-span-1">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex flex-col items-center text-center">
            {client?.profile_photo_url ? (
              <Image
                src={client.profile_photo_url}
                alt={client.full_name}
                width={128}
                height={128}
                unoptimized
                className="h-32 w-32 rounded-full object-cover mb-4 border-4 border-teal-50"
                style={{ boxShadow: '0 0 0 1px rgba(20, 184, 166, 0.2)' }}
              />
            ) : (
              <div className="p-4 bg-teal-50 rounded-full mb-4 border border-teal-100">
                <User className="h-16 w-16 text-teal-600" />
              </div>
            )}
            <h2 className="text-xl font-bold text-gray-900">{client?.full_name || 'Not Set'}</h2>
            <p className="text-sm text-gray-500 mt-1">{userData?.email}</p>
            <div className="mt-4 px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-xs font-bold uppercase tracking-wider border border-teal-100">
              Litigant
            </div>
            {client?.is_verified && (
              <div className="mt-2 flex items-center gap-1 text-xs text-blue-600 font-medium">
                <Award className="h-3 w-3" />
                Verified
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Details */}
      <div className="lg:col-span-2">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
            <h3 className="text-lg font-bold text-gray-900">Personal Information</h3>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <User className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Full Name</p>
                <p className="text-gray-900 font-semibold">{client?.full_name || 'Not set'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Email</p>
                <p className="text-gray-900 font-semibold">{userData?.email}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">City</p>
                <p className="text-gray-900 font-semibold">{client?.city || 'Not set'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">State</p>
                <p className="text-gray-900 font-semibold">{client?.state || 'Not set'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Pincode</p>
                <p className="text-gray-900 font-semibold">{client?.pincode || 'Not set'}</p>
              </div>
            </div>

          </div>

          {client?.address && (
            <div className="mt-4 flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Address</p>
                <p className="text-gray-900 text-sm">{client.address}</p>
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-100">
            <EditProfileForm client={client} />
          </div>
        </div>
      </div>
    </div>
  );
}
