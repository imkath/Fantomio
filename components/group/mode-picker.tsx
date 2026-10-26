'use client'

export type GroupMode = 'classic' | 'blind'

const MODES: Array<{ value: GroupMode; title: string; text: string }> = [
  {
    value: 'classic',
    title: 'Clásico',
    text: 'Después del sorteo cada persona ve a quién le regala y su lista.',
  },
  {
    value: 'blind',
    title: 'A ciegas',
    text: 'Cada persona ve solo una lista, sin nombre. El día del intercambio intentan adivinar de quién es antes de revelarlo. Todos tienen que anotar su lista antes del sorteo.',
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
            className={`rounded-[4px] border p-4 text-left transition-colors disabled:opacity-60 ${
              value === m.value ? 'border-ink bg-slip' : 'border-rule hover:border-ink'
            }`}
          >
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
