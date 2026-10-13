'use client'

import { useEffect, useState } from 'react'

// Each word starts as a derangement of its letters (no letter in its own place, the
// same rule as the draw) and settles one letter at a time. The final spelling is
// laid out invisibly underneath, so the heading never changes size while it moves.
function derange(letters: string[]): string[] {
  let order: number[]
  do {
    order = letters.map((_, i) => i).sort(() => Math.random() - 0.5)
  } while (order.some((v, i) => v === i))
  return order.map((i) => letters[i]!)
}

function ScrambledWord({ word }: { word: string }) {
  const [shown, setShown] = useState(word)

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
      setShown(current.join(''))
      if (++step >= order.length) clearInterval(timer)
    }, 90)
    return () => clearInterval(timer)
  }, [word])

  return (
    <span className="relative inline-block whitespace-nowrap" aria-hidden="true">
      <span className="invisible">{word}</span>
      <span className="absolute top-0 left-0">{shown}</span>
    </span>
  )
}

export function ScrambleTitle({ text = 'Amigo Secreto' }: { text?: string }) {
  const words = text.split(' ')
  return (
    // aria-label isn't allowed on a plain span, so screen readers get the real words as
    // hidden text and the scrambling letters are hidden from them.
    <span className="font-bold">
      <span className="sr-only">{text}</span>
      {words.map((w, i) => (
        <span key={i}>
          <ScrambledWord word={w} />
          {i < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </span>
  )
}
