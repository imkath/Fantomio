'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getSessionUser } from '@/lib/supabase'

// Landing header button: "Entrar" for visitors, "Mis grupos" when there is already a session.
// Both are in the HTML; SESSION_SCRIPT in the layout marks <html> with .has-session before the
// first paint (the session cookie exists), and CSS shows only the right one, so it doesn't
// blink from one to the other. Here we only correct a stale cookie (expired session).
export function AccountLink() {
  useEffect(() => {
    getSessionUser().then((user) =>
      document.documentElement.classList.toggle('has-session', !!user)
    )
  }, [])

  return (
    <>
      <Button asChild size="sm" className="guest-only">
        <Link href="/login">
          Entrar
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
      <Button asChild size="sm" className="session-only">
        <Link href="/dashboard">
          Mis grupos
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
    </>
  )
}
