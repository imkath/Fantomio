'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getSessionUser } from '@/lib/supabase'

// Landing header button: "Entrar" for visitors, "Mis grupos" when there is already a session,
// so people can look at the landing without signing out. Renders "Entrar" until it knows.
export function AccountLink() {
  const [signedIn, setSignedIn] = useState(false)
  useEffect(() => {
    getSessionUser().then((user) => setSignedIn(!!user))
  }, [])

  return (
    <Button asChild size="sm">
      <Link href={signedIn ? '/dashboard' : '/login'}>
        {signedIn ? 'Mis grupos' : 'Entrar'}
        <ArrowRight aria-hidden="true" />
      </Link>
    </Button>
  )
}
