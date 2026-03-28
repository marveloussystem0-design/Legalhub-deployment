import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Modal, useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/lib/auth-context';
import { User, Mail, Award, Briefcase, Calendar, FileText, Edit, X, AlertTriangle, Shield } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useState, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';

type UserRole = 'advocate' | 'client' | 'litigant' | 'clerk' | string;

interface AdvocateProfile {
  full_name?: string | null;
  profile_photo_url?: string | null;
  is_verified?: boolean | null;
  bar_council_number?: string | null;
  bar_council_state?: string | null;
  specialization?: string[] | null;
  experience_years?: number | null;
  bio?: string | null;
}

interface ClientProfile {
  full_name?: string | null;
  phone?: string | null;
  profile_photo_url?: string | null;
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [advocate, setAdvocate] = useState<AdvocateProfile | null>(null);
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const role = (user?.user_metadata?.role as UserRole) || 'user';
  const isClient = role === 'client' || role === 'litigant';
  const profileName = isClient
    ? (client?.full_name || user?.user_metadata?.full_name || 'Not Set')
    : (advocate?.full_name || 'Not Set');
  const profilePhotoUrl = isClient ? client?.profile_photo_url : advocate?.profile_photo_url;
  const profilePhone = client?.phone || user?.phone || user?.user_metadata?.phone || 'Not set';
  const roleLabel = isClient ? 'Litigant' : role;

  // Memoize loadProfileData to prevent unnecessary re-renders
  const loadProfileData = useCallback(async () => {
    if (!user) return;

    try {
      if (isClient) {
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        setClient(data);
        setAdvocate(null);
      } else {
        const { data, error } = await supabase
          .from('advocates')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        setAdvocate(data);
        setClient(null);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      // Don't alert on PGRST116 (no rows), just leave as null
    } finally {
      setLoading(false);
    }
  }, [isClient, user]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadProfileData();
      }
    }, [user, loadProfileData])
  );

  const handleSignOut = async () => {
    console.log('🔴 handleSignOut called');
    setShowSignOutModal(true);
  };

  const confirmSignOut = async () => {
    console.log('✅ User confirmed sign out');
    setShowSignOutModal(false);
    
    try {
      console.log('🚪 Signing out...');
      await signOut();
      console.log('✅ Sign out successful - session cleared');
    } catch (error) {
      console.error('❌ Sign out error:', error);
      alert('Failed to sign out. Please try again.');
    }
  };

  const cancelSignOut = () => {
    console.log('❌ Sign out cancelled by user');
    setShowSignOutModal(false);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>My Profile</Text>
        <Text style={[styles.subtitle, { color: theme.icon }]}>
          {isClient ? 'Manage your account information' : 'Manage your professional information'}
        </Text>
      </View>

      {/* Profile Card */}
      <View style={[styles.profileCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.profileHeader}>
          {profilePhotoUrl ? (
            <Image
              source={{ uri: profilePhotoUrl }}
              style={[styles.profileImage, { borderColor: theme.border }]}
            />
          ) : (
            <View style={[styles.profileImagePlaceholder, { borderColor: theme.border, backgroundColor: theme.tint + '10' }]}>
              <User size={48} color={theme.tint} />
            </View>
          )}
          
          <Text style={[styles.profileName, { color: theme.text }]}>{profileName}</Text>
          <Text style={[styles.profileEmail, { color: theme.icon }]}>{user?.email}</Text>
          
          <View style={[styles.badge, { backgroundColor: theme.tint + '20' }]}>
            <Text style={[styles.badgeText, { color: theme.tint, textTransform: 'capitalize' }]}>
              {roleLabel || 'User'}
            </Text>
          </View>

          {!isClient && advocate?.is_verified && (
            <View style={styles.verifiedBadge}>
              <Award size={12} color="#4ADE80" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>
      </View>

      {/* Professional Information */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          {isClient ? 'Profile Information' : 'Professional Information'}
        </Text>

        <View style={styles.infoGrid}>
          <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <User size={20} color={theme.tint} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: theme.icon }]}>Full Name</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{profileName || 'Not set'}</Text>
            </View>
          </View>

          <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Mail size={20} color={theme.tint} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: theme.icon }]}>Email</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{user?.email}</Text>
            </View>
          </View>

          {isClient ? (
            <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <User size={20} color={theme.tint} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme.icon }]}>Phone</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{profilePhone}</Text>
              </View>
            </View>
          ) : (
            <>
              <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Award size={20} color={theme.tint} />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: theme.icon }]}>Bar Council Number</Text>
                  <Text style={[styles.infoValue, { color: theme.text }]}>{advocate?.bar_council_number || 'Not set'}</Text>
                </View>
              </View>

              <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Award size={20} color={theme.tint} />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: theme.icon }]}>Bar Council State</Text>
                  <Text style={[styles.infoValue, { color: theme.text }]}>{advocate?.bar_council_state || 'Not set'}</Text>
                </View>
              </View>

              <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Briefcase size={20} color={theme.tint} />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: theme.icon }]}>Specialization</Text>
                  <Text style={[styles.infoValue, { color: theme.text }]}>
                    {advocate?.specialization && advocate.specialization.length > 0
                      ? advocate.specialization.join(', ')
                      : 'Not set'}
                  </Text>
                </View>
              </View>

              <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Calendar size={20} color={theme.tint} />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: theme.icon }]}>Experience</Text>
                  <Text style={[styles.infoValue, { color: theme.text }]}>
                    {advocate?.experience_years ? `${advocate.experience_years} years` : 'Not set'}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        {!isClient && advocate?.bio && (
          <View style={[styles.bioCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <FileText size={20} color={theme.tint} />
            <View style={styles.bioContent}>
              <Text style={[styles.infoLabel, { color: theme.icon }]}>Bio</Text>
              <Text style={[styles.bioText, { color: theme.text }]}>{advocate.bio}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.editButton, { backgroundColor: theme.tint }]}
          onPress={() => router.push('/profile/edit')}
        >
          <Edit size={20} color="#fff" />
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.signOutButton}
          onPress={() => {
            console.log('🔴 Sign Out button clicked');
            handleSignOut();
          }}
        >
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Sign Out Confirmation Modal */}
      <Modal
        visible={showSignOutModal}
        transparent
        animationType="fade"
        onRequestClose={cancelSignOut}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconContainer}>
                <AlertTriangle size={40} color="#EF4444" />
              </View>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={cancelSignOut}
              >
                <X size={24} color={theme.icon} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalTitle, { color: theme.text }]}>Sign Out?</Text>
            <Text style={[styles.modalMessage, { color: theme.icon }]}>
              Are you sure you want to sign out? You'll need to log in again to access your account.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalCancelButton, { borderColor: theme.border }]}
                onPress={cancelSignOut}
              >
                <Text style={[styles.modalCancelText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.modalConfirmButton}
                onPress={confirmSignOut}
              >
                <Text style={styles.modalConfirmText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 50,
  },
  header: {
    padding: 24,
    paddingTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  profileCard: {
    borderRadius: 12,
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 24,
    borderWidth: 1,
  },
  profileHeader: {
    alignItems: 'center',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    borderWidth: 3,
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  profileEmail: {
    fontSize: 14,
    marginTop: 4,
  },
  badge: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  verifiedBadge: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: '#4ADE80',
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  infoGrid: {
    gap: 12,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  bioCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
  },
  bioContent: {
    flex: 1,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    paddingHorizontal: 24,
    gap: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  signOutButton: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#EF4444',
    alignItems: 'center',
  },
  signOutButtonText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
