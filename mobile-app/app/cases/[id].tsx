import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Linking, Alert, useColorScheme, Modal, TextInput } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useLocalSearchParams, Stack, useRouter, useFocusEffect } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/lib/auth-context';
import CaseTimeline from '@/components/CaseTimeline';
import { Calendar, Plus, X, BookOpen, Globe, Scale, Trophy, AlertTriangle, Edit2, Check, RefreshCw, History } from 'lucide-react-native';

import DateTimePicker from '@react-native-community/datetimepicker';

const RECENT_CASES_KEY = 'recent_cases_v1';
import SyncModal from '@/components/SyncModal';
import InviteClientModal from '@/components/InviteClientModal';

const parseOfficialTimelineDate = (value?: string | null) => {
  if (!value) return null;
  const match = value.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`).toISOString();
};

const normalizeTimelineLabel = (value?: string | null) =>
  (value || 'hearing').trim().toLowerCase().replace(/\s+/g, ' ');

function buildTimelineEvents(data: any) {
  const events: any[] = [];
  const seen = new Set<string>();

  const pushUnique = (event: any, signature: string) => {
    if (!event?.date || !signature || seen.has(signature)) return;
    seen.add(signature);
    events.push(event);
  };

  const filingRaw =
    data?.metadata?.full_details?.['Filing Date'] ||
    data?.metadata?.full_details?.['Filing Number'];
  const filingDate = parseOfficialTimelineDate(filingRaw);
  if (filingDate) {
    pushUnique(
      {
        id: 'filing',
        type: 'filing' as const,
        title: 'Case Filed',
        description: `Officially filed on ${filingRaw}`,
        date: filingDate,
      },
      `filing|${filingDate.slice(0, 10)}`
    );
  }

  const registrationRaw =
    data?.metadata?.full_details?.['Registration Date'] ||
    data?.metadata?.full_details?.['Registration Number'];
  const registrationDate = parseOfficialTimelineDate(registrationRaw);
  if (registrationDate) {
    pushUnique(
      {
        id: 'registration',
        type: 'status_change' as const,
        title: 'Case Registered',
        description: `Officially registered on ${registrationRaw}`,
        date: registrationDate,
      },
      `registration|${registrationDate.slice(0, 10)}`
    );
  }

  (data?.hearings || []).forEach((hearing: any) => {
    if (!hearing?.hearing_date) return;
    const label = hearing.hearing_type || 'Hearing';
    const normalizedDate = hearing.hearing_date.slice(0, 10);

    pushUnique(
      {
        id: `hearing-${hearing.id}`,
        type: label.toLowerCase().includes('order') || label.toLowerCase().includes('judgment')
          ? 'order'
          : 'hearing',
        title: label,
        description: hearing.notes || undefined,
        date: hearing.hearing_date,
        metadata: hearing.status ? { Status: hearing.status } : undefined,
      },
      `hearing|${normalizedDate}|${normalizeTimelineLabel(label)}`
    );
  });

  (data?.metadata?.history || []).forEach((entry: any, index: number) => {
    const eventDate =
      parseOfficialTimelineDate(entry.business_date) ||
      parseOfficialTimelineDate(entry.hearing_date);
    if (!eventDate) return;

    const label = entry.purpose || 'Hearing';
    const normalizedDate = eventDate.slice(0, 10);
    const signature = `hearing|${normalizedDate}|${normalizeTimelineLabel(label)}`;

    pushUnique(
      {
        id: `hist-${index}`,
        type: label.toLowerCase().includes('order') || label.toLowerCase().includes('judgment')
          ? 'order'
          : 'hearing',
        title: label,
        description: `Judge: ${entry.judge || 'Not Specified'}`,
        date: eventDate,
        metadata: {
          Business: entry.business,
          Next: entry.hearing_date !== 'None' ? entry.hearing_date : undefined,
        },
      },
      signature
    );
  });

  return events;
}


export default function CaseDetailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  
  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);
  
  // Sync state
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showInviteClientModal, setShowInviteClientModal] = useState(false);


  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const isAdvocate = user?.user_metadata?.role === 'advocate';
  const cnrValue = data?.cnr_number || data?.cino || '';

  useFocusEffect(
    useCallback(() => {
      if (id) fetchCaseDetails(id as string);
    }, [id])
  );

  const fetchCaseDetails = async (caseId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching details for case:', caseId);

      // Validate UUID format to prevent 22P02 error (if route is 'new' or 'create')
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(caseId)) {
          console.warn('Invalid UUID passed to [id].tsx, skipping fetch:', caseId);
          setLoading(false);
          setError('Invalid Case ID');
          return;
      }

      // 1. Fetch case details
      const { data: caseResult, error: caseError } = await supabase
        .from('cases')
        .select('*')
        .eq('id', caseId)
        .single();
        
      if (caseError) throw caseError;
      const { data: preferenceRow, error: preferenceError } = await supabase
        .from('case_user_preferences')
        .select('display_title')
        .eq('case_id', caseId)
        .eq('user_id', user?.id)
        .maybeSingle();

      if (preferenceError) throw preferenceError;

      const effectiveDisplayTitle = preferenceRow?.display_title || null;
      setEditingTitleValue(effectiveDisplayTitle || caseResult.title || '');

      // Update recently viewed cases
      const updateRecent = async () => {
        try {
          const existing = await SecureStore.getItemAsync(RECENT_CASES_KEY);
          let list: string[] = existing ? JSON.parse(existing) : [];
          list = [caseId, ...list.filter(cid => cid !== caseId)].slice(0, 5);
          await SecureStore.setItemAsync(RECENT_CASES_KEY, JSON.stringify(list));
        } catch (e) {
          console.error('Failed to update recent cases:', e);
        }
      };
      updateRecent();

      // 2. Fetch participants
      const { data: participants, error: partError } = await supabase
        .from('case_participants')
        .select('user_id, role')
        .eq('case_id', caseId);
        
      if (partError) throw partError;

      // 3. Fetch participant details (Parallel/Sequential like Web)
      const fullParticipants = await Promise.all(
        (participants || []).map(async (p: any) => {
          let details = null;
          let email = '';

          const { data: userData } = await supabase
            .from('users')
            .select('email')
            .eq('id', p.user_id)
            .single();
          email = userData?.email || '';

          if (p.role === 'client') {
            const { data: client } = await supabase
              .from('clients')
              .select('full_name')
              .eq('user_id', p.user_id)
              .single();
            details = client;
          } else if (p.role === 'advocate') {
            const { data: advocate } = await supabase
              .from('advocates')
              .select('full_name')
              .eq('user_id', p.user_id)
              .single();
            details = advocate;
          }

          return {
            ...p,
            users: { email },
            details
          };
        })
      );

      // 4. Fetch hearings
      const { data: hearings, error: hearingsError } = await supabase
        .from('case_hearings')
        .select('*')
        .eq('case_id', caseId)
        .order('hearing_date', { ascending: true });
        
      if (hearingsError) throw hearingsError;

      // 5. Fetch linked eCourts data (Architecture Parity with Web)
      let ecourtsData = null;
      const { data: linkData } = await supabase
        .from('case_ecourts_links')
        .select('ecourts_cases(*)')
        .eq('case_id', caseId)
        .maybeSingle();
        
      if (linkData?.ecourts_cases) {
          ecourtsData = Array.isArray(linkData.ecourts_cases) 
            ? linkData.ecourts_cases[0] 
            : linkData.ecourts_cases;
      } else {
          // Fallback if junction table is missing but CNR exists
          const syncIdentifier = caseResult.cnr_number || caseResult.cino;
          if (syncIdentifier) {
            const { data: ec } = await supabase
              .from('ecourts_cases')
              .select('*')
              .eq('cnr_number', syncIdentifier)
              .maybeSingle();
            ecourtsData = ec;
          }
      }

      // 6. Fetch documents and generate signed URLs
      const { data: documents, error: docsError } = await supabase
        .from('documents')
        .select('*')
        .eq('case_id', caseId);

      if (docsError) throw docsError;

      const documentsWithUrls = await Promise.all(
        (documents || []).map(async (doc: any) => {
          if (!doc.file_url) return doc;
          
          const { data: signedData } = await supabase.storage
            .from('case-documents')
            .createSignedUrl(doc.file_url, 3600); // 1 hour expiry
            
          return {
            ...doc,
            download_url: signedData?.signedUrl
          };
        })
      );

      // Construct final object
      const fullData = {
        ...caseResult,
        display_title: effectiveDisplayTitle,
        ecourts: ecourtsData,
        participants: fullParticipants,
        hearings: hearings || [],
        documents: documentsWithUrls
      };

      console.log('✅ Case details fetched successfully. Has Metadata?', !!fullData.metadata);
      if (fullData.metadata) {
        console.log('   - Metadata full_details keys:', Object.keys(fullData.metadata.full_details || {}).length);
        console.log('   - Metadata history events:', (fullData.metadata.history || []).length);
      }
      console.log('   - eCourts linked data?', !!fullData.ecourts);

      setData(fullData);

    } catch (err: any) {
      console.error('Error fetching case details:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDocument = async (url: string) => {
    if (!url) return;
    try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
            await Linking.openURL(url);
        } else {
            console.error("Don't know how to open URI: " + url);
        }
    } catch (err) {
        console.error("An error occurred", err);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    });
  };

  const handleSaveTitle = async () => {
    try {
      setSavingTitle(true);
      const trimmedTitle = editingTitleValue.trim();
      const query = supabase.from('case_user_preferences');
      const { error: updateError } = trimmedTitle
        ? await query.upsert({
            case_id: id,
            user_id: user?.id,
            display_title: trimmedTitle,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'case_id,user_id' })
        : await query
            .delete()
            .eq('case_id', id)
            .eq('user_id', user?.id);

      if (updateError) throw updateError;
      
      setData({ ...data, display_title: trimmedTitle || null });
      setIsEditingTitle(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update title');
    } finally {
      setSavingTitle(false);
    }
  };


  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.tint} />
        <Text style={{color: theme.icon, marginTop: 16}}>Loading Case Details...</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{color: theme.error, marginBottom: 16}}>Error loading case</Text>
        <Text style={{color: theme.icon}}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ 
        title: '',
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.tint,
        headerBackTitle: 'Back',
        headerRight: () => isAdvocate ? (
          <TouchableOpacity onPress={() => router.push({ pathname: '/cases/edit', params: { id: data.id } })}>
            <Text style={{ color: theme.tint, fontSize: 16, fontWeight: '600' }}>Edit</Text>
          </TouchableOpacity>
        ) : null
      }} />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Section */}
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
            <View style={styles.headerTop}>
                <View style={[styles.badge, data.status === 'open' ? styles.badgeOpen : styles.badgeClosed]}>
                    <Text style={[styles.badgeText, data.status === 'open' ? styles.textOpen : styles.textClosed]}>
                        {data.status?.toUpperCase()}
                    </Text>
                </View>
            </View>
            
            <View style={styles.titleContainer}>
              <Text style={[styles.customTitleLabel, { color: theme.tint }]}>CUSTOM CASE NAME</Text>
              
              {isEditingTitle ? (
                <View style={styles.editTitleRow}>
                  <TextInput
                    style={[styles.editTitleInput, { color: theme.text, borderColor: theme.tint }]}
                    value={editingTitleValue}
                    onChangeText={setEditingTitleValue}
                    placeholder="Add custom case name..."
                    placeholderTextColor={theme.icon}
                    autoFocus
                  />
                  <TouchableOpacity 
                    style={[styles.saveTitleBtn, { backgroundColor: theme.tint }]}
                    onPress={handleSaveTitle}
                    disabled={savingTitle}
                  >
                    {savingTitle ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Check size={18} color="#FFF" />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.cancelTitleBtn}
                    onPress={() => {
                      setEditingTitleValue(data.display_title || data.title || '');
                      setIsEditingTitle(false);
                    }}
                  >
                    <X size={18} color={theme.icon} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.displayTitleRow}
                  onPress={() => setIsEditingTitle(true)}
                >
                  <Text style={[styles.title, { color: (data.display_title || data.title) ? theme.text : theme.icon }]}>
                    {data.display_title || data.title || "Add custom case name..."}
                  </Text>
                  <Edit2 size={16} color={theme.tint} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              )}
              
              {/* Header Titles with Sanitization & Smart Fallback */}
              {(() => {
                const sanitize = (name?: string | null) => {

  if (!name) return 'Unknown';

  const cleaned =
    name
      .replace(/^\d+\)\s*/, '')
      .replace(/Advocate.*/i, '')
      .trim();

  if (!cleaned) return 'Unknown';

  return cleaned;
};

const resolvePetitioner =
  data.petitioner_name ||
  data.metadata?.parsed_fields?.petitioner ||
  data.metadata?.petitioner_details?.[0] ||
  data.metadata?.full_details?.['Petitioner'];

const resolveRespondent =
  data.respondent_name ||
  data.metadata?.parsed_fields?.respondent ||
  data.metadata?.respondent_details?.[0] ||
  data.metadata?.full_details?.['Respondent'];

const pName = sanitize(resolvePetitioner);
const rName = sanitize(resolveRespondent);
                
                let officialTitle = data.title && !data.title.includes('XXXXXX') && !data.title.toLowerCase().includes('unknown')
                  ? data.title 
                  : (pName || rName ? `${pName || 'Unknown'} vs ${rName || 'Unknown'}` : null);

                // Ultimate Fallback: If still no names, show Case Number instead of "Unknown vs Unknown"
                if (!officialTitle || officialTitle.includes('Unknown vs Unknown')) {
                   officialTitle = `Case: ${data.case_number || data.cnr_number || 'Details'}`;
                }

                return (
                  <View style={styles.officialTitleRow}>
                    <Text style={[styles.officialTitle, { color: theme.icon }]} numberOfLines={1}>{officialTitle}</Text>
                    <View style={[styles.officialBadge, { backgroundColor: theme.surfaceVariant }]}>
                      <Text style={[styles.officialBadgeText, { color: theme.icon }]}>OFFICIAL TITLE</Text>
                    </View>
                  </View>
                );
              })()}
            </View>

            <Text style={[styles.caseNumberText, { color: theme.tint }]}>#{data.case_number}</Text>
            
            {cnrValue && (
              <View style={styles.cnrRow}>
                <Text style={[styles.cnrLabel, { color: theme.icon }]}>CNR / CINO</Text>
                <Text style={[styles.cnrValue, { color: theme.text }]}>{cnrValue}</Text>
              </View>
            )}
            
            {/* Universal Data Resolver - Aligned with Web */}
            {(() => {
              const judge = data.ecourts?.judge_name || data.judge_name || data.metadata?.full_details?.['Court Number and Judge'] || 'Not Specified';
              const regDate = data.ecourts?.registration_date || data.registration_date || data.metadata?.full_details?.['Registration Number'] || data.metadata?.full_details?.['Registration Date'];
              const acts = data.metadata?.acts || [];
              const statusStr = (data.status || 'open').toUpperCase();
              const court = data.court_name || data.ecourts?.court_name || data.metadata?.establishment_name || 'Not Specified';

              return (
                <View style={styles.infoCardsRow}>
                  {/* Card 1: Acts & Sections */}
                  <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.infoCardLabel, { color: theme.icon }]}>ACTS & SECTIONS</Text>
                    <View style={styles.infoCardContent}>
                      {acts.length > 0 ? (
                        <View style={styles.cardBadgeList}>
                          {acts.slice(0, 2).map((act: any, i: number) => (
                            <View key={i} style={[styles.cardBadge, { backgroundColor: theme.tint + '10' }]}>
                              <Text style={[styles.cardBadgeText, { color: theme.tint }]} numberOfLines={1}>
                                {act.act} {act.section}
                              </Text>
                            </View>
                          ))}
                          {acts.length > 2 && <Text style={{ fontSize: 10, color: theme.icon }}>+{acts.length - 2}</Text>}
                        </View>
                      ) : (
                        <View style={styles.cardValueRow}>
                          <Scale size={16} color={theme.tint} />
                          <Text style={[styles.infoCardValue, { color: theme.text }]} numberOfLines={1}>
                            {data.case_type || 'Civil'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Card 2: Court */}
                  <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.infoCardLabel, { color: theme.icon }]}>COURT</Text>
                    <View style={styles.infoCardContent}>
                      <View style={styles.cardValueRow}>
                        <BookOpen size={16} color={theme.tint} />
                        <Text style={[styles.infoCardValue, { color: theme.text }]} numberOfLines={2}>
                          {court}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Card 3: Status */}
                  <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.infoCardLabel, { color: theme.icon }]}>STATUS</Text>
                    <View style={styles.infoCardContent}>
                      <View style={[styles.statusBadge, { 
                        backgroundColor: data.status === 'open' ? '#E8F5E9' : '#F5F5F5',
                        borderColor: data.status === 'open' ? '#C8E6C9' : '#E0E0E0'
                      }]}>
                        <Text style={[styles.statusBadgeText, { 
                          color: data.status === 'open' ? '#2E7D32' : '#616161'
                        }]}>{statusStr}</Text>
                      </View>
                      {data.outcome && (
                        <View style={[styles.outcomeBadge, { backgroundColor: theme.tint + '10' }]}>
                          <Text style={[styles.outcomeBadgeText, { color: theme.tint }]}>
                            {data.outcome.toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })()}

            {/* Case Sync Action Row */}
             {isAdvocate && (data.cnr_number || data.cino) && (
              <View style={styles.actionRowHeader}>
                <TouchableOpacity 
                  onPress={() => setShowSyncModal(true)}
                  style={[styles.syncButton, { backgroundColor: theme.tint + '10', borderColor: theme.tint }]}
                >
                  <RefreshCw size={14} color={theme.tint} />
                  <Text style={[styles.syncButtonText, { color: theme.tint }]}>Sync with eCourts</Text>
                </TouchableOpacity>
                <Text style={[styles.syncHint, { color: theme.icon }]}>
                   Last: {data.ecourts?.last_synced_at ? formatDate(data.ecourts.last_synced_at) : (data.metadata?.synced_at ? formatDate(data.metadata.synced_at) : 'Never')}
                </Text>
              </View>
            )}
        </View>

        {/* Sync Modal Integration */}
        {isAdvocate && data && (
          <SyncModal
            isVisible={showSyncModal}
            onClose={() => setShowSyncModal(false)}
            cnrNumber={data.cnr_number || data.cino}
            caseId={data.id}
            onSyncSuccess={() => fetchCaseDetails(data.id)}
          />
        )}
        {isAdvocate && data && (
          <InviteClientModal
            isVisible={showInviteClientModal}
            onClose={() => setShowInviteClientModal(false)}
            caseId={data.id}
            onSuccess={() => fetchCaseDetails(data.id)}
          />
        )}



        {/* Main Content Sections - Reordered: Hearings/Outcome first, then Official Details */}
        
        {/* Case Outcome / Disposed Result (Conditional) */}
        {data.status === 'disposed' || data.status === 'closed' || data.outcome ? (
          <View style={styles.section}>
             <View style={styles.sectionHeader}>
               <View style={styles.sectionTitleRow}>
                 <Trophy size={20} color={theme.tint} />
                 <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>Case Outcome</Text>
               </View>
             </View>
             <View style={[styles.outcomeCard, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
                <View style={[styles.outcomeHeader, { backgroundColor: theme.tint + '05' }]}>
                   <Text style={[styles.outcomeStatus, { color: theme.text }]}>OFFICIAL STATUS</Text>
                </View>
                <View style={styles.outcomeBody}>
                   <Text style={[styles.outcomeDescription, { color: theme.text, fontSize: 16, fontWeight: '700' }]}>
                      {data.metadata?.full_details?.['Case Status'] || data.status?.toUpperCase()}
                   </Text>
                   {data.outcome && (
                      <Text style={[styles.outcomeSubText, { color: theme.icon, marginTop: 4 }]}>
                        Custom Marker: {data.outcome.toUpperCase()}
                      </Text>
                   )}
                </View>
             </View>
          </View>
        ) : (
          <>
          {/* Hearings List */}
          <View style={styles.section}>
               <View style={styles.sectionHeader}>
                 <View style={styles.sectionTitleRow}>
                   <Calendar size={20} color={theme.tint} />
                   <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>Upcoming Hearings</Text>
                 </View>
               </View>
               
               {(data.hearings?.filter((h: any) => new Date(h.hearing_date) >= new Date(new Date().setHours(0,0,0,0))).length ?? 0) > 0 ? (
                 <View style={styles.hearingsList}>
                   {data.hearings
                     .filter((h: any) => new Date(h.hearing_date) >= new Date(new Date().setHours(0,0,0,0)))
                     .sort((a: any, b: any) => new Date(a.hearing_date).getTime() - new Date(b.hearing_date).getTime())
                     .map((h: any, idx: number) => {
                       const isNext = idx === 0;
                     return (
                       <View key={h.id} style={[
                         styles.hearingMiniCard, 
                         { backgroundColor: theme.surface, borderColor: isNext ? theme.tint : theme.border, borderWidth: isNext ? 2 : 1 }
                       ]}>
                         <View style={[styles.hearingDateBadge, { backgroundColor: isNext ? theme.tint : theme.tint + '15' }]}>
                            <Text style={[styles.hearingDateDay, { color: isNext ? '#FFF' : theme.tint }]}>
                              {new Date(h.hearing_date).getDate()}
                            </Text>
                            <Text style={[styles.hearingDateMonth, { color: isNext ? '#FFF' : theme.tint }]}>
                              {new Date(h.hearing_date).toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()}
                            </Text>
                         </View>
                         <View style={styles.hearingInfo}>
                            <View style={styles.hearingHeader}>
                              <View style={styles.hearingTitleRow}>
                                <Text style={[styles.hearingType, { color: theme.text }]}>{h.hearing_type}</Text>
                                {isNext && (
                                  <View style={[styles.nextBadge, { backgroundColor: theme.tint }]}>
                                    <Text style={styles.nextBadgeText}>NEXT</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={[styles.hearingYear, { color: theme.icon }]}>{new Date(h.hearing_date).getFullYear()}</Text>
                            </View>
                            {h.notes && <Text style={[styles.hearingNotes, { color: theme.icon }]} numberOfLines={1}>{h.notes}</Text>}
                         </View>
                       </View>
                     );
                   })}
                 </View>
               ) : (
                 <View style={[styles.emptyContainer, { backgroundColor: theme.surfaceVariant }]}>
                   <Calendar size={32} color={theme.icon} />
                   <Text style={[styles.emptyText, { color: theme.icon, marginTop: 8 }]}>No upcoming hearings</Text>
                 </View>
               )}
          </View>
          </>
        )}

        {/* Parties / Litigants Section with Sanitization */}
                {(() => {
                   const sanitize = (name?: string | null) => {

  if (!name) return 'Unknown';

  const cleaned =
    name
      .replace(/^\d+\)\s*/, '')
      .replace(/Advocate.*/i, '')
      .trim();

  if (!cleaned) return 'Unknown';

  return cleaned;
};
                   return (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <View style={styles.sectionTitleRow}>
                                <Scale size={20} color={theme.tint} />
                                <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>Parties / Litigants</Text>
                            </View>
                        </View>
                        <View style={[styles.partiesCard, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
                            <View style={styles.partyBox}>
                                <Text style={[styles.partyTypeLabel, { color: theme.tint }]}>PETITIONER / PLAINTIFF</Text>
                                <Text style={[styles.partyName, { color: theme.text }]}>
1) {
sanitize(
data.petitioner_name ||
data.metadata?.parsed_fields?.petitioner ||
 data.metadata?.petitioner_details?.[0] ||
 data.metadata?.full_details?.['Petitioner']
)
}
</Text>
                                {data.metadata?.full_details?.['Petitioner Advocate'] && (
                                    <Text style={[styles.partyAdvocate, { color: theme.icon }]}>Advocate- {data.metadata.full_details['Petitioner Advocate']}</Text>
                                )}
                            </View>
                            <View style={[styles.partyDivider, { backgroundColor: theme.border }]} />
                            <View style={styles.partyBox}>
                                <Text style={[styles.partyTypeLabel, { color: '#E53935' }]}>RESPONDENT / DEFENDANT</Text>
                                <Text style={[styles.partyName, { color: theme.text }]}>
1) {
sanitize(
data.respondent_name ||
data.metadata?.parsed_fields?.respondent ||
data.metadata?.respondent_details?.[0] ||
data.metadata?.full_details?.['Respondent']
)
}
</Text>
                                {data.metadata?.full_details?.['Respondent Advocate'] && (
                                    <Text style={[styles.partyAdvocate, { color: theme.icon }]}>Advocate- {data.metadata.full_details['Respondent Advocate']}</Text>
                                )}
                            </View>
                        </View>
                    </View>
                   );
                })()}

        {/* Official Case Details Section */}
        {(data.metadata?.full_details || data.ecourts) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <BookOpen size={20} color={theme.tint} />
                <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>Official Details</Text>
              </View>
              {data.metadata?.qr_code_link && (
                <TouchableOpacity 
                  onPress={() => handleOpenDocument(
                    data.metadata.qr_code_link.startsWith('http') 
                      ? data.metadata.qr_code_link 
                      : `https://services.ecourts.gov.in${data.metadata.qr_code_link.startsWith('/') ? '' : '/ecourtindia_v6/'}${data.metadata.qr_code_link}`
                  )}
                  style={[styles.qrButton, { backgroundColor: theme.tint }]}
                >
                  <Globe size={14} color="#FFF" />
                  <Text style={styles.qrButtonText}>QR Code</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={[styles.officialDetailsGrid, { backgroundColor: theme.surface, borderColor: theme.border }]}>
               {/* Display Clean Fields from ecourts_cases first - aligned with Web Logic */}
               {(() => {
                 const details = (data.metadata?.full_details || {}) as Record<string, unknown>;
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
                 const formatIsoDate = (value?: string | null): string => {
                   if (!value) return "";
                   const d = new Date(value);
                   return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB");
                 };

                 const officialRows: Array<{ label: string; value: string }> = [
                   {
                     label: "Judge Name",
                     value:
                       clean(data.ecourts?.judge_name) ||
                       readDetail("Judge Name", "Court Number and Judge", "Judge"),
                   },
                   {
                     label: "Petitioner",
                     value:
                       clean(data.petitioner_name) ||
                       clean(data.ecourts?.petitioner) ||
                       readDetail("Petitioner"),
                   },
                   {
                     label: "Respondent",
                     value:
                       clean(data.respondent_name) ||
                       clean(data.ecourts?.respondent) ||
                       readDetail("Respondent"),
                   },
                   {
                     label: "Registration Date",
                     value:
                       formatIsoDate(data.ecourts?.registration_date) ||
                       readDetail("Registration Date"),
                   },
                   {
                     label: "Registration Number",
                     value: readDetail("Registration Number"),
                   },
                   {
                     label: "Filing Date",
                     value: formatIsoDate(data.ecourts?.filing_date) || readDetail("Filing Date"),
                   },
                   {
                     label: "Filing Number",
                     value: readDetail("Filing Number"),
                   },
                   {
                     label: "Case Type",
                     value:
                       clean(data.case_type) ||
                       clean(data.ecourts?.case_type) ||
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
                       formatIsoDate(data.next_hearing_date) ||
                       readDetail("Next Hearing Date", "Next Date (Purpose)", "Next Date"),
                   },
                   {
                     label: "CNR Number",
                     value: (
                       clean(data.cnr_number) ||
                       clean(data.cino) ||
                       readDetail("CNR Number", "CNR / CINO")
                     )
                       .replace(/\s*\(note.*$/i, "")
                       .replace(/\s*view qr code.*$/i, "")
                       .trim(),
                   },
                 ];

                 const nextHearing = formatIsoDate(data.next_hearing_date) || readDetail("Next Hearing Date", "Next Date (Purpose)", "Next Date");
                 if (!nextHearing) {
                    officialRows.splice(officialRows.length - 1, 0, 
                       {
                          label: "Case Outcome",
                          value: clean(data.disposal_nature) || readDetail("Nature of Disposal", "Decision")
                       },
                       {
                          label: "Decision Date",
                          value: formatIsoDate(data.outcome_date) || readDetail("Decision Date", "Disposal Date")
                       }
                    );
                 }

                 return officialRows
                   .filter((row) => row.value)
                   .map((row) => (
                     <View key={row.label} style={[styles.detailRow, { borderBottomColor: theme.border }]}>
                       <Text style={[styles.detailKey, { color: theme.icon }]}>
                         {row.label}
                       </Text>
                       <Text style={[styles.detailValue, { color: theme.text, flex: 1, textAlign: 'right' }]}>
                         {row.value}
                       </Text>
                     </View>
                   ));
               })()}
            </View>
          </View>
        )}

        {/* Case History (Timeline) - Enhanced */}
        {(data.hearings?.length || data.metadata?.history || data.metadata?.full_details?.['Filing Date'] || data.metadata?.full_details?.['Registration Date']) && (
          <View style={[styles.section, { paddingHorizontal: 0 }]}>
            <CaseTimeline events={buildTimelineEvents(data)} />
          </View>
        )}

        {/* Participants Section */}
        <View style={styles.section}>
            <View style={styles.participantsHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Participants</Text>
              {isAdvocate && (
                <TouchableOpacity
                  style={[styles.inviteClientBtn, { borderColor: theme.tint, backgroundColor: theme.tint + '10' }]}
                  onPress={() => setShowInviteClientModal(true)}
                >
                  <Text style={[styles.inviteClientBtnText, { color: theme.tint }]}>Invite Client</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.participantRow}>
                {data.participants?.map((p: any) => (
                    <View key={p.user_id} style={[styles.participantCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        <View style={[styles.participantIcon, { backgroundColor: theme.tint + '15' }]}>
                            <Text style={[styles.participantInitials, { color: theme.text }]}>
                                {(p.details?.full_name || p.users?.email || '?').substring(0, 1).toUpperCase()}
                            </Text>
                        </View>
                        <Text style={[styles.participantName, { color: theme.text }]} numberOfLines={1}>
                            {p.details?.full_name || 'User'}
                        </Text>
                        <Text style={[styles.participantRole, { color: theme.tint }]}>{p.role}</Text>
                    </View>
                ))}
            </ScrollView>
        </View>


      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    padding: 24,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeOpen: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  badgeClosed: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  textOpen: { color: '#4ADE80' },
  textClosed: { color: '#F87171' },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  btnClose: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#EF4444',
  },
  btnOpen: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: '#22C55E',
  },
  statusBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  titleContainer: {
    marginBottom: 16,
  },
  customTitleLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    lineHeight: 28,
  },
  officialTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  officialTitle: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  officialBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  officialBadgeText: {
    fontSize: 8,
    fontWeight: '800',
  },
  caseNumber: {
    fontSize: 14,
    fontFamily: 'monospace',
    marginBottom: 20,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statItemType: {
    flex: 1,
    alignItems: 'center',
  },
  statItemCourt: {
    flex: 3,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  statDivider: {
    width: 1,
    height: 30,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'capitalize',
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  qrButtonText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  officialDetailsGrid: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
  detailKey: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  actsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  actBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  actBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  hearingsList: {
    gap: 12,
  },
  hearingMiniCard: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  hearingDateBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hearingDateDay: {
    fontSize: 18,
    fontWeight: '800',
  },
  hearingDateMonth: {
    fontSize: 10,
    fontWeight: '800',
  },
  hearingInfo: {
    flex: 1,
  },
  hearingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  hearingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nextBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  nextBadgeText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '800',
  },
  hearingType: {
    fontWeight: '700',
    fontSize: 15,
    textTransform: 'capitalize',
  },
  hearingYear: {
    fontSize: 10,
    fontWeight: '700',
  },
  hearingNotes: {
    fontSize: 12,
  },
  emptyContainer: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Outcome Card
  outcomeCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  outcomeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  outcomeStatus: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  resultBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  resultText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },
  outcomeBody: {
    padding: 16,
  },
  outcomeDescription: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  // Status Banner
  statusBanner: {
    marginHorizontal: 20,
    marginTop: -8,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBannerText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
  outcomeSubText: {
    fontSize: 12,
    fontWeight: '600',
  },
  participantsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inviteClientBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inviteClientBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  participantRow: {
    flexDirection: 'row',
  },
  participantCard: {
    width: 100,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 12,
    alignItems: 'center',
  },
  participantIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  participantInitials: {
    fontWeight: 'bold',
  },
  participantName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
  },
  participantRole: {
    fontSize: 10,
    textTransform: 'uppercase',
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  docIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginRight: 12,
  },
  docDetails: {
    flex: 1,
  },
  docTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  docMeta: {
    fontSize: 12,
  },
  // Parties Styles
  partiesCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  partyBox: {
    padding: 16,
  },
  partyTypeLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  partyName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  partyAdvocate: {
    fontSize: 12,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  partyDivider: {
    height: 1,
    width: '100%',
  },
  downloadIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalBody: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  dateButtonText: {
    fontSize: 14,
  },
  typeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  textArea: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    // backgroundColor set dynamically
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Title editing styles
  displayTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  editTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  editTitleInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    borderBottomWidth: 2,
    paddingVertical: 4,
  },
  saveTitleBtn: {
    padding: 6,
    borderRadius: 6,
  },
  cancelTitleBtn: {
    padding: 6,
  },
  caseNumberText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  cnrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  cnrLabel: {
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cnrValue: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  actionRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  syncButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  syncHint: {
    fontSize: 11,
    fontWeight: '500',
  },
  // Info Cards Styles
  infoCardsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    height: 90,
  },
  infoCard: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'space-between',
  },
  infoCardLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  infoCardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  infoCardValue: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  cardValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardBadgeList: {
    flexDirection: 'column',
    gap: 2,
  },
  cardBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  cardBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  outcomeBadge: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  outcomeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
});

