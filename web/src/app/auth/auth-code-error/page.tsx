'use client';

import { Suspense } from 'react';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function AuthCodeErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error_description') || searchParams.get('error') || 'The authentication link was invalid or has expired.';

  return (
    <div className="min-h-screen bg-[#1a1410] flex items-center justify-center p-4 text-center">
      <div className="bg-[#2a2218] border border-amber-900/30 w-full max-w-md p-8 rounded-2xl shadow-xl">
        <div className="bg-red-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        
        <h1 className="text-2xl font-bold text-amber-50 mb-3">Authentication Error</h1>
        <p className="text-amber-200/60 mb-8 max-w-sm mx-auto">
          {error}
        </p>

        <div className="space-y-4">
          <Link
            href="/forgot-password"
            className="w-full inline-block bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold py-3.5 rounded-xl hover:from-amber-500 hover:to-orange-500 transition-all shadow-lg"
          >
            Request New Reset Link
          </Link>
          
          <Link 
            href="/login" 
            className="inline-flex items-center justify-center gap-2 text-amber-500/60 hover:text-amber-500 transition-colors text-sm font-medium w-full"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AuthCodeErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#1a1410] flex items-center justify-center p-4 text-amber-100">
          Loading...
        </div>
      }
    >
      <AuthCodeErrorContent />
    </Suspense>
  );
}
