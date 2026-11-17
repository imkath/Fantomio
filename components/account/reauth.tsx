'use client'

import { useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Notice, PasswordField } from '@/components/auth-shell'
import { GoogleButton } from '@/components/google-button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase'
import { isRecentSignIn } from '@/lib/reauth'

// Asks "is it you?" before a sensitive change, unless the person signed in a moment ago.
// `confirm()` resolves true when they may go on: right away if the sign-in is recent, or after
// they type their password. With Google they leave for Google and come back to `returnTo`,
// where they repeat the action with a fresh sign-in.
export function useReauth({
  email,
  hasPassword,
  returnTo,
}: {
  email: string
  hasPassword: boolean
  returnTo: string
}) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef<((ok: boolean) => void) | null>(null)

  const settle = (ok: boolean) => {
    pending.current?.(ok)
    pending.current = null
    setOpen(false)
    setPassword('')
    setError('')
  }

  const confirm = async (): Promise<boolean> => {
    const {
      data: { session },
    } = await createClient().auth.getSession()
    if (isRecentSignIn(session?.access_token)) return true
    return new Promise((resolve) => {
      pending.current = resolve
      setOpen(true)
    })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setChecking(true)
    setError('')
    const { error: signInError } = await createClient().auth.signInWithPassword({
      email,
      password,
    })
    setChecking(false)
    if (signInError) return setError('La contraseña no es correcta.')
    settle(true)
  }

  const dialog = (
    <Dialog open={open} onOpenChange={(o) => !o && settle(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirma que eres tú</DialogTitle>
          <DialogDescription>
            Para este cambio necesitamos que hayas entrado hace poco. Así nadie puede hacerlo desde
            una sesión que dejaste abierta.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {hasPassword && (
            <form id="reauth" onSubmit={submit} className="space-y-4">
              {error && <Notice>{error}</Notice>}
              <PasswordField
                label="Tu contraseña"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </form>
          )}
          {!hasPassword && <GoogleButton redirectTo={returnTo} />}
        </div>
        {hasPassword && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => settle(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="reauth" disabled={checking || !password}>
              {checking ? <Loader2 className="animate-spin" /> : 'Confirmar'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )

  return { confirm, dialog }
}
