'use client'

import { Button } from '@/components/ui/button'
import { ArrowRight, Loader2 } from 'lucide-react'
import { AuthShell, Divider, Field, Notice, PasswordField } from '@/components/auth-shell'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@/lib/use-query'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { safeRedirect } from '@/lib/routes'
import { useSignedInRedirect } from '@/lib/use-signed-in-redirect'
import { readMerge } from '@/lib/merge-session'
import { GoogleButton } from '@/components/google-button'
import { CAPTCHA_WAIT, useTurnstile } from '@/components/turnstile'

function LoginForm() {
  const router = useRouter()
  const searchParams = useQuery()
  const redirectTo = safeRedirect(searchParams.get('redirectTo'))
  // Second step of "Unir otra cuenta": the account page saved who to merge into, and its
  // session stays open meanwhile, so don't send it on.
  const merging = searchParams.get('unir') === '1'
  useSignedInRedirect()
  const verified = searchParams.get('verified') === 'true'
  const deleted = searchParams.get('cuenta') === 'eliminada'
  const [mergeInto, setMergeInto] = useState<string | null>(null)
  useEffect(() => {
    if (merging) setMergeInto(readMerge()?.email ?? null)
  }, [merging])
  const urlError = searchParams.get('error')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (urlError) setError(urlError)
  }, [urlError])
  const [isLoading, setIsLoading] = useState(false)
  const captcha = useTurnstile()

  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!captcha.token) return setError(CAPTCHA_WAIT)
    setIsLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken: captcha.token },
    })
    // Each token works once: a failed attempt needs a new one.
    captcha.reset()

    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'El correo o la contraseña no coinciden'
          : error.message
      )
      setIsLoading(false)
    } else {
      router.push(redirectTo)
      router.refresh()
    }
  }

  const keep = redirectTo !== '/dashboard' ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''

  return (
    <AuthShell title="Entrar" lede="Para ver tus grupos y a quién te tocó.">
      <div className="space-y-6">
        {mergeInto && (
          <Notice tone="ok">
            Entra con la otra cuenta, la que quieres unir a {mergeInto}. Después te pedimos
            confirmar.
          </Notice>
        )}
        <GoogleButton redirectTo={redirectTo} />

        <Divider>o con tu correo</Divider>

        <form onSubmit={handleCredentialsSignIn} className="space-y-5">
          {verified && <Notice tone="ok">Tu cuenta quedó confirmada. Ya puedes entrar.</Notice>}
          {deleted && (
            <Notice tone="ok">Tu cuenta quedó eliminada. Gracias por usar Fantomio.</Notice>
          )}
          {error && <Notice>{error}</Notice>}
          <Field
            label="Correo"
            type="email"
            autoComplete="email"
            placeholder="nombre@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <PasswordField
            label="Contraseña"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {captcha.widget}
          <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <>
                Entrar
                <ArrowRight aria-hidden="true" />
              </>
            )}
          </Button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3 text-[15px]">
          <Button asChild variant="outline" size="sm">
            <Link href={`/register${keep}`}>Crear cuenta</Link>
          </Button>
          <Link
            href="/forgot-password"
            className="text-graphite hover:text-ink underline underline-offset-4"
          >
            Olvidé mi contraseña
          </Link>
        </div>

        <p className="text-faint text-sm">
          Al entrar aceptas los{' '}
          <Link href="/terms" className="hover:text-ink underline underline-offset-[3px]">
            términos
          </Link>{' '}
          y la{' '}
          <Link href="/privacy" className="hover:text-ink underline underline-offset-[3px]">
            política de privacidad
          </Link>
          .
        </p>
      </div>
    </AuthShell>
  )
}

export default function LoginPage() {
  return <LoginForm />
}
