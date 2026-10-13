'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './steps-story.module.css'

// "Cómo se arma" as three small hand-drawn scenes with the hero's line style. The strokes
// draw themselves the first time the section scrolls into view.
const GHOST = 'M6 42V19a14 14 0 0 1 28 0v23l-4.6-3.6L24.6 42 20 38.4 15.4 42l-4.6-3.6Z'

function Ghost({
  x,
  y,
  s = 1,
  flip = false,
}: {
  x: number
  y: number
  s?: number
  flip?: boolean
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <path d={GHOST} pathLength={1} vectorEffect="non-scaling-stroke" />
      <circle className={styles.eye} cx="15" cy="19.5" r="1.9" />
      <circle className={styles.eye} cx="24" cy="19.5" r="1.9" />
    </g>
  )
}

const SCENES = [
  // 1. A ghost writes the group's name on a slip.
  <svg key="1" viewBox="0 0 220 150" aria-hidden="true">
    <Ghost x={22} y={22} s={2.2} />
    <path d="M118 52l70-10 9 62-70 10z" pathLength={1} />
    <path d="M134 70c10-3 20 2 30-2s14 0 18-2" pathLength={1} />
    <path d="M137 86c8-2 16 1 24-1" pathLength={1} />
    <path d="M96 96l34-30 6 6-34 30-9 3z" pathLength={1} />
  </svg>,
  // 2. The slip flies off as a paper plane, trailing a loop.
  <svg key="2" viewBox="0 0 220 150" aria-hidden="true">
    <Ghost x={14} y={40} s={2} />
    <path d="M96 92c18-26 40-6 30 8s-30-2-10-22 46-34 66-38" pathLength={1} />
    <path d="M176 32l32-10-16 30-6-12z M186 40l22-18" pathLength={1} />
  </svg>,
  // 3. Two ghosts swap slips.
  <svg key="3" viewBox="0 0 220 150" aria-hidden="true">
    <Ghost x={12} y={36} s={1.9} />
    <Ghost x={208} y={36} s={1.9} flip />
    <path d="M86 58l22-4 3 15-22 4z" pathLength={1} />
    <path d="M112 92l22-4 3 15-22 4z" pathLength={1} />
    <path d="M96 48c14-16 34-16 46-2 M138 50l5-5 1 8" pathLength={1} />
    <path d="M128 118c-14 14-34 14-46 0 M86 116l-5 5-1-8" pathLength={1} />
  </svg>,
]

export function StepsStory({ steps }: { steps: Array<{ title: string; text: string }> }) {
  const ref = useRef<HTMLOListElement>(null)
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true)
          io.disconnect()
        }
      },
      { threshold: 0.3 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <ol ref={ref} className={`${styles.steps} ${seen ? styles.seen : ''}`}>
      {steps.map((step, i) => (
        <li key={step.title} className={styles.step} style={{ '--i': i } as React.CSSProperties}>
          <div className={styles.scene}>{SCENES[i]}</div>
          <span className={styles.n}>{String(i + 1).padStart(2, '0')}</span>
          <h3>{step.title}</h3>
          <p>{step.text}</p>
        </li>
      ))}
    </ol>
  )
}
