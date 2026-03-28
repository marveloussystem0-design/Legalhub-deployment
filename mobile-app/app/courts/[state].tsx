
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from 'react-native';
import { MapPin, ChevronRight } from 'lucide-react-native';
import courtData from '@/data/court-hierarchy.json';

import TNInteractiveMap from '@/components/TNInteractiveMap';

export default function DistrictListScreen() {
  const { state } = useLocalSearchParams<{ state: string }>();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  const isTamilNadu = state === 'Tamil Nadu';
  const stateData = courtData.find(s => s.state === state);

  const handleDistrictPress = (districtName: string) => {
    router.push({
      pathname: '/courts/[state]/[district]',
      params: { state: state!, district: districtName }
    });
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={[styles.item, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}
      onPress={() => handleDistrictPress(item.name)}
    >
      <View style={styles.row}>
         <View style={[styles.iconBox, { backgroundColor: theme.surfaceVariant }]}>
            <MapPin size={24} color={theme.tint} />
         </View>
         <Text style={[styles.title, { color: theme.text }]}>{item.name}</Text>
      </View>
      <ChevronRight size={20} color={theme.icon} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: state || 'Districts', headerShadowVisible: false }} />
      
      {isTamilNadu ? (
        <View style={styles.mapContainer}>
          <TNInteractiveMap onDistrictPress={handleDistrictPress} />
        </View>
      ) : (
        <FlatList
          data={stateData?.districts || []}
          keyExtractor={(item) => item.name}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
              <View style={styles.empty}>
                  <Text style={{ color: theme.icon }}>No districts found.</Text>
              </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    padding: 16,
    alignItems: 'center',
  },
  mapHint: {
    marginTop: 8,
    fontSize: 12,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    marginTop: 8,
  },
  list: {
    padding: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  empty: {
    padding: 20,
    alignItems: 'center',
  }
});
