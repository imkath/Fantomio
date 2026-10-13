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
