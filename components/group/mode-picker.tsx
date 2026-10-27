'use client'

import type React from 'react'
import { GhostMark } from '@/components/ghost-mark'

export type GroupMode = 'classic' | 'blind'

// Tints from the confetti palette (lib/confetti.ts): warm for classic, blue for blind. Only
// backgrounds and borders take the color; text and the ghost stay in ink for contrast.
const MODES: Array<{ value: GroupMode; title: string; text: string; hue: string }> = [
  {
    value: 'classic',
    hue: '#e8a33d',
    title: 'Clásico',
    text: 'Sabes a quién le regalas y qué le gustaría.',
  },
  {
    value: 'blind',
    hue: '#3f7cc4',
    title: 'A ciegas',
    text: 'Te toca una lista sin nombre. El día del regalo adivinan de quién es.',
  },
]

// The kind of secret santa, chosen when creating the group and changeable until the draw.
export function ModePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: GroupMode
  onChange: (mode: GroupMode) => void
  disabled?: boolean
}) {
  return (
    <fieldset className="grid gap-1.5" disabled={disabled}>
      <legend className="mb-1.5 text-[15px] font-medium">Tipo de amigo secreto</legend>
      <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={value === m.value}
            onClick={() => onChange(m.value)}
            className="mode-card flex flex-col items-start justify-start rounded-[4px] border p-4 text-left transition-colors disabled:opacity-60"
            style={{ '--tint': m.hue } as React.CSSProperties}
          >
            <GhostMark
              blindfold={m.value === 'blind'}
              filled={value === m.value}
              bandColor={value === m.value ? m.hue : undefined}
              className="text-ink mb-3 h-[38px] w-[33px]"
            />
            <span className="block font-bold">{m.title}</span>
            <span className="text-graphite mt-1 block text-sm leading-snug">{m.text}</span>
          </button>
        ))}
      </div>
      {disabled && (
        <p className="text-graphite text-sm">Ya se hizo el sorteo, así que no se puede cambiar.</p>
      )}
    </fieldset>
  )
}
