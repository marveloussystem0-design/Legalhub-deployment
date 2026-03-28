import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

import {
  Briefcase,
  Calendar,
  Users,
  Scale,
  Globe,
  BookOpen,
} from "lucide-react";
import AddParticipantModal from "./add-participant-modal";
import CaseTimeline from "@/components/dashboard/case-timeline";
import SyncCaseButton from "@/components/cases/sync-case-button";
import DeleteCaseButton from "@/components/cases/delete-case-button";
import CopyButton from "@/components/common/copy-button";
import EditableTitle from "./editable-title";
import RemoveParticipantButton from "@/components/cases/remove-participant-button";

type TimelineEvent = {
  id: string;
  type: "hearing" | "status_change" | "document" | "filing" | "order";
  title: string;
  description?: string;
  date: string;
  metadata?: Record<string, unknown>;
};

type MetadataAct = {
  act?: string | null;
  section?: string | null;
};

type MetadataHistoryEntry = {
  business_date?: string | null;
  hearing_date?: string | null;
  purpose?: string | null;
  judge?: string | null;
};

type CaseMetadata = {
  acts?: MetadataAct[];
  history?: MetadataHistoryEntry[];
  qr_code_link?: string | null;
  full_details?: Record<string, unknown>;
  [key: string]: unknown;
};

type CaseHearing = {
  id: string;
  hearing_date: string;
  hearing_type?: string | null;
  notes?: string | null;
  status?: string | null;
};

type CaseDocument = {
  id: string;
  title?: string | null;
  file_url?: string | null;
  file_type?: string | null;
  created_at?: string | null;
  file_size?: number | null;
  download_url?: string | null;
};

type CaseParticipantDetail = { full_name?: string | null } | null;

type CaseParticipant = {
  user_id: string;
  role: string;
  users?: { email?: string | null };
  profiles?: { full_name?: string | null };
  clients?: CaseParticipantDetail[];
  advocates?: CaseParticipantDetail[];
};

type EcourtsCase = {
  judge_name?: string | null;
  petitioner?: string | null;
  respondent?: string | null;
  registration_date?: string | null;
  filing_date?: string | null;
  case_type?: string | null;
};

type CaseDetailData = {
  id: string;
  title?: string | null;
  display_title?: string | null;
  case_number?: string | null;
  cnr_number?: string | null;
  cino?: string | null;
  case_type?: string | null;
  petitioner_name?: string | null;
  respondent_name?: string | null;
  court_name?: string | null;
  status: string;
  next_hearing_date?: string | null;
  disposal_nature?: string | null;
  outcome_date?: string | null;
  metadata?: CaseMetadata | null;
  ecourts?: EcourtsCase | null;
  case_participants?: CaseParticipant[];
  case_hearings?: CaseHearing[];
  documents?: CaseDocument[];
};

