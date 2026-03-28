import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const isIP = typeof window !== 'undefined' && 
    (window.location.hostname.includes('192.168.') || 
     window.location.hostname.includes('10.') || 
     window.location.hostname.includes('172.'));
  
  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // In production (HTTPS + Domain), we want strict security.
  // On local IP, we must disable Secure to allow cookies over HTTP.
  const secure = !isIP && !isLocalhost;

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        secure: secure,
        sameSite: 'lax',
        path: '/',
      }
    }
  )
}
