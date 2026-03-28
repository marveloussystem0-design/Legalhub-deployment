import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, Alert, TextInput } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from 'react-native';
import { useState, useMemo } from 'react';
import { MapPin, Navigation, Search, X } from 'lucide-react-native';
import courtData from '@/data/court-hierarchy.json';

export default function CourtComplexListScreen() {
  const { state, district } = useLocalSearchParams<{ state: string, district: string }>();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const stateData = courtData.find(s => s.state === state);
  const districtData = stateData?.districts.find(d => d.name === district);

  const [searchQuery, setSearchQuery] = useState('');

  const filteredCourts = useMemo(() => {
    if (!districtData?.courts) return [];
    if (!searchQuery.trim()) return districtData.courts;
    
    const query = searchQuery.toLowerCase();
    return districtData.courts.filter(court => 
      court.name.toLowerCase().includes(query) || 
      court.address.toLowerCase().includes(query)
    );
  }, [districtData, searchQuery]);

  const openMaps = (params: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${params}`;
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open maps');
      }
    });
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.header}>
         <View style={[styles.iconBox, { backgroundColor: theme.surfaceVariant }]}>
            <MapPin size={24} color={theme.tint} />
         </View>
         <Text style={[styles.title, { color: theme.text }]}>{item.name}</Text>
      </View>
      
      <Text style={[styles.address, { color: theme.icon }]}>{item.address}</Text>

      <TouchableOpacity 
        style={[styles.mapBtn, { borderColor: theme.tint }]}
        onPress={() => openMaps(item.mapParams)}
      >
        <Navigation size={16} color={theme.tint} />
        <Text style={[styles.mapBtnText, { color: theme.tint }]}>View on Map</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: district || 'Courts', headerShadowVisible: false }} />
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Search size={20} color={theme.icon} />
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Search courts or areas..."
            placeholderTextColor={theme.icon}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={20} color={theme.icon} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredCourts}
        keyExtractor={(item) => item.name}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ color: theme.icon }}>
              {searchQuery ? 'No courts found matching your search.' : 'No courts found in this district.'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: 16,
    paddingTop: 8,
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    height: '100%',
  },
  card: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  address: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  mapBtnText: {
    fontWeight: '600',
  },
  empty: {
    padding: 20,
    alignItems: 'center',
  }
});
