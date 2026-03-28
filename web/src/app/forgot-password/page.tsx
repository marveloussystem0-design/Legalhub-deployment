'use client';

import { Suspense, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const queryError = searchParams.get('error');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const baseUrl = window.location.origin || process.env.NEXT_PUBLIC_APP_URL;
    if (!baseUrl) {
      setError('App URL is not configured. Please contact support.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${baseUrl}/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSubmitted(true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1410] flex items-center justify-center p-4">
      <div className="bg-[#2a2218] border border-amber-900/30 w-full max-w-md p-8 rounded-2xl shadow-xl">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-amber-500/60 hover:text-amber-500 transition-colors mb-6 text-sm font-medium group"
        >
          <ArrowLeft className="h-4 w-4 transform group-hover:-translate-x-1 transition-transform" />
          Back to Login
        </Link>

        {submitted ? (
          <div className="text-center space-y-4">
            <div className="bg-green-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/20">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-amber-50">Check your email</h1>
            <p className="text-amber-200/60">
              We&apos;ve sent a password reset link to <span className="text-amber-100 font-medium">{email}</span>
            </p>
            <div className="pt-4">
              <button
                onClick={() => setSubmitted(false)}
                className="text-amber-500 hover:text-amber-400 text-sm font-medium transition-colors underline underline-offset-4"
              >
                Didn&apos;t get the email? Try again
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-amber-50 mb-2">Forgot Password?</h1>
            <p className="text-amber-200/60 mb-8">No worries, we&apos;ll send you reset instructions.</p>

            <form onSubmit={handleResetRequest} className="space-y-6">
              {(error || queryError) && (
                <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-lg text-red-200 text-sm text-center">
                  {error || queryError}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-amber-100">Email Address</label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#1a1410] border border-amber-900/50 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-600 transition-colors pl-10"
                    placeholder="Enter your email"
                    required
                  />
                  <Mail className="absolute left-3 top-3.5 h-5 w-5 text-amber-500/50" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold py-3.5 rounded-xl hover:from-amber-500 hover:to-orange-500 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-900/20 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Sending Link...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#1a1410] flex items-center justify-center p-4 text-amber-100">
          Loading...
        </div>
      }
    >
      <ForgotPasswordContent />
    </Suspense>
  );
}
