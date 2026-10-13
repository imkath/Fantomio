'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  // The theme is only known on the client; render a neutral label until then.
  useEffect(() => setMounted(true), [])
  const dark = mounted && resolvedTheme === 'dark'

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
    >
      {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      <span className={compact ? 'sr-only md:not-sr-only' : undefined}>
        {dark ? 'Tema claro' : 'Tema oscuro'}
      </span>
    </Button>
  )
}
