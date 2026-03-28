import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import MessageThread from "./message-thread";
import SendMessageForm from "./send-message-form";
import { decryptMessage, generateChatKey } from "@/lib/utils/encryption";

type MessageRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  is_read?: boolean | null;
  is_encrypted?: boolean | null;
  created_at: string;
};

type Partner = {
  id: string;
  name: string;
  email: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isNew?: boolean;
};

type ProfileRow = {
  id: string;
  email?: string | null;
  full_name?: string | null;
};

type UserNameRow = {
  user_id: string;
  full_name?: string | null;
};

export default async function ClientMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const resolvedParams = await searchParams;
  const newRecipientId = resolvedParams?.recipientId as string;

  // Fetch all conversations (messages sent or received)
  const { data: messages } = await supabase
    .from('messages')
    .select(`
      *,
      cases(id, title, case_number)
    `)
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  const messageRows = (messages || []) as MessageRow[];
  const messageUserIds = Array.from(
    new Set(
      messageRows.flatMap((msg) => [msg.sender_id, msg.recipient_id]).filter(Boolean)
    )
  );

  const emailMap = new Map<string, string>();
  if (messageUserIds.length > 0) {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', messageUserIds);

    profileRows?.forEach((profile: ProfileRow) => {
      emailMap.set(profile.id, profile.email || '');
    });
  }

  // Get unique conversation partners (advocates)
  const conversationPartners = new Map<string, Partner>();
  
  messageRows.forEach((msg) => {
    const partnerId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
    const partnerEmail = emailMap.get(partnerId) || 'Unknown User';
    
    if (!conversationPartners.has(partnerId)) {
      // Decrypt the last message preview if it's encrypted
      let previewText = msg.content;
      if (msg.is_encrypted) {
          try {
              const previewKey = generateChatKey(msg.sender_id, msg.recipient_id);
              previewText = decryptMessage(msg.content, previewKey);
          } catch {
              previewText = "Encrypted message";
          }
      }

      conversationPartners.set(partnerId, {
        id: partnerId,
        name: partnerEmail, // Default to email temporarily
        email: partnerEmail,
        lastMessage: previewText,
        lastMessageTime: msg.created_at,
        unreadCount: 0
      });
    }
    
    // Count unread messages from this partner
    if (msg.recipient_id === user.id && !msg.is_read) {
      const partner = conversationPartners.get(partnerId);
      if (partner) partner.unreadCount++;
    }
  });

  // Handle "New Chat" with Advocate
  if (newRecipientId && !conversationPartners.has(newRecipientId)) {
      // Fetch details for this new advocate
      const { data: profileData } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', newRecipientId)
          .maybeSingle();
      
       const { data: advocateData } = await supabase
          .from('advocates')
          .select('full_name')
          .eq('user_id', newRecipientId)
          .single();

      if (profileData || advocateData) {
          conversationPartners.set(newRecipientId, {
              id: newRecipientId,
              name: advocateData?.full_name || profileData?.full_name || profileData?.email || 'Unknown User',
              email: profileData?.email || '',
              lastMessage: 'Start a new conversation',
              lastMessageTime: new Date().toISOString(),
              unreadCount: 0,
              isNew: true
          });
      }
  }

  // Bulk Fetch Names for existing partners
  const partnerIds = Array.from(conversationPartners.keys());
  if (partnerIds.length > 0) {
      const { data: advocatesData } = await supabase
        .from('advocates')
        .select('user_id, full_name')
        .in('user_id', partnerIds);
      
      advocatesData?.forEach((adv: UserNameRow) => {
          if (conversationPartners.has(adv.user_id)) {
              const p = conversationPartners.get(adv.user_id);
              if (p) p.name = adv.full_name || p.email; // Use name if avail
          }
      });
  }

  const conversations = Array.from(conversationPartners.values());

  // Determine active conversation
  const activePartnerId = newRecipientId || conversations[0]?.id;
  
  // Filter messages for active thread logic
  const threadMessages = messageRows.filter((msg) => 
      (msg.sender_id === user.id && msg.recipient_id === activePartnerId) ||
      (msg.recipient_id === user.id && msg.sender_id === activePartnerId)
  );

  // Sort thread chronological
  threadMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Determine active conversation chat key
  let activeChatKey = '';
  if (activePartnerId && user.id) {
      try {
          activeChatKey = generateChatKey(user.id, activePartnerId);
      } catch (e: unknown) {
          console.error("Could not generate chat key", e);
      }
  }

  const activePartner = conversationPartners.get(activePartnerId);

  return (
    <div className="h-[calc(100vh-6rem)] flex rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {/* Sidebar List */}
      <div className="w-80 border-r border-gray-200 bg-gray-50 flex flex-col">
        <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                    No conversations yet. Find an advocate to start chatting.
                </div>
            ) : (
                conversations.map(partner => (
                    <a 
                        key={partner.id} 
                        href={`?recipientId=${partner.id}`} // Simple navigation
                        className={`block p-4 border-b border-gray-100 transition-colors hover:bg-gray-100 ${
                            partner.id === activePartnerId ? 'bg-white border-l-4 border-l-teal-600 shadow-sm' : ''
                        }`}
                    >
                        <div className="flex justify-between items-start mb-1">
                            <span className={`font-semibold text-sm truncate ${partner.id === activePartnerId ? 'text-teal-900' : 'text-gray-700'}`}>
                                {partner.name}
                            </span>
                            {partner.unreadCount > 0 && (
                                <span className="bg-teal-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                    {partner.unreadCount}
                                </span>
                            )}
                        </div>
                        <p className={`text-xs truncate ${partner.isNew ? 'text-teal-600 font-medium italic' : 'text-gray-500'}`}>
                            {partner.lastMessage}
                        </p>
                    </a>
                ))
            )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
          {activePartner ? (
              <>
                <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white z-10">
                    <div>
                        <h3 className="font-bold text-gray-900">{activePartner.name}</h3>
                        {/* Removed the fake Online status */}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-gray-50/50">
                    <MessageThread messages={threadMessages} currentUserId={user.id} chatKey={activeChatKey} />
                </div>

                <div className="p-4 border-t border-gray-200 bg-white">
                    <SendMessageForm 
                        recipientId={activePartner.id} 
                        recipientName={activePartner.name}
                        currentUserId={user.id}
                    />
                </div>
              </>
          ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                  <MessageSquare className="h-16 w-16 mb-4 text-gray-200" />
                  <p>Select a conversation to start messaging</p>
              </div>
          )}
      </div>
    </div>
  );
}
