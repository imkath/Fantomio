'use client'

import { useState } from 'react'

// Profile picture: the Google photo when there is one, otherwise a ghost drawn from the logo's
// body with its own eyes, held item and background, picked from the person's id so it never
// changes between visits. The logo itself (components/ghost-mark.tsx) is left untouched.

const TINTS = ['#dde7f0', '#e0ebdd', '#e9e3f2', '#f2e4da', '#dcecec', '#e9e9e4']

const EYES = [
  // dots, like the logo
  <g key="e0" fill="#1b1b1a">
    <circle cx="15" cy="19.5" r="1.8" />
    <circle cx="24" cy="19.5" r="1.8" />
  </g>,
  // smiling
  <path key="e1" d="M12.8 20.6q2.2-2.8 4.4 0M21.8 20.6q2.2-2.8 4.4 0" />,
  // wink
  <g key="e2">
    <circle cx="15" cy="19.5" r="1.8" fill="#1b1b1a" stroke="none" />
    <path d="M22 19.8h4.2" />
  </g>,
  // looking aside
  <g key="e3" fill="#1b1b1a">
    <circle cx="17.2" cy="19.5" r="1.8" />
    <circle cx="26.2" cy="19.5" r="1.8" />
  </g>,
]

const ITEMS = [
  // folded slip, like the logo
  <path key="i0" d="M23 27l9-2 1.6 7-9 2z" fill="#ffffff" />,
  null,
  // small gift
  <g key="i2">
    <path d="M22.5 27h9v7.5h-9z" fill="#ffffff" />
    <path d="M27 27v7.5M22.5 30.4h9M27 27c-1.6-2.6-4-1.6-2.6 0M27 27c1.6-2.6 4-1.6 2.6 0" />
  </g>,
]

function hash(text: string) {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function GhostAvatar({
  seed,
  src,
  size = 40,
  className = '',
}: {
  seed: string
  src?: string | null
  size?: number
  className?: string
}) {
  const [broken, setBroken] = useState(false)
  const box = `inline-grid shrink-0 place-items-center overflow-hidden rounded-full ${className}`
  const style = { width: size, height: size }

  if (src && !broken) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={`${box} bg-slip object-cover`}
        style={style}
      />
    )
  }

  const h = hash(seed)
  return (
    <span
      className={box}
      style={{ ...style, backgroundColor: TINTS[h % TINTS.length] }}
      aria-hidden="true"
    >
      <svg
        // Square box around the body (x 6-34, y 5-42) so the ghost sits in the middle.
        viewBox="0 3.5 40 40"
        style={{ width: '64%', height: '64%' }}
        fill="none"
        stroke="#1b1b1a"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M6 42V19a14 14 0 0 1 28 0v23l-4.6-3.6L24.6 42 20 38.4 15.4 42l-4.6-3.6Z"
          fill="#ffffff"
        />
        {EYES[Math.floor(h / 7) % EYES.length]}
        {ITEMS[Math.floor(h / 29) % ITEMS.length]}
      </svg>
    </span>
  )
}
