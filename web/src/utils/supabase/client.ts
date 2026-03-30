import { createBrowserClient } from "@supabase/ssr"
export function createClient() {
  const secure = typeof window !== 'undefined'
    ? window.location.protocol === 'https:'
    : false;
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        secure,
        sameSite: 'lax',
        path: '/',
      }
    }
  )
}