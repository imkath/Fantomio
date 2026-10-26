'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Notice } from '@/components/auth-shell'
import { BackLink } from '@/components/back-link'
import { createClient } from '@/lib/supabase'
import { getUserFriendlyError } from '@/lib/errors'

// Changing the account's email goes through Supabase Auth, which sends a link to the current
// address and another to the new one; the change applies once both are confirmed. The copy
// the group sees (profiles.email) follows by trigger (20261026g_sync_profile_email.sql).

interface Account {
  email: string
  pendingEmail: string | null
  withGoogle: boolean
}

function AccountPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [account, setAccount] = useState<Account | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      // getUser asks the auth server, so a change confirmed elsewhere shows up here.
      const {
        data: { user },
      } = await createClient().auth.getUser()
      if (!user) {
        router.push('/login?redirectTo=/account')
        return
      }
      setAccount({
        email: user.email ?? '',
        pendingEmail: user.new_email ?? null,
        withGoogle: !!user.identities?.some((i) => i.provider === 'google'),
      })
    }
    load()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!account) return
    const email = newEmail.trim().toLowerCase()
    if (email === account.email.toLowerCase()) {
      setError('Ese ya es tu correo.')
      return
    }

    setIsSaving(true)
    setError('')
    const next = encodeURIComponent('/account?correo=listo')
    const { error: updateError } = await createClient().auth.updateUser(
      { email },
      { emailRedirectTo: `${window.location.origin}/auth/callback?next=${next}` }
    )
    setIsSaving(false)

    if (updateError) {
      setError(getUserFriendlyError(updateError))
      return
    }
    setSentTo(email)
    setAccount({ ...account, pendingEmail: email })
    setNewEmail('')
  }

  const status = params.get('correo')

  return (
    <div className="bg-paper text-ink min-h-[calc(100vh-69px)]">
      <main className="mx-auto max-w-[640px] px-4 py-10 md:px-8 md:py-14">
        <BackLink />
        <h1 className="mt-6 mb-10 text-[34px] leading-tight font-light md:text-[44px]">
          Mi cuenta
        </h1>

        {!account ? (
          <Loader2 className="text-faint h-8 w-8 animate-spin" aria-label="Cargando" />
        ) : (
          <section className="border-rule space-y-6 rounded-[4px] border p-6 md:p-8">
            <div>
              <h2 className="text-xl font-bold">Correo</h2>
              <p className="text-graphite mt-1">
                Es el que ve tu grupo y donde te llegan los avisos.
              </p>
              <p className="font-detail mt-4 text-lg break-all">{account.email}</p>
            </div>

            {status === 'listo' && !account.pendingEmail && (
              <Notice tone="ok">Listo, tu correo ya cambió.</Notice>
            )}
            {status === 'pendiente' && (
              <Notice tone="ok">
                Confirmaste uno de los dos enlaces. Falta el que llegó al otro correo.
              </Notice>
            )}
            {sentTo ? (
              <Notice tone="ok">
                Te mandamos un enlace a {account.email} y otro a {sentTo}. El cambio se aplica
                cuando confirmes en los dos.
              </Notice>
            ) : (
              account.pendingEmail &&
              status !== 'pendiente' && (
                <Notice tone="ok">
                  Hay un cambio pendiente a {account.pendingEmail}. Para aplicarlo, abre los enlaces
                  que llegaron a los dos correos.
                </Notice>
              )
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && <Notice>{error}</Notice>}
              <Field
                label="Correo nuevo"
                type="email"
                autoComplete="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                hint={
                  account.withGoogle
                    ? 'Si entras con Google, sigues entrando igual. Solo cambia el correo de GhostSwap.'
                    : 'Después del cambio, entras con el correo nuevo y la misma contraseña.'
                }
              />
              <Button type="submit" disabled={isSaving || !newEmail.trim()}>
                {isSaving ? <Loader2 className="animate-spin" /> : <Mail aria-hidden="true" />}
                Cambiar correo
              </Button>
            </form>
          </section>
        )}
      </main>
    </div>
  )
}

export default function AccountRoute() {
  return (
    <Suspense>
      <AccountPage />
    </Suspense>
  )
}
