import { createClient } from "@/lib/supabase/server";
import { Briefcase, Calendar, FileText, Scale, AlertCircle, Download, Mail, Clock } from "lucide-react";
import Link from "next/link";
import CaseTimeline from "@/components/dashboard/case-timeline";
import CopyButton from "@/components/common/copy-button";

type TimelineEvent = {
  id: string;
  type: "hearing" | "status_change" | "document" | "filing" | "order";
  title: string;
  description?: string;
  date: string;
  metadata?: Record<string, unknown>;
};

type CaseHistoryEntry = {
  business_date?: string | null;
  hearing_date?: string | null;
  purpose?: string | null;
  judge?: string | null;
};

type CaseMetadata = {
  history?: CaseHistoryEntry[];
};

type CaseRecord = {
  id: string;
  title: string | null;
  case_type: string | null;
  court_name: string | null;
  filing_date: string | null;
  cnr_number: string | null;
  cino: string | null;
  metadata: CaseMetadata | null;
};

type CaseParticipant = {
  user_id: string;
};

type ProfileRow = {
  email: string | null;
  full_name: string | null;
};

type AdvocateRow = {
  full_name: string | null;
  bar_council_number: string | null;
};

type HearingRow = {
  id: string;
  hearing_date: string;
  hearing_type: string | null;
  notes: string | null;
  status?: string | null;
};

type DocumentRow = {
  id: string;
  title: string | null;
  file_url: string | null;
  file_type: string | null;
  created_at: string;
  file_size: number | null;
};

type DocumentWithUrl = DocumentRow & {
  download_url: string | null;
};

