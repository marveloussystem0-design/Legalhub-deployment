import {
  createContext,
  useContext,
  useEffect,
  useState,
  PropsWithChildren,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { useRouter, useSegments } from 'expo-router';
import { listenForAdminNotifications } from './notifications';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isLoading: false,
  signIn: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Notification listener is handled in DashboardScreen (index.tsx)
  
  // Register/Sync Push Token whenever user logs in or app launches with session
  useEffect(() => {
    if (user) {
      console.log('👤 User authenticated, syncing push token...');
      import('./notifications').then(({ registerForPushNotificationsAsync }) => {
        registerForPushNotificationsAsync();
      });
    }
  }, [user]);

  // Protected Route Logic
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      // If not signed in and not in auth group, redirect to login
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      // If signed in and in auth group, redirect to tabs
      router.replace('/(tabs)');
    }
  }, [session, segments, isLoading]);

  const signIn = async () => {}; // Handled directly in Login screen usually
  const signOut = async () => {
    console.log('🚪 Signing out...');
    const { error } = await supabase.auth.signOut();
    if (error) {
      if (error.name === 'AuthSessionMissingError' || error.message.includes('Auth session missing')) {
        console.log('⚠️ Session already missing, proceeding with local sign out.');
      } else {
        console.error('Sign out error:', error);
        throw error;
      }
    }
    console.log('✅ Sign out successful - session cleared');
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        isLoading,
        signIn,
        signOut,
      }}>
      {children}
    </AuthContext.Provider>
  );
}
