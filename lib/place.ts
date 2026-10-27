// Where the exchange happens: in person (a name and an address) or online (a call link). The map
// is a plain Google Maps URL, which needs no API key and costs nothing
// (developers.google.com/maps/documentation/urls). Nothing here checks an address against a
// service: the organizer opens the map before saving and sees where the pin lands.

export type PlaceKind = 'in_person' | 'online'

export interface Place {
  kind: PlaceKind
  name: string | null
  detail: string | null
}

// Lengths the database enforces too (20261028100000_group_place.sql).
export const PLACE_NAME_MAX = 80
export const PLACE_DETAIL_MAX = 300

const MAPS_HOSTS =
  /^(?:www\.)?(?:google\.[a-z.]+|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl)$/i

// "meet.google.com/abc" or "https://meet..." both become an https URL; anything that is not a
// web address comes back null.
export function normalizeLink(raw: string): string | null {
  const text = raw.trim()
  if (!text) return null
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (!url.hostname.includes('.')) return null
    url.protocol = 'https:'
    return url.toString()
  } catch {
    return null
  }
}

// A Google Maps link pasted as the address is used as is, so the pin is exactly the one chosen.
export function isMapsLink(text: string): boolean {
  const link = normalizeLink(text)
  if (!link) return false
  const url = new URL(link)
  return (
    MAPS_HOSTS.test(url.hostname) &&
    (url.hostname.includes('goo.gl') || url.pathname.startsWith('/maps'))
  )
}

export function mapsUrl(name: string | null, address: string): string {
  if (isMapsLink(address)) return normalizeLink(address)!
  // The address alone finds the place best; the name helps when it is a venue ("Café Literario").
  const query = address.trim() || (name ?? '').trim()
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

const SERVICES: Array<[RegExp, string]> = [
  [/(^|\.)meet\.google\.com$/, 'Google Meet'],
  [/(^|\.)zoom\.(us|com)$/, 'Zoom'],
  [/(^|\.)discord\.(gg|com)$/, 'Discord'],
  [/(^|\.)teams\.(microsoft|live)\.com$/, 'Teams'],
  [/(^|\.)meet\.jit\.si$/, 'Jitsi'],
  [/(^|\.)whereby\.com$/, 'Whereby'],
  [/(^|\.)(wa\.me|chat\.whatsapp\.com)$/, 'WhatsApp'],
  [/(^|\.)(t\.me|telegram\.me)$/, 'Telegram'],
]

// "Entrar por Zoom" reads better than a raw link; unknown hosts just say "Entrar".
export function serviceName(link: string): string | null {
  try {
    const host = new URL(link).hostname.toLowerCase()
    return SERVICES.find(([re]) => re.test(host))?.[1] ?? null
  } catch {
    return null
  }
}
