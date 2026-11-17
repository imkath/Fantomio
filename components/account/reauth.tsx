'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Divider, Notice, PasswordField } from '@/components/auth-shell'
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

// Asks "is it you?" before a sensitive change, unless the person signed in a moment ago.
// `confirm()` resolves true when they may go on: right away if the database says the sign-in
// is recent (its clock, not the device's), or after they type their password. With Google they
// leave for Google and come back to `returnTo`, where they repeat the action freshly signed in.
export function useReauth({
  email,
  hasPassword,
  hasGoogle,
  returnTo,
}: {
  email: string
  hasPassword: boolean
  hasGoogle: boolean
  returnTo: string
}) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef<Promise<boolean> | null>(null)
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const settle = (ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = null
    pending.current = null
    setOpen(false)
    setPassword('')
    setError('')
  }

  const confirm = (): Promise<boolean> => {
    // A double tap while the first check runs gets the same answer, not a second dialog.
    if (pending.current) return pending.current
    pending.current = (async () => {
      const { data } = await createClient().rpc('signed_in_recently')
      if (data === true) {
        pending.current = null
        return true
      }
      return new Promise<boolean>((resolve) => {
        resolver.current = resolve
        setOpen(true)
      })
    })()
    return pending.current
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setChecking(true)
    setError('')
    try {
      const { error: signInError } = await createClient().auth.signInWithPassword({
        email,
        password,
      })
      if (!signInError) return settle(true)
      setError(
        signInError.code === 'invalid_credentials'
          ? 'La contraseña no es correcta.'
          : signInError.status === 429
            ? 'Demasiados intentos. Espera unos minutos.'
            : 'No pudimos revisarla. Intenta de nuevo.'
      )
    } catch {
      setError('No pudimos revisarla. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setChecking(false)
    }
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
              <Link
                href="/forgot-password"
                className="text-graphite hover:text-ink inline-block text-[15px] underline underline-offset-4"
              >
                Olvidé mi contraseña
              </Link>
            </form>
          )}
          {hasPassword && hasGoogle && <Divider>o</Divider>}
          {hasGoogle && <GoogleButton redirectTo={returnTo} loginHint={email} />}
          {!hasPassword && !hasGoogle && (
            <p className="text-graphite">Sal y vuelve a entrar a tu cuenta, y repite el cambio.</p>
          )}
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
