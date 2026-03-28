'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export function AuthRedirectHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check both useSearchParams AND raw location as a fallback
    const rawParams = new URLSearchParams(window.location.search);
    const code = searchParams.get('code') || rawParams.get('code');
    const hash = window.location.hash;
    
    if (code) {
      console.log('🎯 Auth code detected on landing page. Checking origin...');
      
      const next = searchParams.get('next') || rawParams.get('next') || '/reset-password';
      const params = new URLSearchParams();
      params.set('code', code);
      params.set('next', next);

      // CANONICAL ORIGIN CHECK
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (appUrl && !window.location.href.startsWith(appUrl)) {
        console.log('🔄 Origin mismatch detected. Moving auth code to official APP_URL...');
        const target = new URL('/auth/callback', appUrl);
        target.search = params.toString();
        window.location.href = target.toString();
        return;
      }
      
      // Use window.location.href for a hard redirect to bypass any potential router issues
      window.location.href = `/auth/callback?${params.toString()}`;
      return;
    }

    if (hash && (hash.includes('access_token') || hash.includes('type=recovery'))) {
      console.log('🎯 Auth hash detected. Hard redirecting to reset-password...');
      window.location.href = `/reset-password${hash}`;
    }
  }, [searchParams, router]);

  return null;
}
