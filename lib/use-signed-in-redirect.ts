'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSessionUser } from '@/lib/supabase'

// Login and register send people who already have a session straight on (the middleware used
// to do it; the site is static now).
export function useSignedInRedirect(to: string) {
  const router = useRouter()
  useEffect(() => {
    getSessionUser().then((user) => user && router.replace(to))
  }, [router, to])
}
