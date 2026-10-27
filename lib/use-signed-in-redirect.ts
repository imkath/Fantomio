'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSessionUser } from '@/lib/supabase'
import { safeRedirect } from '@/lib/routes'

// Login and register send people who already have a session straight on (the middleware used
// to do it; the site is static now). The query is read here, when the effect runs: useQuery is
// still empty on the first render and would send everyone to the default page.
export function useSignedInRedirect() {
  const router = useRouter()
  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    // "Unir otra cuenta" asks to sign in with a second account on top of the first one.
    if (query.get('unir') === '1') return
    getSessionUser().then((user) => user && router.replace(safeRedirect(query.get('redirectTo'))))
  }, [router])
}
