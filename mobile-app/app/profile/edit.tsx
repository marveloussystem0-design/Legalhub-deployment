import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image, useColorScheme } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth-context';
import * as ImagePicker from 'expo-image-picker';

const SPECIALIZATION_OPTIONS = [
  { label: 'Criminal Law', value: 'criminal' },
  { label: 'Civil Law', value: 'civil' },
  { label: 'Family Law', value: 'family' },
  { label: 'Corporate Law', value: 'corporate' },
  { label: 'Property Law', value: 'property' },
  { label: 'Tax Law', value: 'tax' },
  { label: 'Immigration', value: 'immigration' },
  { label: 'Intellectual Property', value: 'ipr' },
  { label: 'Consumer Protection', value: 'consumer' }
];

export default function EditProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  
  const [formData, setFormData] = useState({
    full_name: '',
    bar_council_number: '',
    bar_council_state: '',
    experience_years: '',
    specialization: '',
    bio: '',
    profile_photo_url: '',
    city: '',
    state: '',
    pincode: '',
    address: ''
  });
  const isAdvocate = user?.user_metadata?.role === 'advocate';

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    try {
      if (isAdvocate) {
          const { data, error } = await supabase
            .from('advocates')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle(); // Use maybeSingle to prevent PGRST116 crashes
          
          if (error) throw error;
          
          if (data) {
            setFormData({
              full_name: data.full_name || '',
              bar_council_number: data.bar_council_number || '',
              bar_council_state: data.bar_council_state || '',
              experience_years: data.experience_years ? data.experience_years.toString() : '',
              specialization: data.specialization ? data.specialization.join(', ') : '',
              bio: data.bio || '',
              profile_photo_url: data.profile_photo_url || '',
              city: '', // Advocates don't have these fields
              state: '',
              pincode: '',
              address: ''
            });
          }
      } else {
          // Client/Litigant Profile Loading from clients table
          const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          if (error) throw error;

          setFormData(prev => ({
            ...prev,
            full_name: data?.full_name || user.user_metadata?.full_name || '',
            profile_photo_url: data?.profile_photo_url || '',
            city: data?.city || '',
            state: data?.state || '',
            pincode: data?.pincode || '',
            address: data?.address || ''
          }));
      }

    } catch (err: any) {
      console.error('Error loading profile:', err);
      // Silent fail is better than alert loop for missing profiles
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    try {
      setUploading(true);
      
      // 1. Create FormData or Blob
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const fileExt = uri.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `profile-photos/${fileName}`;

      // 2. Upload to Supabase 'case-documents' bucket (same as web)
      const { error: uploadError } = await supabase.storage
        .from('case-documents')
        .upload(filePath, blob);

      if (uploadError) throw uploadError;

      // 3. Get Public URL
      const { data } = supabase.storage
        .from('case-documents')
        .getPublicUrl(filePath);

      if (data.publicUrl) {
        setFormData(prev => ({ ...prev, profile_photo_url: data.publicUrl }));
      }

    } catch (error: any) {
      Alert.alert('Upload Failed', error.message);
    } finally {
      setUploading(false);
    }
  };

  const toggleSpecialization = (value: string) => {
    let current = formData.specialization ? formData.specialization.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];
    if (current.includes(value)) {
      current = current.filter(s => s !== value);
    } else {
      current.push(value);
    }
    setFormData(prev => ({ ...prev, specialization: current.join(', ') }));
  };

  const handleSave = async () => {
    if (!user) return;
    if (!formData.full_name.trim()) {
      Alert.alert('Required Field', 'Full Name is required.');
      return;
    }

    setSaving(true);
    try {
      const updates: any = {
        full_name: formData.full_name,
        updated_at: new Date().toISOString(),
      };
      
      // Keep auth metadata consistent for both advocate + litigant.
      await supabase.auth.updateUser({
        data: { full_name: formData.full_name }
      });

      if (isAdvocate) {
          // Advocate specific updates
          const advocateUpdates = {
            ...updates,
            bar_council_number: formData.bar_council_number,
            bar_council_state: formData.bar_council_state,
            experience_years: formData.experience_years ? parseInt(formData.experience_years) : null,
            specialization: formData.specialization 
              ? formData.specialization.split(',').map(s => s.trim()).filter(s => s.length > 0) 
              : [],
            bio: formData.bio,
            profile_photo_url: formData.profile_photo_url, // advocates table uses this
          };
          
          const { error } = await supabase
            .from('advocates')
            .update(advocateUpdates)
            .eq('user_id', user.id);

          if (error) throw error;
      } else {
          // Client specific updates should go to clients table.
          const clientUpdates: Record<string, any> = {
            full_name: formData.full_name,
            city: formData.city,
            state: formData.state,
            pincode: formData.pincode,
            address: formData.address,
            updated_at: new Date().toISOString()
          };

          if (formData.profile_photo_url) {
            clientUpdates.profile_photo_url = formData.profile_photo_url;
          }

          let { error: clientError } = await supabase
            .from('clients')
            .update(clientUpdates)
            .eq('user_id', user.id);

          if (clientError) {
            // Schema-safe fallback for projects missing optional client columns.
            const fallback = await supabase
              .from('clients')
              .update({ full_name: formData.full_name })
              .eq('user_id', user.id);

            clientError = fallback.error;
          }

          if (clientError) throw clientError;
      }

      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (err: any) {
      Alert.alert('Error', 'Failed to update profile: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ 
        title: 'Edit Profile',
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.tint,
        presentation: 'modal',
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
            <Ionicons name="close" size={24} color={theme.tint} />
          </TouchableOpacity>
        ),
        headerRight: () => (
          <TouchableOpacity 
            onPress={handleSave} 
            disabled={saving}
            style={{ opacity: saving ? 0.5 : 1 }}
          >
            <Text style={{ color: theme.tint, fontWeight: 'bold', fontSize: 16 }}>Save</Text>
          </TouchableOpacity>
        )
      }} />

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Photo Section (Placeholder for now) */}
        <View style={styles.photoSection}>
          <Image 
            source={{ uri: formData.profile_photo_url || 'https://via.placeholder.com/100' }} 
            style={[styles.photo, { backgroundColor: theme.surface, borderColor: theme.border }]} 
          />
          <TouchableOpacity 
            style={[styles.changePhotoButton, uploading && { opacity: 0.7 }, { backgroundColor: theme.surface, borderColor: theme.tint }]} 
            onPress={pickImage}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={theme.tint} />
            ) : (
              <Text style={[styles.changePhotoText, { color: theme.tint }]}>Change Photo</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Full Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            value={formData.full_name}
            onChangeText={(t) => setFormData({ ...formData, full_name: t })}
            placeholder="John Doe"
            placeholderTextColor={theme.icon}
          />
        </View>

        {!isAdvocate && (
          <>
            <View style={styles.row}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={[styles.label, { color: theme.text }]}>City</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                  value={formData.city}
                  onChangeText={(t) => setFormData({ ...formData, city: t })}
                  placeholder="Mumbai"
                  placeholderTextColor={theme.icon}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={[styles.label, { color: theme.text }]}>State</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                  value={formData.state}
                  onChangeText={(t) => setFormData({ ...formData, state: t })}
                  placeholder="Maharashtra"
                  placeholderTextColor={theme.icon}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Pincode</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                value={formData.pincode}
                onChangeText={(t) => setFormData({ ...formData, pincode: t })}
                placeholder="400001"
                keyboardType="numeric"
                maxLength={6}
                placeholderTextColor={theme.icon}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Address</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                value={formData.address}
                onChangeText={(t) => setFormData({ ...formData, address: t })}
                placeholder="Enter your full address..."
                placeholderTextColor={theme.icon}
                multiline
                numberOfLines={3}
              />
            </View>
          </>
        )}

        {isAdvocate && (
          <>
            <View style={styles.row}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={[styles.label, { color: theme.text }]}>Bar Council No.</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                  value={formData.bar_council_number}
                  onChangeText={(t) => setFormData({ ...formData, bar_council_number: t })}
                  placeholder="D/123/2024"
                  placeholderTextColor={theme.icon}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={[styles.label, { color: theme.text }]}>State</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                  value={formData.bar_council_state}
                  onChangeText={(t) => setFormData({ ...formData, bar_council_state: t })}
                  placeholder="Delhi"
                  placeholderTextColor={theme.icon}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Experience (Years)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                value={formData.experience_years}
                onChangeText={(t) => setFormData({ ...formData, experience_years: t })}
                placeholder="5"
                keyboardType="numeric"
                placeholderTextColor={theme.icon}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Specialization Areas</Text>
              <View style={styles.chipsContainer}>
                {SPECIALIZATION_OPTIONS.map(spec => {
                  const currentSpecs = formData.specialization ? formData.specialization.split(',').map(s => s.trim()) : [];
                  const isSelected = currentSpecs.includes(spec.value) || currentSpecs.includes(spec.label);
                  return (
                    <TouchableOpacity
                      key={spec.value}
                      style={[
                        styles.chip,
                        { borderColor: theme.border, backgroundColor: theme.surface },
                        isSelected && { backgroundColor: theme.tint, borderColor: theme.tint }
                      ]}
                      onPress={() => toggleSpecialization(spec.value)}
                    >
                      <Text style={[
                        styles.chipText,
                        { color: theme.text },
                        isSelected && { color: '#fff', fontWeight: 'bold' }
                      ]}>
                        {spec.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Bio</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                value={formData.bio}
                onChangeText={(t) => setFormData({ ...formData, bio: t })}
                placeholder="Tell us about your professional background..."
                placeholderTextColor={theme.icon}
                multiline
                numberOfLines={4}
              />
            </View>
          </>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    marginBottom: 12,
  },
  changePhotoButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  changePhotoText: {
    fontWeight: '600',
    fontSize: 14,
  },
  formGroup: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    marginBottom: 8,
    fontWeight: '600',
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
  },
});
