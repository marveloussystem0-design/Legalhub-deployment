import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NotificationsPopover from "@/components/dashboard/notifications-popover";
import HeaderTitle from "@/components/dashboard/header-title";
import DashboardSidebar from "@/components/dashboard/sidebar";
import Link from "next/link";

const clientNavItems = [
  { href: "/dashboard/client", label: "Dashboard", icon: "LayoutDashboard", category: "Main Menu" },
  { href: "/dashboard/client/cases", label: "My Cases", icon: "Gavel", category: "Main Menu" },
  { href: "/dashboard/client/find-advocate", label: "Find Advocate", icon: "Search", category: "Main Menu" },
  { href: "/dashboard/client/messages", label: "Messages", icon: "MessageSquare", category: "Main Menu" },
  { href: "/dashboard/client/profile", label: "Profile", icon: "User", category: "Main Menu" },
];

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const metaRole = user.user_metadata?.role;
  if (metaRole !== 'client') {
    const { data: publicUser } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (publicUser?.role !== 'client') {
      if (publicUser?.role === 'advocate') redirect('/dashboard/advocate');
      if (publicUser?.role === 'admin') redirect('/dashboard/admin');
      redirect('/login');
    }
  }

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50 text-gray-900 font-sans">
      <DashboardSidebar
        items={clientNavItems}
        branding={{ title: "Litigant Portal", icon: "Briefcase" }}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gray-50">
        <header className="px-6 py-4 bg-white border-b border-gray-200 flex items-center shadow-sm z-40 sticky top-0">
          <HeaderTitle />
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <NotificationsPopover />
            <Link href="/dashboard/client/profile">
              <div className="h-9 w-9 bg-teal-100 rounded-full flex items-center justify-center text-teal-700 font-bold hover:bg-teal-200 transition-colors cursor-pointer">
                {user.email?.[0].toUpperCase()}
              </div>
            </Link>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8 relative">
          {children}
        </div>
      </main>
    </div>
  );
}
