import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const forwardedProto = headerStore.get('x-forwarded-proto')
  const secure = forwardedProto === 'https'
  const httpOnly = secure

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
