
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from 'react-native';
import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, List } from 'lucide-react-native';
import ipcData from '@/data/ipc.json';
import crpcData from '@/data/crpc.json';
import cpcData from '@/data/cpc.json';
import evidenceData from '@/data/evidence.json';

// Simple map for MVP.
const ACTS_MAP: any = {
    'IPC': ipcData,
    'CrPC': crpcData,
    'CPC': cpcData,
    'IEA': evidenceData
};

export default function BareActReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  
  const act = ACTS_MAP[id!];
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedChapters, setExpandedChapters] = useState<Record<number, boolean>>({});

  const toggleChapter = (num: number) => {
    setExpandedChapters(prev => ({ ...prev, [num]: !prev[num] })); // Toggle
  };

  // Filter Logic
  const sections = useMemo(() => {
    if (!act) return [];
    
    let result: any[] = [];
    
    act.chapters.forEach((chapter: any) => {
        // If search exists, filter content
        const matchesChapter = chapter.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchingSections = chapter.sections.filter((sec: any) => 
            !searchQuery || 
            sec.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
            sec.section.toLowerCase().includes(searchQuery.toLowerCase()) ||
            sec.content.toLowerCase().includes(searchQuery.toLowerCase())
        );

        if (matchesChapter || matchingSections.length > 0) {
            // Include chapter header
            result.push({ 
                type: 'header', 
                chapter: chapter, 
                expanded: !!searchQuery || expandedChapters[chapter.number] // Auto expand on search
            });
            
            // Include matched sections if expanded
            if (!!searchQuery || expandedChapters[chapter.number]) {
                 matchingSections.forEach((sec: any) => result.push({ type: 'section', section: sec }));
            }
        }
    });
    
    return result;
  }, [act, searchQuery, expandedChapters]);


  const renderItem = ({ item }: { item: any }) => {
     if (item.type === 'header') {
         return (
             <TouchableOpacity 
                style={[styles.chapterHeader, { backgroundColor: theme.surfaceVariant }]}
                onPress={() => toggleChapter(item.chapter.number)}
             >
                 <View style={styles.chapterRow}>
                    <List size={20} color={theme.tint} />
                    <Text style={[styles.chapterTitle, { color: theme.text }]}>
                        Chapter {item.chapter.number}: {item.chapter.title}
                    </Text>
                 </View>
                 {item.expanded ? <ChevronDown size={20} color={theme.icon} /> : <ChevronRight size={20} color={theme.icon} />}
             </TouchableOpacity>
         );
     } else {
         return (
             <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                 <View style={styles.sectionHeader}>
                    <View style={[styles.sectionBadge, { backgroundColor: theme.tint }]}>
                        <Text style={styles.sectionBadgeText}>Section {item.section.section}</Text>
                    </View>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>{item.section.title}</Text>
                 </View>
                 <Text style={[styles.sectionContent, { color: theme.text }]}>{item.section.content}</Text>
             </View>
         );
     }
  };

  if (!act) return <View><Text>Act not found</Text></View>;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: act.id, headerShadowVisible: false }} />

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Search size={20} color={theme.icon} />
          <TextInput 
            style={[styles.input, { color: theme.text }]}
            placeholder={`Search in ${act.title}...`}
            placeholderTextColor={theme.icon}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
      </View>

      <FlatList
        data={sections}
        keyExtractor={(item, index) => index.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 16,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  list: {
    paddingBottom: 40,
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  chapterTitle: {
    fontWeight: '600',
    fontSize: 16,
  },
  sectionCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginLeft: 24, // Indent
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  sectionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  sectionBadgeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  sectionTitle: {
    flex: 1,
    fontWeight: 'bold',
    fontSize: 16,
  },
  sectionContent: {
    lineHeight: 22,
    fontSize: 14,
  }
});
