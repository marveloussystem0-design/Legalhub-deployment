import { createClient } from "@/lib/supabase/server";
import { CheckCircle, ShieldCheck, UserCog } from "lucide-react";
import UserActions from "./user-actions";

interface Props {
  searchParams: Promise<{ role?: string; status?: string }>;
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { role, status } = await searchParams;

  type UserRow = {
    id: string;
    role: string;
    full_name: string | null;
    email: string | null;
    is_verified: boolean;
    verification_source: 'pro' | 'badge' | 'admin' | 'manual' | null;
    badge_expires_at: string | null;
    created_at: string;
    advocates?: { full_name: string | null }[];
    clients?: { full_name: string | null }[];
  };
  type SubscriptionRow = {
    user_id: string;
    plan_type: 'basic' | 'medium' | 'pro';
    status: 'active' | 'pending' | 'expired' | 'cancelled';
    end_date: string | null;
  };

  // Build filtered query based on URL params
  let query = supabase
    .from('profiles')
    .select(`
      *,
      advocates (full_name),
      clients (full_name)
    `)
    .order('created_at', { ascending: false });

  if (role) {
    query = query.eq('role', role);
  }

  if (status === 'pending') {
    query = query.eq('is_verified', false);
  }

  const { data: users } = await query;
  const userIds = (users || []).map((u: UserRow) => u.id);

  const subscriptionMap = new Map<string, SubscriptionRow>();
  if (userIds.length > 0) {
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('user_id, plan_type, status, end_date')
      .in('user_id', userIds)
      .order('end_date', { ascending: false });

    for (const sub of (subscriptions || []) as SubscriptionRow[]) {
      const existing = subscriptionMap.get(sub.user_id);
      if (!existing) {
        subscriptionMap.set(sub.user_id, sub);
        continue;
      }
      const currentTs = sub.end_date ? new Date(sub.end_date).getTime() : 0;
      const existingTs = existing.end_date ? new Date(existing.end_date).getTime() : 0;
      if (currentTs > existingTs) subscriptionMap.set(sub.user_id, sub);
    }
  }

  // Determine active filter label
  let filterLabel = 'All Users';
  if (role === 'advocate' && status === 'pending') filterLabel = 'Unverified Advocates';
  else if (status === 'pending') filterLabel = 'Pending Verifications';
  else if (role === 'advocate') filterLabel = 'Advocates';
  else if (role === 'client') filterLabel = 'Clients';

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500 mt-1">
            Manage platform access and verification
            {(role || status) && (
              <span className="ml-2 text-xs font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                {filterLabel}
              </span>
            )}
          </p>
        </div>
        
        {/* Filter pills */}
        <div className="flex flex-wrap items-center gap-2">
          <a href="/dashboard/admin/users" className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${!role && !status ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>All</a>
          <a href="/dashboard/admin/users?role=advocate" className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${role === 'advocate' && !status ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>Advocates</a>
          <a href="/dashboard/admin/users?role=client" className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${role === 'client' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>Clients</a>
          <a href="/dashboard/admin/users?status=pending" className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${status === 'pending' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            Pending
          </a>
        </div>
      </div>
      
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
         <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="px-6 py-4 font-semibold text-gray-700">User / Email</th>
                        <th className="px-6 py-4 font-semibold text-gray-700">Role</th>
                        <th className="px-6 py-4 font-semibold text-gray-700">Status</th>
                        <th className="px-6 py-4 font-semibold text-gray-700">Subscription</th>
                        <th className="px-6 py-4 font-semibold text-gray-700">Joined</th>
                        <th className="px-6 py-4 font-semibold text-gray-700 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {(users as UserRow[] | null)?.map((user) => {
                        let displayName = user.full_name || 'Unknown';
                        
                        if (displayName === 'Unknown') {
                             if (user.role === 'advocate' && user.advocates?.[0]) displayName = user.advocates[0].full_name || 'Unknown';
                             else if (user.role === 'client' && user.clients?.[0]) displayName = user.clients[0].full_name || 'Unknown';
                             else if (user.role === 'admin') displayName = 'Administrator';
                        }
                        
                        return (
                            <tr key={user.id} className="hover:bg-gray-50/80 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-gray-900">{displayName}</div>
                                    <div className="text-xs text-gray-500">{user.email}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border capitalize tracking-wide ${
                                        user.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                        user.role === 'advocate' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                        'bg-blue-50 text-blue-700 border-blue-200'
                                    }`}>
                                        {user.role === 'admin' && <ShieldCheck className="h-3 w-3" />}
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    {user.is_verified ? (
                                        <div className="flex flex-col gap-1">
                                            <span className="flex items-center gap-1.5 text-teal-600 text-xs font-bold">
                                                <CheckCircle className="h-3.5 w-3.5" />
                                                Verified
                                            </span>
                                            <span className="text-[11px] text-gray-500 capitalize">
                                                via {user.verification_source || 'admin'}
                                                {user.verification_source === 'badge' && user.badge_expires_at
                                                  ? ` until ${new Date(user.badge_expires_at).toLocaleDateString()}`
                                                  : ''}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="flex items-center gap-1.5 text-amber-600/80 text-xs font-bold">
                                            <UserCog className="h-3.5 w-3.5" />
                                            Pending
                                        </span>
                                    )}
                                </td>
                                {(() => {
                                  const subscription = subscriptionMap.get(user.id);
                                  const now = new Date();
                                  const end = subscription?.end_date ? new Date(subscription.end_date) : null;
                                  const graceEnd = end ? new Date(end) : null;
                                  if (graceEnd) graceEnd.setDate(graceEnd.getDate() + 3);
                                  const effectiveStatus =
                                    subscription?.status === 'active' || subscription?.status === 'pending'
                                      ? end && end < now && graceEnd && graceEnd >= now
                                        ? 'grace'
                                        : subscription.status
                                      : subscription?.status || 'none';
                                  const statusClass =
                                    effectiveStatus === 'active'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : effectiveStatus === 'pending' || effectiveStatus === 'grace'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-gray-100 text-gray-700 border-gray-200';
                                  const planLabel = subscription?.plan_type?.toUpperCase() || 'BASIC';
                                  const subStatus = effectiveStatus;

                                  return (
                                    <td className="px-6 py-4">
                                      <div className="flex flex-col gap-1">
                                        <span className={`inline-flex w-fit items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${statusClass}`}>
                                          {planLabel}
                                        </span>
                                        <span className="text-[11px] text-gray-500 capitalize">{subStatus}</span>
                                      </div>
                                    </td>
                                  );
                                })()}
                                <td className="px-6 py-4 text-gray-500 text-xs font-medium">
                                    {new Date(user.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <UserActions userId={user.id} isVerified={user.is_verified} />
                                </td>
                            </tr>
                        );
                    })}
                    
                    {(!users || users.length === 0) && (
                         <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                No users found matching the current filter.
                            </td>
                         </tr>
                    )}
                </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}
