'use client'

import { ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  PLACE_DETAIL_MAX,
  PLACE_NAME_MAX,
  mapsUrl,
  normalizeLink,
  type PlaceKind,
} from '@/lib/place'

export interface PlaceDraft {
  kind: PlaceKind | null
  name: string
  detail: string
}

const KINDS: Array<{ value: PlaceKind | null; label: string }> = [
  { value: null, label: 'Sin definir' },
  { value: 'in_person', label: 'En persona' },
  { value: 'online', label: 'Online' },
]

// The online link has to be a web address; returns the message to show, or null when fine.
export function placeError(place: PlaceDraft): string | null {
  if (place.kind === 'online' && place.detail.trim() && !normalizeLink(place.detail)) {
    return 'Pega el link de la llamada, por ejemplo meet.google.com/abc-defg-hij'
  }
  return null
}

// What gets saved: trimmed, empty fields as null, the online link normalized to https.
export function placeToSave(place: PlaceDraft) {
  if (!place.kind) return { place_kind: null, place_name: null, place_detail: null }
  const detail = place.detail.trim()
  return {
    place_kind: place.kind,
    place_name: place.name.trim() || null,
    place_detail: place.kind === 'online' ? normalizeLink(detail) : detail || null,
  }
}

export function PlaceFields({
  value,
  onChange,
}: {
  value: PlaceDraft
  onChange: (next: PlaceDraft) => void
}) {
  const error = placeError(value)
  const set = (patch: Partial<PlaceDraft>) => onChange({ ...value, ...patch })

  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1.5 text-[15px] font-medium">Lugar del intercambio</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de lugar">
        {KINDS.map((k) => (
          <button
            key={k.label}
            type="button"
            role="radio"
            aria-checked={value.kind === k.value}
            onClick={() => set({ kind: k.value })}
            className="border-rule aria-checked:border-ink aria-checked:bg-ink aria-checked:text-paper hover:border-ink min-h-10 cursor-pointer rounded-full border px-4 text-[15px] transition-colors"
          >
            {k.label}
          </button>
        ))}
      </div>

      {value.kind === 'in_person' && (
        <>
          <div className="grid gap-1.5">
            <label htmlFor="place-name" className="text-graphite text-sm">
              Nombre (opcional)
            </label>
            <Input
              id="place-name"
              value={value.name}
              maxLength={PLACE_NAME_MAX}
              placeholder="Casa de la abuela"
              onChange={(e) => set({ name: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="place-detail" className="text-graphite text-sm">
              Dirección o link de Google Maps
            </label>
            <Input
              id="place-detail"
              value={value.detail}
              maxLength={PLACE_DETAIL_MAX}
              placeholder="Av. Providencia 1234, Providencia"
              autoComplete="street-address"
              onChange={(e) => set({ detail: e.target.value })}
            />
            {value.detail.trim() ? (
              <p className="text-sm">
                <a
                  href={mapsUrl(value.name, value.detail)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink inline-flex items-center gap-1.5 underline underline-offset-[3px]"
                >
                  Revisar en el mapa
                  <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                </a>
                <span className="text-graphite"> y fíjate que el pin quede donde es.</span>
              </p>
            ) : (
              <p className="text-graphite text-sm">
                Con comuna o ciudad se encuentra mejor. También puedes pegar el link de
                &quot;Compartir&quot; de Google Maps.
              </p>
            )}
          </div>
        </>
      )}

      {value.kind === 'online' && (
        <>
          <div className="grid gap-1.5">
            <label htmlFor="place-name" className="text-graphite text-sm">
              Nombre (opcional)
            </label>
            <Input
              id="place-name"
              value={value.name}
              maxLength={PLACE_NAME_MAX}
              placeholder="Videollamada del viernes"
              onChange={(e) => set({ name: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="place-detail" className="text-graphite text-sm">
              Link de la llamada o del servidor
            </label>
            <Input
              id="place-detail"
              value={value.detail}
              maxLength={PLACE_DETAIL_MAX}
              inputMode="url"
              placeholder="meet.google.com/abc-defg-hij"
              aria-invalid={!!error}
              aria-describedby={error ? 'place-error' : undefined}
              onChange={(e) => set({ detail: e.target.value })}
            />
            {error ? (
              <p id="place-error" className="text-destructive text-sm">
                {error}
              </p>
            ) : (
              <p className="text-graphite text-sm">Meet, Zoom, Discord, Teams o el que usen.</p>
            )}
          </div>
        </>
      )}
    </fieldset>
  )
}
