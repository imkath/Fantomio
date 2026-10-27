'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Link2, Loader2, Mail, Merge, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, Notice, PasswordField } from '@/components/auth-shell'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AccountSection, Setting } from '@/components/account/section'
import { createClient } from '@/lib/supabase'
import { getUserFriendlyError } from '@/lib/errors'
import { LEGAL } from '@/lib/legal'
import {
  authCallback as callback,
  forgetGoogleLink,
  pendingGoogleLink,
  saveMerge,
} from '@/lib/merge-session'

const MIN_PASSWORD = 8

export interface AccessState {
  email: string
  pendingEmail: string | null
  hasPassword: boolean
  providers: string[]
  googleEmail: string | null
}

export function AccessSection({
  state,
  status,
  onChange,
}: {
  state: AccessState
  status: string | null
  onChange: () => void
}) {
  return (
    <AccountSection id="acceso" title="Acceso" lede="Cómo entras a Fantomio.">
      <EmailSetting state={state} status={status} />
      <PasswordSetting state={state} onChange={onChange} />
      <GoogleSetting state={state} status={status} onChange={onChange} />
      <MergeSetting email={state.email} />
    </AccountSection>
  )
}

function EmailSetting({ state, status }: { state: AccessState; status: string | null }) {
  const [newEmail, setNewEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const email = newEmail.trim().toLowerCase()
    if (email === state.email.toLowerCase()) return setError('Ese ya es tu correo.')
    setSaving(true)
    setError('')
    const { error: updateError } = await createClient().auth.updateUser(
      { email },
      { emailRedirectTo: callback('/account?correo=listo') }
    )
    setSaving(false)
    if (updateError) return setError(getUserFriendlyError(updateError))
    setSentTo(email)
    setNewEmail('')
  }

  const pending = sentTo ?? state.pendingEmail
  return (
    <Setting
      title="Correo"
      hint={
        <>
          Es el que ve tu grupo y donde te llegan los avisos. Ahora es{' '}
          <strong className="text-ink font-detail break-all">{state.email}</strong>.
        </>
      }
    >
      {status === 'listo' && !state.pendingEmail && (
        <Notice tone="ok">Listo, tu correo ya cambió.</Notice>
      )}
      {status === 'pendiente' && (
        <Notice tone="ok">
          Confirmaste uno de los dos enlaces. Falta el que llegó al otro correo.
        </Notice>
      )}
      {pending && status !== 'pendiente' && (
        <Notice tone="ok">
          {sentTo
            ? `Te mandamos un enlace a ${state.email} y otro a ${sentTo}. El cambio se aplica cuando confirmes en los dos.`
            : `Hay un cambio pendiente a ${pending}. Para aplicarlo, abre los enlaces que llegaron a los dos correos.`}
        </Notice>
      )}
      {error && <Notice>{error}</Notice>}
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field
            label="Correo nuevo"
            type="email"
            autoComplete="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline" disabled={saving || !newEmail.trim()}>
          {saving ? <Loader2 className="animate-spin" /> : <Mail aria-hidden="true" />}
          Cambiar correo
        </Button>
      </form>
    </Setting>
  )
}

