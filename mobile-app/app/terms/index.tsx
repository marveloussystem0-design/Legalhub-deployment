import React from 'react';
import { View, Text, StyleSheet, ScrollView, useColorScheme, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { Shield } from 'lucide-react-native';

export default function TermsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ 
        title: 'Terms of Service',
        headerShown: true,
        headerBackTitle: 'Back',
        headerTintColor: theme.tint,
        headerStyle: { backgroundColor: theme.background }
      }} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: theme.tint + '20' }]}>
                <Shield size={32} color={theme.tint} />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>Terms & Conditions</Text>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  header: {
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
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
