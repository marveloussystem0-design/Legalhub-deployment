import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Briefcase, ArrowRight } from "lucide-react";

export default async function SearchResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ q: string }>
}) {
  const supabase = await createClient();
  const { q } = await searchParams;
  const query = q || '';

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  if (!query) {
    return (
      <div className="text-center py-12 text-amber-200/60">
        <h2 className="text-xl font-bold mb-2">Search Results</h2>
        <p>Enter a search term to find cases</p>
      </div>
    );
  }

  // 1. Search Cases
  // Get cases where user is advocate first
  const { data: advocateParticipations } = await supabase
    .from('case_participants')
    .select('case_id')
    .eq('user_id', user.id)
    .eq('role', 'advocate');

  const caseIds = advocateParticipations?.map(p => p.case_id) || [];
  let cases: Array<{
    id: string;
    title: string | null;
    case_number: string | null;
    status: string | null;
    display_title?: string | null;
  }> = [];

  if (caseIds.length > 0) {
    const { data } = await supabase
      .from('cases')
      .select('id, title, case_number, status')
      .in('id', caseIds)
      .or(`title.ilike.%${query}%,case_number.ilike.%${query}%`)
      .limit(5);
    cases = data || [];

    if (cases.length > 0) {
      const { data: preferenceRows } = await supabase
        .from('case_user_preferences')
        .select('case_id, display_title')
        .eq('user_id', user.id)
        .in('case_id', cases.map((c) => c.id));

      const preferenceMap = new Map(
        (preferenceRows || []).map((row) => [row.case_id, row.display_title])
      );

      cases = cases
        .map((c) => ({
          ...c,
          display_title: preferenceMap.get(c.id) || null,
        }))
        .filter((c) => {
          const customTitle = c.display_title?.toLowerCase() || '';
          return customTitle.includes(query.toLowerCase()) ||
            c.title?.toLowerCase().includes(query.toLowerCase()) ||
            c.case_number?.toLowerCase().includes(query.toLowerCase());
        });
    }
  }

  // ... (rest of search) ...

  return (
    <div className="space-y-8 font-sans">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Search Results</h1>
        <p className="text-gray-500 mt-1">
          Showing results for &quot;{query}&quot;
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-teal-600" />
            Cases ({cases.length})
          </h2>
          {cases.length > 0 && (
            <Link
              href={`/dashboard/advocate?search=${query}`}
              className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1 font-semibold"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {cases.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm bg-gray-50">
              No matching cases found
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {cases.map((c) => (
                <Link
                  key={c.id}
                  href={`/dashboard/advocate/cases/${c.id}`}
                  className="block p-4 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 group-hover:text-teal-700 transition-colors">
                      {c.display_title || c.title}
                    </h3>
                    {c.display_title && c.display_title !== c.title && (
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider bg-gray-50 px-1 py-0.5 rounded border border-gray-100 italic">
                        {c.title}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                      {c.case_number}
                    </span>
                    <span className={`capitalize px-1.5 py-0.5 rounded ${
                      c.status === 'open'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
