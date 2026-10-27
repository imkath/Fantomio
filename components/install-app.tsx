'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
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
    <div className="border-rule bg-slip mb-8 flex items-start gap-3 rounded-[4px] border p-4">
      <Download aria-hidden="true" className="text-ink mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">Ten Fantomio a mano, como una app</p>
        {mode === 'ios' ? (
          <p className="text-graphite text-[15px]">
            Toca Compartir en Safari y después &quot;Agregar a inicio&quot;.
          </p>
        ) : (
          <Button size="sm" variant="outline" className="mt-2" onClick={install}>
            Instalar Fantomio
          </Button>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Ahora no"
        className="text-graphite hover:text-ink -m-2 flex h-11 w-11 items-center justify-center"
      >
        <X aria-hidden="true" className="h-5 w-5" />
      </button>
    </div>
  )
}
