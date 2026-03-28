'use client';

import { useState } from 'react';
import { sendMessage } from './actions';
import { Send, Loader2, Paperclip, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { encryptMessage, generateChatKey } from '@/lib/utils/encryption';

export default function SendMessageForm({ recipientId, recipientName, currentUserId }: { recipientId?: string, recipientName?: string, currentUserId?: string }) {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const router = useRouter();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!recipientId || !content.trim()) return;

    setIsLoading(true);

    try {
      let documentUrl = '';
      
      // Upload file if attached
      if (file) {
        const supabase = createClient();
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `messages/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('case-documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: signedUrl } = await supabase.storage
          .from('case-documents')
          .createSignedUrl(filePath, 31536000); // 1 year

        documentUrl = signedUrl?.signedUrl || '';
      }

      // 1. Encrypt Content BEFORE sending
      let finalContent = content;
      let isEncrypted = false;
      
      if (currentUserId && recipientId) {
          try {
              const chatKey = generateChatKey(currentUserId, recipientId);
              finalContent = encryptMessage(content, chatKey);
              isEncrypted = true;
          } catch (e) {
              console.error("Encryption failed before send", e);
              alert("Encryption failed. Message not sent for security reasons.");
              setIsLoading(false);
              return;
          }
      }

      const formData = new FormData();
      formData.append('recipientId', recipientId);
      formData.append('content', finalContent);
      formData.append('isEncrypted', isEncrypted.toString());
      if (documentUrl) formData.append('documentUrl', documentUrl);

      const result = await sendMessage(formData);

      if (result.error) {
        alert('Failed to send message: ' + result.error);
      } else {
        setContent('');
        setFile(null);
        router.refresh();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert('Error: ' + message);
    }

    setIsLoading(false);
  };

  // If no recipient is selected, don't show the form or show a placeholder
  if (!recipientId) return null;

  return (
    <div className="bg-white border-t border-gray-100 p-2">
      {file && (
        <div className="flex items-center gap-2 mb-2 bg-gray-50 p-2 rounded-lg w-fit">
          <Paperclip className="h-4 w-4 text-gray-500" />
          <span className="text-xs text-gray-600 truncate max-w-[200px]">{file.name}</span>
          <button onClick={() => setFile(null)} className="text-gray-400 hover:text-red-500">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
         {/* File Input */}
         <label className="p-2.5 text-gray-400 hover:text-teal-600 hover:bg-gray-50 rounded-full cursor-pointer transition-colors">
            <Paperclip className="h-5 w-5" />
            <input 
                type="file" 
                className="hidden" 
                onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
         </label>

        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Message ${recipientName || 'Advocate'}...`}
            className="w-full px-4 py-2.5 bg-gray-50 border border-transparent focus:bg-white focus:border-teal-500 rounded-xl resize-none outline-none text-sm transition-all"
            rows={1}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (content.trim()) handleSubmit(e);
                }
            }}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !content.trim()}
          className="p-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
      </form>
    </div>
  );
}
