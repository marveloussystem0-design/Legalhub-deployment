import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, useColorScheme, TextInput
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/lib/auth-context';
import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Briefcase, Calendar, ChevronRight, Clock, Scale, Search, AlertTriangle, X, User, RefreshCw } from 'lucide-react-native';
import SyncModal from '@/components/SyncModal';

import { useFocusEffect, Link, useRouter } from 'expo-router';
import FAB from '@/components/FAB';

type TabKey = 'all' | 'needs_sync' | 'open' | 'closed';

// ── Helper: Parse various date formats including eCourts strings ───────────
const parseDate = (d: string | undefined): Date | null => {
  if (!d) return null;
  
  // 1. Remove ordinal suffixes: 1st, 2nd, 3rd, 4th...
  const clean = d.replace(/(\d+)(st|nd|rd|th)/, '$1');
  
  // 2. Try standard parsing
  let date = new Date(clean);
  if (!isNaN(date.getTime())) return date;

  // 3. Manual parse: "04 March 2026"
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

// ── Determine if a case needs an eCourts re-sync ─────────────────────────────
function isSyncOverdue(caseItem: any): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pastDates: Date[] = [];

  // 1. Relational hearings
  caseItem.case_hearings?.forEach((h: any) => {
    const d = parseDate(h.hearing_date);
    if (d) { d.setHours(0, 0, 0, 0); if (d < today) pastDates.push(d); }
  });

  // 2. DB next_hearing_date column
  const nhd = parseDate(caseItem.next_hearing_date);
  if (nhd) { nhd.setHours(0, 0, 0, 0); if (nhd < today) pastDates.push(nhd); }

  // 3. eCourts metadata string (e.g. "13th February 2026")
  const metaRaw = caseItem.metadata?.full_details?.['Next Hearing Date'];
  if (metaRaw) {
    const md = parseDate(metaRaw);
    if (md) { md.setHours(0, 0, 0, 0); if (md < today) pastDates.push(md); }
  }

  if (pastDates.length === 0) return false;

  const latestPast = pastDates.sort((a, b) => a.getTime() - b.getTime()).at(-1)!;
  // Fallback: Check both last_synced_at joined from ecourts_cases AND synced_at in metadata
  const lastSyncedStr: string | null = caseItem.last_synced_at || caseItem.metadata?.synced_at || null;
  
  if (!lastSyncedStr) return true; // Never synced

  const lastSynced = new Date(lastSyncedStr);
  lastSynced.setHours(0, 0, 0, 0);
  
  // Align with Web: If synced on the same day as a past hearing, it's NOT overdue.
  return latestPast.getTime() > lastSynced.getTime();
}

// ── Get the most relevant hearing (Upcoming preferred, then Metadata) ────────
function getNextHearing(caseItem: any) {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const candidates: Array<{ date: string; type: string }> = [];

  // Helper to normalize to YYYY-MM-DD
  const normalize = (d: any) => {
    const parsed = parseDate(String(d));
    if (!parsed) return null;
    return parsed.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  };

  // 1. Relational hearings (Highest Priority)
  if (caseItem.case_hearings?.length > 0) {
    caseItem.case_hearings.forEach((h: any) => {
      const d = h.hearing_date;
      if (d && d >= todayStr) {
        candidates.push({ date: d, type: h.hearing_type || 'Hearing' });
      }
    });
  }
  
  // 2. DB next_hearing_date column
  const colDate = caseItem.next_hearing_date;
  if (colDate && colDate >= todayStr) {
    candidates.push({ date: colDate, type: 'Hearing' });
  }
  
  // 3. eCourts metadata string
  const metaRaw = caseItem.metadata?.full_details?.['Next Hearing Date'];
  const metaDate = normalize(metaRaw);
  if (metaDate && metaDate >= todayStr) {
    candidates.push({ 
      date: metaDate, 
      type: caseItem.metadata?.full_details?.['Case Stage'] || 'Next Hearing' 
    });
  }
  
  if (candidates.length === 0) return null;

  // Sort by date ascending and pick the earliest upcoming one
  candidates.sort((a, b) => a.date.localeCompare(b.date));
  return { hearing_date: candidates[0].date, hearing_type: candidates[0].type };
}

