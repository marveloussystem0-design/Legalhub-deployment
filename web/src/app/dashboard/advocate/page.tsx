import { createClient } from "@/lib/supabase/server";
import { Briefcase, Calendar, Scale } from "lucide-react";
import NewsTicker from "@/components/dashboard/news-ticker";
import TipsTicker from "@/components/dashboard/tips-ticker";
import PortalShortcuts from "@/components/dashboard/portal-shortcuts";
import CourtDirectory from "@/components/dashboard/court-directory";
import { LEGAL_TOOLS, GOVT_PORTALS } from "@/lib/data/portals";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function AdvocateDashboard({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient();
  const queryParams = await searchParams;
  const view = queryParams.view;

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  
  // Fetch case IDs where user is an advocate participant
  const { data: advocateParticipations } = await supabase
    .from('case_participants')
    .select('case_id')
    .eq('user_id', user?.id)
    .eq('role', 'advocate');

  const caseIds = advocateParticipations?.map(p => p.case_id) || [];

  type DashboardHearing = { case_id: string; hearing_date: string };
  type DashboardCase = {
    id: string;
    title?: string | null;
    case_number?: string | null;
    status?: string | null;
    court_name?: string | null;
    filing_date?: string | null;
    metadata?: { full_details?: Record<string, unknown> } | null;
    next_hearing_date?: string | null;
    case_hearings?: DashboardHearing[];
  };

  let cases: DashboardCase[] = [];

  if (caseIds.length > 0) {
    // 1. Fetch Cases
    const { data: casesData } = await supabase
      .from('cases')
      .select('id, title, case_number, status, court_name, filing_date, metadata, next_hearing_date') // Fetch all needed fields
      .in('id', caseIds);

    // 2. Fetch ALL Hearings for these cases in ONE query (Batching)
    const { data: allHearings } = await supabase
        .from('case_hearings')
        .select('case_id, hearing_date') // Fetch only needed fields
        .in('case_id', caseIds)
        .order('hearing_date', { ascending: true });

    // 3. Map hearings to cases in memory
    const hearingsMap = new Map<string, DashboardHearing[]>();
    allHearings?.forEach(h => {
        if (!hearingsMap.has(h.case_id)) {
            hearingsMap.set(h.case_id, []);
        }
        const hearingRows = hearingsMap.get(h.case_id);
        if (hearingRows) hearingRows.push(h);
    });

    cases = ((casesData || []) as DashboardCase[]).map(c => ({
        ...c,
        case_hearings: hearingsMap.get(c.id) || []
    }));
  }

  // Calculate upcoming hearings (next 10 days) - ROBUST IST LOGIC
  const getISTDateStr = (d: Date) => {
      return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  };
  
  const now = new Date();
  const todayStr = getISTDateStr(now);

  const tenDaysFromNow = new Date(now);
  tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);
  const tenDaysStr = getISTDateStr(tenDaysFromNow);

  const upcomingHearingsCount = cases?.filter(c => {
    let nextHearingStr: string | null = null;
    
    // 1. From Case Hearings
    if (c.case_hearings && c.case_hearings.length > 0) {
         // Sort and find
         const futureHearings = c.case_hearings
             .map((h) => getISTDateStr(new Date(h.hearing_date)))
             .filter((dStr) => dStr >= todayStr)
             .sort();
         
         if (futureHearings.length > 0) {
             nextHearingStr = futureHearings[0];
         }
    }

    // 2. From Metadata
    if (c.next_hearing_date) {
         const nhdStr = getISTDateStr(new Date(c.next_hearing_date));
         if (nhdStr >= todayStr) {
             if (!nextHearingStr || nhdStr < nextHearingStr) {
                 nextHearingStr = nhdStr;
             }
         }
    }

    // 3. Fallback to Metadata JSON (eCourts string "13th February 2026")
    const metaDateRaw = c.metadata?.full_details?.['Next Hearing Date'];
             if (metaDateRaw && typeof metaDateRaw === 'string') {
                 // Hack: remove "st", "nd", "rd", "th" from day part
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

    return nextHearingStr && nextHearingStr <= tenDaysStr;
  }).length || 0;

  const advocateLegalTools = LEGAL_TOOLS.map(tool => {
    if (tool.id === 'courts') {
      return { ...tool, url: '/dashboard/advocate?view=courts' };
    }
    return tool;
  });

  if (view === 'courts') {
    return <CourtDirectory />;
  }

  return (
    <div className="space-y-8 font-sans">

      {/* Tips Ticker */}
      <div className="-mt-4 mb-0">
        <TipsTicker />
      </div>

      {/* News Ticker */}
      <div className="-mt-2 mb-2">
        <NewsTicker />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/dashboard/advocate/cases" className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
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

        <Link href="/dashboard/advocate/cases?status=open" className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Scale className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Active Cases</p>
              <p className="text-2xl font-bold text-gray-900">
                {cases?.filter(c => c.status === 'open').length || 0}
              </p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/advocate/cases?filter=upcoming" className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
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
      <PortalShortcuts title="Legal Tools" items={advocateLegalTools} />
      <PortalShortcuts title="Government Portals" items={GOVT_PORTALS} />
    </div>
  );
}
