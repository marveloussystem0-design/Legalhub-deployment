import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/utils/supabase/server";
import { getEffectiveSubscription } from "@/lib/billing/access";
import { redirect } from "next/navigation";
import ProfileContent from "./profile-content";

export default async function AdvocateProfilePage() {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Fetch advocate profile
  const { data: advocate } = await supabase
    .from('advocates')
    .select('*')
    .eq('user_id', user.id)
    .single();

  const { data: userData } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', user.id)
    .single();

  const subscription = await getEffectiveSubscription(admin, user.id);

  return (
    <ProfileContent advocate={advocate} userData={userData} planType={subscription.effectivePlan} />
  );
}