export default function CasesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sync state
  const [syncingCase, setSyncingCase] = useState<{ id: string, cnr: string } | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('all');

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const isAdvocate = user?.user_metadata?.role === 'advocate';

  const fetchCases = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Case IDs for this user
      // Primary source: participant links. Fallback: cases created by this user.
      const [participationsRes, ownedCasesRes] = await Promise.all([
        supabase
          .from('case_participants')
          .select('case_id')
          .eq('user_id', user.id),
        supabase
          .from('cases')
          .select('id')
          .eq('created_by', user.id)
      ]);
      if (participationsRes.error) throw participationsRes.error;
      if (ownedCasesRes.error) throw ownedCasesRes.error;

      const caseIds = Array.from(
        new Set([
          ...(participationsRes.data?.map(p => p.case_id) || []),
          ...(ownedCasesRes.data?.map(c => c.id) || [])
        ])
      );
      if (caseIds.length === 0) {
        setCases([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // 2. Cases + hearings + sync links in parallel
      const [casesRes, hearingsRes, syncLinksRes, preferencesRes] = await Promise.all([
        supabase.from('cases').select('*').in('id', caseIds).order('created_at', { ascending: false }),
        supabase.from('case_hearings').select('case_id, hearing_date, hearing_type').in('case_id', caseIds).order('hearing_date', { ascending: true }),
        supabase.from('case_ecourts_links').select('case_id, ecourts_cases(last_synced_at)').in('case_id', caseIds),
        supabase.from('case_user_preferences').select('case_id, display_title').eq('user_id', user.id).in('case_id', caseIds),
      ]);

      if (casesRes.error) throw casesRes.error;
      if (preferencesRes.error) throw preferencesRes.error;

      // Merge next_hearing and last_synced_at into each case
      const hearingsMap = new Map<string, any[]>();
      hearingsRes.data?.forEach(h => {
        if (!hearingsMap.has(h.case_id)) hearingsMap.set(h.case_id, []);
        hearingsMap.get(h.case_id)!.push(h);
      });

      const syncMap = new Map<string, string | null>();
      syncLinksRes.data?.forEach(l => {
        const ecObj = l.ecourts_cases as any;
        const synced = Array.isArray(ecObj)
          ? ecObj[0]?.last_synced_at
          : ecObj?.last_synced_at;
        syncMap.set(l.case_id, synced || null);
      });

      const preferenceMap = new Map<string, string | null>();
      preferencesRes.data?.forEach(row => {
        preferenceMap.set(row.case_id, row.display_title || null);
      });

      const merged = (casesRes.data || []).map(c => ({
        ...c,
        display_title: preferenceMap.get(c.id) || null,
        case_hearings: hearingsMap.get(c.id) || [],
        last_synced_at: syncMap.get(c.id) ?? null,
      }));

      setCases(merged);
    } catch (error) {
      console.error('Error fetching cases:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { if (user) fetchCases(); }, [user, fetchCases]));
  const onRefresh = useCallback(() => { setRefreshing(true); fetchCases(); }, [fetchCases]);

  // ── Filter logic ────────────────────────────────────────────────────────────
  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      if (activeTab === 'needs_sync' && !isSyncOverdue(c)) return false;
      if (activeTab === 'open' && c.status !== 'open') return false;
      if (activeTab === 'closed' && c.status !== 'closed') return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const titleToMatch = c.display_title || c.title || '';
      return (
        titleToMatch.toLowerCase().includes(q) ||
        c.case_number?.toLowerCase().includes(q) ||
        c.court_name?.toLowerCase().includes(q)
      );
    });
  }, [cases, searchQuery, activeTab]);

  const overdueCount = useMemo(() => cases.filter(isSyncOverdue).length, [cases]);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const d = parseDate(dateString);
    if (!d) return dateString; // Return as-is if parsing fails
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const tabs: { key: TabKey; label: string; count?: number; accent?: boolean }[] = isAdvocate
    ? [
        { key: 'all', label: 'All' },
        { key: 'needs_sync', label: 'Needs Sync', count: overdueCount, accent: true },
        { key: 'open', label: 'Open' },
        { key: 'closed', label: 'Closed' },
      ]
    : [
        { key: 'all', label: 'All' },
        { key: 'open', label: 'Open' },
        { key: 'closed', label: 'Closed' },
      ];

  const renderItem = ({ item }: { item: any }) => {
    const nextHearing = getNextHearing(item);
    const overdue = isSyncOverdue(item);
    const hasCnr = !!(item.cnr_number || item.cino);

    return (
        <TouchableOpacity 
          style={[styles.card, { backgroundColor: theme.surface, borderColor: isAdvocate && overdue ? '#FED7AA' : theme.border }]}
          activeOpacity={0.7}
          onPress={() => router.push({ pathname: '/cases/[id]', params: { id: item.id } })}
        >
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={[styles.caseIcon, { backgroundColor: theme.tint + '15' }]}>
            <Briefcase size={20} color={theme.tint} />
          </View>
          <View style={styles.headerContent}>
            <Text style={[styles.caseTitle, { color: theme.text }]} numberOfLines={1}>
              {item.display_title || item.title}
            </Text>
            <View style={styles.caseSubHeader}>
              <Text style={[styles.caseNumber, { color: theme.icon }]}>{item.case_number}</Text>
              <View style={[styles.miniStatusDot, { backgroundColor: item.status === 'open' ? '#3B82F6' : '#9CA3AF' }]} />
            </View>
          </View>
          <ChevronRight size={18} color={theme.icon} style={{ alignSelf: 'center' }} />
        </View>

        {/* Sync Overdue Badge */}
        {isAdvocate && overdue && (
          <View style={styles.overdueRow}>
            <AlertTriangle size={12} color="#C2410C" />
            <Text style={styles.overdueText}>Sync Overdue</Text>
          </View>
        )}

        <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />

        {/* Meta row */}
        <View style={styles.cardMeta}>
          <View style={styles.metaItemMain}>
            <Scale size={14} color={theme.icon} />
            <Text style={[styles.metaText, { color: theme.icon }]} numberOfLines={1}>{item.case_type}</Text>
          </View>
          {nextHearing ? (
            <View style={[styles.metaItemBadge, { backgroundColor: '#4ADE8015' }]}>
              <Calendar size={12} color="#16A34A" />
              <Text style={[styles.metaText, { color: '#16A34A', fontWeight: '700' }]}>{formatDate(nextHearing.hearing_date)}</Text>
            </View>
          ) : (
            <View style={[styles.metaItemBadge, { backgroundColor: (item.metadata?.full_details?.['Nature of Disposal'] || item.metadata?.full_details?.['Case Status'] || item.metadata?.full_details?.['Case Stage']) ? theme.tint + '10' : '#EF444410' }]}>
              <Clock size={12} color={(item.metadata?.full_details?.['Nature of Disposal'] || item.metadata?.full_details?.['Case Status'] || item.metadata?.full_details?.['Case Stage']) ? theme.tint : '#EF4444'} />
              <Text style={[styles.metaText, { color: (item.metadata?.full_details?.['Nature of Disposal'] || item.metadata?.full_details?.['Case Status'] || item.metadata?.full_details?.['Case Stage']) ? theme.tint : '#EF4444', fontWeight: '700' }]}>
                {(item.metadata?.full_details?.['Nature of Disposal'] || item.metadata?.full_details?.['Case Status'] || item.metadata?.full_details?.['Case Stage'] || 'Not Synced').toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Action Row - Restored */}
        {isAdvocate && hasCnr && (
          <View style={[styles.actionRow, { borderTopColor: theme.border }]}>
            <TouchableOpacity 
              style={[styles.syncBtn, { borderColor: theme.tint + '50', backgroundColor: theme.tint + '08' }]}
              onPress={() => setSyncingCase({ id: item.id, cnr: item.cnr_number || item.cino })}
            >
              <RefreshCw size={12} color={theme.tint} />
              <Text style={[styles.syncBtnText, { color: theme.tint }]}>Sync eCourts</Text>
            </TouchableOpacity>
            
            <View style={styles.viewBtn}>
              <Text style={[styles.viewBtnText, { color: theme.icon }]}>View Details</Text>
              <ChevronRight size={14} color={theme.icon} />
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>My Cases</Text>
          <Text style={[styles.headerSubtitle, { color: theme.icon }]}>{cases.length} matters</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/profile')}
          style={styles.profileButton}
        >
          <View style={[styles.profileCircle, { borderColor: theme.tint }]}>
            <User size={20} color={theme.tint} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Search size={16} color={theme.icon} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search by title, number, court..."
          placeholderTextColor={theme.icon}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X size={16} color={theme.icon} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: theme.surfaceVariant || theme.surface }]}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.key;
          const accentActive = tab.accent && isActive;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && (accentActive ? styles.tabActiveAccent : styles.tabActive)]}
              onPress={() => setActiveTab(tab.key)}
            >
              {tab.accent && <AlertTriangle size={11} color={isActive ? '#fff' : '#EA580C'} />}
              <Text style={[styles.tabText, {
                color: isActive ? (accentActive ? '#fff' : theme.text) : theme.icon,
                fontWeight: isActive ? '700' : '500',
              }]}>{tab.label}</Text>
              {tab.count !== undefined && tab.count > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : '#FED7AA' }]}>
                  <Text style={[styles.tabBadgeText, { color: isActive ? '#fff' : '#C2410C' }]}>{tab.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      ) : (
        <FlatList
          data={filteredCases}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconCircle, { backgroundColor: theme.text + '10' }]}>
                <Briefcase size={32} color={theme.icon} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {activeTab === 'needs_sync' ? 'All Cases Up to Date' :
                 searchQuery ? 'No Matches Found' : 'No Cases Found'}
              </Text>
              <Text style={[styles.emptyText, { color: theme.icon }]}>
                {activeTab === 'needs_sync' ? 'No cases are overdue for an eCourts sync.' :
                 searchQuery ? 'Try a different search term.' :
                 "You haven't been assigned to any cases yet."}
              </Text>
            </View>
          }
        />
      )}

      {isAdvocate && (
        <FAB 
          label="Add Case via CNR" 
          onPress={() => router.push('/cases/create')} 
        />
      )}

      {/* Sync Modal */}
      {isAdvocate && syncingCase && (
        <SyncModal
          isVisible={!!syncingCase}
          onClose={() => setSyncingCase(null)}
          cnrNumber={syncingCase.cnr}
          caseId={syncingCase.id}
          onSyncSuccess={fetchCases}
        />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    paddingTop: 40,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 24, fontWeight: '800', letterSpacing: 0.5 },
  headerSubtitle: { fontSize: 13, fontWeight: '600' },

  profileButton: {},
  profileCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14 },

  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 12,
    padding: 4,
    gap: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 9,
  },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  tabActiveAccent: { backgroundColor: '#EA580C' },
  tabText: { fontSize: 12 },
  tabBadge: { borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1 },
  tabBadgeText: { fontSize: 10, fontWeight: '700' },

  listContent: { padding: 16, gap: 14, paddingBottom: 100 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  caseIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  headerContent: { flex: 1 },
  caseTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  caseSubHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  caseNumber: { fontSize: 12, fontFamily: 'monospace' },
  miniStatusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  statusOpen: { backgroundColor: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.2)' },
  statusClosed: { backgroundColor: 'rgba(107,114,128,0.1)', borderColor: 'rgba(107,114,128,0.2)' },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  statusTextOpen: { color: '#60A5FA' },
  statusTextClosed: { color: '#9CA3AF' },

  overdueRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FFF7ED', borderRadius: 8, alignSelf: 'flex-start' },
  overdueText: { fontSize: 11, fontWeight: '700', color: '#C2410C' },

  cardDivider: { height: 1, marginVertical: 14 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  metaItemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaItemBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  metaText: { fontSize: 12, fontWeight: '500' },

  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTopWidth: 1 },
  syncBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderRadius: 10 },
  syncBtnText: { fontSize: 12, fontWeight: '600' },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  viewBtnText: { fontSize: 13, fontWeight: '600' },

  emptyState: { marginTop: 60, alignItems: 'center' },
  emptyIconCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  emptyText: { textAlign: 'center', lineHeight: 20, paddingHorizontal: 30 },
});
