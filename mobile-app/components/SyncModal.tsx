
import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Modal, 
  TouchableOpacity, Image, TextInput, 
  ActivityIndicator, Alert, useColorScheme 
} from 'react-native';
import { X, RefreshCw, Globe, CheckCircle2 } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { getWebBaseUrl } from '@/lib/web-url';

interface SyncModalProps {
  isVisible: boolean;
  onClose: () => void;
  cnrNumber: string;
  caseId: string;
  onSyncSuccess?: () => void;
}

export default function SyncModal({ isVisible, onClose, cnrNumber, caseId, onSyncSuccess }: SyncModalProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const webUrl = getWebBaseUrl();

  const [step, setStep] = useState<'captcha' | 'loading' | 'success'>('captcha');
  const [captchaImage, setCaptchaImage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [captchaCode, setCaptchaCode] = useState('');
  const [isCaptchaLoading, setIsCaptchaLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (isVisible) {
      setStep('captcha');
      setCaptchaCode('');
      setSyncError(null);
      fetchCaptcha();
    }
  }, [isVisible]);

  const fetchCaptcha = async () => {
    setIsCaptchaLoading(true);
    setSyncError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      console.log(`[SyncModal] Fetching captcha for ${cnrNumber}. Session exists: ${!!session}`);
      
      const response = await fetch(`${webUrl}/api/ecourts/captcha?cnr=${cnrNumber}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`❌ [SyncModal] API Error ${response.status}:`, text.substring(0, 500));
        throw new Error(`Server returned ${response.status}: ${text.substring(0, 50)}`);
      }

      const data = await response.json();
      if (data.imageBase64 && data.sessionId) {
        setCaptchaImage(data.imageBase64);
        setSessionId(data.sessionId);
      } else {
        throw new Error('Failed to load captcha image');
      }
    } catch (err: any) {
      setSyncError('Could not connect to eCourts. Please try again.');
      console.error('[SyncModal] fetchCaptcha error:', err);
    } finally {
      setIsCaptchaLoading(false);
    }
  };

  const handleSync = async () => {
    if (!captchaCode || !sessionId) return;
    
    setStep('loading');
    setSyncError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${webUrl}/api/ecourts/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          sessionId,
          code: captchaCode,
          cnrNumber: cnrNumber.toUpperCase(),
          caseId
        })
      });

      const result = await response.json();

      if (result.success) {
        setStep('success');
        if (onSyncSuccess) onSyncSuccess();
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        // Known errors (captcha typo, not found) are returned as result.error
        setSyncError(result.error || 'Sync failed. Please try again.');
        setCaptchaCode('');
        setStep('captcha');
        fetchCaptcha();
      }
    } catch (err: any) {
      setSyncError(err.message || 'Connection error');
      setStep('captcha');
    }
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.content, { backgroundColor: theme.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.text }]}>Sync with eCourts</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={24} color={theme.icon} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            {step === 'captcha' && (
              <View>
                <Text style={[styles.subtitle, { color: theme.icon }]}>
                  Enter the security code to update Case #{cnrNumber}
                </Text>

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

                {syncError && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{syncError}</Text>
                  </View>
                )}

                <TextInput
                  style={[styles.input, { backgroundColor: theme.surfaceVariant, color: theme.text, borderColor: theme.border }]}
                  placeholder="Enter Code"
                  placeholderTextColor={theme.icon}
                  value={captchaCode}
                  onChangeText={setCaptchaCode}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={6}
                />

                <TouchableOpacity 
                  style={[styles.syncBtn, { backgroundColor: theme.tint }, !captchaCode && styles.disabledBtn]} 
                  onPress={handleSync}
                  disabled={!captchaCode}
                >
                  <Text style={styles.syncBtnText}>Update Case Details</Text>
                  <Globe size={18} color="#FFF" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              </View>
            )}

            {step === 'loading' && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.tint} />
                <Text style={[styles.loadingText, { color: theme.text }]}>Syncing with eCourts Portal...</Text>
                <Text style={[styles.loadingSubtext, { color: theme.icon }]}>Fetching hearings and disposal history</Text>
              </View>
            )}

            {step === 'success' && (
              <View style={styles.successContainer}>
                <CheckCircle2 size={60} color="#16A34A" />
                <Text style={[styles.successTitle, { color: theme.text }]}>Sync Complete!</Text>
                <Text style={[styles.successSubtitle, { color: theme.icon }]}>All case dates and history updated.</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: 400,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    padding: 20,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  captchaContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  captchaWrapper: {
    backgroundColor: '#FFF',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  captchaImage: {
    width: 150,
    height: 50,
  },
  captchaPlaceholder: {
    height: 66,
    justifyContent: 'center',
  },
  refreshBtn: {
    padding: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 22,
    textAlign: 'center',
    letterSpacing: 4,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 14,
  },
  syncBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
  },
  loadingSubtext: {
    fontSize: 14,
    marginTop: 8,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 20,
  },
  successSubtitle: {
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
