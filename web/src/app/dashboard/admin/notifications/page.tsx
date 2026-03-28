'use client';

import { useState } from 'react';
import { Bell, Send, Users, UserCheck, User } from 'lucide-react';

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Failed to send notification';
};

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetAudience, setTargetAudience] = useState<'all' | 'advocates' | 'clients'>('all');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      setMessage({ type: 'error', text: 'Please fill in all fields' });
      return;
    }

    try {
      setSending(true);
      setMessage(null);

      const response = await fetch('/api/admin/broadcast-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, target_audience: targetAudience })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send notification');
      }

      setMessage({ 
        type: 'success', 
        text: `Notification sent successfully to ${data.recipient_count} user(s)!` 
      });
      
      // Reset form
      setTitle('');
      setBody('');
      setTargetAudience('all');

    } catch (error: unknown) {
      setMessage({ type: 'error', text: getErrorMessage(error) });
    } finally {
      setSending(false);
    }
  };

  const audienceOptions = [
    { value: 'all', label: 'All Users', icon: Users, description: 'Send to everyone' },
    { value: 'advocates', label: 'Advocates Only', icon: UserCheck, description: 'Send to advocates' },
    { value: 'clients', label: 'Clients Only', icon: User, description: 'Send to clients' }
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Bell className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Broadcast Notifications</h1>
        </div>
        <p className="text-gray-600">Send push notifications to users on the mobile app</p>
      </div>

      {/* Message Alert */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Send Notification Form */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Compose Notification</h2>

        {/* Title */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Important Update"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            maxLength={100}
          />
          <p className="text-xs text-gray-500 mt-1">{title.length}/100 characters</p>
        </div>

        {/* Body */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Message *
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type your message here..."
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            maxLength={300}
          />
          <p className="text-xs text-gray-500 mt-1">{body.length}/300 characters</p>
        </div>

        {/* Target Audience */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Target Audience *
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {audienceOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = targetAudience === option.value;
              
              return (
                <button
                  key={option.value}
                  onClick={() => setTargetAudience(option.value as 'all' | 'advocates' | 'clients')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-5 h-5 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`} />
                    <span className={`font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                      {option.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 text-left">{option.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={sending || !title.trim() || !body.trim()}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
        >
          <Send className="w-5 h-5" />
          {sending ? 'Sending...' : 'Send Notification'}
        </button>
      </div>

      {/* Preview */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Preview</h3>
        <div className="bg-white rounded-lg shadow-sm p-4 max-w-sm">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Bell className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm mb-1">
                {title || 'Notification Title'}
              </p>
              <p className="text-gray-600 text-sm">
                {body || 'Your message will appear here...'}
              </p>
              <p className="text-xs text-gray-400 mt-2">Just now</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
