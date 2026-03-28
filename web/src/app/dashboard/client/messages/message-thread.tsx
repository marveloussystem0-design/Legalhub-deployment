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

  if (!messages || messages.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
            <div className="bg-gray-100 p-4 rounded-full mb-4">
                <MessageSquare className="h-8 w-8 text-gray-300" />
            </div>
            <p className="text-sm">No messages yet. Say hello!</p>
        </div>
      );
  }

  return (
    <div className="p-4 space-y-4">
        {messages.map((msg) => {
        const isSent = msg.sender_id === currentUserId;
        
        let displayContent = msg.content;
        if (msg.is_encrypted && chatKey) {
            displayContent = decryptMessage(msg.content, chatKey);
        }

        return (
            <div key={msg.id} className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] p-3 px-4 rounded-2xl shadow-sm ${
                isSent 
                ? 'bg-teal-600 text-white rounded-br-none' 
                : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none shadow-sm'
            }`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{displayContent}</p>
                
                {msg.document_url && (
                <a
                    href={msg.document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-2 mt-3 p-2.5 rounded-lg border ${
                        isSent 
                        ? 'border-white/20 bg-teal-700/50 hover:bg-teal-700 transition-colors' 
                        : 'border-gray-200 bg-white hover:bg-gray-50 transition-colors'
                    }`}
                >
                    <FileText className="h-4 w-4 opacity-80" />
                    <span className="text-xs font-medium">Attached Document</span>
                    <Download className="h-3 w-3 ml-auto opacity-70" />
                </a>
                )}
                
                <div className={`flex items-center gap-1 mt-1.5 justify-end ${isSent ? 'text-teal-100/70' : 'text-gray-400'}`}>
                <p className="text-[10px]">
                    {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </p>
                {isSent && (
                    <span className="ml-1">
                    {msg.is_read ? (
                        <CheckCheck className="h-3 w-3" />
                    ) : (
                        <Check className="h-3 w-3" />
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
  );
}
