'use client'

import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { AuthShell, Field, Notice } from '@/components/auth-shell'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const { error: supabaseError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      })

      if (supabaseError) {
        setError(supabaseError.message)
        setIsLoading(false)
        return
      }

      setSent(true)
    } catch {
      setError('No pudimos conectar. Revisa tu internet e intenta de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }

  if (sent) {
    return (
      <AuthShell back="/login" title="Revisa tu correo">
        <p className="text-graphite mb-8">
          Si hay una cuenta con <strong className="text-ink">{email}</strong>, te llegará un enlace
          para elegir una contraseña nueva.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Volver a entrar</Link>
        </Button>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      back="/login"
      title="Recuperar contraseña"
      lede="Escribe tu correo y te mandamos un enlace para crear una nueva."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
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
        <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar enlace'}
        </Button>
      </form>

      <p className="text-graphite mt-6 text-[15px]">
        ¿Te acordaste?{' '}
        <Link href="/login" className="text-ink underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </AuthShell>
  )
}