function parseTimelineDate(value?: string | null) {
  if (!value) return null;
  const match = value.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  return new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`).toISOString();
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeTimelineLabel(value?: string | null) {
  return (value || "hearing").trim().toLowerCase().replace(/\s+/g, " ");
}

function buildCaseTimelineEvents(caseData: CaseDetailData): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const seen = new Set<string>();

  const pushUnique = (event: TimelineEvent, signature: string) => {
    if (!event?.date || !signature || seen.has(signature)) return;
    seen.add(signature);
    events.push(event);
  };

  const filingRaw =
    caseData.metadata?.full_details?.["Filing Date"] ||
    caseData.metadata?.full_details?.["Filing Number"];
  const filingDate = parseTimelineDate(asText(filingRaw));
  if (filingDate) {
    pushUnique(
      {
        id: "official-filing",
        type: "filing" as const,
        title: "Case Filed (Official)",
        date: filingDate,
        description: `Officially filed on ${filingRaw}`,
      },
      `filing|${filingDate.slice(0, 10)}`
    );
  }

  const registrationRaw =
    caseData.metadata?.full_details?.["Registration Date"] ||
    caseData.metadata?.full_details?.["Registration Number"];
  const registrationDate = parseTimelineDate(asText(registrationRaw));
  if (registrationDate) {
    pushUnique(
      {
        id: "official-registration",
        type: "status_change" as const,
        title: "Case Registered (Official)",
        date: registrationDate,
        description: `Officially registered on ${registrationRaw}`,
      },
      `registration|${registrationDate.slice(0, 10)}`
    );
  }

  (caseData.case_hearings || []).forEach((hearing) => {
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
        description: hearing.notes ?? undefined,
        metadata: {
          type: hearing.hearing_type,
          status: hearing.status,
        },
      },
      `hearing|${hearing.hearing_date.slice(0, 10)}|${normalizeTimelineLabel(label)}`
    );
  });

  (caseData.documents || []).forEach((document) => {
    if (!document?.created_at) return;
    pushUnique(
      {
        id: `doc-${document.id}`,
        type: "document" as const,
        title: "Document Uploaded",
        date: document.created_at,
        description: document.title ?? undefined,
        metadata: { size: `${((document.file_size ?? 0) / 1024).toFixed(1)} KB` },
      },
      `document|${document.id}`
    );
  });

  (caseData.metadata?.history || []).forEach((entry, index) => {
    const eventDate =
      parseTimelineDate(entry.business_date) ||
      parseTimelineDate(entry.hearing_date);
    if (!eventDate) return;

    const label = entry.purpose === "None" ? "Hearing Update" : entry.purpose || "Hearing";
    pushUnique(
      {
        id: `ecourts-h-${index}`,
        type:
          label.toLowerCase().includes("judgment") ||
          label.toLowerCase().includes("order")
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

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { id: caseId } = await params;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 1. Fetch case details (simple fetch)
  const { data: caseResult } = await supabase
    .from("cases")
    .select("*")
    .eq("id", caseId)
    .maybeSingle();

  if (!caseResult) {
    redirect("/dashboard/advocate/cases");
  }

  // 1.5 Fetch linked eCourts data (for clean fields)
  let ecourtsData = null;
  if (caseResult?.cnr_number) {
    const { data: ec } = await supabase
      .from("ecourts_cases")
      .select("*")
      .eq("cnr_number", caseResult.cnr_number)
      .single();
    ecourtsData = ec;
  }

  const { data: preferenceRow } = await supabase
    .from("case_user_preferences")
    .select("display_title")
    .eq("case_id", caseId)
    .eq("user_id", user.id)
    .maybeSingle();

  // 2. Fetch participants
  const { data: participants } = await supabase
    .from("case_participants")
    .select("user_id, role")
    .eq("case_id", caseId);

  // 3. Fetch participant details (sequentially to avoid join issues)
  const fullParticipants = await Promise.all(
    (participants || []).map(async (p: { user_id: string; role: string }) => {
      let details = null;
      let email = "";
      let profileName: string | null = null;

      // Profiles is the canonical source for participant identity.
      const { data: userData } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", p.user_id)
        .maybeSingle();
      email = userData?.email || "";
      profileName = userData?.full_name || null;

      if (p.role === "client") {
        const { data: client } = await supabase
          .from("clients")
          .select("full_name")
          .eq("user_id", p.user_id)
          .single();
        details = client;
      } else if (p.role === "advocate") {
        const { data: advocate } = await supabase
          .from("advocates")
          .select("full_name")
          .eq("user_id", p.user_id)
          .single();
        details = advocate;
      }

      return {
        ...p,
        users: { email },
        profiles: { full_name: profileName },
        clients: p.role === "client" ? [details] : [],
        advocates: p.role === "advocate" ? [details] : [],
      };
    }),
  );

  // 4. Fetch hearings (safely)
  const { data: hearings } = await supabase
    .from("case_hearings")
    .select("id, hearing_date, hearing_type, notes")
    .eq("case_id", caseId)
    .order("hearing_date", { ascending: true });

  // 5. Fetch documents
  const { data: documents } = await supabase
    .from("documents")
    .select("id, title, file_url, file_type, created_at, file_size")
    .eq("case_id", caseId);

  // 6. Construct final object with signed URLs for documents
  const documentsWithUrls = await Promise.all(
    (documents || []).map(async (doc: CaseDocument) => {
      if (!doc.file_url) {
        return {
          ...doc,
          download_url: null,
        };
      }

      const { data: signedUrl } = await supabase.storage
        .from("case-documents")
        .createSignedUrl(doc.file_url, 3600); // 1 hour expiry

      return {
        ...doc,
        download_url: signedUrl?.signedUrl || null,
      };
    }),
  );

  const caseData: CaseDetailData | null = caseResult
    ? {
        ...caseResult,
        display_title: preferenceRow?.display_title || null,
        ecourts: ecourtsData, // Attach eCourts data
        case_participants: fullParticipants,
        case_hearings: hearings || [],
        documents: documentsWithUrls,
      }
    : null;

  if (!caseData) {
    return <div>Case not found</div>;
  }

  return (
    <div className="space-y-5 font-sans">
      <div className="space-y-2">
        <div className="flex justify-end items-center">
          <div className="flex items-center gap-2">
            <SyncCaseButton
              caseId={caseId}
              cnrNumber={caseData.cnr_number ?? caseData.cino ?? undefined}
            />
            <DeleteCaseButton caseId={caseId} />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest mb-1">
            Custom Case Name
          </p>
          <EditableTitle
            caseId={caseId}
            initialTitle={caseData.display_title || caseData.title || ""}
          />
          <div className="flex items-center gap-2 mt-1">
            <span className="text-gray-500 font-bold text-sm">
              {caseData.title}
            </span>
            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
              Official Title
            </span>
          </div>
          <p className="text-gray-400 text-xs mt-1">
            Case #{caseData.case_number}
          </p>
        </div>
      </div>

      {/* Case Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Acts & Sections */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Acts & Sections
          </p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {caseData.metadata?.acts && caseData.metadata.acts.length > 0 ? (
              caseData.metadata.acts.map((act, i: number) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-100 rounded text-xs font-bold"
                >
                  {act.act} {act.section}
                </span>
              ))
            ) : (
              <p className="text-lg font-bold text-gray-900 capitalize flex items-center gap-2">
                <Scale className="h-4 w-4 text-teal-600" />
                {caseData.case_type}
              </p>
            )}
          </div>
        </div>

        {/* Card 2: Court */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Court
          </p>
          <p className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-teal-600" />
            {caseData.court_name || "Not specified"}
          </p>
        </div>

        {/* Card 3: Status */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Status
          </p>
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-sm font-bold border inline-block ${
                caseData.status === "open"
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-gray-100 text-gray-700 border-gray-200"
              }`}
            >
              {caseData.status.toUpperCase()}
            </span>

          </div>
        </div>
      </div>

      {/* Official Case Information Section (Moved from bottom) */}
      {(caseData.metadata?.full_details || caseData.ecourts) && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-teal-600" />
              Official Case Details
            </h2>
            {caseData.metadata?.qr_code_link && (
              <a
                href={
                  caseData.metadata.qr_code_link.startsWith("http")
                    ? caseData.metadata.qr_code_link
                    : `https://services.ecourts.gov.in${caseData.metadata.qr_code_link.startsWith("/") ? "" : "/ecourtindia_v6/"}${caseData.metadata.qr_code_link}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-bold shadow-sm"
              >
                <Globe className="h-4 w-4" />
                View eCourts QR Code
              </a>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 text-sm">
            {(() => {
              const details = (caseData.metadata?.full_details || {}) as Record<
                string,
                unknown
              >;
              const clean = (v: unknown): string => {
                if (v === null || v === undefined) return "";
                const s = String(v).trim();
                if (!s || s === "None" || s === "Unknown" || s === "-") return "";
                return s;
              };
              const readDetail = (...keys: string[]): string => {
                for (const key of keys) {
                  const val = clean(details[key]);
                  if (val) return val;
                }
                return "";
              };
              const formatIso = (value?: string | null): string => {
                if (!value) return "";
                const d = new Date(value);
                return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB");
              };

              const officialRows: Array<{ label: string; value: string }> = [
                {
                  label: "Judge Name",
                  value:
                    clean(caseData.ecourts?.judge_name) ||
                    readDetail("Judge Name", "Court Number and Judge", "Judge"),
                },
                {
                  label: "Petitioner",
                  value:
                    clean(caseData.petitioner_name) ||
                    clean(caseData.ecourts?.petitioner) ||
                    readDetail("Petitioner"),
                },
                {
                  label: "Respondent",
                  value:
                    clean(caseData.respondent_name) ||
                    clean(caseData.ecourts?.respondent) ||
                    readDetail("Respondent"),
                },
                {
                  label: "Registration Date",
                  value:
                    formatIso(caseData.ecourts?.registration_date) ||
                    readDetail("Registration Date"),
                },
                {
                  label: "Registration Number",
                  value: readDetail("Registration Number"),
                },
                {
                  label: "Filing Date",
                  value: formatIso(caseData.ecourts?.filing_date) || readDetail("Filing Date"),
                },
                {
                  label: "Filing Number",
                  value: readDetail("Filing Number"),
                },
                {
                  label: "Case Type",
                  value:
                    clean(caseData.case_type) ||
                    clean(caseData.ecourts?.case_type) ||
                    readDetail("Case Type"),
                },
                {
                  label: "Case Stage",
                  value: readDetail("Case Stage"),
                },
                {
                  label: "First Hearing Date",
                  value: readDetail("First Hearing Date"),
                },
                {
                  label: "Next Hearing Date",
                  value:
                    formatIso(caseData.next_hearing_date) ||
                    readDetail("Next Hearing Date", "Next Date (Purpose)", "Next Date"),
                },
                {
                  label: "CNR Number",
                  value: (
                    clean(caseData.cnr_number) ||
                    clean(caseData.cino) ||
                    readDetail("CNR Number", "CNR / CINO")
                  )
                    .replace(/\s*\(note.*$/i, "")
                    .replace(/\s*view qr code.*$/i, "")
                    .trim(),
                },
              ];

              const nextHearing = formatIso(caseData.next_hearing_date) || readDetail("Next Hearing Date", "Next Date (Purpose)", "Next Date");
              if (!nextHearing) {
                 officialRows.splice(officialRows.length - 1, 0, 
                    {
                       label: "Case Outcome",
                       value: clean(caseData.disposal_nature) || readDetail("Nature of Disposal", "Decision")
                    },
                    {
                       label: "Decision Date",
                       value: formatIso(caseData.outcome_date) || readDetail("Decision Date", "Disposal Date")
                    }
                 );
              }

              return officialRows
                .filter((row) => row.value)
                .map((row) => (
                  <div
                    key={`${row.label}-${row.value}`}
                    className="flex justify-between border-b border-gray-50 pb-2"
                  >
                    <span className="text-gray-500 font-medium">{row.label}</span>
                    <span className="ml-4 flex items-center gap-2 text-gray-900 font-semibold text-right">
                      <span>{row.value}</span>
                      {row.label === "CNR Number" && (
                        <CopyButton value={row.value} label="Copy" />
                      )}
                    </span>
                  </div>
                ));
            })()}
          </div>
        </div>
      )}

      {/* Participants & Next Hearings - Compact Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Participants */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Users className="h-4 w-4 text-teal-600" />
              Team & Clients
            </h2>
            <AddParticipantModal caseId={caseId} />
          </div>
          <div className="space-y-1">
            {caseData.case_participants?.map((participant) => {
              const name =
                participant.clients?.[0]?.full_name ||
                participant.advocates?.[0]?.full_name ||
                participant.profiles?.full_name ||
                (participant.users?.email
                  ? participant.users.email.split("@")[0]
                  : null) ||
                "Unknown";
              const initial = name.charAt(0).toUpperCase();
              return (
                <div
                  key={`${participant.user_id}-${participant.role}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border ${
                        participant.role === "advocate"
                          ? "bg-purple-50 text-purple-700 border-purple-100"
                          : "bg-blue-50 text-blue-700 border-blue-100"
                      }`}
                    >
                      {initial}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm leading-tight">
                        {name}
                      </p>
                      <p className="text-xs text-gray-500 leading-tight">
                        {participant.role.charAt(0).toUpperCase() +
                          participant.role.slice(1)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-gray-400 group-hover:text-gray-600 transition-colors">
                      {participant.users?.email
                        ? participant.users.email.split("@")[0]
                        : "user"}
                    </div>
                    {participant.role === "client" && (
                      <RemoveParticipantButton
                        caseId={caseId}
                        userId={participant.user_id}
                        role={participant.role}
                        label={name}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hearings List (Compact) */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-teal-600" />
              Upcoming
            </h2>
          </div>
          <div className="space-y-1">
            {(() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const upcoming = (caseData.case_hearings || []).filter(
                (h) => new Date(h.hearing_date) >= today,
              );
              if (upcoming.length === 0)
                return (
                  <div className="text-center py-6">
                    <Calendar className="h-8 w-8 text-gray-200 mx-auto mb-1" />
                    <p className="text-gray-400 text-xs text-center">
                      No upcoming hearings
                    </p>
                  </div>
                );
              return upcoming.map((hearing) => (
                <div
                  key={hearing.id}
                  className="p-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors"
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-teal-500"></div>
                      <span className="font-semibold text-gray-900 text-sm">
                        {new Date(hearing.hearing_date).toLocaleDateString(
                          "en-IN",
                          {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          },
                        )}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide bg-gray-100 px-1.5 py-0.5 rounded">
                      {hearing.hearing_type}
                    </span>
                  </div>
                  {hearing.notes && (
                    <p className="text-xs text-gray-500 pl-3.5 line-clamp-1">
                      {hearing.notes}
                    </p>
                  )}
                </div>
              ));
            })()}
          </div>
        </div>
      </div>

      {/* Full Width Layout for Main Content */}
      <div className="space-y-6">
        {/* Timeline & Documents - Full Width */}
        <div className="space-y-6">
          {/* Timeline */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-teal-600" />
                Case History
              </h2>
            </div>
            <CaseTimeline
              events={buildCaseTimelineEvents(caseData)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
