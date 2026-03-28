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
  document_url?: string | null;
  created_at: string;
};

type Partner = {
  id: string;
  email: string;
  name: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
};

type UserNameRow = {
  user_id: string;
  full_name?: string | null;
};

type ProfileRow = {
  id: string;
  email?: string | null;
};

export default async function AdvocateMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const resolvedParams = await searchParams;
  const partnerId = resolvedParams?.partner as string;

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

  // Get unique conversation partners
  const conversationPartners = new Map<string, Partner>();
  
  messageRows.forEach((msg) => {
    const pId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
    const pEmail = emailMap.get(pId) || 'Unknown User';
    
    if (!conversationPartners.has(pId)) {
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

      conversationPartners.set(pId, {
        id: pId,
        email: pEmail,
        name: pEmail, // Default to email
        lastMessage: previewText,
        lastMessageTime: msg.created_at,
        unreadCount: 0
      });
    }
    
    // Count unread messages from this partner
    if (msg.recipient_id === user.id && !msg.is_read) {
      const partner = conversationPartners.get(pId);
      if (partner) partner.unreadCount++;
    }
  });

  // Bulk Fetch Names for existing partners (Clients)
  const partnerIds = Array.from(conversationPartners.keys());
  if (partnerIds.length > 0) {
      // Try fetching from clients table
      const { data: clientsData } = await supabase
        .from('clients')
        .select('user_id, full_name')
        .in('user_id', partnerIds);
      
      clientsData?.forEach((client: UserNameRow) => {
          if (conversationPartners.has(client.user_id)) {
              const p = conversationPartners.get(client.user_id);
              if (p) p.name = client.full_name || p.email;
          }
      });

      // Also try fetching from advocates table (in case advocate messaging advocate)
      const { data: advocatesData } = await supabase
        .from('advocates')
        .select('user_id, full_name')
        .in('user_id', partnerIds);

      advocatesData?.forEach((adv: UserNameRow) => {
          if (conversationPartners.has(adv.user_id)) {
              const p = conversationPartners.get(adv.user_id);
              // Only overwrite if we didn't find a client name (or maybe better to just overwrite?)
              // Generally user_id is unique so it shouldn't exist in both, but let's be safe.
              if (p) p.name = adv.full_name || p.name;
          }
      });
  }

  const conversations = Array.from(conversationPartners.values());

  // Prepare Active Thread
  const activePartnerId = partnerId;
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


  // Fetch clients for sending new messages (Dropdown)
  const { data: advocateParticipations } = await supabase
    .from('case_participants')
    .select('case_id')
    .eq('user_id', user.id)
    .eq('role', 'advocate');

  const caseIds = advocateParticipations?.map(p => p.case_id) || [];

  let clients: Array<{ user_id: string; full_name?: string | null; users: { email: string } }> = [];
  if (caseIds.length > 0) {
    const { data: clientParticipations } = await supabase
      .from('case_participants')
      .select('user_id, case_id')
      .in('case_id', caseIds)
      .eq('role', 'client');

    const uniqueClientIds = [...new Set(clientParticipations?.map(p => p.user_id))];

    if (uniqueClientIds.length > 0) {
        const [{ data: clientDetails }, { data: clientProfiles }] = await Promise.all([
          supabase
            .from('clients')
            .select('user_id, full_name')
            .in('user_id', uniqueClientIds),
          supabase
            .from('profiles')
            .select('id, email')
            .in('id', uniqueClientIds),
        ]);

        const clientEmailMap = new Map<string, string>();
        clientProfiles?.forEach((profile: ProfileRow) => {
          clientEmailMap.set(profile.id, profile.email || '');
        });

        clients = ((clientDetails || []) as UserNameRow[]).map((client) => ({
          ...client,
          users: { email: clientEmailMap.get(client.user_id) || '' },
        }));
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Conversations List */}
      <div className="lg:col-span-1">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-teal-600" />
            Conversations
          </h2>

          <div className="space-y-2">
            {conversations.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200">No conversations yet</p>
            ) : (
              conversations.map((conv) => (
                <a
                  key={conv.id}
                  href={`/dashboard/advocate/messages?partner=${conv.id}`}
                  className={`block p-3 rounded-lg border transition-colors group ${
                    conv.id === activePartnerId
                      ? 'bg-teal-50 border-teal-200'
                      : 'bg-gray-50 hover:bg-gray-100 border-gray-100'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm truncate ${
                        conv.id === activePartnerId ? 'text-teal-800' : 'text-gray-900 group-hover:text-teal-700'
                      }`}>
                        {conv.name}
                      </p>
                      <p className={`text-xs truncate mt-1 ${
                        conv.id === activePartnerId ? 'text-teal-600' : 'text-gray-500'
                      }`}>
                        {conv.lastMessage}
                      </p>
                    </div>
                    {conv.unreadCount > 0 && (
                      <span className="bg-teal-600 text-white text-xs px-2 py-0.5 rounded-full shadow-sm ml-2 flex-shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Message Thread & Send Form */}
      <div className="lg:col-span-2 space-y-4">
        {activePartnerId ? (
          <>
            <MessageThread messages={threadMessages} currentUserId={user.id} chatKey={activeChatKey} />
            <SendMessageForm clients={clients} currentUserId={user.id} />
          </>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center h-[600px] flex flex-col justify-center items-center">
            <div className="bg-gray-50 p-4 rounded-full mb-4 border border-gray-100">
              <MessageSquare className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">Select a conversation to view messages</p>
            {/* Add a button/dropdown here to start NEW conversation manually if not relying on incoming */}
            <div className="mt-8 w-full max-w-sm">
              <p className="text-xs text-gray-400 mb-2">Or start a new one:</p>
              <SendMessageForm clients={clients} currentUserId={user.id} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
