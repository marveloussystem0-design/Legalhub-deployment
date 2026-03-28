import { createClient } from '@/lib/supabase/server'
import { getEffectiveSubscription } from '@/lib/billing/access'
import type { PlanType } from '@/lib/billing/plans'
import { redirect } from 'next/navigation'
import NotificationsPopover from '@/components/dashboard/notifications-popover'
import HeaderTitle from '@/components/dashboard/header-title'
import DashboardSidebar from '@/components/dashboard/sidebar'
import Link from 'next/link'

const advocateNavItems = [
  { href: "/dashboard/advocate", label: "Dashboard", icon: "Home", category: "Practice Management" },
  { href: "/dashboard/advocate/cases", label: "My Cases", icon: "Gavel", category: "Practice Management" },
  { href: "/dashboard/advocate/clients", label: "Clients", icon: "Users", category: "Practice Management" },
  { href: "/dashboard/advocate/draft", label: "Draft", icon: "FilePen", category: "Practice Management" },
  { href: "/dashboard/advocate/messages", label: "Messages", icon: "MessageSquare", category: "Practice Management" },
  { href: "/dashboard/advocate/profile", label: "My Profile", icon: "User", category: "Other" },
];

function getSubscriptionSummary(expiresAt: string | null) {
  if (!expiresAt) {
    return 'no end date';
  }

  const now = new Date();
  const endDate = new Date(expiresAt);
  const diffMs = endDate.getTime() - now.getTime();
  const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  return `ending in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
}

function getSubscriptionChipClasses(plan: PlanType) {
  if (plan === 'pro') {
    return {
      container: 'border-amber-200 bg-amber-50 text-amber-950',
      summary: 'text-amber-700',
    };
  }

  if (plan === 'medium') {
    return {
      container: 'border-teal-200 bg-teal-50 text-teal-900',
      summary: 'text-teal-700',
    };
  }

  return {
    container: 'border-slate-200 bg-slate-50 text-slate-900',
    summary: 'text-slate-600',
  };
}

export default async function AdvocateLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = user.user_metadata?.role

  if (role !== 'advocate') {
    redirect('/dashboard')
  }

  const subscription = await getEffectiveSubscription(supabase, user.id)
  const subscriptionSummary = getSubscriptionSummary(subscription.expiresAt)
  const chipClasses = getSubscriptionChipClasses(subscription.effectivePlan)

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50 text-gray-900 font-sans">
      <DashboardSidebar
        items={advocateNavItems}
        branding={{ title: "Advocate Panel", icon: "Briefcase" }}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gray-50">
        <header className="px-6 py-4 bg-white border-b border-gray-200 flex items-center shadow-sm z-40 sticky top-0">
          <HeaderTitle />
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/advocate/subscription"
              className={`hidden md:flex items-center rounded-full border px-4 py-2 text-sm transition-colors hover:opacity-90 ${chipClasses.container}`}
            >
              <span className="font-semibold">Current subscription:</span>
              <span className="ml-2 uppercase font-bold">{subscription.effectivePlan}</span>
              <span className={`ml-2 ${chipClasses.summary}`}>{subscriptionSummary}</span>
            </Link>
            <NotificationsPopover />
            <Link href="/dashboard/advocate/profile">
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
  )
}
