import { createClient } from "@/lib/supabase/server";
import { Users, Mail, Phone, Briefcase } from "lucide-react";
import Link from "next/link";

export default async function AdvocateClientsPage() {
  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Get ALL accessible Case IDs (RLS handles permission)
  const { data: accessibleCases } = await supabase
    .from('cases')
    .select('id, title');
  
  const caseIds = accessibleCases?.map(c => c.id) || [];
  
  // Create a map of ID -> Title for later
  const caseTitleMap = ((accessibleCases || []) as AccessibleCase[]).reduce<Record<string, string>>((acc, c) => {
    acc[c.id] = c.title || 'Untitled Case';
    return acc;
  }, {});

  // NEW: Fetch Pending Invites
  const { data: pendingInvites } = await supabase
    .from('case_invites')
    .select(`
        id, email, created_at,
        cases (title, case_number)
    `)
    .eq('invited_by', user?.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  let clients: ClientRecord[] = [];

  if (caseIds.length > 0) {
    // 2. Get all client participants in those cases
    const { data: clientParticipations } = await supabase
      .from('case_participants')
      .select('user_id, case_id')
      .in('case_id', caseIds)
      .eq('role', 'client');

    if (clientParticipations && clientParticipations.length > 0) {
      // 3. Collect case IDs per client
      const clientCaseMap: Record<string, string[]> = {};
      
      // We already have caseTitleMap from Step 1

      (clientParticipations as ClientParticipation[]).forEach((p) => {
        if (!clientCaseMap[p.user_id]) clientCaseMap[p.user_id] = [];
        if (caseTitleMap[p.case_id]) {
            clientCaseMap[p.user_id].push(caseTitleMap[p.case_id]);
        }
      });

      const uniqueClientIds = Object.keys(clientCaseMap);

      // 4. Fetch details for these unique clients
      const { data: clientDetails } = await supabase
        .from('clients')
        .select('*')
        .in('user_id', uniqueClientIds);
      
      // 4b. Fetch emails from profiles (safer than join)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', uniqueClientIds);
      
      const emailMap = (profiles || []).reduce<Record<string, string | null | undefined>>((acc, p: { id: string; email?: string | null }) => {
        acc[p.id] = p.email;
        return acc;
      }, {});

      // 5. Combine data
      clients = ((clientDetails || []) as ClientRecord[]).map((client) => ({
        ...client,
        users: { email: emailMap[client.user_id] },
        cases: clientCaseMap[client.user_id] || []
      }));
    }
  }

  return (
    <div className="grid gap-4">
      {/* Pending Invites Section */}
      {pendingInvites && pendingInvites.length > 0 && (
        <div className="mb-6 space-y-3">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pending Invitations</h2>
          <div className="grid gap-3">
            {(pendingInvites as PendingInvite[]).map((invite) => (
              <div key={invite.id} className="bg-amber-50/50 border border-amber-200 border-dashed rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-amber-100 rounded-lg">
                    <Users className="h-5 w-5 text-amber-700" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{invite.phone || invite.email}</h3>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Invited to: {invite.cases?.title || 'Unknown Case'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                    Pending Signup
                  </span>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Sent: {new Date(invite.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {clients?.map((client) => (
        <div key={client.user_id} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md hover:border-teal-200 transition-all">
          <div className="flex flex-col md:flex-row items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-teal-50 rounded-lg">
                <Users className="h-6 w-6 text-teal-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">{client.full_name}</h3>
                <div className="flex flex-col gap-1 mt-2">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Mail className="h-4 w-4 text-gray-400" />
                    {client.users?.email || 'No email'}
                  </div>
                  {client.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Phone className="h-4 w-4 text-gray-400" />
                      {client.phone}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-5 py-4 rounded-lg border border-gray-100 max-w-xs w-full md:w-auto">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="h-4 w-4 text-teal-600" />
                <span className="text-sm font-semibold text-gray-700">
                  Active Cases
                </span>
              </div>
              <div className="space-y-1">
                {client.cases.length > 0 ? (
                  client.cases.map((title: string, idx: number) => (
                    <p key={idx} className="text-sm text-gray-600 truncate flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0"></span>
                      {title}
                    </p>
                  ))
                ) : (
                  <p className="text-sm text-gray-400 italic">No active cases</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}

      {(!clients || clients.length === 0) && (
        <div className="text-center p-16 bg-white border border-dashed border-gray-300 rounded-xl">
          <div className="bg-gray-50 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">No Clients Yet</h3>
          <p className="text-gray-500 max-w-sm mx-auto mb-6">
            Clients appear here when you add them to a Case. <br />
            To onboard a client, create a case and invite them.
          </p>
          <Link href="/dashboard/advocate/cases/create">
            <button className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors">
              Create Case & Add Client
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}
  type AccessibleCase = { id: string; title: string | null };
  type PendingInvite = {
    id: string;
    email?: string | null;
    phone?: string | null;
    created_at: string;
    cases?: { title?: string | null; case_number?: string | null } | null;
  };
  type ClientParticipation = { user_id: string; case_id: string };
  type ClientRecord = {
    user_id: string;
    full_name?: string | null;
    phone?: string | null;
    users?: { email?: string | null };
    cases: string[];
    [key: string]: unknown;
  };
