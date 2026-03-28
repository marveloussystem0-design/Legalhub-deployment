import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ClientProfileView from "./client-profile-view";

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { id: clientId } = await params;

  // 1. Fetch Client Details
  const { data: client, error } = await supabase
    .from('clients')
    .select(`
        *,
        user:user_id (email)
    `) // Assuming 'user_id' is FK to auth.users, but wait... 
       // In our schema 'clients' table has 'user_id' which is the client's auth ID.
       // However, we can't join on auth.users directly via standard PostgREST unless setup.
       // Let's first fetch client, then fetch email separately if needed.
    .eq('id', clientId)
    .single();

  if (error || !client) {
    return <div>Client not found</div>;
  }

  // 1b. Fetch Email safely
  let email = '';
  if (client.user_id) {
    const { data: userData } = await supabase.from('profiles').select('email').eq('id', client.user_id).single();
    email = userData?.email || '';
  }

  const clientData = { ...client, user: { email } };

  // 2. Fetch Cases for this Client
  // Using case_participants intersection
  const { data: participations } = await supabase
    .from('case_participants')
    .select('case_id')
    .eq('user_id', client.user_id)
    .eq('role', 'client');
    
  const caseIds = participations?.map(p => p.case_id) || [];
  
  let cases: ClientCase[] = [];
  if (caseIds.length > 0) {
      const { data: casesData } = await supabase
        .from('cases')
        .select('*')
        .in('id', caseIds)
        .order('updated_at', { ascending: false });
      cases = casesData || [];
  }

  return <ClientProfileView client={clientData} cases={cases} />;
}
  type ClientCase = {
    id: string;
    title?: string | null;
    case_number?: string | null;
    status?: string | null;
    next_hearing_date?: string | null;
    [key: string]: unknown;
  };
