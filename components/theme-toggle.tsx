'use client'

import { useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'

// A day/night switch: a sky track with the sun on the left and the moon on the right, and the
// ghost rolling over the side that is not active, so the visible icon is the current theme.
//
// Where everything sits comes from CSS (.theme-switch in globals.css) reading the theme class
// the <head> script already put on <html>, so the switch paints in place on load and doesn't
// animate into position. `target` only exists while it slides after a click: the layout swaps
// themes with transitions off, so the theme changes once the ghost has arrived.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [target, setTarget] = useState<'light' | 'dark' | null>(null)
  const busy = useRef(false)

  const toggle = () => {
    if (busy.current) return
    busy.current = true
    const dark = document.documentElement.classList.contains('dark')
    const next = dark ? 'light' : 'dark'
    setTarget(next)
    window.setTimeout(() => setTheme(next), 540)
    // Let go of the override only after the theme class has caught up, so nothing jumps.
    window.setTimeout(() => {
      setTarget(null)
      busy.current = false
    }, 700)
  }

  const label =
    (target ?? resolvedTheme) === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={(target ?? resolvedTheme) === 'dark'}
      aria-label="Tema oscuro"
      title={label}
      onClick={toggle}
      data-target={target ?? undefined}
      className="theme-switch group relative h-10 w-[76px] shrink-0 overflow-hidden rounded-full shadow-[inset_0_1px_3px_rgba(0,0,0,0.18)] active:scale-95"
    >
      <span className="sky-day" aria-hidden="true" />
      <span className="sky-night" aria-hidden="true" />
      <Sun className="sun" aria-hidden="true" />
      <Moon className="moon" aria-hidden="true" />
      <span className="knob" aria-hidden="true">
        <svg
          viewBox="0 0 40 46"
          className="h-[18px] w-[16px] transition-transform duration-300 group-hover:-translate-y-0.5"
          fill="none"
          stroke="#1b1b1a"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 42V19a14 14 0 0 1 28 0v23l-4.6-3.6L24.6 42 20 38.4 15.4 42l-4.6-3.6Z" />
          <path d="M23 27l9-2 1.6 7-9 2z" />
          <circle cx="15" cy="19.5" r="1.8" fill="#1b1b1a" stroke="none" />
          <circle cx="24" cy="19.5" r="1.8" fill="#1b1b1a" stroke="none" />
        </svg>
      </span>
    </button>
  )
}
