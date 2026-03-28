'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, Calendar, Users, FileText, AlertTriangle, RefreshCw } from 'lucide-react';
import SyncCaseButton from '@/components/cases/sync-case-button';

interface CaseParticipant {
  role?: string | null;
  clients?: { full_name?: string | null } | Array<{ full_name?: string | null }> | null;
  advocates?: { full_name?: string | null } | Array<{ full_name?: string | null }> | null;
  profiles?: { full_name?: string | null } | null;
  users?: { email?: string | null } | null;
}

interface CaseHearing {
  hearing_date?: string | null;
  hearing_type?: string | null;
}

interface CaseMetadata {
  synced_at?: string | null;
  outcome?: string | null;
  full_details?: Record<string, string | null | undefined>;
}

interface CaseListItem {
  id: string;
  title?: string | null;
  display_title?: string | null;
  case_number?: string | null;
  court_name?: string | null;
  status: 'open' | 'closed' | string;
  next_hearing_date?: string | null;
  filing_date?: string | null;
  last_synced_at?: string | null;
  cnr_number?: string | null;
  cino?: string | null;
  metadata?: CaseMetadata | null;
  case_hearings?: CaseHearing[] | null;
  case_participants?: CaseParticipant[] | null;
}

interface CaseListViewProps {
  cases: CaseListItem[];
  hideTabs?: boolean;
}

function resolveParticipantName(p: CaseParticipant): string {
  const clientName = Array.isArray(p?.clients)
    ? p.clients?.[0]?.full_name
    : p?.clients?.full_name;

  const advocateName = Array.isArray(p?.advocates)
    ? p.advocates?.[0]?.full_name
    : p?.advocates?.full_name;

  const profileName = p?.profiles?.full_name;
  const emailPrefix =
    typeof p?.users?.email === 'string' && p.users.email.includes('@')
      ? p.users.email.split('@')[0]
      : null;

  return clientName || advocateName || profileName || emailPrefix || 'Unknown Client';
}

