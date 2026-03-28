import { createClient } from "@/lib/supabase/server";
import { getEffectiveSubscription } from "@/lib/billing/access";
import { createAdminClient } from "@/utils/supabase/server";
import CreateCaseModal from "./create-case-modal";
import CaseListView from "../case-list-view"; // Adjust import path
import Link from "next/link";
import SubscriptionDowngradeGuard from "./subscription-downgrade-guard";

export const dynamic = 'force-dynamic';

type ParticipantLink = {
  case_id: string;
  user_id: string;
  role: string;
};

type CaseHearing = {
  case_id: string;
  hearing_date: string;
  hearing_type?: string | null;
};

type ProfileRecord = {
  id: string;
  full_name?: string | null;
  email?: string | null;
};

type ClientRecord = {
  user_id: string;
  full_name?: string | null;
};

type PreferenceRecord = {
  case_id: string;
  display_title?: string | null;
};

type EcourtsLink = {
  case_id: string;
  ecourts_cases?: { last_synced_at?: string | null } | Array<{ last_synced_at?: string | null }> | null;
};

type CaseRow = {
  id: string;
  status?: string | null;
  case_type?: string | null;
  created_at?: string;
  updated_at?: string;
  next_hearing_date?: string | null;
  metadata?: {
    full_details?: Record<string, string | null | undefined>;
    [key: string]: unknown;
  } | null;
  case_hearings?: Array<{ hearing_date: string }>;
  [key: string]: unknown;
};

type EnrichedCase = CaseRow & {
  status: string;
  display_title: string | null;
  case_hearings: CaseHearing[];
  case_participants: Array<
    ParticipantLink & {
      clients: ClientRecord | null;
      profiles: ProfileRecord | null;
      users: { email: string };
    }
  >;
  last_synced_at: string | null;
};

