'use client'

import { useEffect, useState } from 'react'

// Each word starts as a derangement of its letters (no letter in its own place, the
// same rule as the draw) and settles one letter at a time.
//
// The real word is the only text in the HTML, so search engines and screen readers read
// "Amigo Secreto" once. While it moves, the word turns transparent (keeping its width, so
// the heading never changes size) and the shuffled letters are painted over it by
// .scramble-word::after in globals.css, marked as decorative.
function derange(letters: string[]): string[] {
  let order: number[]
  do {
    order = letters.map((_, i) => i).sort(() => Math.random() - 0.5)
  } while (order.some((v, i) => v === i))
  return order.map((i) => letters[i]!)
}

function ScrambledWord({ word }: { word: string }) {
  const [shown, setShown] = useState<string | null>(null)

  useEffect(() => {
    if (word.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const target = [...word]
    const current = derange(target)
    const order = target.map((_, i) => i).sort(() => Math.random() - 0.5)
    let step = 0
    setShown(current.join(''))
    const timer = setInterval(() => {
      const i = order[step]!
      current[i] = target[i]!
      if (++step >= order.length) {
        clearInterval(timer)
        setShown(null)
      } else {
        setShown(current.join(''))
      }
    }, 90)
    return () => clearInterval(timer)
  }, [word])

  return (
    <span className="scramble-word" data-shown={shown ?? undefined}>
      {word}
    </span>
  )
}

export function ScrambleTitle({ text = 'Amigo Secreto' }: { text?: string }) {
  const words = text.split(' ')
  return (
    <span className="font-bold">
      {words.map((w, i) => (
        <span key={i}>
          <ScrambledWord word={w} />
          {i < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </span>
  )
}
