import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Allow auth callback to proceed without checks (needed for OAuth/magic links)
  if (request.nextUrl.pathname === '/auth/callback') {
    return supabaseResponse
  }

  // Create Supabase client to allow cookie refresh
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Read the session from the cookie (refreshing it only when it has expired) instead of
  // asking the auth server on every navigation, which cost a round trip to Supabase each time.
  // This is enough here: the middleware only decides redirects. Data is protected by RLS on
  // every query, and server actions still verify the user with getUser().
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user ?? null

  // Protected routes
  const protectedPaths = ['/dashboard', '/groups']
  const isProtectedPath = protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path))

  // Redirect to login if accessing protected route without session
  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // Auth pages check - redirect to dashboard if already logged in
  const authPaths = ['/login', '/register']
  const isAuthPath = authPaths.some((path) => request.nextUrl.pathname === path)

  if (isAuthPath && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  // Only run middleware on routes that actually need authentication
  // This significantly reduces CPU usage on Cloudflare Workers
  matcher: ['/dashboard/:path*', '/groups/:path*', '/login', '/register', '/auth/callback'],
}
