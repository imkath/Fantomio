'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AppHeader } from '@/components/app-header'
import { Loader2, Plus } from 'lucide-react'
import { Notice } from '@/components/auth-shell'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { BackLink } from '@/components/back-link'
import { createClient } from '@/lib/supabase'
import { getUserFriendlyError } from '@/lib/errors'

const currencies = [
  { code: 'CLP', symbol: '$', name: 'Peso chileno', defaultBudget: '15000' },
  { code: 'USD', symbol: '$', name: 'Dólar estadounidense', defaultBudget: '15' },
  { code: 'EUR', symbol: '€', name: 'Euro', defaultBudget: '15' },
  { code: 'MXN', symbol: '$', name: 'Peso mexicano', defaultBudget: '300' },
  { code: 'ARS', symbol: '$', name: 'Peso argentino', defaultBudget: '15000' },
  { code: 'COP', symbol: '$', name: 'Peso colombiano', defaultBudget: '60000' },
  { code: 'PEN', symbol: 'S/', name: 'Sol peruano', defaultBudget: '60' },
  { code: 'BRL', symbol: 'R$', name: 'Real brasileño', defaultBudget: '80' },
  { code: 'GBP', symbol: '£', name: 'Libra esterlina', defaultBudget: '12' },
]

export default function NewGroupPage() {
  const router = useRouter()
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [budget, setBudget] = useState('')
  const [currency, setCurrency] = useState('CLP')
  const [eventDate, setEventDate] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setIsCheckingAuth(false)
      // Auto-focus name input after auth check
      setTimeout(() => nameInputRef.current?.focus(), 100)
    }
    checkAuth()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const supabase = createClient()

    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Create group
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({
          name,
          admin_id: user.id,
          budget: budget ? parseFloat(budget) : null,
          currency,
          exchange_date: eventDate || null,
        })
        .select()
        .single()

      if (groupError) {
        setError(getUserFriendlyError(groupError))
        setIsLoading(false)
        return
      }

      // Add creator as member (admin)
      const { error: memberError } = await supabase.from('members').insert({
        group_id: group.id,
        user_id: user.id,
        is_admin: true,
      })

      if (memberError) {
        setError(getUserFriendlyError(memberError))
        setIsLoading(false)
        return
      }

      // Log activity
      await supabase.from('activities').insert({
        group_id: group.id,
        user_id: user.id,
        type: 'GROUP_CREATED',
        message: `Grupo "${name}" creado`,
      })

      router.push(`/groups/${group.id}`)
    } catch (err) {
      setError(getUserFriendlyError(err as { code?: string; message?: string }))
      setIsLoading(false)
    }
  }

  if (isCheckingAuth) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <Loader2 className="text-faint h-8 w-8 animate-spin" />
      </div>
    )
  }

  const selectedCurrency = currencies.find((c) => c.code === currency)

  return (
    <div className="bg-paper text-ink min-h-screen">
      <AppHeader />

      <main className="mx-auto max-w-[560px] px-4 py-10 md:py-16">
        <BackLink />

        <h1 className="mt-8 mb-2 text-[34px] leading-tight font-light md:text-[40px]">
          Crear grupo
        </h1>
        <p className="text-graphite mb-8">
          Solo el nombre es obligatorio. Lo demás lo puedes cambiar después.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <Notice>{error}</Notice>}

          <div className="grid gap-1.5">
            <label htmlFor="group-name" className="text-[15px] font-medium">
              Nombre del grupo
            </label>
            <Input
              id="group-name"
              ref={nameInputRef}
              placeholder="Navidad familia 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="group-budget" className="text-[15px] font-medium">
              Presupuesto por regalo
            </label>
            <div className="flex gap-2">
              <select
                aria-label="Moneda"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="border-input bg-paper text-ink focus-visible:border-ink h-11 rounded-[2px] border px-3 text-base outline-none"
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
              <Input
                id="group-budget"
                type="number"
                inputMode="numeric"
                min="0"
                placeholder={selectedCurrency?.defaultBudget || '15000'}
                className="flex-1"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>
            {selectedCurrency && <p className="text-faint text-sm">{selectedCurrency.name}</p>}
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="group-date" className="text-[15px] font-medium">
              Día del intercambio
            </label>
            <Input
              id="group-date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={isLoading || !name.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" />
                Creando…
              </>
            ) : (
              <>
                <Plus aria-hidden="true" />
                Crear grupo
              </>
            )}
          </Button>
        </form>
      </main>
    </div>
  )
}
