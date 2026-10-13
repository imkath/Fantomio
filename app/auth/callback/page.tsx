'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { safeRedirect } from '@/lib/routes'

// Where Google sign-in and the email links (confirm account, reset password) come back to.
// It runs in the browser: the site is static, there is no server to finish the sign-in.
// The Supabase browser client exchanges a ?code= on its own when it starts (PKCE), so here
// we wait for that, handle ?token_hash= links, and move on.

function Callback() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const next = safeRedirect(params.get('next') || params.get('redirect_to'))
    const failed = params.get('error_description')
    if (failed) {
      router.replace(`/login?error=${encodeURIComponent(failed)}`)
      return
    }

    const supabase = createClient()
    const finish = async () => {
      const tokenHash = params.get('token_hash') || params.get('token')
      const type = params.get('type')
      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as 'signup' | 'email' | 'recovery' | 'invite',
        })
        if (!error) {
          router.replace(type === 'recovery' ? '/reset-password' : '/login?verified=true')
          return
        }
      }
      const {
        data: { session },
      } = await supabase.auth.getSession()
      router.replace(session ? next : '/login')
    }
    finish()
  }, [params, router])

  return <Spinner />
}

function Spinner() {
  return (
    <main className="bg-paper flex min-h-screen items-center justify-center" aria-live="polite">
      <Loader2 className="text-faint h-8 w-8 animate-spin" />
      <span className="sr-only">Entrando…</span>
    </main>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Callback />
    </Suspense>
  )
}
