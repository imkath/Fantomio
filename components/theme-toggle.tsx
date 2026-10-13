'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'

// A day/night switch: a sky track with the sun on the left and the moon on the right, and the
// ghost rolling over the side that is not active, so the visible icon is the current theme.
// Its colours are fixed on purpose: it's a little object, like the phone in the landing.
// Smooth start, soft overshoot at the end.
const EASE = 'cubic-bezier(0.45, 0, 0.2, 1.25)'
const STARS =
  'radial-gradient(1.2px 1.2px at 14px 9px, #fff 99%, transparent), radial-gradient(1px 1px at 24px 26px, #fff 99%, transparent), radial-gradient(1.4px 1.4px at 34px 14px, #fff 99%, transparent), radial-gradient(1px 1px at 9px 22px, #fff 99%, transparent)'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  // The theme is only known on the client; render the day position until then.
  useEffect(() => setMounted(true), [])
  const themeDark = mounted && resolvedTheme === 'dark'

  // The layout swaps themes with transitions disabled (next-themes disableTransitionOnChange),
  // which would freeze the ghost mid-slide. So the switch animates on its own state first and
  // the theme changes once the ghost has arrived.
  const [dark, setDark] = useState(themeDark)
  useEffect(() => setDark(themeDark), [themeDark])
  const toggle = () => {
    const next = !dark
    setDark(next)
    window.setTimeout(() => setTheme(next ? 'dark' : 'light'), 540)
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Tema oscuro"
      title={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      onClick={toggle}
      className="group relative h-10 w-[76px] shrink-0 overflow-hidden rounded-full shadow-[inset_0_1px_3px_rgba(0,0,0,0.18)] transition-transform active:scale-95 motion-reduce:*:!transition-none"
    >
      {/* day and night skies cross-fade, since gradients themselves can't animate */}
      <span
        className="absolute inset-0 transition-opacity duration-500"
        style={{
          background: 'linear-gradient(120deg, #9fd3f2 0%, #cfe9f7 55%, #fde6a8 100%)',
          opacity: dark ? 0 : 1,
        }}
        aria-hidden="true"
      />
      <span
        className="absolute inset-0 transition-opacity duration-500"
        style={{
          backgroundImage: `${STARS}, linear-gradient(120deg, #141b34 0%, #26305a 60%, #3b3f73 100%)`,
          opacity: dark ? 1 : 0,
        }}
        aria-hidden="true"
      />
      <Sun
        className="absolute top-1/2 left-[11px] size-[19px]"
        style={{
          color: '#e8962e',
          fill: '#f6c453',
          transition: `opacity 400ms, transform 600ms ${EASE}`,
          opacity: dark ? 0 : 1,
          transform: `translateY(-50%) rotate(${dark ? -90 : 0}deg) scale(${dark ? 0.5 : 1})`,
        }}
        aria-hidden="true"
      />
      <Moon
        className="absolute top-1/2 right-[11px] size-[18px]"
        style={{
          color: '#f3d36b',
          fill: '#f7e08f',
          transition: `opacity 400ms, transform 600ms ${EASE}`,
          opacity: dark ? 1 : 0,
          transform: `translateY(-50%) rotate(${dark ? 0 : 90}deg) scale(${dark ? 1 : 0.5})`,
        }}
        aria-hidden="true"
      />
      <span
        className="absolute top-1 left-1 grid size-8 place-items-center rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.25)]"
        style={{
          transition: `transform 520ms ${EASE}`,
          transform: dark ? 'translateX(0) rotate(-360deg)' : 'translateX(36px) rotate(0deg)',
        }}
        aria-hidden="true"
      >
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
