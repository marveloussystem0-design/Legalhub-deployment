'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function CallbackClient() {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const hasStartedRef = useRef(false);

  const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return 'An unexpected error occurred during login.';
  };

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const handleCallback = async () => {
      const code = searchParams.get('code');
      const next = searchParams.get('next') || '/reset-password';

      if (!code) {
        setError('No code provided in callback.');
        return;
      }

      try {
        let manualVerifier: string | undefined;
        const cookies = document.cookie.split('; ');
        const verifierCookie = cookies.find((c) => c.trim().includes('-code-verifier'));

        if (verifierCookie) {
          const rawValue = verifierCookie.split('=')[1];
          if (rawValue) {
            if (rawValue.startsWith('base64-')) {
              try {
                manualVerifier = atob(rawValue.substring(7));
              } catch {
                manualVerifier = rawValue;
              }
            } else {
              manualVerifier = rawValue;
            }
          }
        }

        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError && manualVerifier) {
          const manualExchange = supabase.auth.exchangeCodeForSession as unknown as (
            code: string,
            verifier?: string
          ) => Promise<{ error: { message: string } | null }>;

          const { error: retryError } = await manualExchange(code, manualVerifier);
          if (!retryError) {
            router.push(next);
            return;
          }
        }

        if (exchangeError) {
          const message = exchangeError.message || 'Unable to complete reset flow.';
          const userMessage = message.toLowerCase().includes('code verifier')
            ? 'Reset link opened in a different browser/session. Please open it in the same browser where you requested it, or request a new link.'
            : message;
          router.push(`/reset-password?error=${encodeURIComponent(userMessage)}`);
          return;
        }

        router.push(next);
      } catch (err: unknown) {
        setError(getErrorMessage(err));
      }
    };

    void handleCallback();
  }, [router, searchParams, supabase]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#1a1410] flex items-center justify-center p-4">
        <div className="bg-[#2a2218] border border-red-900/30 w-full max-w-md p-8 rounded-2xl shadow-xl text-center">
          <h1 className="text-2xl font-bold text-red-100 mb-3">Authentication Error</h1>
          <p className="text-red-200/60 mb-6">{error}</p>
          <a
            href="/forgot-password"
            className="inline-block bg-red-900/40 text-red-100 font-bold py-3 px-8 rounded-xl hover:bg-red-900/60 transition-all"
          >
            Retry Reset
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1410] flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 text-amber-500 animate-spin mx-auto" />
        <h1 className="text-xl font-bold text-amber-50">Syncing your secure session...</h1>
        <p className="text-amber-200/40 text-sm">Please wait while we finalize your technical ID.</p>
      </div>
    </div>
  );
}
