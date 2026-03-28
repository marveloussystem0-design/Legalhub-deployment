import React from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, TouchableOpacity, useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { Shield, X } from 'lucide-react-native';

interface TermsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function TermsModal({ visible, onClose }: TermsModalProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={{ width: 40 }} /> 
            <Text style={[styles.headerTitle, { color: theme.text }]}>Terms of Service</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
                <View style={[styles.iconCircle, { backgroundColor: theme.tint + '20' }]}>
                    <Shield size={32} color={theme.tint} />
                </View>
                <Text style={[styles.subtitle, { color: theme.icon }]}>Last Updated: Feb 2026</Text>
            </View>

            <View style={styles.section}>
                <Text style={[styles.heading, { color: theme.text }]}>1. Introduction</Text>
                <Text style={[styles.paragraph, { color: theme.text }]}>
                    Welcome to LegalHub. By accessing or using our mobile application, you agree to be bound by these Terms of Service.
                </Text>
            </View>

            <View style={styles.section}>
                <Text style={[styles.heading, { color: theme.text }]}>2. Definitions</Text>
                <Text style={[styles.paragraph, { color: theme.text }]}>
                    • "Platform" refers to the LegalHub application.{"\n"}
                    • "Advocate" refers to legal professionals registered on the platform.{"\n"}
                    • "Litigant" refers to clients or individuals accessing legal services.
                </Text>
            </View>

            <View style={styles.section}>
                <Text style={[styles.heading, { color: theme.text }]}>3. Responsibilities</Text>
                <Text style={[styles.paragraph, { color: theme.text }]}>
                    <Text style={{fontWeight: 'bold'}}>Advocates:</Text> You warrant that you are a licensed legal professional. You are responsible for the advice you provide.{"\n\n"}
                    <Text style={{fontWeight: 'bold'}}>Litigants:</Text> You agree to provide accurate information and respect the professional time of Advocates.
                </Text>
            </View>

            <View style={styles.section}>
                <Text style={[styles.heading, { color: theme.text }]}>4. Data Privacy</Text>
                <Text style={[styles.paragraph, { color: theme.text }]}>
                    We take data security serious. Case data is encrypted. Messaging between Advocates and Litigants is private. We do not sell your personal data to third parties.
                </Text>
            </View>

            <View style={styles.section}>
                <Text style={[styles.heading, { color: theme.text }]}>5. eCourts Data</Text>
                <Text style={[styles.paragraph, { color: theme.text }]}>
                    Our platform provides data imported from public eCourts records for convenience. We do not guarantee real-time accuracy. Always verify dates with official court records.
                </Text>
            </View>

            <View style={styles.section}>
                <Text style={[styles.heading, { color: theme.text }]}>6. Limitation of Liability</Text>
                <Text style={[styles.paragraph, { color: theme.text }]}>
                    LegalHub is a technology platform, not a law firm. We are not liable for any legal outcomes or damages resulting from the use of our services.
                </Text>
            </View>

            <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    padding: 24,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    opacity: 0.8,
  },
});
