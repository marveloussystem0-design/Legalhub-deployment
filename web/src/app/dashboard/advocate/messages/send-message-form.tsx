'use client';

import { useState } from 'react';
import { sendMessage } from './actions';
import { Send, Loader2, Paperclip, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { encryptMessage, generateChatKey } from '@/lib/utils/encryption';

type MessageClient = {
  user_id: string;
  full_name?: string | null;
  users?: { email?: string | null };
};

export default function SendMessageForm({ clients, currentUserId }: { clients: MessageClient[], currentUserId?: string }) {
  const [content, setContent] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const partnerId = searchParams.get('partner');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const targetRecipient = partnerId || recipientId;
    if (!targetRecipient || !content.trim()) return;

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
      
      if (currentUserId && targetRecipient) {
          try {
              const chatKey = generateChatKey(currentUserId, targetRecipient);
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
      formData.append('recipientId', targetRecipient);
      formData.append('content', finalContent);
      formData.append('isEncrypted', isEncrypted.toString());
      if (documentUrl) formData.append('documentUrl', documentUrl);

      const result = await sendMessage(formData);

      if (result.error) {
        alert('Failed to send message: ' + result.error);
      } else {
        setContent('');
        setFile(null);
        if (!partnerId) {
          router.push(`/dashboard/advocate/messages?partner=${recipientId}`);
        }
        router.refresh();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert('Error: ' + message);
    }

    setIsLoading(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm mt-4">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Send Message</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {!partnerId && (
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">To</label>
            <select
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              required
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none transition-shadow"
            >
              <option value="">Select a client</option>
              {clients.map((client) => (
                <option key={client.user_id} value={client.user_id}>
                  {client.full_name} ({client.users?.email})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">Message</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={4}
            placeholder="Type your message..."
            className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none resize-none transition-shadow"
          />
        </div>

        {/* File Attachment */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">Attach Document (Optional)</label>
          {file ? (
            <div className="flex items-center gap-3 p-3 bg-teal-50 border border-teal-100 rounded-lg">
              <div className="p-1.5 bg-white rounded border border-teal-100">
                 <Paperclip className="h-4 w-4 text-teal-600" />
              </div>
              <span className="text-sm text-teal-900 font-medium flex-1 truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 hover:border-gray-400 transition-all border-dashed">
              <Paperclip className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600 font-medium">Click to attach a file</span>
              <input
                type="file"
                onChange={(e) => e.target.files && setFile(e.target.files[0])}
                className="hidden"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />
            </label>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || !content.trim()}
          className="w-full bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 disabled:from-gray-300 disabled:to-gray-400 text-white px-4 py-2.5 rounded-lg transition-all font-bold shadow-sm hover:shadow active:scale-[0.99] flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Send Message
            </>
          )}
        </button>
      </form>
    </div>
  );
}
