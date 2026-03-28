import { createClient } from "@/lib/supabase/server";
import { Briefcase, Clock, Scale } from "lucide-react";
import Link from "next/link";

type HearingRow = {
  hearing_date: string;
  hearing_type: string | null;
};

type CaseRow = {
  id: string;
  title: string | null;
  case_number: string | null;
  case_type: string | null;
  status: string | null;
  court_name: string | null;
  filing_date: string | null;
  created_at: string | null;
  jurisdiction?: string | null;
  case_hearings?: HearingRow[] | null;
};

type ParticipantCaseRow = {
  cases: CaseRow | null;
};

export default async function ClientCasesPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch cases where the client is a participant
  const { data: participantData } = await supabase
    .from('case_participants')
    .select(`
      cases (
        id,
        title,
        case_number,
        case_type,
        status,
        court_name,
        filing_date,
        created_at,
        case_hearings (hearing_date, hearing_type)
      )
    `)
    .eq('user_id', user?.id)
    .eq('role', 'client');

  // Extract cases from the join result
  const cases = ((participantData as ParticipantCaseRow[] | null)?.map((item) => item.cases).filter(Boolean) || []) as CaseRow[];

   // Helper to get next hearing
   const getNextHearing = (c: CaseRow) => {
        if (!c.case_hearings || c.case_hearings.length === 0) return null;
        return c.case_hearings[0];
   };

  return (
    <div className="grid gap-6">
      {cases?.map((caseItem) => {
        const nextHearing = getNextHearing(caseItem);

        return (
          <div key={caseItem.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 group-hover:text-teal-700 transition-colors">{caseItem.title}</h3>
                <p className="text-gray-500 text-sm mt-1 font-medium">
                  Case #{caseItem.case_number} • {caseItem.court_name}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-widest ${caseItem.status === 'open' ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                {caseItem.status}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <div className="flex items-center gap-2 text-teal-600 mb-2">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Next Hearing</span>
                </div>
                <div className="text-gray-900 font-semibold text-lg">
                  {nextHearing ? new Date(nextHearing.hearing_date).toLocaleDateString() : 'Not Scheduled'}
                </div>
                {nextHearing && <div className="text-xs text-gray-500 mt-1 font-medium">{nextHearing.hearing_type}</div>}
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <div className="flex items-center gap-2 text-teal-600 mb-2">
                  <Briefcase className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Type</span>
                </div>
                <div className="text-gray-900 font-semibold">{caseItem.case_type}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <div className="flex items-center gap-2 text-teal-600 mb-2">
                  <Scale className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Jurisdiction</span>
                </div>
                <div className="text-gray-900 font-semibold">{caseItem.jurisdiction || 'N/A'}</div>
              </div>
            </div>

            <div className="flex justify-end items-center gap-3 border-t border-gray-100 pt-4">
              <Link href={`/dashboard/client/cases/${caseItem.id}`} className="text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 transition-colors flex items-center gap-1.5 px-6 py-2.5 rounded-lg shadow-sm hover:shadow active:scale-[0.98]">
                View Case Details
                <span className="text-teal-200 group-hover:translate-x-1 transition-transform">→</span>
              </Link>
            </div>
          </div>
        );
      })}

      {(!cases || cases.length === 0) && (
        <div className="text-center p-12 bg-white border border-dashed border-gray-300 rounded-xl shadow-sm">
          <div className="bg-gray-50 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 border border-gray-100">
            <Briefcase className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">No Active Legal Matters</h3>
          <p className="text-gray-500 max-w-sm mx-auto">
            You don&apos;t have any active legal matters linked to your account yet. Your legal counsel will add them here.
          </p>
        </div>
      )}
    </div>
  );
}
