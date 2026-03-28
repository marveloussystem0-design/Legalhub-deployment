
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from 'react-native';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Send, ArrowLeft, Paperclip, FileText } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import * as DocumentPicker from 'expo-document-picker';
import { decode } from 'base64-arraybuffer';
import { encryptMessage, decryptMessage, generateChatKey } from '@/lib/encryption';

export default function ChatThreadScreen() {
  const { id: partnerId, name } = useLocalSearchParams<{ id: string, name: string }>();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { user } = useAuth();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Memoize chat key so it's not recalculated on every render
  const chatKey = useMemo(() => {
    if (user?.id && partnerId) {
       return generateChatKey(user.id, partnerId);
    }
    return '';
  }, [user?.id, partnerId]);

  // Fetch Messages
  const fetchMessages = useCallback(async () => {
    if (!user || !partnerId) return;

    const { error: markReadError } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', partnerId)
      .eq('recipient_id', user.id)
      .eq('is_read', false);

    if (markReadError) {
      console.error('Error marking messages as read:', markReadError);
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${user.id})`)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setMessages(data);
    }
  }, [user, partnerId]);

  // Initial Load & Polling (Simple Real-time)
  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000); // Poll every 3s
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const handleSend = async () => {
    if (!inputText.trim() || !user || !partnerId || !chatKey) return;
    setSending(true);

    try {
      // Encrypt the message text before sending to the server
      const encryptedContent = encryptMessage(inputText.trim(), chatKey);

      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          recipient_id: partnerId,
          content: encryptedContent,
          is_read: false,
          is_encrypted: true // Mark as encrypted
        });

      if (error) throw error;

      setInputText('');
      fetchMessages(); // Refresh immediately
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const file = result.assets[0];
      setSending(true);

      // 1. Read file as Base64
      // Note: In a real app, use FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' })
      // For now, assuming blob upload support or base64 workaround for Supabase React Native
      const response = await fetch(file.uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();

      // 2. Upload to Supabase Storage
      const fileName = `${Date.now()}_${file.name.replace(/\s/g, '_')}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(fileName, arrayBuffer, {
          contentType: file.mimeType || 'application/octet-stream',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // 3. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(fileName);

      // 4. Send Message
      const { error: msgError } = await supabase
        .from('messages')
        .insert({
          sender_id: user?.id,
          recipient_id: partnerId,
          content: `Sent a file: ${file.name}`,
          is_read: false,
          attachments: {
            url: publicUrl,
            name: file.name,
            type: file.mimeType,
            size: file.size
          }
        });

      if (msgError) throw msgError;

      fetchMessages();

    } catch (error: any) {
      console.error('Attachment upload failed:', error);
      alert('Failed to upload file: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender_id === user?.id;
    
    // Decrypt the content if it's marked as encrypted
    const displayContent = item.is_encrypted && chatKey 
        ? decryptMessage(item.content, chatKey) 
        : item.content;

    return (
      <View style={[
        styles.messageContainer, 
        isMe ? styles.myMessage : styles.theirMessage,
        { backgroundColor: isMe ? theme.tint : theme.surfaceVariant }
      ]}>
        <Text style={[
          styles.messageText, 
          { color: isMe ? 'white' : theme.text }
        ]}>
          {displayContent}
        </Text>
        {item.attachments && (
            <TouchableOpacity style={{ 
                marginTop: 8, 
                backgroundColor: 'rgba(0,0,0,0.1)', 
                padding: 8, 
                borderRadius: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8
            }}>
                <FileText size={20} color={isMe ? 'white' : theme.text} />
                <Text style={{ color: isMe ? 'white' : theme.text, fontSize: 12 }} numberOfLines={1}>
                    {item.attachments.name}
                </Text>
            </TouchableOpacity>
        )}
        <Text style={[
          styles.timeText,
          { color: isMe ? 'rgba(255,255,255,0.7)' : theme.icon }
        ]}>
          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.background }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0} 
    >
      <Stack.Screen 
        options={{ 
          title: name || 'Chat', 
          headerShadowVisible: false,
          headerLeft: () => (
             <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 10 }}>
                <ArrowLeft size={24} color={theme.text} />
             </TouchableOpacity>
          )
        }} 
      />

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        inverted
        contentContainerStyle={styles.listContent}
      />

      <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <TouchableOpacity onPress={handleAttachment} disabled={sending} style={{ padding: 4 }}>
            <Paperclip size={24} color={theme.icon} />
        </TouchableOpacity>

        <TextInput
          style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
          placeholder="Type a message..."
          placeholderTextColor={theme.icon}
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <TouchableOpacity 
          style={[styles.sendButton, { backgroundColor: theme.tint, opacity: !inputText.trim() ? 0.5 : 1 }]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
           {sending ? <ActivityIndicator color="white" size="small" /> : <Send size={20} color="white" />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 8,
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  myMessage: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  timeText: {
    fontSize: 10,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12, // Reduced padding
    paddingBottom: Platform.OS === 'ios' ? 30 : 12, // Handle home indicator
    alignItems: 'center',
    borderTopWidth: 1,
    gap: 12,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
