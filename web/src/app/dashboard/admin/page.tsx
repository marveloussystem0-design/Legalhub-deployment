import { createClient } from "@/lib/supabase/server";
import { Users, Activity, ShieldCheck, User, Settings, Clock } from "lucide-react";
import Link from "next/link";
import { SystemHealth } from "@/components/admin/system-health";
import CourtDirectory from "@/components/dashboard/court-directory";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [
    { count: totalUsers },
    { count: verifiedAdvocates },
    { count: totalClients },
    { count: activeCases },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'advocate')
      .eq('is_verified', true),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'client'),
    supabase
      .from('cases')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'archived'),
  ]);

  // Fetch pending advocates
  const { count: pendingAdvocates } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'advocate')
    .eq('is_verified', false);

  // Fetch pending clients
  const { count: pendingClients } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'client')
    .eq('is_verified', false);

  // Fallback defaults
  const safeStats = {
    total_users: totalUsers ?? 0,
    active_advocates: verifiedAdvocates ?? 0,
    total_clients: totalClients ?? 0,
    active_cases: activeCases ?? 0,
  };

  const totalPending = (pendingAdvocates ?? 0) + (pendingClients ?? 0);

  const statCards = [
    {
      label: "Total Users",
      value: safeStats.total_users,
      subtext: "All registered accounts",
      icon: User,
      iconColor: "text-blue-600 bg-blue-50",
      href: "/dashboard/admin/users",
      badge: null as string | null,
    },
    {
      label: "Verified Advocates",
      value: safeStats.active_advocates,
      subtext: "Active & verified",
      icon: ShieldCheck,
      iconColor: "text-teal-600 bg-teal-50",
      href: "/dashboard/admin/users?role=advocate",
      badge: null as string | null,
    },
    {
      label: "Total Clients",
      value: safeStats.total_clients,
      subtext: "Registered client accounts",
      icon: Users,
      iconColor: "text-indigo-600 bg-indigo-50",
      href: "/dashboard/admin/users?role=client",
      badge: null as string | null,
    },
    {
      label: totalPending > 0 ? `Unverified (${totalPending})` : "Pending Verifications",
      value: null, // Custom rendering for this card
      isPending: true,
      pendingDetails: [
        { label: 'Advocates', value: pendingAdvocates ?? 0, color: 'text-amber-600' },
        { label: 'Litigants', value: pendingClients ?? 0, color: 'text-blue-600' }
      ],
      subtext: "Awaiting approval",
      icon: Clock,
      iconColor: totalPending > 0 ? "text-amber-600 bg-amber-50" : "text-gray-400 bg-gray-50",
      href: "/dashboard/admin/users?status=pending",
      badge: totalPending > 0 ? "Needs Review" : null as string | null,
    },
  ];

  return (
    <div className="space-y-8 font-sans">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">System Overview</h1>
        <p className="text-gray-500 mt-1">Monitor system health and performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <Link
            key={i}
            href={stat.href}
            className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 group block"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{stat.label}</p>
                {stat.isPending ? (
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    {stat.pendingDetails?.map((detail, idx) => (
                      <div key={idx} className="flex flex-col">
                        <span className={`text-2xl font-bold ${detail.color}`}>{detail.value}</span>
                        <span className="text-[10px] text-gray-400 font-medium uppercase">{detail.label}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                )}
                {!stat.isPending && <p className="text-xs text-gray-400 mt-1 truncate">{stat.subtext}</p>}
              </div>
              <div className={`p-3 rounded-lg ${stat.iconColor} group-hover:scale-110 transition-transform flex-shrink-0 ml-3`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </div>
            {stat.badge && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
                  ● {stat.badge}
                </span>
              </div>
            )}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <SystemHealth />

         {/* Quick Actions */}
         <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Quick Actions</h2>
            <div className="space-y-4">
                <Link
                    href="/dashboard/admin/settings"
                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group"
                >
                    <span className="font-medium text-gray-700 group-hover:text-gray-900">Manage System Settings</span>
                    <Settings className="h-5 w-5 text-gray-400 group-hover:text-gray-600" />
                </Link>
                <Link
                    href="/dashboard/admin/users?status=pending"
                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group"
                >
                    <span className="font-medium text-gray-700 group-hover:text-gray-900">Review Pending Verifications</span>
                    <ShieldCheck className="h-5 w-5 text-gray-400 group-hover:text-gray-600" />
                </Link>
                <Link
                    href="/dashboard/admin/notifications"
                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group"
                >
                    <span className="font-medium text-gray-700 group-hover:text-gray-900">Send Broadcast Notification</span>
                    <Activity className="h-5 w-5 text-gray-400 group-hover:text-gray-600" />
                </Link>
            </div>
         </div>
      </div>
      {/* Court Directory Section */}
      <div className="pt-4">
         <CourtDirectory />
      </div>
    </div>
  );
}
