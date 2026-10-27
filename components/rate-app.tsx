'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const DISMISSED = 'fantomio:rate-dismissed'

// Asks once, after someone has seen their match, how Fantomio worked for them. Stars only, one
// rating per account. It hides for good after rating or after "Ahora no".
export function RateApp() {
  const [state, setState] = useState<'hidden' | 'ask' | 'saving' | 'thanks'>('hidden')
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED)) return
    } catch {
      // No storage: ask anyway, the rating itself is what counts.
    }
    createClient()
      .rpc('my_app_rating')
      .then(({ data, error: rpcError }) => {
        if (!rpcError && data == null) setState('ask')
      })
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED, '1')
    } catch {
      // Nothing to remember it in; it will ask again next time.
    }
    setState('hidden')
  }

  const rate = async (stars: number) => {
    setState('saving')
    setError('')
    const { error: rpcError } = await createClient().rpc('rate_app', { p_stars: stars })
    if (rpcError) {
      setError('No pudimos guardar tu nota. Intenta de nuevo.')
      setState('ask')
      return
    }
    setState('thanks')
  }

  if (state === 'hidden') return null

  return (
    <section className="border-rule rounded-[4px] border px-6 py-5" aria-live="polite">
      {state === 'thanks' ? (
        <p className="text-graphite">Gracias. Nos ayuda a que más gente encuentre Fantomio.</p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">¿Qué te pareció Fantomio?</h2>
            <p className="text-graphite text-[15px]">Toca una nota de 1 a 5.</p>
          </div>
          <div className="flex items-center gap-1" role="group" aria-label="Nota de 1 a 5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                disabled={state === 'saving'}
                onClick={() => rate(n)}
                className="hover:border-ink border-rule flex h-11 min-w-11 items-center justify-center rounded-[2px] border px-3 text-lg font-medium"
                aria-label={`${n} de 5`}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={dismiss}
              className="text-graphite ml-2 min-h-11 px-2 text-[15px] underline underline-offset-[3px]"
            >
              Ahora no
            </button>
          </div>
          {error && <p className="text-destructive w-full text-[15px]">{error}</p>}
        </div>
      )}
    </section>
  )
}
