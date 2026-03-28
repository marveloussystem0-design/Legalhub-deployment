import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ScrollText, ExternalLink } from 'lucide-react-native';

import { Colors } from '@/constants/Colors';

const INDIA_CODE_URL = 'https://www.indiacode.nic.in/';

export default function IndiaCodeScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const openIndiaCode = async () => {
    try {
      await WebBrowser.openBrowserAsync(INDIA_CODE_URL);
    } catch (error) {
      console.error('Failed to open India Code in browser:', error);
      await Linking.openURL(INDIA_CODE_URL);
    }
  };

  useEffect(() => {
    void openIndiaCode();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'India Code', headerShadowVisible: false }} />

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: theme.surfaceVariant }]}>
          <ScrollText size={28} color={theme.tint} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>Opening India Code</Text>
        <Text style={[styles.subtitle, { color: theme.icon }]}>
          Access the official repository of central acts and rules from the Government of India.
        </Text>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.tint }]}
          onPress={() => void openIndiaCode()}
        >
          <ExternalLink size={18} color="#FFFFFF" />
          <Text style={styles.buttonText}>Open India Code</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
