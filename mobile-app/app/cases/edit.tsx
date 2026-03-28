import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Alert, useColorScheme } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { FileText } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';

export default function EditCaseScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  
  // Form Data
  const [formData, setFormData] = useState({
    title: '',
    caseNumber: '',
    caseType: 'civil',
    courtName: '',
    description: '',
    cnrNumber: '',
    cino: '',
  });

  // Client Logic
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);


  // Document Logic
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);


  const caseTypes = ['civil', 'criminal', 'family', 'corporate', 'property', 'tax', 'immigration', 'other'];

  useEffect(() => {
    if (id) {
        fetchCaseDetails();
        fetchClients();
    }
  }, [id]);

  const fetchCaseDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) throw error;
      
      if (data) {
        setFormData({
          title: data.title || '',
          caseNumber: data.case_number || '',
          caseType: data.case_type || 'civil',
          courtName: data.court_name || '',
          description: data.description || '',
          cnrNumber: data.cnr_number || '',
          cino: data.cino || '',
        });
      }
    } catch (err: any) {
      Alert.alert('Error', 'Failed to load case details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
      try {
          console.log('[EditCase] Fetching clients...');
          const { data, error } = await supabase.from('clients').select('user_id, full_name');
          if (error) {
              console.error('[EditCase] Error fetching clients:', error);
          } else if (data) {
              console.log('[EditCase] Clients found:', data.length);
              setClients(data);
          }
      } catch (e) {
          console.log('[EditCase] Error fetching clients', e);
      }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;
      setSelectedFile(result.assets[0]);
    } catch (err) {
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleUpdate = async () => {
    if (!formData.title || !formData.caseNumber) {
      Alert.alert('Missing Fields', 'Title and Case Number are required.');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 1. Update Case Details
      const { error } = await supabase
        .from('cases')
        .update({
          title: formData.title,
          case_number: formData.caseNumber,
          case_type: formData.caseType,
          court_name: formData.courtName,
          description: formData.description,
          cnr_number: formData.cnrNumber,
          cino: formData.cino,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      // 2. Assign Client (if selected)
      if (selectedClientId) {
          // Check if already assigned? Simplest is to just try insert and ignore duplicate error if RLS handles it, 
          // or rely on unique constraints. Or select first.
          // For now, let's just insert.
          const { error: partError } = await supabase.from('case_participants').insert({
              case_id: id,
              user_id: selectedClientId,
              role: 'client'
          });
          if (partError) console.log('Client assignment error (likely duplicate):', partError.message);
      }


      // 4. Upload New Document (if selected)
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${id}/${Date.now()}.${fileExt}`;
        
        const response = await fetch(selectedFile.uri);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
          .from('case-documents')
          .upload(fileName, blob);

        if (!uploadError) {
           await supabase.from('case_documents').insert({
             case_id: id,
             file_name: selectedFile.name,
             file_path: fileName,
             file_type: selectedFile.mimeType || 'application/octet-stream',
             file_size: selectedFile.size || 0,
             uploaded_by: user.id
           });
        }
      }

      Alert.alert('Success', 'Case updated successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ 
        title: 'Edit Case',
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.tint,
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
            <Ionicons name="close" size={24} color={theme.tint} />
          </TouchableOpacity>
        ),
        headerRight: () => (
          <TouchableOpacity 
            onPress={handleUpdate} 
            disabled={saving}
            style={{ opacity: saving ? 0.5 : 1 }}
          >
            <Text style={{ color: theme.tint, fontWeight: 'bold', fontSize: 16 }}>Save</Text>
          </TouchableOpacity>
        ),
        presentation: 'modal'
      }} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* --- eCourts Identifiers --- */}
        <Text style={[styles.sectionHeader, { color: theme.text }]}>Official Identifiers</Text>
        <Text style={[styles.helperText, { color: theme.icon, marginBottom: 12 }]}>
          Linking a CNR number allows automatic syncing with eCourts.
        </Text>
        
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.text }]}>CNR Number</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            placeholder="e.g. MCHC010012342023"
            placeholderTextColor={theme.icon}
            value={formData.cnrNumber}
            onChangeText={(t) => setFormData({ ...formData, cnrNumber: t })}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.text }]}>CINO</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            placeholder="e.g. 1234567890"
            placeholderTextColor={theme.icon}
            value={formData.cino}
            onChangeText={(t) => setFormData({ ...formData, cino: t })}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        {/* --- Case Details (Local Only) --- */}
        <Text style={[styles.sectionHeader, { color: theme.text }]}>Local Details</Text>
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Case Display Title</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            placeholder="e.g. Smith vs. Jones"
            placeholderTextColor={theme.icon}
            value={formData.title}
            onChangeText={(t) => setFormData({ ...formData, title: t })}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            placeholder="Brief details about the case..."
            placeholderTextColor={theme.icon}
            multiline
            numberOfLines={3}
            value={formData.description}
            onChangeText={(t) => setFormData({ ...formData, description: t })}
          />
        </View>

        {/* --- Official Info (Read Only) --- */}
        <View style={[styles.infoBanner, { backgroundColor: theme.surfaceVariant }]}>
          <Ionicons name="information-circle" size={20} color={theme.tint} />
          <Text style={[styles.infoBannerText, { color: theme.icon }]}>
            Official information like Case Number, Type, and Court Name are automatically synced from eCourts and cannot be edited manually.
          </Text>
        </View>
        
        {/* --- Add Client (New) --- */}
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Text style={[styles.sectionHeader, { color: theme.text }]}>Assign New Client</Text>
        <View style={styles.formGroup}>
            {clients.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                    {clients.map((client) => (
                        <TouchableOpacity
                            key={client.user_id}
                            style={[
                                styles.typeChip, 
                                { backgroundColor: theme.surface, borderColor: theme.border },
                                selectedClientId === client.user_id && { backgroundColor: theme.tint + '20', borderColor: theme.tint }
                            ]}
                            onPress={() => setSelectedClientId(
                                selectedClientId === client.user_id ? null : client.user_id
                            )}
                        >
                            <Text style={[
                                styles.typeText, 
                                { color: theme.icon },
                                selectedClientId === client.user_id && { color: theme.tint }
                            ]}>
                                {client.full_name || client.email}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            ) : (
                 <Text style={{ color: theme.icon, fontStyle: 'italic' }}>No clients found.</Text>
            )}
        </View>


        {/* --- Upload Document (New) --- */}
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Text style={[styles.sectionHeader, { color: theme.text }]}>Upload New Document</Text>
        
        {selectedFile ? (
          <View style={[styles.fileCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <FileText size={24} color={theme.tint} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.fileName, { color: theme.text }]}>{selectedFile.name}</Text>
              <Text style={[styles.fileSize, { color: theme.icon }]}>{(selectedFile.size! / 1024).toFixed(1)} KB</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedFile(null)}>
              <Ionicons name="close-circle" size={24} color={theme.icon} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={[styles.uploadBox, { borderColor: theme.border, backgroundColor: theme.surfaceVariant }]} onPress={pickDocument}>
            <Ionicons name="cloud-upload-outline" size={32} color={theme.icon} />
            <Text style={[styles.uploadText, { color: theme.icon }]}>Tap to upload new document</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
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
  content: {
    padding: 24,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  divider: {
    height: 1,
    marginVertical: 24,
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  subSection: {
    padding: 16,
    borderRadius: 12,
  },
  formGroup: {
    marginBottom: 20,
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
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  miniChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  miniChipText: {
    fontSize: 12,
    textTransform: 'capitalize',
  },
  uploadBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadText: {
    marginTop: 8,
    fontSize: 14,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
  },
  fileSize: {
    fontSize: 12,
  },
});
