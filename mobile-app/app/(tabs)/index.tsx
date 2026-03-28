import { View, Text, StyleSheet, ScrollView, RefreshControl, Image, Platform, useColorScheme, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/lib/auth-context';
import { Briefcase, Calendar, Scale, ChevronRight, Gavel, Bell, Clock } from 'lucide-react-native';
import { useCallback, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useFocusEffect, useRouter } from 'expo-router';
import FAB from '@/components/FAB';
import NewsTicker from '@/components/NewsTicker';
import TipsTicker from '@/components/TipsTicker';
import PortalShortcuts, { ESSENTIALS, GOVT_PORTALS } from '@/components/PortalShortcuts';
import { syncHearingNotifications, listenForAdminNotifications } from '@/lib/notifications';
import * as SecureStore from 'expo-secure-store';
import { Modal, Pressable } from 'react-native';
import { X } from 'lucide-react-native';

const RECENT_CASES_KEY = 'recent_cases_v1';

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    hearings: 0,
    upcomingHearings: [] as any[]
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [recentCases, setRecentCases] = useState<any[]>([]);
  const [hearingsModalVisible, setHearingsModalVisible] = useState(false);
  const [upcomingTenDays, setUpcomingTenDays] = useState<any[]>([]);
  const [dashboardHearings, setDashboardHearings] = useState<any[]>([]); // Merged from all sources

  // Memoize fetchDashboardData to prevent unnecessary re-renders
  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    
    try {
      // Helper: get IST date string from a Date
      const getISTDateStr = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

      // Helper: manually parse "DDth Month YYYY" format
      const robustParse = (raw: string) => {
        if (!raw || typeof raw !== 'string') return null;
        const clean = raw.replace(/(\d+)(st|nd|rd|th)/, '$1');
        const months: Record<string, number> = {
          'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
          'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11,
          'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'jun': 5, 'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
        };
        const parts = clean.trim().split(/\s+/);
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const monthStr = parts[1].toLowerCase();
          const year = parseInt(parts[2], 10);
          if (!isNaN(day) && !isNaN(year) && months[monthStr] !== undefined) {
            return new Date(year, months[monthStr], day);
          }
        }
        return new Date(clean); // Fallback to standard
      };

      const now = new Date();
      const todayStr = getISTDateStr(now);
      const tenDaysOut = new Date(now);
      tenDaysOut.setDate(tenDaysOut.getDate() + 10);
      const tenDaysStr = getISTDateStr(tenDaysOut);

      // 1. Get Case IDs visible to this user:
      // participant links + fallback to owned cases for robustness.
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

      // 2. Load Recent Cases from SecureStore
      const recentIdsJson = await SecureStore.getItemAsync(RECENT_CASES_KEY);
      if (recentIdsJson) {
        const recentIds = JSON.parse(recentIdsJson) as string[];
        if (recentIds.length > 0) {
          const { data: recentData } = await supabase
            .from('cases')
            .select('id, title, case_number, court_name, status')
            .in('id', recentIds);
          
          if (recentData) {
            const sortedRecent = recentIds
              .map(id => recentData.find(c => c.id === id))
              .filter(Boolean);
            setRecentCases(sortedRecent);
          }
        }
      }


      if (caseIds.length === 0) {
        setStats({ total: 0, active: 0, hearings: 0, upcomingHearings: [] });
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // 3. Fetch Cases + Hearings from case_hearings table (next 10 days) in parallel
      const casesPromise = supabase
        .from('cases')
        .select('id, title, case_number, court_name, status, next_hearing_date, metadata')
        .in('id', caseIds);

      const hearingsPromise = supabase
        .from('case_hearings')
        .select('*, cases(id, title, case_number, court_name)')
        .in('case_id', caseIds)
        .gte('hearing_date', todayStr)
        .lte('hearing_date', tenDaysStr)
        .order('hearing_date', { ascending: true });

      const [casesResult, hearingsResult] = await Promise.all([casesPromise, hearingsPromise]);

      if (casesResult.error) throw casesResult.error;
      if (hearingsResult.error) throw hearingsResult.error;

      const cases = casesResult.data || [];
      const hearingsData = hearingsResult.data || [];

      // 4. Build a merged hearing list (Earliest of 3 sources per case)
      const allHearings: any[] = [];

      for (const c of cases) {
        let bestDate: string | null = null;
        let hearingType = 'Hearing';
        let notes = null;

        // Source A: Relational Hearings Table (Earliest in 10d window)
        const tableHearings = hearingsData
          .filter((h: any) => h.case_id === c.id)
          .sort((a, b) => a.hearing_date.localeCompare(b.hearing_date));
        
        if (tableHearings.length > 0) {
          bestDate = tableHearings[0].hearing_date;
          hearingType = tableHearings[0].hearing_type;
          notes = tableHearings[0].notes;
        }

        // Source B: next_hearing_date Column
        if (c.next_hearing_date) {
            const d = robustParse(c.next_hearing_date);
            if (d && !isNaN(d.getTime())) {
                const colDate = getISTDateStr(d);
                if (colDate >= todayStr && colDate <= tenDaysStr) {
                    if (!bestDate || colDate < bestDate) {
                        bestDate = colDate;
                        hearingType = 'Next Hearing';
                        notes = null;
                    }
                }
            }
        }

        // Source C: eCourts Metadata JSON ("13th February 2026")
        const metaRaw = (c.metadata as any)?.full_details?.['Next Hearing Date'];
        if (metaRaw && typeof metaRaw === 'string') {
          const d = robustParse(metaRaw);
          if (d && !isNaN(d.getTime())) {
            const metaDate = getISTDateStr(d);
            if (metaDate >= todayStr && metaDate <= tenDaysStr) {
              if (!bestDate || metaDate < bestDate) {
                bestDate = metaDate;
                hearingType = 'Next Hearing';
                notes = null;
              }
            }
          }
        }

        if (bestDate) {
          allHearings.push({
            id: `merged_${c.id}`,
            case_id: c.id,
            hearing_date: bestDate,
            hearing_type: hearingType,
            notes: notes,
            cases: { 
              id: c.id, 
              title: c.title, 
              case_number: c.case_number, 
              court_name: c.court_name 
            },
          });
        }
      }


      // Sort final list by date
      allHearings.sort((a, b) => a.hearing_date.localeCompare(b.hearing_date));

      setStats({
        total: cases.length,
        active: cases.filter(c => c.status === 'open').length,
        hearings: allHearings.length, // Matches web's "Cases with Upcoming Hearings"
        upcomingHearings: allHearings.slice(0, 5)
      });

      setUpcomingTenDays(allHearings);
      setDashboardHearings(allHearings.slice(0, 3));

      syncHearingNotifications(allHearings.slice(0, 5), cases);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  // Load user role and initial data
  useEffect(() => {
    let channel: any = null;
    let isMounted = true;
    
    const setup = async () => {
      if (user) {
        const metaRole = user.user_metadata?.role;
        if (isMounted) setRole(metaRole || 'advocate');
        
        // Start listening for notifications with status callback
        const newChannel = await listenForAdminNotifications((status) => {
           console.log('Extensions status update:', status);
           if (isMounted) setConnectionStatus(status);
        });

        // Handle race condition: If unmounted while waiting, cleanup immediately
        if (!isMounted) {
           console.log('Component unmounted during setup - cleaning up channel');
           if (newChannel) supabase.removeChannel(newChannel);
           return;
        }
        
        channel = newChannel;
        fetchDashboardData();
      }
    };
    
    setup();

    return () => {
      isMounted = false;
      if (channel) {
        console.log('Unsubscribing from notifications...');
        supabase.removeChannel(channel);
      }
    };
  }, [user, fetchDashboardData]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchDashboardData();
      }
    }, [user, fetchDashboardData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData();
  }, [fetchDashboardData]);

  const StatCard = ({ label, value, icon: Icon, color, bgColor }: any) => (
    <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
      <View style={[styles.iconBox, { backgroundColor: bgColor }]}>
        <Icon size={24} color={color} />
      </View>
      <Text style={[styles.cardLabel, { color: theme.icon }]}>{label}</Text>
      <Text style={[styles.cardValue, { color: theme.text }]}>{value}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 100 }} // Add padding for FAB
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />
        }
      >
        <NewsTicker />
        <TipsTicker />

        <View style={styles.contentPadding}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                 <Text style={[styles.greeting, { color: theme.icon }]}>Welcome Back,</Text>
                 
                 {/* Connection Status Badge */}
                 {connectionStatus === 'connected' ? (
                   <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' }} />
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#15803D' }}>LIVE</Text>
                   </View>
                 ) : connectionStatus === 'connecting' ? (
                   <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B' }} />
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#B45309' }}>CONNECTING...</Text>
                   </View>
                 ) : (
                   <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' }} />
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#B91C1C' }}>DISCONNECTED</Text>
                   </View>
                 )}
              </View>
              <Text style={[styles.name, { color: theme.text }]}>{user?.user_metadata?.full_name || 'Advocate'}</Text>
              <Text style={[styles.subtitle, { color: theme.tint }]}>
                {role === 'client' ? 'Track your legal matters' : 'Here is your daily summary'}
              </Text>
            </View>

          </View>

          <View style={styles.statsContainer}>
            {/* Total Cases */}
            <StatCard 
              label="Total Cases" 
              value={stats.total} 
              icon={Briefcase} 
              color={theme.tint}
              bgColor="rgba(13, 148, 136, 0.1)" // Teal-ish alpha
            />

            {/* Active Cases */}
            <StatCard 
              label="Active" 
              value={stats.active} 
              icon={Scale} 
              color="#3B82F6" 
              bgColor="rgba(59, 130, 246, 0.1)" 
            />

            {/* Hearings - Interactive */}
            <TouchableOpacity 
              style={{ flex: 1 }}
              onPress={() => setHearingsModalVisible(true)}
            >
              <StatCard 
                label="Hearings" 
                value={stats.hearings} 
                icon={Calendar} 
                color="#F59E0B" 
                bgColor="rgba(245, 158, 11, 0.1)" 
              />
            </TouchableOpacity>
          </View>

          {/* New Find Advocate Banner */}
          {role === 'client' && (
            <TouchableOpacity 
              style={[styles.banner, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => router.push('/find-advocate')}
            >
              <View style={[styles.bannerIcon, { backgroundColor: '#ECFDF5' }]}>
                <Briefcase size={28} color="#059669" />
              </View>
              <View style={styles.bannerContent}>
                 <Text style={[styles.bannerTitle, { color: theme.text }]}>Find a Legal Expert</Text>
                 <Text style={[styles.bannerSubtitle, { color: theme.icon }]}>Browse our directory of verified advocates.</Text>
              </View>
              <ChevronRight size={20} color={theme.icon} />
            </TouchableOpacity>
          )}



          {/* Upcoming Hearings Section */}
          {dashboardHearings.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Upcoming Hearings</Text>
                <TouchableOpacity onPress={() => setHearingsModalVisible(true)}>
                  <Text style={{ color: theme.tint, fontSize: 13, fontWeight: '600' }}>See All</Text>
                </TouchableOpacity>
              </View>
              {dashboardHearings.map((h: any) => {
                const hearingDate = new Date(h.hearing_date);
                const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
                const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowStr = tomorrow.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
                const isToday = h.hearing_date.slice(0, 10) === todayStr;
                const isTomorrow = h.hearing_date.slice(0, 10) === tomorrowStr;

                return (
                  <TouchableOpacity
                    key={h.id}
                    style={[
                      styles.upcomingHearingCard,
                      {
                        backgroundColor: theme.surface,
                        borderColor: isToday ? '#EF4444' : isTomorrow ? '#F59E0B' : theme.border,
                      }
                    ]}
                    onPress={() => router.push({ pathname: '/cases/[id]', params: { id: h.case_id } })}
                  >
                    {/* Date Box */}
                    <View style={[styles.hearingDateBox, { backgroundColor: isToday ? '#FEE2E2' : isTomorrow ? '#FEF3C7' : theme.surfaceVariant }]}>
                      <Text style={[styles.hearingDayNum, { color: isToday ? '#EF4444' : isTomorrow ? '#F59E0B' : theme.tint }]}>
                        {hearingDate.getUTCDate()}
                      </Text>
                      <Text style={[styles.hearingMonthLabel, { color: theme.icon }]}>
                        {hearingDate.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()}
                      </Text>
                    </View>

                    {/* Content */}
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        {isToday && (
                          <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                            <Text style={{ color: '#EF4444', fontSize: 10, fontWeight: '800' }}>TODAY</Text>
                          </View>
                        )}
                        {isTomorrow && (
                          <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                            <Text style={{ color: '#F59E0B', fontSize: 10, fontWeight: '800' }}>TOMORROW</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.hearingCaseTitle, { color: theme.text }]} numberOfLines={1}>
                        {h.cases?.title}
                      </Text>
                      <Text style={[styles.hearingMeta, { color: theme.icon }]}>
                        {h.hearing_type} • {h.cases?.case_number}
                      </Text>
                    </View>
                    <ChevronRight size={18} color={theme.icon} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <PortalShortcuts title="Legal Tools" items={ESSENTIALS} />
          <PortalShortcuts title="Government Portals" items={GOVT_PORTALS} />

          {/* Recently Viewed Cases */}
          <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 24 }]}>Recent Cases</Text>
          {recentCases.length > 0 ? (
            <View style={styles.recentList}>
              {recentCases.map((rc) => (
                <TouchableOpacity 
                   key={rc.id}
                   style={[styles.recentItem, { backgroundColor: theme.surface, borderColor: theme.border }]}
                   onPress={() => router.push({ pathname: '/cases/[id]', params: { id: rc.id } })}
                >
                  <View style={[styles.recentIcon, { backgroundColor: theme.tint + '10' }]}>
                    <Briefcase size={18} color={theme.tint} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.recentTitle, { color: theme.text }]} numberOfLines={1}>{rc.title}</Text>
                    <Text style={[styles.recentNumber, { color: theme.icon }]}>{rc.case_number}</Text>
                  </View>
                  <ChevronRight size={16} color={theme.icon} />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={[styles.emptyState, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <View style={[styles.emptyIconCircle, { backgroundColor: theme.surfaceVariant }]}>
                <Briefcase size={32} color={theme.icon} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Recent Activity</Text>
              <Text style={[styles.emptyText, { color: theme.icon }]}>
                Recently opened cases will appear here.
              </Text>
            </View>
          )}
        </View>

      </ScrollView>

      {/* Hearings Modal (10 Days) */}
      <Modal
        visible={hearingsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setHearingsModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setHearingsModalVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Next 10 Days Hearings</Text>
              <TouchableOpacity onPress={() => setHearingsModalVisible(false)}>
                <X size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400, padding: 20 }}>
              {upcomingTenDays.length > 0 ? (
                 upcomingTenDays.map((h) => (
                   <TouchableOpacity 
                     key={h.id} 
                     style={[styles.modalHearingItem, { borderBottomColor: theme.border }]}
                     onPress={() => {
                        setHearingsModalVisible(false);
                        router.push({ pathname: '/cases/[id]', params: { id: h.case_id } });
                     }}
                   >
                     <View style={styles.modalHearingDateBox}>
                        <Text style={[styles.modalHearingDay, { color: theme.tint }]}>
                          {new Date(h.hearing_date).getDate()}
                        </Text>
                        <Text style={[styles.modalHearingMonth, { color: theme.icon }]}>
                          {new Date(h.hearing_date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                        </Text>
                     </View>
                     <View style={{ flex: 1, marginLeft: 16 }}>
                        <Text style={[styles.modalHearingCase, { color: theme.text }]} numberOfLines={1}>
                          {h.cases?.title}
                        </Text>
                        <Text style={[styles.modalHearingType, { color: theme.icon }]}>
                          {h.hearing_type} • {h.cases?.case_number}
                        </Text>
                     </View>
                     <ChevronRight size={18} color={theme.icon} />
                   </TouchableOpacity>
                 ))
              ) : (
                <Text style={{ textAlign: 'center', color: theme.icon, padding: 20 }}>
                  No hearings scheduled for the next 10 days.
                </Text>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
      <FAB onPress={() => router.push('/cases/create')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentPadding: {
    padding: 24,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 24,
    marginBottom: 8,
  },
  bannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: 13,
  },
  header: {
    marginTop: 8,
    marginBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 16,
    fontWeight: '500',
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    gap: 12,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    flex: 1,
    borderWidth: 1,
    // Removed shadows for cleaner flat look
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '600',
  },
  cardValue: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  emptyState: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    lineHeight: 20,
  },
  hearingCard: {
    width: 200,
    padding: 16,
    borderRadius: 16,
    marginRight: 12,
    borderWidth: 1,
  },
  hearingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  hearingDate: {
    fontSize: 12,
    fontWeight: '600',
  },
  hearingTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  hearingType: {
    fontSize: 12,
    textTransform: 'capitalize',
    fontWeight: '600',
  },
  urgentBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  urgentText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '800',
  },
  tomorrowBadge: {
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tomorrowText: {
    color: '#EAB308',
    fontSize: 10,
    fontWeight: '800',
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Recent Activity Styles
  recentList: {
    gap: 12,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  recentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recentTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  recentNumber: {
    fontSize: 12,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: 300,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalHearingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalHearingDateBox: {
    alignItems: 'center',
    width: 45,
  },
  modalHearingDay: {
    fontSize: 20,
    fontWeight: '800',
  },
  modalHearingMonth: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: -2,
  },
  modalHearingCase: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  modalHearingType: {
    fontSize: 12,
  },
  // Upcoming Hearings Section Cards
  upcomingHearingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  hearingDateBox: {
    width: 46,
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hearingDayNum: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 22,
  },
  hearingMonthLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  hearingCaseTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  hearingMeta: {
    fontSize: 12,
    fontWeight: '500',
  },
});
