import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield, Users, Settings, LayoutDashboard, Bell, Lightbulb, MessagesSquare } from "lucide-react";
import SignOutButton from "@/components/auth/sign-out-button";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Strict Role Check for Admin
  // 1. Check metadata
  const metaRole = user.user_metadata?.role;
  if (metaRole !== 'admin') {
      // 2. Fallback check public profile
      const { data: publicUser } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (publicUser?.role !== 'admin') {
        // Redirect unauthorized users to their appropriate dashboard
        if (publicUser?.role === 'advocate') redirect('/dashboard/advocate');
        if (publicUser?.role === 'client') redirect('/dashboard/client');
        redirect('/login'); // Fallback
      }
  }

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* Admin Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0 hidden md:flex flex-col shadow-sm overflow-y-auto">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-teal-700 to-teal-600">
          <div className="flex items-center gap-2">
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Admin Panel</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/dashboard/admin" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-teal-50 hover:text-teal-700 rounded-lg transition-colors font-medium">
            <LayoutDashboard className="h-5 w-5" />
            <span>Overview</span>
          </Link>
          <Link href="/dashboard/admin/users" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-teal-50 hover:text-teal-700 rounded-lg transition-colors font-medium">
            <Users className="h-5 w-5" />
            <span>User Management</span>
          </Link>
          <Link href="/dashboard/admin/notifications" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-teal-50 hover:text-teal-700 rounded-lg transition-colors font-medium">
            <Bell className="h-5 w-5" />
            <span>Broadcasts</span>
          </Link>
          <Link href="/dashboard/admin/draft-requests" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-teal-50 hover:text-teal-700 rounded-lg transition-colors font-medium">
            <MessagesSquare className="h-5 w-5" />
            <span>Draft Requests</span>
          </Link>
          <Link href="/dashboard/admin/tips" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-amber-50 hover:text-amber-700 rounded-lg transition-colors font-medium">
            <Lightbulb className="h-5 w-5" />
            <span>Daily Tips</span>
          </Link>
          <Link href="/dashboard/admin/settings" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-teal-50 hover:text-teal-700 rounded-lg transition-colors font-medium">
            <Settings className="h-5 w-5" />
            <span>Settings</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="px-4 py-3 mb-2">
            <div className="text-sm font-medium text-gray-900 mb-1">Admin User</div>
            <div className="text-xs text-gray-600 truncate">{user.email}</div>
          </div>
          <SignOutButton />
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
          <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 md:hidden shadow-sm">
              <span className="font-bold text-gray-900">Admin Panel</span>
               {/* Mobile menu toggle would go here */}
          </header>
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
