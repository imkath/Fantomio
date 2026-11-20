'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Cloudflare Turnstile in front of sign-up, sign-in and password recovery: Supabase Auth checks
// the token, so accounts can't be created or guessed in bulk. "interaction-only" keeps it
// invisible unless Cloudflare needs a click. The site key is public by design.
const SITE_KEY = '0x4AAAAAAGF5PzHOXvV2TQNa'
// Cloudflare's test key always passes; the real one only works on fantomio.com.
const TEST_KEY = '1x00000000000000000000AA'
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (id: string) => void
  remove: (id: string) => void
}
declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let loading: Promise<void> | null = null
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      loading = null
      reject(new Error('turnstile'))
    }
    document.head.appendChild(s)
  })
  return loading
}

// Returns the current token (single use: call reset() after each attempt) and the widget box.
// The widget renders when its box appears, so it also works inside a dialog that opens later.
export function useTurnstile() {
  const id = useRef<string | null>(null)
  const [token, setToken] = useState<string | null>(null)

  const box = useCallback((el: HTMLDivElement | null) => {
    if (!el) {
      if (id.current) window.turnstile?.remove(id.current)
      id.current = null
      setToken(null)
      return
    }
    const local = !window.location.hostname.endsWith('fantomio.com')
    loadScript()
      .then(() => {
        if (!el.isConnected || !window.turnstile || id.current) return
        id.current = window.turnstile.render(el, {
          sitekey: local ? TEST_KEY : SITE_KEY,
          appearance: 'interaction-only',
          theme: 'auto',
          language: 'es',
          callback: (t: string) => setToken(t),
          'expired-callback': () => setToken(null),
          'error-callback': () => setToken(null),
        })
      })
      .catch(() => setToken(null))
  }, [])

  useEffect(
    () => () => {
      if (id.current) window.turnstile?.remove(id.current)
    },
    []
  )

  const reset = useCallback(() => {
    setToken(null)
    if (id.current) window.turnstile?.reset(id.current)
  }, [])

  const widget = <div ref={box} className="empty:hidden" />
  return { token, reset, widget }
}

export const CAPTCHA_WAIT =
  'Estamos comprobando que la conexión es segura. Espera un segundo y vuelve a intentarlo.'
