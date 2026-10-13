'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  // The theme is only known on the client; render a neutral label until then.
  useEffect(() => setMounted(true), [])
  const dark = mounted && resolvedTheme === 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      className="border-rule text-graphite hover:border-ink hover:text-ink inline-flex min-h-11 items-center gap-2 rounded-full border bg-transparent px-4 text-[15px] transition-colors"
      aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
        <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 1.8a6.2 6.2 0 0 1 0 12.4Z" fill="currentColor" />
      </svg>
      <span>{dark ? 'Tema claro' : 'Tema oscuro'}</span>
    </button>
  )
}
