'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Check, Info, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

type Notification = {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  is_read: boolean;
  created_at: string;
  link?: string;
};

export default function NotificationsPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const supabase = createClient();
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    console.log('🔔 NotificationsPopover: Current User ID:', user.id);

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
      setNotifications(data as Notification[]);
      setUnreadCount(data.filter((n: Notification) => !n.is_read).length);
    }
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchNotifications();
    }, 0);
    
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications' 
      }, () => {
        void fetchNotifications();
      })
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications, supabase]);

  const markAsRead = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
    
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, is_read: true } : n
    ));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    setIsOpen(false);
    if (notification.link) {
      router.push(notification.link);
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) fetchNotifications();
        }}
        className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-teal-600 hover:bg-teal-50 hover:border-teal-200 transition-colors relative shadow-sm"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-teal-600 rounded-full text-[10px] flex items-center justify-center text-white font-bold border-2 border-white shadow-sm">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="font-semibold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <button 
                  onClick={async (e) => {
                    e.stopPropagation();
                    console.log('Marking all as read...');
                    
                    // Optimistic update
                    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
                    setUnreadCount(0);

                    const ids = notifications.filter(n => !n.is_read).map(n => n.id);
                    if (ids.length === 0) return;
                    
                    const {  error } = await supabase
                      .from('notifications')
                      .update({ is_read: true })
                      .in('id', ids);
                    
                    if (error) {
                        console.error('Failed to mark read:', error);
                        // Revert on error (optional, but good practice)
                        fetchNotifications(); 
                    }
                  }}
                  className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                >
                  Mark all read
                </button>
              )}
            </div>
            
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  No notifications yet
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((n) => (
                    <div 
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer flex gap-3 ${!n.is_read ? 'bg-teal-50/30' : ''}`}
                    >
                      <div className={`mt-0.5 shrink-0 ${
                        n.type === 'warning' ? 'text-orange-400' : 
                        n.type === 'success' ? 'text-green-400' : 'text-blue-400'
                      }`}>
                        {n.type === 'warning' ? <AlertTriangle className="h-4 w-4" /> : 
                         n.type === 'success' ? <Check className="h-4 w-4" /> : 
                         <Info className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className={`text-sm ${!n.is_read ? 'text-gray-900 font-semibold' : 'text-gray-600'}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1.5 uppercase tracking-wider" suppressHydrationWarning>
                          {new Date(n.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {!n.is_read && (
                        <div className="shrink-0 mt-1.5">
                          <div className="h-2 w-2 rounded-full bg-teal-500" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
