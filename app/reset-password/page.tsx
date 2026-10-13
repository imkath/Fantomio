'use client'

import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { AuthShell, Notice, PasswordField } from '@/components/auth-shell'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    // Check if user has a valid session from the callback
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        // No valid session, redirect to forgot password
        router.push('/forgot-password?error=invalid_session')
        return
      }

      setIsCheckingSession(false)
    }

    checkSession()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      setIsLoading(false)
      return
    }

    try {
      const { error: supabaseError } = await supabase.auth.updateUser({
        password: password,
      })

      if (supabaseError) {
        setError(supabaseError.message)
        setIsLoading(false)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    } catch {
      setError('Error al actualizar la contraseña')
    } finally {
      setIsLoading(false)
    }
  }

  if (isCheckingSession) {
    return (
      <main className="bg-paper flex min-h-screen items-center justify-center">
        <Loader2 className="text-faint h-8 w-8 animate-spin" />
      </main>
    )
  }

  if (success) {
    return (
      <AuthShell back="/login" title="Listo, contraseña cambiada">
        <p className="text-graphite mb-8">En unos segundos te llevamos a la página para entrar.</p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Entrar ahora</Link>
        </Button>
      </AuthShell>
    )
  }

  return (
    <AuthShell back="/login" title="Contraseña nueva" lede="Elige una que recuerdes.">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <Notice>{error}</Notice>}
        <PasswordField
          label="Contraseña nueva"
          hint="Al menos 6 caracteres."
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
        <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar contraseña'}
        </Button>
      </form>
    </AuthShell>
  )
}
