'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock } from 'lucide-react';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const supabase = createClient();

  useEffect(() => {
    console.log('🔗 Reset Page Handler Mounted');
    console.log('# Hash:', window.location.hash);

    // Failsafe: Show error after 10s if no session found
    const timer = setTimeout(() => {
      console.log('⏰ Failsafe Timeout Triggered - no session found');
      setSessionLoading(false);
      setHasSession(false);
    }, 10000);
    
    const checkSession = async () => {
      const queryError = new URLSearchParams(window.location.search).get('error');
      if (queryError) {
        setError(queryError);
      }
      console.log('🕵️ Checking session...');
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('🕵️ Session result:', session ? 'Found' : 'Null', error);
      
      if (session) {
        setHasSession(true);
        setSessionLoading(false);
        clearTimeout(timer);
        return;
      }

      // Fallback 1: Parse hash if Supabase auto-detect failed
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
          console.log('⚡ Attempting manual hash parsing...');
          const params = new URLSearchParams(hash.substring(1));
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');

          if (access_token && refresh_token) {
              const { data, error: setSessionError } = await supabase.auth.setSession({
                  access_token,
                  refresh_token
              });
              if (!setSessionError && data.session) {
                  console.log('✅ Manual session set success');
                  setHasSession(true);
                  setSessionLoading(false);
                  clearTimeout(timer);
                  return;
              } else {
                   console.error('❌ Manual setSession failed:', setSessionError);
              }
          }
      }

      // Fallback 2: Handle auth code links directly on reset route
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code');
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (!exchangeError) {
          const { data: refreshed } = await supabase.auth.getSession();
          if (refreshed.session) {
            setHasSession(true);
            setSessionLoading(false);
            clearTimeout(timer);
            return;
          }
        } else {
          const msg = exchangeError.message || 'Invalid or expired reset link';
          if (msg.toLowerCase().includes('code verifier')) {
            setError('This reset link was opened in a different browser/session. Open it in the same browser where you requested it, or request a new link.');
          } else {
            setError(msg);
          }
        }
      }

      // Listen for auth state change (handles PKCE flow)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        console.log('🔔 Auth State Change:', event);
        if (session) {
          setHasSession(true);
          setSessionLoading(false);
          clearTimeout(timer);
          subscription.unsubscribe();
        }
      });
      return () => subscription.unsubscribe();
    };

    checkSession();
    return () => clearTimeout(timer);
  }, [supabase]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/dashboard'); 
    }
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-[#1a1410] flex items-center justify-center p-4">
        <div className="text-amber-50">Verifying reset link...</div>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="min-h-screen bg-[#1a1410] flex items-center justify-center p-4">
        <div className="bg-[#2a2218] border border-amber-900/30 w-full max-w-md p-8 rounded-2xl shadow-xl text-center">
          <h1 className="text-2xl font-bold text-amber-50 mb-3">Link Expired</h1>
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg text-red-200 text-sm text-center">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <a
              href="/forgot-password"
              className="w-full inline-block bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold py-3 px-8 rounded-xl hover:from-amber-500 hover:to-orange-500 transition-all font-medium"
            >
              Request New Link
            </a>
            <a
              href="/login"
              className="w-full inline-block text-amber-500/60 hover:text-amber-500 transition-colors text-sm font-medium"
            >
              Back to Login
            </a>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-[#1a1410] flex items-center justify-center p-4">
      <div className="bg-[#2a2218] border border-amber-900/30 w-full max-w-md p-8 rounded-2xl shadow-xl">
        <h1 className="text-3xl font-bold text-amber-50 mb-2 text-center">Reset Password</h1>
        <p className="text-amber-200/60 text-center mb-8">Enter your new password below</p>

        <form onSubmit={handleUpdatePassword} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-lg text-red-200 text-sm text-center">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-amber-100">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#1a1410] border border-amber-900/50 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-600 transition-colors pl-10"
                placeholder="Enter new password"
                required
              />
              <Lock className="absolute left-3 top-3.5 h-5 w-5 text-amber-500/50" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-amber-500/50 hover:text-amber-500 transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-amber-100">Confirm Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#1a1410] border border-amber-900/50 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-600 transition-colors pl-10"
                placeholder="Confirm new password"
                required
              />
              <Lock className="absolute left-3 top-3.5 h-5 w-5 text-amber-500/50" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold py-3.5 rounded-xl hover:from-amber-500 hover:to-orange-500 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-900/20"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
