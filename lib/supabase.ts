import { createBrowserClient } from '@supabase/ssr'

// The session lives in cookies the page itself reads (there is no server to set HttpOnly ones),
// so at least keep them on HTTPS and off cross-site requests. Local dev runs on plain http.
const options = {
  cookieOptions: { secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const },
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    options
  )
}

// For backward compatibility
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  options
)

// Signed-in user from the local session cookie, without a round trip to the auth server.
// Only for deciding what to load in the browser: RLS still checks the real token on every
// query, and server actions keep using getUser().
export async function getSessionUser() {
  const { data } = await supabase.auth.getSession()
  return data.session?.user ?? null
}
