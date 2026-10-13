'use client'

import { useState } from 'react'
import { Shuffle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GhostAvatar } from '@/components/ghost-avatar'
import { generateDerangement } from '@/lib/derangement'
import { celebrate } from '@/lib/confetti'
import styles from './draw-demo.module.css'

// A pretend draw with the app's own algorithm, so people see what happens: everyone gets
// someone and nobody gets themselves. In the app each person only sees their own slip.
const PEOPLE = ['Ana', 'Tomás', 'Javiera', 'Luis', 'Carmen', 'Pedro']
const SLIPS = ['#fde3c8', '#d9e8f7', '#d9efdf', '#f9dbe4', '#fbedc2', '#e6e1f5']
const TILT = [-2.5, 1.5, -1, 2.5, -2, 1]

export function DrawDemo() {
  const [phase, setPhase] = useState<'idle' | 'mixing' | 'done'>('idle')
  const [receivers, setReceivers] = useState<string[]>([])

  const draw = () => {
    setPhase('mixing')
    window.setTimeout(() => {
      setReceivers(generateDerangement(PEOPLE) ?? [])
      setPhase('done')
      celebrate()
    }, 1100)
  }

  return (
    <div className={styles.panel}>
      <ul className={styles.people} aria-label="Participantes de ejemplo">
        {PEOPLE.map((name, i) => (
          <li
            key={name}
            className={phase === 'mixing' ? styles.mixing : undefined}
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <GhostAvatar seed={`demo-${name}`} size={64} />
            <span>{name}</span>
          </li>
        ))}
      </ul>

      <div className={styles.action}>
        <Button size="lg" onClick={draw} disabled={phase === 'mixing'}>
          <Shuffle aria-hidden="true" />
          {phase === 'idle' ? 'Sortear' : phase === 'mixing' ? 'Sorteando…' : 'Sortear de nuevo'}
        </Button>
      </div>

      {phase === 'done' && (
        <>
          <ol className={styles.slips} aria-live="polite">
            {PEOPLE.map((giver, i) => (
              <li
                key={`${giver}-${receivers[i]}`}
                className={styles.slip}
                style={
                  {
                    background: SLIPS[i],
                    '--tilt': `${TILT[i]}deg`,
                    animationDelay: `${i * 90}ms`,
                  } as React.CSSProperties
                }
              >
                <GhostAvatar seed={`demo-${giver}`} size={36} />
                <span>
                  <b>{giver}</b> le regala a <b>{receivers[i]}</b>
                </span>
              </li>
            ))}
          </ol>
          <p className={styles.note}>
            Nadie se sacó a sí mismo. En la app, cada persona ve solo su papelito.
          </p>
        </>
      )}
    </div>
  )
}
