import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native';
import { UserPlus, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';
import { getWebBaseUrl } from '@/lib/web-url';

interface InviteClientModalProps {
  isVisible: boolean;
  onClose: () => void;
  caseId: string;
  onSuccess?: () => void;
}

interface ExistingCandidate {
  id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
}

export default function InviteClientModal({
  isVisible,
  onClose,
  caseId,
  onSuccess
}: InviteClientModalProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [existingCandidate, setExistingCandidate] = useState<ExistingCandidate | null>(null);
  const webUrl = getWebBaseUrl();

  useEffect(() => {
    if (isVisible) {
      setPhone('');
      setInviteLink(null);
      setExistingCandidate(null);
      setLoading(false);
    }
  }, [isVisible]);

  const postInvite = async (payload: Record<string, unknown>) => {
    let { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      const refreshResult = await supabase.auth.refreshSession();
      session = refreshResult.data.session;
    }

    if (!session?.access_token) {
      throw new Error('Your session has expired. Please log in again and retry.');
    }

    const response = await fetch(`${webUrl}/api/cases/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok || result.error) {
      throw new Error(result.error || 'Failed to invite client');
    }
    return result;
  };

  const handleLookupOrInvite = async () => {
    if (!phone.trim()) {
      Alert.alert('Phone required', 'Enter a client phone number.');
      return;
    }

    setLoading(true);
    try {
      const result = await postInvite({
        caseId,
        phone: phone.trim(),
        action: 'lookup_or_invite'
      });

      if (result.type === 'existing_found' && result.candidate) {
        setExistingCandidate(result.candidate as ExistingCandidate);
        return;
      }

      if (result.type === 'invited' && result.inviteLink) {
        setExistingCandidate(null);
        setInviteLink(result.inviteLink);
        Alert.alert(
          'Invite Created',
          'Share the invite link via WhatsApp or SMS.'
        );
      }
    } catch (err: any) {
      Alert.alert('Invite Failed', err?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddExisting = async () => {
    if (!existingCandidate) return;
    setLoading(true);
    try {
      const result = await postInvite({
        caseId,
        phone: phone.trim(),
        action: 'add_existing',
        userId: existingCandidate.id
      });

      if (result.type === 'added') {
        Alert.alert('Client Added', result.success || 'Client added to case.');
        onClose();
        if (onSuccess) onSuccess();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      Alert.alert('Add Failed', message);
    } finally {
      setLoading(false);
    }
  };

  const shareText = inviteLink
    ? `Hi, please join my case on LegalHub. Click to join: ${inviteLink}`
    : '';

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.content, { backgroundColor: theme.surface }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.headerTitleRow}>
              <UserPlus size={18} color={theme.tint} />
              <Text style={[styles.title, { color: theme.text }]}>Invite Client</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={22} color={theme.icon} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <Text style={[styles.label, { color: theme.icon }]}>Client Phone Number</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceVariant }]}
              placeholder="+91 98765 43210"
              placeholderTextColor={theme.icon}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              editable={!loading}
            />

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.tint }, loading && styles.disabledBtn]}
              onPress={handleLookupOrInvite}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Find or Invite Client</Text>
              )}
            </TouchableOpacity>

            {existingCandidate && (
              <View style={[styles.existingCard, { borderColor: theme.border, backgroundColor: theme.surfaceVariant }]}>
                <Text style={[styles.existingLabel, { color: theme.icon }]}>Existing User Found</Text>
                <Text style={[styles.existingName, { color: theme.text }]}>{existingCandidate.full_name}</Text>
                {(existingCandidate.phone || existingCandidate.email) && (
                  <Text style={[styles.existingMeta, { color: theme.icon }]}>
                    {[existingCandidate.phone, existingCandidate.email].filter(Boolean).join(' • ')}
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.addBtn, { backgroundColor: theme.tint }, loading && styles.disabledBtn]}
                  onPress={handleAddExisting}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Add to Case</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {inviteLink && (
              <View style={styles.shareRow}>
                <TouchableOpacity
                  style={[styles.shareBtn, { borderColor: theme.border, backgroundColor: theme.surfaceVariant }]}
                  onPress={() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(shareText)}`)}
                >
                  <Text style={[styles.shareBtnText, { color: theme.text }]}>Share WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.shareBtn, { borderColor: theme.border, backgroundColor: theme.surfaceVariant }]}
                  onPress={() => Linking.openURL(`sms:?body=${encodeURIComponent(shareText)}`)}
                >
                  <Text style={[styles.shareBtnText, { color: theme.text }]}>Share SMS</Text>
                </TouchableOpacity>
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
    justifyContent: 'flex-end'
  },
  content: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: 300,
    paddingBottom: 24
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  title: {
    fontSize: 18,
    fontWeight: '700'
  },
  body: {
    padding: 20,
    gap: 12
  },
  label: {
    fontSize: 13,
    fontWeight: '600'
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16
  },
  primaryBtn: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15
  },
  disabledBtn: {
    opacity: 0.7
  },
  shareRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10
  },
  shareBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center'
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: '600'
  },
  existingCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    gap: 4
  },
  existingLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  existingName: {
    fontSize: 16,
    fontWeight: '700'
  },
  existingMeta: {
    fontSize: 12
  },
  addBtn: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center'
  }
});