export default async function AdvocateCasesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient();
  const resolvedParams = await searchParams;

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  const admin = await createAdminClient();
  const subscription = user ? await getEffectiveSubscription(admin, user.id) : null;
  
  let cases: EnrichedCase[] = [];
  let allHearings: CaseHearing[] | null = [];
  let allParticipants: ParticipantLink[] | null = [];
  const clientMap = new Map<string, ClientRecord>();
  const profileMap = new Map<string, ProfileRecord>();
  const preferenceMap = new Map<string, string | null | undefined>();
  const { data: participantLinks } = await supabase
    .from('case_participants')
    .select('case_id')
    .eq('user_id', user?.id);

  const { data: ownedCaseLinks } = await supabase
    .from('cases')
    .select('id')
    .eq('created_by', user?.id);

  const visibleCaseIds = Array.from(
      new Set([
      ...(participantLinks?.map((link: { case_id: string }) => link.case_id) || []),
      ...(ownedCaseLinks?.map((link: { id: string }) => link.id) || [])
    ])
  );

  // Start building query - fetch cases visible to this advocate
  let query = supabase
    .from('cases')
    .select('*, display_title');

  if (visibleCaseIds.length > 0) {
    query = query.in('id', visibleCaseIds);
  } else {
    query = query.eq('id', '__no_cases__');
  }

  // Apply filters
  if (resolvedParams?.status) {
    query = query.eq('status', resolvedParams.status);
  }
  if (resolvedParams?.type) {
    query = query.eq('case_type', resolvedParams.type);
  }

  // Apply sorting
  if (resolvedParams?.sort === 'oldest') {
    query = query.order('created_at', { ascending: true });
  } else if (resolvedParams?.sort === 'updated') {
    query = query.order('updated_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false }); // Default: newest
  }

  const { data: casesData } = await query;
  
  if (casesData && casesData.length > 0) {
      const loadedCaseIds = casesData.map(c => c.id);

      const { data: preferenceRows } = await supabase
          .from('case_user_preferences')
          .select('case_id, display_title')
          .eq('user_id', user?.id)
          .in('case_id', loadedCaseIds);

      preferenceRows?.forEach((row: PreferenceRecord) => {
          preferenceMap.set(row.case_id, row.display_title);
      });

      // 2. Batch Fetch Hearings
      const { data: hearingsData } = await supabase
          .from('case_hearings')
          .select('case_id, hearing_date, hearing_type')
          .in('case_id', loadedCaseIds)
          .order('hearing_date', { ascending: true });
      allHearings = hearingsData;

      // 3. Batch Fetch Participants
      const { data: participantsData } = await supabase
          .from('case_participants')
          .select('case_id, user_id, role')
          .in('case_id', loadedCaseIds);
      allParticipants = participantsData;

      // 4. Batch Fetch Client Details
      const allUserIds = Array.from(
        new Set((allParticipants || []).map((p: ParticipantLink) => p.user_id))
      );
      const clientUserIds = (allParticipants || [])
          .filter((p: ParticipantLink) => p.role === 'client')
          .map((p: ParticipantLink) => p.user_id) || [];
          
      // Client map initialized in outer scope
      if (clientUserIds.length > 0) {
          const { data: clientDetails } = await supabase
              .from('clients')
              .select('user_id, full_name')
              .in('user_id', clientUserIds);
          
          clientDetails?.forEach((c: ClientRecord) => clientMap.set(c.user_id, c));
      }

      // 4b. Batch Fetch profile details for robust participant name fallback
      if (allUserIds.length > 0) {
          const { data: profileDetails } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', allUserIds);

          profileDetails?.forEach((p: ProfileRecord) => profileMap.set(p.id, p));

      }

      // 5. Batch Fetch last_synced_at via case_ecourts_links
      const { data: ecourtsLinks } = await supabase
          .from('case_ecourts_links')
          .select('case_id, ecourts_cases(last_synced_at)')
          .in('case_id', loadedCaseIds);

        // Build a map: case_id -> last_synced_at (Latest across all links)
        const lastSyncedMap = new Map<string, string | null>();
        ecourtsLinks?.forEach((link: EcourtsLink) => {
            const currentSyncedObj = Array.isArray(link.ecourts_cases)
                ? link.ecourts_cases[0]
                : link.ecourts_cases;
            
            const currentSyncedDateStr = currentSyncedObj?.last_synced_at;
            if (!currentSyncedDateStr) return;

            const existingSyncedDateStr = lastSyncedMap.get(link.case_id);
            if (!existingSyncedDateStr || new Date(currentSyncedDateStr) > new Date(existingSyncedDateStr)) {
                lastSyncedMap.set(link.case_id, currentSyncedDateStr);
            }
        });

      // In-Memory Join
      const hearingsMap = new Map<string, CaseHearing[]>();
      allHearings?.forEach(h => {
           if (!hearingsMap.has(h.case_id)) hearingsMap.set(h.case_id, []);
           const hearingRows = hearingsMap.get(h.case_id);
           if (hearingRows) hearingRows.push(h);
      });

      const participantsMap = new Map<string, Array<ParticipantLink & { clients: ClientRecord | null; profiles: ProfileRecord | null; users: { email: string } }>>();
      allParticipants?.forEach(p => {
           if (!participantsMap.has(p.case_id)) participantsMap.set(p.case_id, []);
           const profile = profileMap.get(p.user_id) || null;
           const enrichedP = {
             ...p,
             clients: p.role === 'client' ? clientMap.get(p.user_id) || null : null,
             profiles: profile,
             users: { email: profile?.email || '' }
           };
           const participantRows = participantsMap.get(p.case_id);
           if (participantRows) participantRows.push(enrichedP);
       });

       cases = (casesData as CaseRow[]).map((c): EnrichedCase => ({
            ...c,
            status: typeof c.status === "string" && c.status ? c.status : "open",
            display_title: preferenceMap.get(c.id) || null,
            case_hearings: hearingsMap.get(c.id) || [],
            case_participants: participantsMap.get(c.id) || [],
            last_synced_at: lastSyncedMap.get(c.id) || null
       }));

        // 6. Apply upcoming hearings filter if requested
        if (resolvedParams?.filter === 'upcoming') {
           // Helper: Get IST Date String YYYY-MM-DD
           const getISTDateStr = (d: Date) => {
               return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
           };

           const now = new Date();
           const todayStr = getISTDateStr(now);
           
           const tenDaysFromNow = new Date(now);
           tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);
           const tenDaysStr = getISTDateStr(tenDaysFromNow);

           cases = cases.filter(c => {
             let nextHearingStr: string | null = null;
             
             // 1. From Case Hearings (Find earliest future string)
             if (c.case_hearings && c.case_hearings.length > 0) {
                 const futureHearings = c.case_hearings
                     .map((h: { hearing_date: string }) => {
                        // Ensure we parse whatever format comes in (ISO or YYYY-MM-DD) to a consistent YYYY-MM-DD
                        // If h.hearing_date is "2026-02-13T00:00...", new Date() works.
                        return getISTDateStr(new Date(h.hearing_date));
                    })
                     .filter((dStr) => dStr >= todayStr)
                    .sort(); // String sort works for YYYY-MM-DD

                 if (futureHearings.length > 0) {
                     nextHearingStr = futureHearings[0];
                 }
             }

             // 2. Fallback to next_hearing_date
             if (c.next_hearing_date) {
                 // Check if valid date string
                 const nhdStr = getISTDateStr(new Date(c.next_hearing_date));
                 if (nhdStr >= todayStr) {
                     if (!nextHearingStr || nhdStr < nextHearingStr) {
                         nextHearingStr = nhdStr;
                     }
                 }
             }

             // 3. Fallback to Metadata (eCourts often has "13th February 2026")
             const metaDateRaw = c.metadata?.full_details?.['Next Hearing Date'];
             if (metaDateRaw && typeof metaDateRaw === 'string') {
                 // Parse "13th February 2026" or "13-02-2026"
                 // Simple hack: remove "st", "nd", "rd", "th" from day part if present
                 const cleanDate = metaDateRaw.replace(/(\d+)(st|nd|rd|th)/, '$1'); 
                 const d = new Date(cleanDate);
                 if (!isNaN(d.getTime())) {
                     const metaStr = getISTDateStr(d);
                     if (metaStr >= todayStr) {
                         if (!nextHearingStr || metaStr < nextHearingStr) {
                             nextHearingStr = metaStr;
                         }
                     }
                 }
             }

             if (nextHearingStr) {
                 return nextHearingStr <= tenDaysStr;
             }
             return false;
           });
        }
  }

  // Query cleaned up - clients no longer needed for CNR input
  
  return (
    <div className="space-y-8 font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">My Cases</h1>
          <p className="text-gray-600 mt-1">Manage all your legal matters</p>
        </div>
        
        <div className="flex gap-2">
            {subscription?.canBulkImport ? (
              <Link
                href="/dashboard/advocate/cases/bulk-import"
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 py-2 px-4"
              >
                Bulk Import
              </Link>
            ) : null}
            <CreateCaseModal />
        </div>
      </div>

      <SubscriptionDowngradeGuard />

      {/* Cases List */}
      <CaseListView
        cases={cases}
        hideTabs={resolvedParams?.filter === 'upcoming'}
      />
    </div>
  );
}
