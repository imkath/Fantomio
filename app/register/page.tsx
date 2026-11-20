'use client'

import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { AuthShell, Divider, Field, Notice, PasswordField } from '@/components/auth-shell'
import { GoogleButton } from '@/components/google-button'
import { CAPTCHA_WAIT, useTurnstile } from '@/components/turnstile'
import { useState } from 'react'
import { useQuery } from '@/lib/use-query'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { safeRedirect } from '@/lib/routes'
import { useSignedInRedirect } from '@/lib/use-signed-in-redirect'

function RegisterForm() {
  const searchParams = useQuery()
  const redirectTo = safeRedirect(searchParams.get('redirectTo'))
  useSignedInRedirect()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const captcha = useTurnstile()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!captcha.token) return setError(CAPTCHA_WAIT)
    setIsLoading(true)
    setError('')

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      setIsLoading(false)
      return
    }

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      setIsLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
          data: {
            name,
          },
          captchaToken: captcha.token,
        },
      })
      captcha.reset()

      if (error) {
        setError(error.message)
        setIsLoading(false)
        return
      }

      setEmailSent(true)
    } catch {
      setError('No pudimos conectar. Revisa tu internet e intenta de nuevo.')
      setIsLoading(false)
    }
  }

  const keep = redirectTo !== '/dashboard' ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''

  if (emailSent) {
    return (
      <AuthShell back="/login" title="Revisa tu correo">
        <p className="text-graphite mb-8">
          Te mandamos un enlace a <strong className="text-ink">{email}</strong>. Ábrelo para activar
          tu cuenta. Si no aparece, mira en spam.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/login${keep}`}>Volver a entrar</Link>
        </Button>
      </AuthShell>
    )
  }

  return (
    <AuthShell back={`/login${keep}`} title="Crear cuenta" lede="Con Google es un toque.">
      <GoogleButton redirectTo={redirectTo} />
      <div className="my-6">
        <Divider>o con tu correo</Divider>
      </div>
      <form onSubmit={handleRegister} className="space-y-5">
        {error && <Notice>{error}</Notice>}
        <Field
          label="Tu nombre"
          hint="Así te verán en los grupos."
          autoComplete="name"
          value={name}
          maxLength={300}
          onChange={(e) => setName(e.target.value)}
          required
        />
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
          hint="Al menos 8 caracteres."
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <PasswordField
          label="Repite la contraseña"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        {captcha.widget}
        <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear cuenta'}
        </Button>
      </form>

      <p className="text-faint mt-6 text-sm">
        Al crear tu cuenta aceptas los{' '}
        <Link href="/terms" className="hover:text-ink underline underline-offset-[3px]">
          términos
        </Link>{' '}
        y la{' '}
        <Link href="/privacy" className="hover:text-ink underline underline-offset-[3px]">
          política de privacidad
        </Link>
        .
      </p>

      <p className="text-graphite mt-4 text-[15px]">
        ¿Ya tienes cuenta?{' '}
        <Link href={`/login${keep}`} className="text-ink underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </AuthShell>
  )
}

export default function RegisterPage() {
  return <RegisterForm />
}
