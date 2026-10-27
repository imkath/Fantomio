'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Link2, Loader2, Merge } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/auth-shell'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { clearAvatarFiles } from '@/components/account/profile-section'
import { createClient, getSessionUser } from '@/lib/supabase'
import { getUserFriendlyError } from '@/lib/errors'
import {
  authCallback,
  forgetMerge,
  readMerge,
  rememberGoogleLink,
  type PendingMerge,
} from '@/lib/merge-session'

// Second step of "Unir otra cuenta". The person started in the account that stays, then
// signed in here with the other one. Confirming moves everything over and deletes this one;
// then the first session comes back, and if this account entered with Google, that Google is
// connected to the first one with Supabase's linkIdentity.

type Step =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'confirm'; pending: PendingMerge; userId: string; target: string; current: string }
  | { kind: 'done'; target: string; google: string | null; signedIn: boolean }

export default function MergePage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const run = async () => {
      const user = await getSessionUser()
      if (!user) {
        router.replace('/login?unir=1&redirectTo=%2Faccount%2Funir')
        return
      }
      const pending = readMerge()
      if (!pending) return setStep({ kind: 'missing' })
      const { data } = await createClient().rpc('merge_preview', { p_code: pending.code })
      if (!data) {
        forgetMerge()
        return setStep({ kind: 'missing' })
      }
      if (data.same) {
        setError('Entraste con la misma cuenta. Vuelve atrás y entra con la otra.')
      }
      setStep({
        kind: 'confirm',
        pending,
        userId: user.id,
        target: data.email,
        current: user.email ?? '',
      })
    }
    run()
  }, [router])

  // Brings back the session of the account that stays. If it can't (it was closed meanwhile,
  // for example), this tab ends signed out and the person signs in again.
  const restore = async (pending: PendingMerge) => {
    const supabase = createClient()
    const { data, error: restoreError } = await supabase.auth.setSession(pending.keep)
    if (!restoreError && data.session) return true
    await supabase.auth.signOut({ scope: 'local' })
    return false
  }

  const confirm = async () => {
    if (step.kind !== 'confirm') return
    setBusy(true)
    setError('')
    const supabase = createClient()
    const { data: ids } = await supabase.auth.getUserIdentities()
    const google = ids?.identities.find((i) => i.provider === 'google')
    const googleEmail = google ? String(google.identity_data?.email ?? step.current) : null
    // Photos live in storage, outside the database: remove this account's before it goes.
    await clearAvatarFiles(step.userId).catch(() => {})
    const { data, error: rpcError } = await supabase.rpc('confirm_merge', {
      p_code: step.pending.code,
    })
    if (rpcError) {
      setError(getUserFriendlyError(rpcError))
      setBusy(false)
      return
    }
    forgetMerge()
    const signedIn = await restore(step.pending)
    if (googleEmail && !signedIn) rememberGoogleLink(googleEmail)
    setBusy(false)
    setStep({ kind: 'done', target: data as string, google: googleEmail, signedIn })
  }

  const cancel = async () => {
    if (step.kind !== 'confirm') return
    setBusy(true)
    forgetMerge()
    const signedIn = await restore(step.pending)
    router.push(signedIn ? '/account' : '/login')
  }

  const connectGoogle = async () => {
    if (step.kind !== 'done' || !step.google) return
    setBusy(true)
    setError('')
    const { error: linkError } = await createClient().auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: authCallback('/account?google=conectado') },
    })
    if (linkError) {
      rememberGoogleLink(step.google)
      setError(getUserFriendlyError(linkError))
      setBusy(false)
    }
  }

  const later = () => {
    if (step.kind === 'done' && step.google) rememberGoogleLink(step.google)
    router.push('/account')
  }

  return (
    <div className="bg-paper text-ink min-h-[calc(100vh-69px)]">
      <main className="mx-auto max-w-[640px] px-4 pt-8 pb-16 md:px-8">
        <Breadcrumbs
          items={[
            { label: 'Mis grupos', href: '/dashboard' },
            { label: 'Mi cuenta', href: '/account' },
            { label: 'Unir cuentas' },
          ]}
        />
        <h1 className="mt-6 mb-8 text-[34px] leading-tight font-light md:text-[44px]">
          Unir cuentas
        </h1>

        {step.kind === 'loading' && <Loader2 className="text-faint h-8 w-8 animate-spin" />}

        {step.kind === 'missing' && (
          <div className="space-y-4">
            <Notice>
              No encontramos una unión en curso, o pasaron más de 15 minutos. Vuelve a empezar desde
              Mi cuenta, en la cuenta que quieres conservar.
            </Notice>
            <Button asChild variant="outline">
              <Link href="/account">Ir a Mi cuenta</Link>
            </Button>
          </div>
        )}

        {step.kind === 'confirm' && (
          <div className="border-rule space-y-5 rounded-[4px] border p-6 md:p-8">
            <p>
              Vas a unir <strong className="break-all">{step.current}</strong> a{' '}
              <strong className="break-all">{step.target}</strong>.
            </p>
            <ul className="text-graphite list-disc space-y-1 pl-5">
              <li>Sus grupos, listas, sorteos, invitaciones y avisos pasan a {step.target}.</li>
              <li>Si esta cuenta entra con Google, al final te pedimos conectarlo.</li>
              <li>{step.target} conserva su correo y su contraseña.</li>
              <li>{step.current} deja de existir. No se puede deshacer.</li>
            </ul>
            {error && <Notice>{error}</Notice>}
            <div className="flex flex-wrap gap-2">
              <Button onClick={confirm} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Merge aria-hidden="true" />}
                Unir las cuentas
              </Button>
              <Button variant="outline" onClick={cancel} disabled={busy}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {step.kind === 'done' && (
          <div className="space-y-4">
            <Notice tone="ok">Listo. Todo quedó en {step.target}.</Notice>
            {error && <Notice>{error}</Notice>}
            {step.signedIn && step.google && (
              <>
                <p>Falta un paso: conecta tu Google ({step.google}) para seguir entrando con él.</p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={connectGoogle} disabled={busy}>
                    {busy ? <Loader2 className="animate-spin" /> : <Link2 aria-hidden="true" />}
                    Conectar Google
                  </Button>
                  <Button variant="outline" onClick={later} disabled={busy}>
                    Más tarde
                  </Button>
                </div>
              </>
            )}
            {step.signedIn && !step.google && (
              <Button asChild>
                <Link href="/dashboard">Ver mis grupos</Link>
              </Button>
            )}
            {!step.signedIn && (
              <>
                <p>
                  Entra con {step.target}.
                  {step.google &&
                    ` Después, en Mi cuenta, conecta tu Google (${step.google}). Hasta entonces, no entres con ese Google: crearía una cuenta nueva.`}
                </p>
                <Button asChild>
                  <Link href="/login?redirectTo=%2Faccount">Entrar</Link>
                </Button>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
