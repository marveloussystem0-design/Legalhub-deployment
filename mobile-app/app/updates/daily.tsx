
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from 'react-native';
import { Calendar, Clock, MapPin, Briefcase, Info, Share2 } from 'lucide-react-native';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

export default function DailyUpdateScreen() {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [hearings, setHearings] = useState<any[]>([]);
  const [date, setDate] = useState(new Date());

  const fetchDailyData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      
      // Get Case IDs
      const { data: participations } = await supabase
        .from('case_participants')
        .select('case_id')
        .eq('user_id', user.id);
        
      const caseIds = participations?.map(p => p.case_id) || [];

      if (caseIds.length === 0) {
        setHearings([]);
        setLoading(false);
        return;
      }

      // Fetch Today's Hearings
      const { data: hearingsData, error } = await supabase
        .from('case_hearings')
        .select('*, cases(title, case_number, court_name, status)')
        .in('case_id', caseIds)
        .eq('hearing_date', todayStr)
        .order('hearing_type');

      if (error) throw error;
      setHearings(hearingsData || []);

    } catch (error) {
      console.error('Error fetching daily update:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDailyData();
  }, [fetchDailyData]);

  const handleShare = () => {
    // Implement share logic later
    alert('Sharing schedule...');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'Morning Digest', headerShadowVisible: false }} />
      
      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchDailyData} tintColor={theme.tint} />}
      >
        {/* Header Summary */}
        <View style={[styles.summaryCard, { backgroundColor: theme.tint }]}>
          <Text style={styles.dateText}>
            {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
          <Text style={styles.summaryTitle}>
            {hearings.length > 0 
              ? `You have ${hearings.length} hearing${hearings.length !== 1 ? 's' : ''} today.` 
              : "No hearings scheduled for today."}
          </Text>
          {hearings.length > 0 && (
             <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                <Share2 size={16} color={theme.tint} />
                <Text style={[styles.shareText, { color: theme.tint }]}>Share Schedule</Text>
             </TouchableOpacity>
          )}
        </View>

        {/* Hearings List */}
        <View style={styles.listContainer}>
          {hearings.map((hearing, index) => (
            <TouchableOpacity 
                key={hearing.id} 
                style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => router.push(`/cases/${hearing.case_id}`)}
            >
              <View style={styles.cardHeader}>
                 <View style={styles.timeBadge}>
                    <Clock size={12} color={theme.text} />
                    <Text style={[styles.timeText, { color: theme.text }]}>10:30 AM</Text> 
                 </View>
                 <View style={[styles.statusBadge, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                    <Text style={styles.statusText}>{hearing.cases?.status?.toUpperCase() || 'ACTIVE'}</Text>
                 </View>
              </View>

              <Text style={[styles.caseTitle, { color: theme.text }]}>{hearing.cases?.title}</Text>
              <Text style={[styles.caseNumber, { color: theme.icon }]}>Case No: {hearing.cases?.case_number}</Text>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                 <MapPin size={14} color={theme.icon} />
                 <Text style={[styles.infoText, { color: theme.icon }]}>{hearing.cases?.court_name || 'Court not specified'}</Text>
              </View>
              <View style={styles.infoRow}>
                 <Info size={14} color={theme.icon} />
                 <Text style={[styles.infoText, { color: theme.icon }]}>{hearing.hearing_type} Hearing</Text>
              </View>
            </TouchableOpacity>
          ))}

          {!loading && hearings.length === 0 && (
            <View style={styles.emptyState}>
                <Briefcase size={48} color={theme.border} />
                <Text style={[styles.emptyText, { color: theme.icon }]}>Enjoy your free day!</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  summaryCard: {
    padding: 24,
    paddingTop: 12,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  dateText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  summaryTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 8,
  },
  shareText: {
    fontWeight: '600',
    fontSize: 14,
  },
  listContainer: {
    padding: 20,
    gap: 16,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    color: '#047857',
    fontSize: 10,
    fontWeight: '700',
  },
  caseTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  caseNumber: {
    fontSize: 14,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
  }
});
