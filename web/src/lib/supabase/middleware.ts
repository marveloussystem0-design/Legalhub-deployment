import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Only mark auth cookies as secure when the incoming request is HTTPS.
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const secure = request.nextUrl.protocol === 'https:' || forwardedProto === 'https';
  const httpOnly = secure;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            const cookieOptions = { 
              ...options, 
              secure: secure,
              httpOnly: httpOnly,
              sameSite: 'lax' as const,
              path: '/'
            };
            request.cookies.set(name, value)
            response.cookies.set(name, value, cookieOptions)
          })
        },
      },
    }
  )

  let user: { user_metadata?: Record<string, unknown> } | null = null
  try {
    const { data } = await supabase.auth.getUser()
    user = (data?.user as { user_metadata?: Record<string, unknown> } | null) ?? null
  } catch (error) {
    console.error('[middleware] Supabase auth.getUser failed:', error)
    // On transient network failures, avoid breaking public routes.
    if (!request.nextUrl.pathname.startsWith('/dashboard')) {
      return response
    }
    // Dashboard routes require auth; send user to login if auth service is unreachable.
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 1. Protect all dashboard routes
  if (request.nextUrl.pathname.startsWith('/dashboard') && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 2. Role-Based Access Control (RBAC) Logic
  if (user) {
    const role = user.user_metadata?.role;
    const path = request.nextUrl.pathname;

    // Redirect root dashboard to role-specific dashboard
    if (path === '/dashboard') {
      if (role === 'admin') return NextResponse.redirect(new URL('/dashboard/admin', request.url));
      if (role === 'advocate') return NextResponse.redirect(new URL('/dashboard/advocate', request.url));
      if (role === 'client') return NextResponse.redirect(new URL('/dashboard/client', request.url));
    }

    // Role-Specific Route Protection
    // Admin Routes
    if (path.startsWith('/dashboard/admin') && role !== 'admin') {
       if (role === 'advocate') return NextResponse.redirect(new URL('/dashboard/advocate', request.url));
       if (role === 'client') return NextResponse.redirect(new URL('/dashboard/client', request.url));
    }

    // Advocate Routes
    if (path.startsWith('/dashboard/advocate') && role !== 'advocate') {
      if (role === 'admin') return NextResponse.redirect(new URL('/dashboard/admin', request.url));
      if (role === 'client') return NextResponse.redirect(new URL('/dashboard/client', request.url));
    }

    // Client Routes
    if (path.startsWith('/dashboard/client') && role !== 'client') {
      if (role === 'admin') return NextResponse.redirect(new URL('/dashboard/admin', request.url));
      if (role === 'advocate') return NextResponse.redirect(new URL('/dashboard/advocate', request.url));
    }

    // Redirect authenticated users away from auth pages
    if (path === '/login' || path === '/signup') {
       if (role === 'admin') return NextResponse.redirect(new URL('/dashboard/admin', request.url));
       if (role === 'advocate') return NextResponse.redirect(new URL('/dashboard/advocate', request.url));
       if (role === 'client') return NextResponse.redirect(new URL('/dashboard/client', request.url));
       return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return response
}
