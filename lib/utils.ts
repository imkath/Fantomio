import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse a date string (YYYY-MM-DD) as a local date to avoid timezone issues.
 * When using new Date("2024-12-24"), JS interprets it as UTC midnight,
 * which can shift the date backward in negative UTC offset timezones.
 */
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Format a date string (YYYY-MM-DD) for display without timezone issues.
 */
export function formatLocalDate(dateString: string, locale = 'es-ES'): string {
  return parseLocalDate(dateString).toLocaleDateString(locale)
}

/**
 * Today's date (YYYY-MM-DD) in a time zone; the group's, so everyone in the group and the
 * server agree on when the exchange day has come. Falls back to the device's own zone.
 */
export function todayIn(timeZone?: string, now: Date = new Date()): string {
  try {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now)
  } catch {
    return new Intl.DateTimeFormat('en-CA').format(now)
  }
}

/**
 * Whole calendar days from one YYYY-MM-DD to another. Counted on UTC dates, so a 23 or 25 hour
 * day (when the clocks change) never makes it one off.
 */
export function daysBetween(from: string, to: string): number {
  const utc = (d: string) => {
    const [y, m, day] = d.split('-').map(Number)
    return Date.UTC(y, m - 1, day)
  }
  return Math.round((utc(to) - utc(from)) / 86_400_000)
}

const NAME_PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'van', 'von'])

/**
 * Normalize how people typed their name: "nancy villena" and "Rodolfo NUÑEZ" become
 * "Nancy Villena" and "Rodolfo Nuñez". Particles like "de" stay lowercase unless first.
 */
export function formatName(name: string | null | undefined): string {
  if (!name) return ''
  // Some people have only their email as name; leave those alone.
  if (name.includes('@')) return name.trim()
  return name
    .trim()
    .toLocaleLowerCase('es')
    .split(/\s+/)
    .map((word, i) =>
      i > 0 && NAME_PARTICLES.has(word)
        ? word
        : word.replace(/(^|[-'])(\p{L})/gu, (_, sep, ch) => sep + ch.toLocaleUpperCase('es'))
    )
    .join(' ')
}
