'use client'

import { useState } from 'react'
import { toast } from 'sonner'

interface GroupInfoCardProps {
  budget: number | null
  currency?: string
  exchangeDate: string | null
  inviteCode?: string
}

export function GroupInfoCard({
  budget,
  currency = 'CLP',
  exchangeDate,
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

  // Parse date string as local date to avoid timezone issues
  // "2024-12-24" should be Dec 24, not Dec 23 due to UTC conversion
  const parseLocalDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  const formatDate = (dateString: string) => {
    const date = parseLocalDate(dateString)
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  }

  const getDaysUntil = (dateString: string) => {
    const date = parseLocalDate(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    date.setHours(0, 0, 0, 0)
    const diffTime = date.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
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

  const days = exchangeDate ? getDaysUntil(exchangeDate) : -1

  return (
    <section className="border-rule bg-slip rounded-[4px] border p-6">
      <dl className="grid gap-4">
        {budget != null && (
          <div>
            <dt className="text-graphite font-mono text-sm">presupuesto</dt>
            <dd className="text-2xl">{formatCurrency(budget, currency)}</dd>
          </div>
        )}
        {exchangeDate && (
          <div>
            <dt className="text-graphite font-mono text-sm">intercambio</dt>
            <dd className="text-xl first-letter:uppercase">{formatDate(exchangeDate)}</dd>
            {days >= 0 && (
              <dd className="text-faint text-sm">
                {days === 0 ? 'es hoy' : days === 1 ? 'mañana' : `en ${days} días`}
              </dd>
            )}
          </div>
        )}
        {inviteCode && (
          <div>
            <dt className="text-graphite font-mono text-sm">código para unirse</dt>
            <dd className="flex items-center gap-3">
              <span className="font-mono text-xl tracking-wider">{inviteCode}</span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="text-graphite hover:text-ink min-h-8 font-mono text-[13px] underline underline-offset-[3px]"
              >
                {codeCopied ? 'copiado' : 'copiar'}
              </button>
            </dd>
          </div>
        )}
      </dl>
    </section>
  )
}
