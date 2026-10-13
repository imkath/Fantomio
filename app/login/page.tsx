'use client'

import { Button } from '@/components/ui/button'
import { ArrowRight, Loader2 } from 'lucide-react'
import { AuthShell, Divider, Field, Notice, PasswordField } from '@/components/auth-shell'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { safeRedirect } from '@/lib/routes'
import { useSignedInRedirect } from '@/lib/use-signed-in-redirect'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = safeRedirect(searchParams.get('redirectTo'))
  useSignedInRedirect(redirectTo)
  const verified = searchParams.get('verified') === 'true'
  const urlError = searchParams.get('error')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(urlError || '')
  const [isLoading, setIsLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    })
  }

  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

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
        <Button size="lg" variant="outline" className="w-full" onClick={handleGoogleSignIn}>
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
          Seguir con Google
        </Button>

        <Divider>o con tu correo</Divider>

        <form onSubmit={handleCredentialsSignIn} className="space-y-5">
          {verified && <Notice tone="ok">Tu cuenta quedó confirmada. Ya puedes entrar.</Notice>}
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
  return (
    <Suspense
      fallback={
        <main className="bg-paper flex min-h-screen items-center justify-center">
          <Loader2 className="text-faint h-8 w-8 animate-spin" />
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