function parseTimelineDate(value?: string | null) {
  if (!value) return null;
  const match = value.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  return new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`).toISOString();
}

function normalizeTimelineLabel(value?: string | null) {
  return (value || "hearing").trim().toLowerCase().replace(/\s+/g, " ");
}

function buildCaseTimelineEvents(caseResult: CaseRecord, hearings: HearingRow[]) {
  const events: TimelineEvent[] = [];
  const seen = new Set<string>();

  const pushUnique = (event: TimelineEvent, signature: string) => {
    if (!event?.date || !signature || seen.has(signature)) return;
    seen.add(signature);
    events.push(event);
  };

  if (caseResult.filing_date) {
    pushUnique(
      {
        id: "filing",
        type: "filing" as const,
        title: "Case Filed",
        date: caseResult.filing_date,
        description: `Case filed in ${caseResult.court_name}`,
      },
      `filing|${String(caseResult.filing_date).slice(0, 10)}`
    );
  }

  (hearings || []).forEach((hearing) => {
    if (!hearing?.hearing_date) return;
    const label = hearing.hearing_type || "Hearing";
    pushUnique(
      {
        id: `hearing-${hearing.id}`,
        type:
          label.toLowerCase().includes("order") ||
          label.toLowerCase().includes("judgment")
            ? "order"
            : ("hearing" as const),
        title: label,
        date: hearing.hearing_date,
        description: hearing.notes || undefined,
        metadata: { type: hearing.hearing_type, status: hearing.status },
      },
      `hearing|${String(hearing.hearing_date).slice(0, 10)}|${normalizeTimelineLabel(label)}`
    );
  });

  (caseResult.metadata?.history || []).forEach((entry, index: number) => {
    const eventDate =
      parseTimelineDate(entry.business_date) ||
      parseTimelineDate(entry.hearing_date);
    if (!eventDate) return;

    const label = entry.purpose === "None" ? "Hearing Update" : entry.purpose || "Hearing";
    pushUnique(
      {
        id: `history-${index}`,
        type:
          label.toLowerCase().includes("order") ||
          label.toLowerCase().includes("judgment")
            ? "order"
            : ("hearing" as const),
        title: label,
        date: eventDate,
        description: `Judge: ${entry.judge || "Not Specified"}`,
        metadata: {
          source: "eCourts Official Record",
          next_hearing:
            entry.hearing_date !== "None" ? entry.hearing_date : undefined,
        },
      },
      `hearing|${eventDate.slice(0, 10)}|${normalizeTimelineLabel(label)}`
    );
  });

  return events;
}

export default async function ClientCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id: caseId } = await params;
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Fetch case details
  const { data: caseResultData } = await supabase
    .from('cases')
    .select('*')
    .eq('id', caseId)
    .single();
  const caseResult = caseResultData as CaseRecord | null;

  if (!caseResult) {
    return (
        <div className="p-8 text-center bg-white border border-gray-200 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 font-sans tracking-tight">Case Not Found</h2>
            <p className="text-gray-500 mt-2 font-medium">This case does not exist or you do not have access to it.</p>
            <Link href="/dashboard/client/cases" className="mt-4 inline-block text-teal-600 font-bold hover:underline">
                &larr; Back to My Cases
            </Link>
        </div>
    );
  }

  // 2. Security Check: Ensure user is a participant
  const { data: participantCheck } = await supabase
    .from('case_participants')
    .select('role')
    .eq('case_id', caseId)
    .eq('user_id', user?.id)
    .single();

  if (!participantCheck) {
      return (
        <div className="p-8 text-center text-red-600 bg-red-50 rounded-xl border border-red-200 shadow-sm">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <h2 className="text-lg font-bold">Access Denied</h2>
            <p className="text-sm font-medium">You are not authorized to view this case.</p>
            <Link href="/dashboard/client/cases" className="mt-4 inline-block text-red-600 font-bold hover:underline">
                &larr; Back to My Cases
            </Link>
        </div>
      );
  }

  // 3. Fetch Advocate Details for this case
  // 3. Fetch Advocate Details for this case
  const { data: advocateParticipantData } = await supabase
    .from('case_participants')
    .select('user_id')
    .eq('case_id', caseId)
    .eq('role', 'advocate')
    .single();
  const advocateParticipant = advocateParticipantData as CaseParticipant | null;

  let advocateInfo = null;

  if (advocateParticipant) {
      // Fetch profile and advocate details in parallel
      const [userProfile, advocateProfile] = await Promise.all([
          supabase.from('profiles').select('email, full_name').eq('id', advocateParticipant.user_id).single(),
          supabase.from('advocates').select('full_name, bar_council_number').eq('user_id', advocateParticipant.user_id).single()
      ]);

      const profileData = userProfile.data as ProfileRow | null;
      const advData = advocateProfile.data as AdvocateRow | null;

      if (profileData || advData) {
          advocateInfo = {
              id: advocateParticipant.user_id,
              name: advData?.full_name || profileData?.full_name || 'Advocate',
              email: profileData?.email,
              barNumber: advData?.bar_council_number,
              initial: (advData?.full_name || profileData?.full_name || 'A')[0]
          };
      }
  }


  // 4. Fetch hearings
  const { data: hearingsData } = await supabase
    .from('case_hearings')
    .select('id, hearing_date, hearing_type, notes')
    .eq('case_id', caseId)
    .order('hearing_date', { ascending: true });
  const hearings = (hearingsData as HearingRow[] | null) || [];

  // 5. Fetch documents
  const { data: documentsData } = await supabase
    .from('documents')
    .select('id, title, file_url, file_type, created_at, file_size')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });
  const documents = (documentsData as DocumentRow[] | null) || [];

  // 6. Generate Signed URLs for documents
  const documentsWithUrls = await Promise.all(
    documents.map(async (doc) => {
      if (!doc.file_url) return { ...doc, download_url: null };
      
      const { data: signedUrl } = await supabase.storage
        .from('case-documents')
        .createSignedUrl(doc.file_url, 3600); // 1 hour expiry
      
      return {
        ...doc,
        download_url: signedUrl?.signedUrl || null
      };
    })
  ) as DocumentWithUrl[];

  return (
    <div className="space-y-6 font-sans">
      {/* Case Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Court</p>
          <p className="text-lg font-bold text-gray-900 flex items-center gap-2">
             <Briefcase className="h-4 w-4 text-teal-600" />
             {caseResult.court_name || 'Not specified'}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Type</p>
          <p className="text-lg font-bold text-gray-900 capitalize flex items-center gap-2">
             <Scale className="h-4 w-4 text-teal-600" />
             {caseResult.case_type}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Filing Date</p>
          <p className="text-lg font-bold text-gray-900 flex items-center gap-2">
             <Calendar className="h-4 w-4 text-teal-600" />
             {caseResult.filing_date ? new Date(caseResult.filing_date).toLocaleDateString() : 'N/A'}
          </p>
        </div>
        {(caseResult.cnr_number || caseResult.cino) && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">CNR Number</p>
              <CopyButton value={caseResult.cnr_number ?? caseResult.cino ?? ""} label="Copy" />
            </div>
            <p className="text-sm font-bold text-gray-900 break-all">
              {caseResult.cnr_number ?? caseResult.cino}
            </p>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* Left Column: Timeline & Documents */}
        <div className="lg:col-span-2 space-y-6">
             {/* Timeline */}
             <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-teal-600" />
                  Case Timeline
                </h2>
                <CaseTimeline events={buildCaseTimelineEvents(caseResult, hearings)} />
              </div>

             {/* Documents */}
             <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
               <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-4">
                 <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                   <FileText className="h-5 w-5 text-teal-600" />
                   Case Documents
                 </h2>
               </div>
               <div className="grid gap-3">
                 {documentsWithUrls?.map((doc) => (
                   <div key={doc.id} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-200 hover:border-teal-200 transition-colors group">
                     <div className="flex items-center gap-4">
                       <div className="p-2 bg-white rounded-lg border border-gray-200 group-hover:border-teal-200 transition-colors">
                          <FileText className="h-5 w-5 text-gray-400 group-hover:text-teal-600 transition-colors" />
                       </div>
                       <div>
                         <p className="font-bold text-gray-900 group-hover:text-teal-700 transition-colors">{doc.title}</p>
                         <p className="text-xs text-gray-500 mt-0.5 font-medium">
                           {new Date(doc.created_at).toLocaleDateString()} • {((doc.file_size ?? 0) / 1024).toFixed(1)} KB
                         </p>
                       </div>
                     </div>
                     {doc.download_url && (
                       <a
                         href={doc.download_url}
                         target="_blank"
                         rel="noopener noreferrer"
                         className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-all text-sm font-medium shadow-sm hover:shadow"
                       >
                         <Download className="h-4 w-4 text-gray-500" />
                         Download
                       </a>
                     )}
                   </div>
                 ))}
                 {(!documentsWithUrls || documentsWithUrls.length === 0) && (
                   <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                       <FileText className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                       <p className="text-gray-500 text-sm">No documents uploaded yet</p>
                   </div>
                 )}
               </div>
             </div>
        </div>

        {/* Right Column: Advocate Info */}
        <div className="space-y-6">
             <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
               <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2 pb-4 border-b border-gray-100">
                 <Briefcase className="h-5 w-5 text-teal-600" />
                 Your Legal Counsel
               </h2>
               
               {advocateInfo ? (
                   <div className="space-y-4">
                       <div className="flex items-center gap-4">
                           <div className="h-12 w-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-800 font-bold text-lg">
                               {advocateInfo.initial}
                           </div>
                           <div>
                               <h3 className="font-bold text-gray-900 text-lg">{advocateInfo.name}</h3>
                               <p className="text-sm text-gray-500">Legal Counsel</p>
                           </div>
                       </div>
                       
                       <div className="space-y-3 pt-2">
                           {advocateInfo.email && (
                            <div className="flex items-center gap-3 text-gray-700">
                                <Mail className="h-4 w-4 text-gray-400" />
                                <span className="text-sm">{advocateInfo.email}</span>
                            </div>
                           )}
                           {advocateInfo.barNumber && (
                            <div className="flex items-center gap-3 text-gray-700">
                                <Scale className="h-4 w-4 text-gray-400" />
                                <span className="text-sm">Bar No: {advocateInfo.barNumber}</span>
                            </div>
                           )}
                       </div>

                       <div className="pt-4 mt-4 border-t border-gray-100">
                           <Link 
                                href={`/dashboard/client/messages?partner=${advocateInfo.id}`}
                                className="w-full py-2 bg-teal-50 text-teal-700 font-semibold rounded-lg hover:bg-teal-100 transition-colors text-sm flex items-center justify-center gap-2"
                           >
                               <Mail className="h-4 w-4" />
                               Send Message
                           </Link>
                       </div>
                   </div>
               ) : (
                   <p className="text-gray-500 text-sm italic">No advocate assigned explicitly.</p>
               )}
             </div>

             {/* Upcoming Hearing (Highlight) */}
             <div className="bg-gradient-to-br from-teal-50 to-white border border-teal-100 rounded-xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-teal-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Next Hearing
                </h3>
                {hearings.filter((h) => new Date(h.hearing_date) >= new Date()).length > 0 ? (
                    (() => {
                        const next = hearings.filter((h) => new Date(h.hearing_date) >= new Date())[0];
                        return (
                            <div>
                                <p className="text-3xl font-bold text-gray-900">
                                    {new Date(next.hearing_date).getDate()}
                                </p>
                                <p className="text-lg font-medium text-gray-600 mb-1">
                                    {new Date(next.hearing_date).toLocaleString('default', { month: 'long', year: 'numeric' })}
                                </p>
                                <div className="mt-3 inline-block px-3 py-1 bg-white border border-teal-200 rounded-lg text-teal-700 text-sm font-bold">
                                    {next.hearing_type}
                                </div>
                            </div>
                        );
                    })()
                ) : (
                    <div className="text-center py-4">
                        <p className="text-gray-500 font-medium">No upcoming hearings</p>
                    </div>
                )}
             </div>
        </div>
      </div>
    </div>
  );
}
