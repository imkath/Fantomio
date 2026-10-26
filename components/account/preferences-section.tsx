'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Notice } from '@/components/auth-shell'
import { Switch } from '@/components/ui/switch'
import { AccountSection, Setting } from '@/components/account/section'
import { createClient } from '@/lib/supabase'
import { getUserFriendlyError } from '@/lib/errors'

const THEMES = [
  { value: 'system', label: 'Como mi dispositivo' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
] as const

type Theme = (typeof THEMES)[number]['value']

export function PreferencesSection({
  userId,
  theme,
  emailNotifications,
}: {
  userId: string
  theme: Theme
  emailNotifications: boolean
}) {
  const { setTheme } = useTheme()
  const [chosen, setChosen] = useState<Theme>(theme)
  const [emails, setEmails] = useState(emailNotifications)
  const [error, setError] = useState('')

  const save = async (fields: Record<string, unknown>) => {
    setError('')
    const { error: dbError } = await createClient().from('profiles').update(fields).eq('id', userId)
    if (dbError) {
      setError(getUserFriendlyError(dbError))
      return false
    }
    return true
  }

  const pickTheme = async (value: Theme) => {
    const previous = chosen
    setChosen(value)
    setTheme(value)
    if (await save({ theme: value })) toast.success('Tema guardado')
    else setChosen(previous)
  }

  const toggleEmails = async (value: boolean) => {
    setEmails(value)
    if (await save({ email_notifications: value }))
      toast.success(value ? 'Avisos por correo activados' : 'Avisos por correo desactivados')
    else setEmails(!value)
  }

  return (
    <AccountSection id="preferencias" title="Preferencias">
      {error && <Notice>{error}</Notice>}

      <Setting
        title="Tema"
        hint="Se aplica cada vez que entras. El botón del sol y la luna lo cambia solo en el dispositivo que estés usando."
      >
        <div role="radiogroup" aria-label="Tema" className="flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={chosen === t.value}
              onClick={() => pickTheme(t.value)}
              className={`min-h-11 rounded-[4px] border px-4 text-[15px] transition-colors ${
                chosen === t.value
                  ? 'border-ink bg-ink text-paper'
                  : 'border-rule hover:border-ink text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Setting>

      <Setting
        title="Avisos por correo"
        hint="Cuando se hace el sorteo, te preguntan algo, te responden o tu amigo secreto cambia su lista. Si los apagas, igual los ves en la campanita."
      >
        <label className="flex items-center gap-3">
          <Switch checked={emails} onCheckedChange={toggleEmails} aria-label="Avisos por correo" />
          <span className="text-[15px]">{emails ? 'Activados' : 'Desactivados'}</span>
        </label>
      </Setting>
    </AccountSection>
  )
}
