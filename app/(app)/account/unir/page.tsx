'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Merge } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/auth-shell'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { MERGE_KEY } from '@/components/account/access-section'
import { createClient, getSessionUser } from '@/lib/supabase'
import { getUserFriendlyError } from '@/lib/errors'

// Second step of "Unir otra cuenta". The person started in the account that stays, then
// signed in here with the other one. Confirming moves everything over and deletes this one.

type Step =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'confirm'; code: string; target: string; current: string }
  | { kind: 'done'; target: string }

const forget = () => {
  try {
    localStorage.removeItem(MERGE_KEY)
  } catch {
    // Nothing to clean.
  }
}

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
      let saved: { code?: string } | null = null
      try {
        saved = JSON.parse(localStorage.getItem(MERGE_KEY) || 'null')
      } catch {
        saved = null
      }
      if (!saved?.code) return setStep({ kind: 'missing' })
      const { data } = await createClient().rpc('merge_preview', { p_code: saved.code })
      if (!data) {
        forget()
        return setStep({ kind: 'missing' })
      }
      if (data.same) {
        setError('Entraste con la misma cuenta. Sal y entra con la otra para unirlas.')
      }
      setStep({ kind: 'confirm', code: saved.code, target: data.email, current: user.email ?? '' })
    }
    run()
  }, [router])

  const confirm = async () => {
    if (step.kind !== 'confirm') return
    setBusy(true)
    setError('')
    const supabase = createClient()
    const { data, error: rpcError } = await supabase.rpc('confirm_merge', { p_code: step.code })
    if (rpcError) {
      setError(getUserFriendlyError(rpcError))
      setBusy(false)
      return
    }
    forget()
    // This account no longer exists; its session goes with it.
    await supabase.auth.signOut({ scope: 'local' })
    setStep({ kind: 'done', target: data as string })
  }

  const cancel = async () => {
    forget()
    await createClient().auth.signOut({ scope: 'local' })
    router.push('/login')
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
              <li>Sus grupos, listas, sorteos y avisos pasan a {step.target}.</li>
              <li>Si esta cuenta entra con Google, ese acceso también pasa.</li>
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
            <Notice tone="ok">
              Listo. Todo quedó en {step.target}. Entra con esa cuenta, con su contraseña o con
              Google.
            </Notice>
            <Button asChild>
              <Link href="/login">Entrar</Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
