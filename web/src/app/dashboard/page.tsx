import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 1. Check user metadata first (fastest)
  const metaRole = user.user_metadata?.role;

  if (metaRole === 'advocate') {
    redirect('/dashboard/advocate');
  } else if (metaRole === 'client') {
    redirect('/dashboard/client');
  }

  // 2. Fallback: Query the public.users table if metadata is missing/unreliable
  const { data: publicUser } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (publicUser?.role === 'advocate') {
    redirect('/dashboard/advocate');
  } else if (publicUser?.role === 'client') {
    redirect('/dashboard/client');
  } else if (publicUser?.role === 'admin') {
     redirect('/dashboard/admin');
  }

  // 3. Last resort fallback
  return (
    <div className="min-h-screen bg-[#1a1410] flex items-center justify-center text-amber-100">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Role Not Found</h1>
        <p className="text-amber-200/60">We couldn&apos;t determine your account type.</p>
        <p className="text-sm mt-4">User ID: {user.id}</p>
      </div>
    </div>
  );
}
