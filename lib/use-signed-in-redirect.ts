'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSessionUser } from '@/lib/supabase'

// Login and register send people who already have a session straight on (the middleware used
// to do it; the site is static now).
// `enabled` is false while "Unir otra cuenta" asks to sign in with a second account on top of
// the first one.
export function useSignedInRedirect(to: string, enabled = true) {
  const router = useRouter()
  useEffect(() => {
    if (!enabled) return
    getSessionUser().then((user) => user && router.replace(to))
  }, [router, to, enabled])
}
