import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            const isProduction = process.env.NODE_ENV === 'production';
            const secure = isProduction;
            const httpOnly = isProduction;

            const cookieOptions = { 
              ...options, 
              secure, 
              httpOnly,
              sameSite: 'lax' as const,
              path: '/'
            };
            cookieStore.set(name, value, cookieOptions)
          } catch {
            // Server Component context
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            const isProduction = process.env.NODE_ENV === 'production';
            const secure = isProduction;
            const httpOnly = isProduction;

            const cookieOptions = { 
              ...options, 
              secure, 
              httpOnly,
              sameSite: 'lax' as const,
              path: '/'
            };
            cookieStore.set(name, '', { ...cookieOptions, maxAge: 0 })
          } catch {
            // Server Component context
          }
        },
      },
    }
  )
}
