
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { MessageSquare, User } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import FAB from '@/components/FAB';
import { decryptMessage, generateChatKey } from '@/lib/encryption';

export default function ChatScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<any[]>([]);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Fetch all messages where user is sender or recipient
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 2. Group by unique conversation partner
      const convMap = new Map();
      const partnerIds = new Set<string>();

      messages?.forEach((msg) => {
        const otherId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
        let previewText = msg.content;

        if (msg.is_encrypted) {
          try {
            const previewKey = generateChatKey(user.id, otherId);
            previewText = decryptMessage(msg.content, previewKey);
          } catch {
            previewText = msg.content;
          }
        }
        
        if (!convMap.has(otherId)) {
          convMap.set(otherId, {
            id: otherId,
            lastMessage: previewText,
            timestamp: msg.created_at,
            read: msg.recipient_id === user.id ? msg.is_read : true,
            partnerId: otherId
          });
          partnerIds.add(otherId);
        }
      });

      // 3. Fetch Partner Details (Names)
      if (partnerIds.size > 0) {
        // Consolidated Profiles Fetch (Cleaner & Covers All Roles)
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url') // Assuming avatar_url exists or we fallback
            .in('id', Array.from(partnerIds));

        if (profileError) console.error('Error fetching profiles:', profileError);

        const nameMap = new Map();
        profiles?.forEach((p) => nameMap.set(p.id, p.full_name));

        // Update convs with names
        convMap.forEach((conv) => {
          conv.name = nameMap.get(conv.partnerId) || 'Unknown User';
          // Optional: Add avatar logic later
        });
      }

      setConversations(Array.from(convMap.values()));

    } catch (err) {
      console.error('Error fetching chats:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [fetchConversations])
  );

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={[styles.itemObj, { backgroundColor: theme.background, borderColor: theme.border }]}
      onPress={() => router.push(`/messages/${item.partnerId}?name=${encodeURIComponent(item.name)}`)}
    >
      <View style={[styles.avatar, { backgroundColor: theme.surfaceVariant }]}>
        <User size={24} color={theme.icon} />
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
           <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
           <Text style={[styles.time, { color: theme.icon }]}>
             {new Date(item.timestamp).toLocaleDateString()}
           </Text>
        </View>
        <Text 
          style={[styles.message, { color: !item.read ? theme.text : theme.icon, fontWeight: !item.read ? '700' : '400' }]} 
          numberOfLines={1}
        >
          {item.lastMessage}
        </Text>
      </View>
      {!item.read && <View style={[styles.dot, { backgroundColor: theme.tint }]} />}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={conversations}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchConversations} tintColor={theme.tint} />}
        ListEmptyComponent={!loading ? (
           <View style={styles.empty}>
              <MessageSquare size={48} color={theme.border} />
              <Text style={[styles.emptyText, { color: theme.icon }]}>No messages yet</Text>
           </View>
        ) : null}
      />
      <FAB onPress={() => router.push('/messages/new')} icon={MessageSquare} /> 
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  itemObj: { 
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  time: {
    fontSize: 12,
  },
  message: {
    fontSize: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
  }
});
