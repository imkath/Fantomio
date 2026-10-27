'use client'

import { groupPath } from '@/lib/routes'
import { ModePicker, type GroupMode } from '@/components/group/mode-picker'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Notice } from '@/components/auth-shell'
import { createClient, getSessionUser } from '@/lib/supabase'
import { getUserFriendlyError } from '@/lib/errors'
import { deviceCurrency } from '@/lib/currency'
import { todayIn } from '@/lib/utils'

// Create a group, from the "Crear grupo" modal in the dashboard.

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

export function NewGroupForm({
  onDirtyChange,
}: {
  // Lets the dashboard modal ask before throwing away what was typed.
  onDirtyChange?: (dirty: boolean) => void
} = {}) {
  const router = useRouter()
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [budget, setBudget] = useState('')
  // Preselected from the device's country (lib/currency.ts); the select still changes it.
  const [currency, setCurrency] = useState<string>(deviceCurrency)
  const [eventDate, setEventDate] = useState('')
  const [mode, setMode] = useState<GroupMode>('classic')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    nameInputRef.current?.focus()
  }, [])

  const dirty = !!(name.trim() || budget || eventDate)
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // The button is never disabled: tapping it without a name says what's missing.
    if (!name.trim()) {
      setError('Ponle un nombre al grupo para crearlo.')
      nameInputRef.current?.focus()
      nameInputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return
    }
    setIsLoading(true)
    setError('')

    const supabase = createClient()

    try {
      // Get current user
      const user = await getSessionUser()
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
          mode,
          // The calendar the exchange date belongs to (see group_today in the database).
          time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Santiago',
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

      router.push(groupPath(group.id))
    } catch (err) {
      setError(getUserFriendlyError(err as { code?: string; message?: string }))
      setIsLoading(false)
    }
  }

  const selectedCurrency = currencies.find((c) => c.code === currency)

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
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
            onChange={(e) => {
              setName(e.target.value)
              if (error && e.target.value.trim()) setError('')
            }}
            aria-invalid={!!error && !name.trim()}
          />
        </div>

        {/* Side by side on wide screens; stacked on phones. */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="grid content-start gap-1.5">
            <label htmlFor="group-budget" className="text-[15px] font-medium">
              Presupuesto por regalo
            </label>
            <div className="flex gap-2">
              <select
                aria-label="Moneda"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="border-input bg-paper text-ink focus-visible:border-ink h-11 rounded-[8px] border px-3 text-base outline-none"
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

          <div className="grid content-start gap-1.5">
            <label htmlFor="group-date" className="text-[15px] font-medium">
              Día del intercambio
            </label>
            <Input
              id="group-date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              min={todayIn()}
            />
          </div>
        </div>

        <ModePicker value={mode} onChange={setMode} />
      </div>

      {/* Always visible, whatever the screen size or how far the fields scrolled. */}
      <div className="border-rule bg-background flex shrink-0 border-t px-6 py-4 md:justify-end">
        <Button type="submit" size="lg" className="w-full md:w-auto" disabled={isLoading}>
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
      </div>
    </form>
  )
}