function PasswordSetting({ state, onChange }: { state: AccessState; onChange: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (next.length < MIN_PASSWORD)
      return setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`)
    if (next !== repeat) return setError('Las dos contraseñas nuevas no coinciden.')
    setSaving(true)
    const supabase = createClient()
    try {
      if (state.hasPassword) {
        // Someone who walks up to an open session shouldn't be able to change the password.
        const { error: checkError } = await supabase.auth.signInWithPassword({
          email: state.email,
          password: current,
        })
        if (checkError) {
          setError('La contraseña actual no es correcta.')
          return
        }
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: next })
      if (updateError) {
        setError(getUserFriendlyError(updateError))
        return
      }
      // Registers the password as a sign-in method, so Google can be disconnected later.
      const { data: registered } = await supabase.rpc('ensure_email_identity')
      if (!registered) {
        setError(
          `La contraseña quedó guardada y ya puedes entrar con ella, pero no pudimos dejarla lista para desconectar Google. Escríbenos a ${LEGAL.contacto}.`
        )
        onChange()
        return
      }
      toast.success(state.hasPassword ? 'Contraseña cambiada' : 'Contraseña creada')
      setCurrent('')
      setNext('')
      setRepeat('')
      onChange()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Setting
      title="Contraseña"
      hint={
        state.hasPassword
          ? 'Para cambiarla te pedimos la actual.'
          : 'Entras con Google. Si creas una contraseña, también podrás entrar con tu correo y ella.'
      }
    >
      {error && <Notice>{error}</Notice>}
      <form onSubmit={submit} className="grid max-w-md gap-4">
        {state.hasPassword && (
          <PasswordField
            label="Contraseña actual"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        )}
        <PasswordField
          label={state.hasPassword ? 'Contraseña nueva' : 'Contraseña'}
          autoComplete="new-password"
          hint={`Al menos ${MIN_PASSWORD} caracteres.`}
          required
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <PasswordField
          label="Repítela"
          autoComplete="new-password"
          required
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
        />
        <div>
          <Button type="submit" variant="outline" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <KeyRound aria-hidden="true" />}
            {state.hasPassword ? 'Cambiar contraseña' : 'Crear contraseña'}
          </Button>
        </div>
      </form>
    </Setting>
  )
}

function GoogleSetting({
  state,
  status,
  onChange,
}: {
  state: AccessState
  status: string | null
  onChange: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const connected = state.providers.includes('google')
  // Left by "Unir otra cuenta" when that account's Google still has to be connected here.
  const [pendingLink, setPendingLink] = useState<string | null>(null)
  useEffect(() => {
    if (connected) forgetGoogleLink()
    else setPendingLink(pendingGoogleLink())
  }, [connected])
  // Google can only go if there is another way in: a password registered as a sign-in method.
  const canDisconnect = state.hasPassword && state.providers.includes('email')

  const connect = async () => {
    setBusy(true)
    setError('')
    const { error: linkError } = await createClient().auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: callback('/account?google=conectado') },
    })
    if (linkError) {
      setError(getUserFriendlyError(linkError))
      setBusy(false)
    }
  }

  const disconnect = async () => {
    setBusy(true)
    setError('')
    const supabase = createClient()
    const { data } = await supabase.auth.getUserIdentities()
    const google = data?.identities.find((i) => i.provider === 'google')
    if (google) {
      const { error: unlinkError } = await supabase.auth.unlinkIdentity(google)
      if (unlinkError) {
        setError(getUserFriendlyError(unlinkError))
        setBusy(false)
        return
      }
    }
    toast.success('Google desconectado')
    setBusy(false)
    onChange()
  }

  return (
    <Setting
      title="Google"
      hint={
        connected
          ? `Conectado${state.googleEmail ? ` con ${state.googleEmail}` : ''}. Puedes entrar con el botón de Google.`
          : 'Conéctalo para entrar con un toque, sin escribir la contraseña.'
      }
    >
      {status === 'conectado' && connected && <Notice tone="ok">Google quedó conectado.</Notice>}
      {pendingLink && !connected && (
        <Notice>
          Conecta {pendingLink} para seguir entrando con Google. Hasta entonces, entrar con ese
          Google crearía una cuenta nueva.
        </Notice>
      )}
      {status === 'otra-cuenta' && (
        <Notice>
          Esa cuenta de Google ya tiene su propia cuenta en Fantomio. Si las dos son tuyas, júntalas
          con &quot;Unir otra cuenta&quot;, más abajo.
        </Notice>
      )}
      {error && <Notice>{error}</Notice>}
      {connected ? (
        <div className="space-y-2">
          <Button variant="outline" disabled={busy || !canDisconnect} onClick={disconnect}>
            {busy ? <Loader2 className="animate-spin" /> : <Unlink aria-hidden="true" />}
            Desconectar Google
          </Button>
          {!canDisconnect && (
            <p className="text-graphite text-sm">
              Para desconectarlo, primero crea una contraseña. Si no, no tendrías cómo entrar.
            </p>
          )}
        </div>
      ) : (
        <Button variant="outline" disabled={busy} onClick={connect}>
          {busy ? <Loader2 className="animate-spin" /> : <Link2 aria-hidden="true" />}
          Conectar Google
        </Button>
      )}
    </Setting>
  )
}

function MergeSetting({ email }: { email: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const start = async () => {
    setBusy(true)
    setError('')
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const { data: code, error: rpcError } = await supabase.rpc('start_merge')
    if (rpcError || !code || !session) {
      setError(getUserFriendlyError(rpcError ?? { message: '' }))
      setBusy(false)
      return
    }
    // This session is not signed out (that would revoke it): it waits in this tab and comes
    // back after the merge.
    if (!saveMerge(code, email, session)) {
      setError('Tu navegador no deja guardar el paso intermedio. Prueba fuera del modo privado.')
      setBusy(false)
      return
    }
    router.push(`/login?unir=1&redirectTo=${encodeURIComponent('/account/unir')}`)
  }

  return (
    <Setting
      title="Unir otra cuenta"
      hint="Si te creaste dos cuentas (por ejemplo una con tu correo y otra con Google), puedes juntarlas en esta."
    >
      {error && <Notice>{error}</Notice>}
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Merge aria-hidden="true" />
        Unir otra cuenta
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unir otra cuenta a {email}</DialogTitle>
            <DialogDescription>
              Te vamos a pedir que entres con la otra cuenta, para confirmar que también es tuya.
              Sus grupos, listas y sorteos pasan a esta. Si entraba con Google, al final te pedimos
              conectarlo aquí. La otra cuenta deja de existir. Esta conserva su correo y su
              contraseña.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={start} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Merge aria-hidden="true" />}
              Entrar con la otra cuenta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Setting>
  )
}
