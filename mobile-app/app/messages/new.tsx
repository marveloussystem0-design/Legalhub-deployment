
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from 'react-native';
import { useState, useEffect } from 'react';
import { Search, User } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

export default function NewMessageScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Search Users logic
  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim() || !user) {
        setResults([]);
        return;
      }
      
      setLoading(true);
      try {
        // Search both advocates and clients
        // Note: Real-world app needs proper RLS and maybe a unified 'profiles' view
        
        const { data: advocates } = await supabase
          .from('advocates')
          .select('user_id, full_name')
          .ilike('full_name', `%${searchQuery}%`)
          .neq('user_id', user.id)
          .limit(5);

        const { data: clients } = await supabase
          .from('clients')
          .select('user_id, full_name')
          .ilike('full_name', `%${searchQuery}%`)
          .neq('user_id', user.id)
          .limit(5);

        const combined = [
          ...(advocates || []).map(a => ({ ...a, type: 'Advocate' })),
          ...(clients || []).map(c => ({ ...c, type: 'Client' }))
        ];

        setResults(combined);

      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    };

    const timeout = setTimeout(searchUsers, 500); // 500ms debounce
    return () => clearTimeout(timeout);
  }, [searchQuery, user]);

  const handleSelect = (selectedUser: any) => {
    // Navigate to chat thread
    router.replace(`/messages/${selectedUser.user_id}?name=${encodeURIComponent(selectedUser.full_name)}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'New Message', headerShadowVisible: false }} />

      <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
         <Search size={20} color={theme.icon} />
         <TextInput 
            style={[styles.input, { color: theme.text }]}
            placeholder="Search for people..."
            placeholderTextColor={theme.icon}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
         />
         {loading && <ActivityIndicator size="small" color={theme.tint} />}
      </View>

      <FlatList 
        data={results}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.item, { borderBottomColor: theme.border }]}
            onPress={() => handleSelect(item)}
          >
             <View style={[styles.avatar, { backgroundColor: theme.surfaceVariant }]}>
                <User size={20} color={theme.icon} />
             </View>
             <View>
                <Text style={[styles.name, { color: theme.text }]}>{item.full_name}</Text>
                <Text style={[styles.type, { color: theme.icon }]}>{item.type}</Text>
             </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inputContainer: {
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
    paddingHorizontal: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    gap: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  type: {
    fontSize: 12,
  }
});
