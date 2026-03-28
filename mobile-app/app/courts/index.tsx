
import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from 'react-native';
import TNInteractiveMap from '@/components/TNInteractiveMap';

export default function CourtStateListScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  const handleDistrictPress = (districtName: string) => {
    router.push({
      pathname: '/courts/[state]/[district]',
      params: { state: 'Tamil Nadu', district: districtName }
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'Court Directory - Tamil Nadu', headerShadowVisible: false }} />
      
      <View style={styles.content}>
        <TNInteractiveMap onDistrictPress={handleDistrictPress} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  hint: {
    marginTop: 12,
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  }
});
