'use client'

import { useState } from 'react'
import { Banknote, CalendarDays, Check, Copy, Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { daysBetween, parseLocalDate, todayIn } from '@/lib/utils'

interface GroupInfoCardProps {
  budget: number | null
  currency?: string
  exchangeDate: string | null
  // The group's time zone, so "Es hoy" flips at midnight on the group's calendar.
  timeZone?: string
  inviteCode?: string
}

export function GroupInfoCard({
  budget,
  currency = 'CLP',
  exchangeDate,
  timeZone,
  inviteCode,
}: GroupInfoCardProps) {
  const [codeCopied, setCodeCopied] = useState(false)

  if (budget == null && !exchangeDate && !inviteCode) return null

  const handleCopyCode = async () => {
    if (!inviteCode) return
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCodeCopied(true)
      toast.success('Código copiado')
      setTimeout(() => setCodeCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  const formatDate = (dateString: string) => {
    const date = parseLocalDate(dateString)
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  }

  const formatCurrency = (amount: number, currencyCode: string) => {
    // Map currency codes to their symbols
    const currencySymbols: Record<string, string> = {
      CLP: '$',
      USD: 'US$',
      EUR: '€',
      MXN: 'MX$',
      ARS: 'AR$',
      COP: 'COL$',
      PEN: 'S/',
      BRL: 'R$',
      GBP: '£',
    }

    const symbol = currencySymbols[currencyCode] || currencyCode

    // Format number with locale-specific separators
    const formattedAmount = amount.toLocaleString('es-CL', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })

    return `${symbol}${formattedAmount}`
  }

  const days = exchangeDate ? daysBetween(todayIn(timeZone), exchangeDate) : -1

  return (
    <section className="border-rule bg-slip rounded-[4px] border p-6">
      <dl className="grid gap-5">
        {budget != null && (
          <div className="flex gap-4">
            <span
              className="bg-paper border-rule text-ink grid size-10 shrink-0 place-items-center rounded-full border"
              aria-hidden="true"
            >
              <Banknote className="size-5" />
            </span>
            <div>
              <dt className="text-graphite text-[15px]">Presupuesto</dt>
              <dd className="text-2xl">{formatCurrency(budget, currency)}</dd>
            </div>
          </div>
        )}
        {exchangeDate && (
          <div className="flex gap-4">
            <span
              className="bg-paper border-rule text-ink grid size-10 shrink-0 place-items-center rounded-full border"
              aria-hidden="true"
            >
              <CalendarDays className="size-5" />
            </span>
            <div>
              <dt className="text-graphite text-[15px]">Intercambio</dt>
              <dd className="text-xl first-letter:uppercase">{formatDate(exchangeDate)}</dd>
              {days >= 0 && (
                <dd className="text-graphite text-[15px]">
                  {days === 0 ? 'Es hoy' : days === 1 ? 'Mañana' : `Faltan ${days} días`}
                </dd>
              )}
            </div>
          </div>
        )}
        {inviteCode && (
          <div className="flex gap-4">
            <span
              className="bg-paper border-rule text-ink grid size-10 shrink-0 place-items-center rounded-full border"
              aria-hidden="true"
            >
              <Hash className="size-5" />
            </span>
            <div>
              <dt className="text-graphite text-[15px]">Código para unirse</dt>
              <dd className="flex flex-wrap items-center gap-3">
                <span className="font-detail text-xl tracking-wider">{inviteCode}</span>
                <Button variant="outline" size="sm" onClick={handleCopyCode}>
                  {codeCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                  {codeCopied ? 'Copiado' : 'Copiar'}
                </Button>
              </dd>
            </div>
          </div>
        )}
      </dl>
    </section>
  )
}
