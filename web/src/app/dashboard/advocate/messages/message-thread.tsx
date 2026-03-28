'use client';

import { useEffect, useRef } from 'react';
import { MessageSquare, Check, CheckCheck, Download, FileText } from 'lucide-react';
import { decryptMessage } from '@/lib/utils/encryption';

type MessageItem = {
  id: string;
  sender_id: string;
  content: string;
  is_encrypted?: boolean | null;
  is_read?: boolean | null;
  document_url?: string | null;
  created_at: string;
};

export default function MessageThread({ messages, currentUserId, chatKey }: { messages: MessageItem[], currentUserId: string, chatKey?: string }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // If no messages (and implicitly no active partner selected if parents handle it right, 
  // or just empty conversation), show placeholder. 
  // But strictly speaking, the parent should handle the "No Partner Selected" state 
  // and pass null/empty here only if a partner IS selected but has no messages.
  
  // We'll assume if messages array is passed, we render it.
  
  if (!messages || messages.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
           <MessageSquare className="h-12 w-12 mb-2 opacity-20" />
           <p className="text-sm">No messages yet. Start the conversation!</p>
        </div>
      );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm h-[600px] flex flex-col">
      <h2 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-100 pb-4">Conversation</h2>
      
      <div className="space-y-4 overflow-y-auto flex-1 pr-2">
          {messages.map((msg) => {
            const isSent = msg.sender_id === currentUserId;
            
            let displayContent = msg.content;
            if (msg.is_encrypted && chatKey) {
                displayContent = decryptMessage(msg.content, chatKey);
            }

            return (
              <div key={msg.id} className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] p-4 rounded-2xl shadow-sm ${
                  isSent 
                    ? 'bg-teal-600 text-white rounded-br-none' 
                    : 'bg-gray-100 text-gray-800 rounded-bl-none border border-gray-200'
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{displayContent}</p>
                  
                  {msg.document_url && (
                    <a
                      href={msg.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-3 mt-3 p-3 rounded-lg border ${isSent ? 'border-white/20 bg-white/10 hover:bg-white/20' : 'border-gray-300 bg-white hover:bg-gray-50'} transition-all`}
                    >
                      <div className={`p-1.5 rounded ${isSent ? 'bg-white/20' : 'bg-gray-200'}`}>
                         <FileText className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-medium truncate max-w-[150px]">Attached Document</span>
                      <Download className="h-3 w-3 ml-auto opacity-70" />
                    </a>
                  )}
                  
                  <div className={`flex items-center gap-1.5 mt-2 justify-end text-[10px] uppercase font-bold tracking-wider ${isSent ? 'text-teal-100' : 'text-gray-400'}`}>
                    <span>
                      {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isSent && (
                      <span className="ml-1">
                        {msg.is_read ? (
                          <CheckCheck className="h-3 w-3" />
                        ) : (
                          <Check className="h-3 w-3 opacity-70" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
      </div>
    </div>
  );
}