export default function CaseListView({ cases, hideTabs = false }: CaseListViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'needs_sync' | 'open' | 'closed'>('all');

  // Helper: detect if a case needs syncing (hearing passed, not yet synced)
  const isSyncOverdue = (caseItem: CaseListItem): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Collect all past hearing dates (as Date objects)
    const pastHearingDates: Date[] = [];

    // Helper to parse "13th February 2026" or "2026-02-13" styles
    const parseDate = (d: string | null | undefined): Date | null => {
      if (!d) return null;
      // Try standard Date parse first (handles ISO "2026-02-13")
      const date = new Date(d);
      if (!isNaN(date.getTime())) return date;
      
      // Manual parse: "04th March 2026"
      const clean = d.replace(/(\d+)(st|nd|rd|th)/, '$1');
      const months: Record<string, number> = {
        'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
        'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11,
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'jun': 5, 'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
      };
      const parts = clean.trim().split(/\s+/);
      if (parts.length === 3) {
        const dayNum = parseInt(parts[0], 10);
        const monthStr = parts[1].toLowerCase();
        const yearNum = parseInt(parts[2], 10);
        if (!isNaN(dayNum) && !isNaN(yearNum) && months[monthStr] !== undefined) {
          return new Date(yearNum, months[monthStr], dayNum);
        }
      }

      return null;
    };

    // 1. Check relational hearings
    const hearings = caseItem.case_hearings ?? [];
    if (hearings.length > 0) {
      hearings.forEach((h) => {
        const date = parseDate(h.hearing_date);
        if (date) {
            date.setHours(0, 0, 0, 0);
            if (date < today) pastHearingDates.push(date);
        }
      });
    }

    // 2. Check DB column next_hearing_date
    const nhd = parseDate(caseItem.next_hearing_date);
    if (nhd) {
        nhd.setHours(0, 0, 0, 0);
        if (nhd < today) pastHearingDates.push(nhd);
    }

    // 3. IMPORTANT: Check Metadata "Next Hearing Date" (Text format like "13th February 2026")
    // This is often what is displayed on the card even if DB columns are empty
    const metadataNextHearing = caseItem.metadata?.full_details?.['Next Hearing Date'];
    if (metadataNextHearing) {
        const metaDate = parseDate(metadataNextHearing);
        if (metaDate) {
            metaDate.setHours(0,0,0,0);
             if (metaDate < today) pastHearingDates.push(metaDate);
        }
    }

    if (pastHearingDates.length === 0) return false;

    // Most recent past hearing
    const latestPastHearing = pastHearingDates.sort((a, b) => a.getTime() - b.getTime()).at(-1)!;

    // Source 1: Direct column (New)
    // Source 2: Metadata (Internal)
    // Source 3: Junction link (Passed from page.tsx)
    const lastSyncedStr: string | null = caseItem.last_synced_at || caseItem.metadata?.synced_at || null;
    
    if (!lastSyncedStr) return true; // Never synced

    const lastSyncedDate = new Date(lastSyncedStr);
    
    // Set both to start of day for stable "Day-over-Day" comparison
    const hearingDay = new Date(latestPastHearing);
    hearingDay.setHours(0, 0, 0, 0);
    
    const syncDay = new Date(lastSyncedDate);
    syncDay.setHours(0, 0, 0, 0);

    // If hearing was AFTER our last sync day, we need a refresh.
    // If they are on the same day, we assume the sync happened for that hearing.
    const isOverdue = hearingDay.getTime() > syncDay.getTime();

    if (isOverdue && typeof window !== 'undefined') {
        // console.log(`[Debug] Case ${caseItem.title} is overdue. Latest Past: ${hearingDay.toDateString()}, Last Sync: ${syncDay.toDateString()}`);
    }

    return isOverdue;
  };

  const filteredCases = useMemo(() => {
    const result = cases.filter((caseItem) => {
      // 1. Filter by tab
      if (activeTab === 'needs_sync') {
        if (!isSyncOverdue(caseItem)) return false;
      } else if (activeTab === 'open') {
        if (caseItem.status !== 'open') return false;
      } else if (activeTab === 'closed') {
        if (caseItem.status !== 'closed') return false;
      }

      // 2. Filter by search query
      if (searchQuery.trim() === '') return true;

      const query = searchQuery.toLowerCase();
      const title = caseItem.title?.toLowerCase() || '';
      const displayTitle = caseItem.display_title?.toLowerCase() || '';
      const caseNumber = caseItem.case_number?.toLowerCase() || '';
      const courtName = caseItem.court_name?.toLowerCase() || '';
      
      const clients = caseItem.case_participants
        ?.filter((p) => p.role === 'client')
        .map((p) => resolveParticipantName(p).toLowerCase())
        .join(' ');

      return (
        title.includes(query) ||
        displayTitle.includes(query) ||
        caseNumber.includes(query) ||
        courtName.includes(query) ||
        (clients && clients.includes(query))
      );
    });



    return result;
  }, [cases, searchQuery, activeTab]);

  const overdueCount = useMemo(() => cases.filter(isSyncOverdue).length, [cases]);



  // Helper to get next hearing with smart priority and parsing
  const getNextHearing = (caseItem: CaseListItem) => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Helper to parse various date formats into YYYY-MM-DD
    const normalizeDate = (d: unknown): string | null => {
      if (!d) return null;
      if (d instanceof Date) return d.toISOString().split('T')[0];
      
      const dateStr = String(d).trim();
      const dateObj = new Date(dateStr);
      if (!isNaN(dateObj.getTime())) return dateObj.toISOString().split('T')[0];
      
      // Handle "13th February 2026"
      const clean = dateStr.replace(/(\d+)(st|nd|rd|th)/, '$1');
      const d2 = new Date(clean);
      if (!isNaN(d2.getTime())) return d2.toISOString().split('T')[0];
      
      return null;
    };

    const candidates: Array<{ date: string; type: string }> = [];

    // 1. Check relational hearings (highest priority for accuracy)
    if (caseItem.case_hearings && caseItem.case_hearings.length > 0) {
      caseItem.case_hearings.forEach((h) => {
        const d = normalizeDate(h.hearing_date);
        if (d && d >= todayStr) {
          candidates.push({ date: d, type: h.hearing_type || 'Hearing' });
        }
      });
    }

    // 2. Check Case-Level column
    const colDate = normalizeDate(caseItem.next_hearing_date);
    if (colDate && colDate >= todayStr) {
      candidates.push({ date: colDate, type: 'Hearing' });
    }

    // 3. Check Metadata
    const metaDateRaw = caseItem.metadata?.full_details?.['Next Hearing Date'];
    const metaDate = normalizeDate(metaDateRaw);
    if (metaDate && metaDate >= todayStr) {
      candidates.push({ 
        date: metaDate, 
        type: caseItem.metadata?.full_details?.['Case Stage'] || 'Hearing' 
      });
    }

    if (candidates.length === 0) return null;

    // Sort by date ascending and pick the earliest upcoming one
    candidates.sort((a, b) => a.date.localeCompare(b.date));
    return candidates[0];
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by case title, number, client, or court..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all shadow-sm"
        />
      </div>

      {/* Tab Bar */}
      {!hideTabs && (
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-full overflow-x-auto">
          {([
            { key: 'all', label: 'All Cases' },
            { key: 'needs_sync', label: 'Needs Sync', count: overdueCount, accent: true },
            { key: 'open', label: 'Open' },
            { key: 'closed', label: 'Closed' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? ('accent' in tab)
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {'accent' in tab && <AlertTriangle className="h-3.5 w-3.5" />}
              {tab.label}
              {'count' in tab && tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-700'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="grid gap-4">
        {filteredCases.map((caseItem) => {
          const nextHearing = getNextHearing(caseItem);
          const syncOverdue = isSyncOverdue(caseItem);

          return (
             <div key={caseItem.id} className={`bg-white border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow ${
               syncOverdue ? 'border-orange-200' : 'border-gray-200'
             }`}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-gray-900">
                      {caseItem.display_title || caseItem.title}
                    </h3>
                    {caseItem.display_title && caseItem.display_title !== caseItem.title && (
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 italic">
                        {caseItem.title}
                      </span>
                    )}
                    {syncOverdue && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                        <AlertTriangle className="h-3 w-3" />
                        Sync Overdue
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600 border border-gray-200">
                      #{caseItem.case_number}
                    </span>
                    <span className="text-sm text-gray-500">•</span>
                    <span className="text-sm text-gray-600">{caseItem.court_name || 'Court not specified'}</span>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  caseItem.status === 'open' ? 'bg-green-50 text-green-700 border-green-200' : 
                  'bg-gray-100 text-gray-600 border-gray-200'
                }`}>
                  {caseItem.status.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="group flex items-start p-3 rounded-lg bg-gray-50 hover:bg-teal-50/50 transition-colors border border-transparent hover:border-teal-100">
                  <div className="p-2 bg-white rounded-md shadow-sm mr-3">
                    <Calendar className="h-4 w-4 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">
                      {caseItem.status === 'closed' ? 'Case Outcome' : 'Next Hearing'}
                    </p>
                    {caseItem.status === 'closed' ? (
                        <div className="text-gray-900 font-semibold">
                            {caseItem.metadata?.full_details?.['Nature of Disposal'] || caseItem.metadata?.outcome || 'Case Disposed'}
                            <span className="block text-xs text-gray-500 font-normal mt-0.5">
                                {caseItem.metadata?.full_details?.['Decision Date'] || 'Closed'}
                            </span>
                        </div>
                    ) : (
                      nextHearing ? (
                        <div className="text-gray-900 font-semibold">
                          {new Date(nextHearing.date).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                          <span className="block text-xs text-gray-500 font-normal mt-0.5">
                            {nextHearing.type || 'Scheduled'}
                          </span>
                        </div>
                      ) : (
                        <div className="text-gray-900 font-semibold">
                            Not Scheduled
                            <span className="block text-xs text-gray-400 font-normal mt-0.5">
                                Await listing
                            </span>
                        </div>
                      )
                    )}
                  </div>
                </div>

                <div className="flex items-start p-3 rounded-lg bg-gray-50 border border-transparent">
                  <div className="p-2 bg-white rounded-md shadow-sm mr-3">
                    <Users className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Clients</p>
                    <div className="text-gray-900 font-medium">
                    {(() => {
                      const clientParticipants = caseItem.case_participants?.filter((p) => p.role === 'client') || [];
                      if (clientParticipants.length === 0) {
                        return <span className="text-sm text-gray-400 italic">No clients assigned</span>;
                      }
                      return clientParticipants.map((p, idx: number) => (
                        <div key={idx} className="text-sm">
                          {resolveParticipantName(p)}
                        </div>
                      ));
                    })()}
                    </div>
                  </div>
                </div>

                <div className="flex items-start p-3 rounded-lg bg-gray-50 border border-transparent">
                  <div className="p-2 bg-white rounded-md shadow-sm mr-3">
                    <FileText className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Filed On</p>
                    <div className="text-gray-900 font-medium text-sm">
                      {(() => {
                        // Prioritize metadata from eCourts as it is the official source
                        const metadataDate = caseItem.metadata?.full_details?.['Filing Date'] || caseItem.metadata?.full_details?.['Filing Number'];
                        
                        if (metadataDate) return metadataDate;
                        
                        return caseItem.filing_date 
                          ? new Date(caseItem.filing_date).toLocaleDateString('en-GB')
                          : <span className="text-gray-400 italic text-xs">Not Available</span>;
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-5">
                <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider flex items-center gap-1.5">
                    <RefreshCw className="h-3 w-3" />
                    Last Synced: {(() => {
                        const ts = caseItem.last_synced_at || caseItem.metadata?.synced_at;
                        return ts ? new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never';
                    })()}
                </div>
                <div className="flex items-center gap-2">
                    <SyncCaseButton caseId={caseItem.id} cnrNumber={caseItem.cnr_number ?? caseItem.cino ?? undefined} />
                    <Link 
                      href={`/dashboard/advocate/cases/${caseItem.id}`}
                      className="inline-flex items-center text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors bg-teal-50 px-3 py-2 rounded-lg"
                    >
                      View Details
                      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </Link>
                </div>
              </div>
            </div>
          );
        })}

        {filteredCases.length === 0 && (
          <div className="text-center py-16 bg-white border border-dashed border-gray-300 rounded-xl">
             <div className="bg-gray-50 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Search className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">No Matches Found</h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              {cases.length === 0 
                ? "You haven't created any cases yet. Start by creating your first legal case." 
                : "No cases match your current search or filters."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
