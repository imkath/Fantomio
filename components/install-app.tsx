'use client'

import { useEffect, useState } from 'react'
import { Share, SquarePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const DISMISSED = 'fantomio:install-dismissed'

// The install event Chrome and Android browsers fire when the site can be installed.
interface InstallPrompt extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// A small, dismissible note on phones offering to add Fantomio to the home screen, so it opens
// like an app. Android and Chrome get the browser's own install dialog; iPhone, which has no such
// dialog, gets the two taps that do it. Hidden on computers, once installed and after "Ahora no".
export function InstallApp() {
  const [mode, setMode] = useState<'hidden' | 'prompt' | 'ios'>('hidden')
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED)) return
    } catch {
      // No storage: still fine to offer it.
    }
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    const phone = window.matchMedia('(pointer: coarse)').matches
    if (standalone || !phone) return

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    if (isIOS) {
      setMode('ios')
      return
    }
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPrompt(e as InstallPrompt)
      setMode('prompt')
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED, '1')
    } catch {
      // Nothing to remember it in.
    }
    setMode('hidden')
  }

  const install = async () => {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setMode('hidden')
  }

  if (mode === 'hidden') return null

  return (
    <div className="border-rule bg-raised relative mb-8 flex items-center gap-4 rounded-[6px] border p-4 pr-12">
      {/* The icon exactly as it lands on the home screen. */}
      <figure className="m-0 flex shrink-0 flex-col items-center gap-1">
        <img
          src="/icon-192.png"
          alt=""
          width={56}
          height={56}
          className="h-14 w-14 rounded-[13px] shadow-[0_1px_2px_rgba(0,0,0,.12),0_6px_14px_-6px_rgba(0,0,0,.35)] ring-1 ring-[var(--rule)]"
        />
        <figcaption className="text-graphite text-[12px] leading-none">Fantomio</figcaption>
      </figure>
      <div className="min-w-0 flex-1">
        <p className="leading-snug font-bold">Agrégalo a tu inicio</p>
        {mode === 'ios' ? (
          <p className="text-graphite mt-1 text-[15px] leading-relaxed">
            Toca{' '}
            <Share aria-label="Compartir" className="inline h-[1.1em] w-[1.1em] align-[-0.2em]" />{' '}
            en Safari y luego{' '}
            <span className="text-ink inline-flex items-center gap-1 font-medium whitespace-nowrap">
              <SquarePlus aria-hidden="true" className="h-[1.1em] w-[1.1em]" />
              Agregar a inicio
            </span>
          </p>
        ) : (
          <>
            <p className="text-graphite mt-0.5 text-[15px]">
              Se abre como una app, a pantalla completa.
            </p>
            <Button size="sm" className="mt-3" onClick={install}>
              Instalar
            </Button>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Ahora no"
        className="text-graphite hover:text-ink absolute top-1 right-1 flex h-11 w-11 cursor-pointer items-center justify-center"
      >
        <X aria-hidden="true" className="h-5 w-5" />
      </button>
    </div>
  )
}
