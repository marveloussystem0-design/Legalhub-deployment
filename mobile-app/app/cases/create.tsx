import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, Image, useColorScheme, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { getWebBaseUrl } from '@/lib/web-url';
import { Ionicons } from '@expo/vector-icons';
import { Globe, RefreshCw, CheckCircle2, AlertCircle, X, Briefcase, MapPin, FileText } from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';

export default function CreateCaseScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const isAdvocate = user?.user_metadata?.role === 'advocate';
  
  const [cnrNumber, setCnrNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [importStep, setImportStep] = useState<'init' | 'captcha' | 'success' | 'existing'>('init');
  
  // Captcha State
  const [captchaImage, setCaptchaImage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [captchaCode, setCaptchaCode] = useState('');
  const [isCaptchaLoading, setIsCaptchaLoading] = useState(false);

  // Found existing case
  const [foundCase, setFoundCase] = useState<{
    id: string;
    title: string;
    case_number: string | null;
    court_name: string | null;
    status: string | null;
    isParticipant: boolean;
  } | null>(null);

  const [webUrl] = useState(getWebBaseUrl());

  const fetchCaptcha = async () => {
    setIsCaptchaLoading(true);
    try {
      const webUrl = getWebBaseUrl();
      // Get auth token to send with request (API requires Authorization header)
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${webUrl}/api/ecourts/captcha${cnrNumber ? `?cnr=${cnrNumber}` : ''}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      const data = await response.json();
      if (data.imageBase64 && data.sessionId) {
        setCaptchaImage(data.imageBase64);
        setSessionId(data.sessionId);
      } else {
        throw new Error('Failed to load captcha');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to connect to eCourts');
    } finally {
      setIsCaptchaLoading(false);
    }
  };

  const startImportFlow = async () => {
    if (cnrNumber.length !== 16) {
      Alert.alert('Invalid CNR', 'Please enter a valid 16-digit CNR number.');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const normalizedCnr = cnrNumber.toUpperCase().trim();

      // 1. Check if case already exists in our DB
      const { data: existingCase, error: fetchError } = await supabase
        .from('cases')
        .select('id, title, case_number, court_name, status')
        .eq('cnr_number', normalizedCnr)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingCase) {
        console.log(`[CreateCase] CNR ${normalizedCnr} exists. ID: ${existingCase.id}. Checking participation...`);
        
        // 2. Check if user is already a participant
        const { data: participation } = await supabase
          .from('case_participants')
          .select('id')
          .eq('case_id', existingCase.id)
          .eq('user_id', user.id)
          .maybeSingle();

        // Show preview card with participation status
        setFoundCase({
          id: existingCase.id,
          title: existingCase.title,
          case_number: existingCase.case_number,
          court_name: existingCase.court_name,
          status: existingCase.status,
          isParticipant: !!participation,
        });
        setImportStep('existing');
        return;
      }

      // 3. If not exists, proceed with Captcha
      setImportStep('captcha');
      fetchCaptcha();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to check case existence');
    } finally {
      setLoading(false);
    }
  };

  const linkExistingCase = async () => {
    if (!foundCase) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const { error: linkError } = await supabase
        .from('case_participants')
        .insert({ case_id: foundCase.id, user_id: user.id, role: 'advocate' });

      if (linkError) throw linkError;

      router.replace({ pathname: '/cases/[id]', params: { id: foundCase.id } });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to link case');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!captchaCode || !sessionId) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      console.log(`[CreateCase] Submitting sync for CNR: ${cnrNumber} with code: "${captchaCode}"`);
      const response = await fetch(`${webUrl}/api/ecourts/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          sessionId,
          code: captchaCode,
          cnrNumber: cnrNumber.toUpperCase()
        })
      });

      console.log(`[CreateCase] Sync response status: ${response.status}`);
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error(`[CreateCase] Expected JSON but got ${contentType}. Body: ${text.substring(0, 100)}...`);
        throw new Error(`Sync server returned non-JSON response (${response.status})`);
      }

      const result = await response.json();

      if (result.success) {
        setImportStep('success');
        setTimeout(() => {
          router.replace({ pathname: '/cases/[id]', params: { id: result.caseId } });
        }, 1500);
      } else {
        Alert.alert('Import Failed', result.error || 'Check the CNR number and captcha.');
        setCaptchaCode('');
        fetchCaptcha();
      }
    } catch (err: any) {
      Alert.alert('Connection Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdvocate) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
          Advocate Access Only
        </Text>
        <Text style={{ color: theme.icon, textAlign: 'center', marginBottom: 20 }}>
          eCourts CNR import is available only for advocate accounts.
        </Text>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.tint, paddingHorizontal: 20 }]}
          onPress={() => router.back()}
        >
          <Text style={styles.primaryButtonText}>Back to Cases</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ 
        title: 'Add Case via CNR',
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.tint,
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
            <Ionicons name="close" size={24} color={theme.tint} />
          </TouchableOpacity>
        ),
        presentation: 'modal'
      }} />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {importStep === 'init' && (
            <View style={styles.stepContainer}>
              <View style={[styles.infoBox, { backgroundColor: theme.surfaceVariant }]}>
                <Globe size={24} color={theme.tint} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.infoTitle, { color: theme.text }]}>Direct eCourts Sync</Text>
                  <Text style={[styles.infoText, { color: theme.icon }]}>
                    Enter the 16-digit CNR number to automatically import all case details, history, and upcoming hearings.
                  </Text>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.text }]}>CNR Number</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                  placeholder="e.g. MCHC010012342023"
                  placeholderTextColor={theme.icon}
                  value={cnrNumber}
                  onChangeText={(t) => setCnrNumber(t.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={16}
                  autoFocus
                />
                <Text style={[styles.helperText, { color: theme.icon }]}>
                  Found on your case filing receipt or eCourts portal.
                </Text>
              </View>

              <TouchableOpacity 
                style={[styles.primaryButton, { backgroundColor: theme.tint }, cnrNumber.length !== 16 && { opacity: 0.5 }]} 
                onPress={startImportFlow}
                disabled={cnrNumber.length !== 16}
              >
                <Text style={styles.primaryButtonText}>Search eCourts</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            </View>
          )}

          {importStep === 'captcha' && (
            <View style={styles.stepContainer}>
              <View style={styles.captchaHeader}>
                <Text style={[styles.stepTitle, { color: theme.text }]}>Security Check</Text>
                <Text style={[styles.stepSubtitle, { color: theme.icon }]}>Enter the code shown in the image below</Text>
              </View>

              <View style={styles.captchaContainer}>
                {isCaptchaLoading ? (
                  <View style={styles.captchaPlaceholder}>
                    <ActivityIndicator color={theme.tint} />
                  </View>
                ) : (
                  <View style={styles.captchaWrapper}>
                    {captchaImage && (
                      <Image 
                        source={{ uri: captchaImage }} 
                        style={styles.captchaImage} 
                        resizeMode="contain"
                      />
                    )}
                    <TouchableOpacity style={styles.refreshBtn} onPress={fetchCaptcha}>
                      <RefreshCw size={20} color={theme.tint} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={styles.formGroup}>
                <TextInput
                  style={[styles.captchaInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                  placeholder="Enter Code"
                  placeholderTextColor={theme.icon}
                  value={captchaCode}
                  onChangeText={setCaptchaCode}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  textContentType="none"
                  maxLength={6}
                />
              </View>

              <TouchableOpacity 
                style={[styles.primaryButton, { backgroundColor: theme.tint }, (!captchaCode || loading) && styles.disabledButton]} 
                onPress={handleImport}
                disabled={!captchaCode || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>Import Case</Text>
                    <Globe size={18} color="#FFF" style={{ marginLeft: 8 }} />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setImportStep('init')}
                style={styles.backButton}
              >
                <Text style={{ color: theme.icon, fontSize: 14 }}>Back to CNR</Text>
              </TouchableOpacity>
            </View>
          )}

          {importStep === 'existing' && foundCase && (
            <View style={styles.stepContainer}>
              {/* Header */}
              <View style={{ alignItems: 'center', marginBottom: 24 }}>
                <View style={{ 
                  width: 64, height: 64, borderRadius: 32, 
                  backgroundColor: foundCase.isParticipant ? '#DCFCE7' : '#FEF3C7',
                  justifyContent: 'center', alignItems: 'center', marginBottom: 12 
                }}>
                  {foundCase.isParticipant 
                    ? <CheckCircle2 size={32} color="#16A34A" />
                    : <AlertCircle size={32} color="#F59E0B" />
                  }
                </View>
                <Text style={[styles.stepTitle, { color: theme.text, textAlign: 'center' }]}>
                  {foundCase.isParticipant ? 'Case Already Added' : 'Case Found in System'}
                </Text>
                <Text style={[styles.stepSubtitle, { color: theme.icon, textAlign: 'center' }]}>
                  {foundCase.isParticipant 
                    ? 'This case is already in your dashboard.' 
                    : 'This CNR belongs to an existing case. Link it to your dashboard?'}
                </Text>
              </View>

              {/* Case Card */}
              <View style={[styles.casePreviewCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={[styles.casePreviewIconRow, { backgroundColor: theme.tint + '15' }]}>
                  <Briefcase size={20} color={theme.tint} />
                  <Text style={[styles.casePreviewCNR, { color: theme.tint }]}>{cnrNumber.toUpperCase()}</Text>
                  <View style={[
                    styles.statusBadge, 
                    { backgroundColor: foundCase.status === 'open' ? '#DCFCE7' : '#FEE2E2' }
                  ]}>
                    <Text style={[styles.statusBadgeText, { color: foundCase.status === 'open' ? '#16A34A' : '#EF4444' }]}>
                      {foundCase.status?.toUpperCase() || 'UNKNOWN'}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.casePreviewBody}>
                  <Text style={[styles.casePreviewTitle, { color: theme.text }]} numberOfLines={2}>
                    {foundCase.title}
                  </Text>
                  
                  {foundCase.case_number && (
                    <View style={styles.casePreviewRow}>
                      <FileText size={14} color={theme.icon} />
                      <Text style={[styles.casePreviewMeta, { color: theme.icon }]}>
                        {foundCase.case_number}
                      </Text>
                    </View>
                  )}

                  {foundCase.court_name && (
                    <View style={styles.casePreviewRow}>
                      <MapPin size={14} color={theme.icon} />
                      <Text style={[styles.casePreviewMeta, { color: theme.icon }]} numberOfLines={1}>
                        {foundCase.court_name}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Action Buttons */}
              <View style={{ gap: 12, marginTop: 8 }}>
                {foundCase.isParticipant ? (
                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: theme.tint }]}
                    onPress={() => router.replace({ pathname: '/cases/[id]', params: { id: foundCase.id } })}
                  >
                    <Text style={styles.primaryButtonText}>View Case</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFF" style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: '#16A34A' }, loading && styles.disabledButton]}
                    onPress={linkExistingCase}
                    disabled={loading}
                  >
                    {loading 
                      ? <ActivityIndicator color="#FFF" />
                      : <>
                          <CheckCircle2 size={18} color="#FFF" style={{ marginRight: 8 }} />
                          <Text style={styles.primaryButtonText}>Link to Dashboard</Text>
                        </>
                    }
                  </TouchableOpacity>
                )}

                <TouchableOpacity 
                  onPress={() => { setImportStep('init'); setFoundCase(null); }}
                  style={styles.backButton}
                >
                  <Text style={{ color: theme.icon, fontSize: 14 }}>Use a different CNR</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {importStep === 'success' && (
            <View style={[styles.stepContainer, { alignItems: 'center', paddingTop: 60 }]}>
              <CheckCircle2 size={80} color="#16A34A" />
              <Text style={[styles.successTitle, { color: theme.text }]}>Case Imported!</Text>
              <Text style={[styles.successSubtitle, { color: theme.icon }]}>Successfully synced with eCourts. Redirecting...</Text>
              <ActivityIndicator size="small" color={theme.tint} style={{ marginTop: 20 }} />
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24 },
  stepContainer: { width: '100%' },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
  },
  infoTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  infoText: { fontSize: 13, lineHeight: 18 },
  formGroup: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 8, letterSpacing: 0.5 },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
  },
  helperText: { fontSize: 12, marginTop: 8, fontStyle: 'italic' },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  disabledButton: { opacity: 0.6 },
  
  stepTitle: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  stepSubtitle: { fontSize: 14, marginBottom: 32 },
  
  captchaHeader: { alignItems: 'center', marginBottom: 20 },
  captchaContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  captchaWrapper: {
    backgroundColor: '#FFF',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
    minWidth: 200,
    alignItems: 'center',
  },
  captchaImage: { width: 200, height: 60 },
  captchaPlaceholder: { height: 76, justifyContent: 'center' },
  refreshBtn: {
    position: 'absolute',
    right: -40,
    top: 20,
    padding: 8,
  },
  captchaInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 10,
    fontWeight: 'bold',
  },
  backButton: {
    alignItems: 'center',
    marginTop: 20,
    padding: 10,
  },
  successTitle: { fontSize: 24, fontWeight: 'bold', marginTop: 24, marginBottom: 8 },
  successSubtitle: { fontSize: 16, textAlign: 'center' },
  // Case Preview Card styles
  casePreviewCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 24,
  },
  casePreviewIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  casePreviewCNR: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  casePreviewBody: {
    padding: 16,
    gap: 8,
  },
  casePreviewTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    lineHeight: 22,
  },
  casePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  casePreviewMeta: {
    fontSize: 13,
    flex: 1,
  },
});
