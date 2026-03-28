import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, View, Linking, Platform } from 'react-native';
import { Globe, FileText, Landmark, Gavel, Search, Map, ScrollText, Video, MonitorPlay } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';


export const ESSENTIALS = [
  {
    id: 'courts',
    name: 'Court Directory',
    url: '/courts',
    icon: Map,
    color: '#6366F1'
  },
  {
    id: 'india-code',
    name: 'India Code',
    url: 'https://www.indiacode.nic.in/',
    icon: ScrollText,
    color: '#EC4899'
  }
];

export const GOVT_PORTALS = [
  {
    id: 'ecourts',
    name: 'eCourts Services',
    url: 'https://services.ecourts.gov.in/',
    icon: Globe,
    color: '#2563EB',
  },
  {
    id: 'efiling',
    name: 'e-Filing',
    url: 'https://filing.ecourts.gov.in/pdedev/',
    icon: FileText,
    color: '#2563EB',
  },
  {
    id: 'njdg',
    name: 'NJDG Data Grid',
    url: 'https://njdg.ecourts.gov.in/njdgnew/index.php',
    icon: Landmark,
    color: '#D97706',
  },
  {
    id: 'hybridvc',
    name: 'Hybrid VC Links',
    url: 'https://chennai.dcourts.gov.in/hybrid-vc-microsoft-teams-links-for-all-the-courts-functioning-in-chennai-district/',
    icon: Video,
    color: '#7C3AED',
  },
  {
    id: 'livehearing',
    name: 'Live Hearing Display',
    url: 'https://www.mhc.tn.gov.in/masdisplay/',
    icon: MonitorPlay,
    color: '#DC2626',
  }
];

interface PortalShortcutsProps {
  title: string;
  items: typeof ESSENTIALS;
}

export default function PortalShortcuts({ title, items }: PortalShortcutsProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  const handlePress = async (url: string) => {
    if (url.startsWith('/')) {
        router.push(url as any);
        return;
    }
    
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
        console.error("An error occurred", error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {items.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => handlePress(item.url)}
          >
            <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
              <item.icon size={24} color={item.color} />
            </View>
            <Text style={[styles.portalName, { color: theme.text }]} numberOfLines={2}>
              {item.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingHorizontal: 12, // +4 margin on card = 16
  },
  card: {
    width: 100,
    height: 110,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    ...Platform.select({
        ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
        },
        android: {
            elevation: 2,
        },
    }),
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  portalName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
