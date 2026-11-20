'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'

// Google is the shortest way in: one tap creates the account the first time and signs in after
// that, so it sits first on both the sign-in and the sign-up page.
export function GoogleButton({
  redirectTo,
  loginHint,
}: {
  redirectTo: string
  // Suggests this account in Google's chooser (used when confirming it's you).
  loginHint?: string
}) {
  const [loading, setLoading] = useState(false)
  // On success the browser leaves for Google, so loading only ends when something failed.
  const signIn = async () => {
    setLoading(true)
    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
          ...(loginHint ? { queryParams: { login_hint: loginHint } } : {}),
        },
      })
      if (error) throw error
    } catch {
      toast.error('No pudimos abrir Google. Revisa tu conexión e intenta de nuevo.')
      setLoading(false)
    }
  }
  return (
    <Button size="lg" variant="outline" className="w-full" onClick={signIn} disabled={loading}>
      {loading ? (
        <Loader2 className="mr-1 size-5 animate-spin" aria-hidden="true" />
      ) : (
        <svg className="mr-1 h-5 w-5" aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.11s.13-1.45.35-2.11V7.05H2.18C.79 9.81 0 12.92 0 16c0 3.08.79 6.19 2.18 8.95l3.66-2.84z"
            fill="#FBBC05"
          />
          <path
            d="M12 4.63c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0 7.7 0 3.99 2.47 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
      )}
      Seguir con Google
    </Button>
  )
}
