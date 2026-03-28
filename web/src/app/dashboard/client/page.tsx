import { createClient } from "@/lib/supabase/server";
import { Briefcase, Calendar, Scale } from "lucide-react";
import Link from "next/link";
import NewsTicker from "@/components/dashboard/news-ticker";
import TipsTicker from "@/components/dashboard/tips-ticker";
import PortalShortcuts from "@/components/dashboard/portal-shortcuts";
import CourtDirectory from "@/components/dashboard/court-directory";
import { LEGAL_TOOLS, GOVT_PORTALS } from "@/lib/data/portals";

export const dynamic = 'force-dynamic';

type ParticipantRow = {
  case_id: string;
};

type CaseHearing = {
  case_id: string;
  hearing_date: string;
};

type CaseRow = {
  id: string;
  title: string | null;
  case_number: string | null;
  status: string | null;
  court_name: string | null;
  filing_date: string | null;
  metadata: Record<string, unknown> | null;
  next_hearing_date: string | null;
};

type CaseWithHearings = CaseRow & {
  case_hearings: CaseHearing[];
};

export default async function ClientDashboard({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient();
  const queryParams = await searchParams;
  const view = queryParams.view;
  
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Fetch case IDs where user is a client participant
  const { data: participations } = await supabase
    .from('case_participants')
    .select('case_id')
    .eq('user_id', user?.id)
    .eq('role', 'client');

  const caseIds = (participations as ParticipantRow[] | null)?.map((p) => p.case_id) || [];
  let cases: CaseWithHearings[] = [];

  if (caseIds.length > 0) {
    // 2. Fetch Cases
    const { data: casesData } = await supabase
      .from('cases')
      .select('id, title, case_number, status, court_name, filing_date, metadata, next_hearing_date')
      .in('id', caseIds);

    // 3. Fetch Hearings
    const { data: allHearings } = await supabase
        .from('case_hearings')
        .select('case_id, hearing_date')
        .in('case_id', caseIds)
        .order('hearing_date', { ascending: true });

    const hearingsMap = new Map<string, CaseHearing[]>();
    (allHearings as CaseHearing[] | null)?.forEach((h) => {
        if (!hearingsMap.has(h.case_id)) {
            hearingsMap.set(h.case_id, []);
        }
        const list = hearingsMap.get(h.case_id);
        if (list) {
          list.push(h);
        }
    });

    cases = ((casesData as CaseRow[] | null) || []).map((c) => ({
        ...c,
        case_hearings: hearingsMap.get(c.id) || []
    }));
  }

  // Calculate upcoming hearings (next 30 days) - Standard IST Logic
  const getISTDateStr = (d: Date) => {
      return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  };
  
  const now = new Date();
  const todayStr = getISTDateStr(now);
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const thirtyDaysStr = getISTDateStr(thirtyDaysFromNow);

  const upcomingHearingsCount = cases?.filter((c) => {
    let nextHearingStr: string | null = null;
    
    if (c.case_hearings && c.case_hearings.length > 0) {
         const futureHearings = c.case_hearings
             .map((h) => getISTDateStr(new Date(h.hearing_date)))
             .filter((dStr: string) => dStr >= todayStr)
             .sort();
         
         if (futureHearings.length > 0) {
             nextHearingStr = futureHearings[0];
         }
    }

    if (c.next_hearing_date) {
         const nhdStr = getISTDateStr(new Date(c.next_hearing_date));
         if (nhdStr >= todayStr) {
             if (!nextHearingStr || nhdStr < nextHearingStr) {
                 nextHearingStr = nhdStr;
             }
         }
    }

    return nextHearingStr && nextHearingStr <= thirtyDaysStr;
  }).length || 0;

  const clientLegalTools = LEGAL_TOOLS.map(tool => {
    if (tool.id === 'courts') {
      return { ...tool, url: '/dashboard/client?view=courts' };
    }
    return tool;
  });

  if (view === 'courts') {
    return <CourtDirectory />;
  }

  return (
    <div className="space-y-8 font-sans">

      {/* Tickers */}
      <div className="-mt-4 mb-0">
        <TipsTicker />
      </div>

      <div className="-mt-2 mb-2">
        <NewsTicker />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/dashboard/client/cases" className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-teal-50 rounded-lg">
              <Briefcase className="h-6 w-6 text-teal-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Cases</p>
              <p className="text-2xl font-bold text-gray-900">{cases?.length || 0}</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/client/cases" className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Scale className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Active Matters</p>
              <p className="text-2xl font-bold text-gray-900">
                {cases?.filter((c) => c.status === 'open').length || 0}
              </p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/client/cases" className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-50 rounded-lg">
              <Calendar className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Upcoming Hearings</p>
              <p className="text-2xl font-bold text-gray-900">
                {upcomingHearingsCount}
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* Portal Shortcuts */}
      <PortalShortcuts title="Legal Tools" items={clientLegalTools} />
      <PortalShortcuts title="Government Portals" items={GOVT_PORTALS} />
    </div>
  );
}
