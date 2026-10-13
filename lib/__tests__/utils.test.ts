import { describe, it, expect } from 'vitest'
import { cn, parseLocalDate, formatLocalDate } from '../utils'

describe('cn (class names utility)', () => {
  it('merges simple class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    const condition = false
    expect(cn('foo', condition && 'bar', 'baz')).toBe('foo baz')
  })

  it('handles undefined and null', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar')
  })

  it('merges tailwind classes correctly', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })

  it('handles array of classes', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })

  it('handles object syntax', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz')
  })

  it('handles mixed inputs', () => {
    expect(cn('foo', ['bar', 'baz'], { qux: true })).toBe('foo bar baz qux')
  })

  it('handles empty inputs', () => {
    expect(cn()).toBe('')
  })
})

describe('parseLocalDate', () => {
  it('parses YYYY-MM-DD string as local date', () => {
    const date = parseLocalDate('2024-12-24')
    expect(date.getFullYear()).toBe(2024)
    expect(date.getMonth()).toBe(11) // December is month 11
    expect(date.getDate()).toBe(24)
  })

  it('parses first day of month correctly', () => {
    const date = parseLocalDate('2024-01-01')
    expect(date.getFullYear()).toBe(2024)
    expect(date.getMonth()).toBe(0) // January is month 0
    expect(date.getDate()).toBe(1)
  })

  it('parses last day of year correctly', () => {
    const date = parseLocalDate('2024-12-31')
    expect(date.getFullYear()).toBe(2024)
    expect(date.getMonth()).toBe(11)
    expect(date.getDate()).toBe(31)
  })

  it('avoids timezone shift issue that occurs with new Date(string)', () => {
    // This is the key test: new Date("2024-12-24") interprets as UTC
    // and can shift to Dec 23 in negative UTC offset timezones
    const dateString = '2024-12-24'
    const localDate = parseLocalDate(dateString)

    // The date should always be 24, regardless of timezone
    expect(localDate.getDate()).toBe(24)
  })
})

describe('formatLocalDate', () => {
  it('formats date string for display in es-ES locale', () => {
    const formatted = formatLocalDate('2024-12-24')
    // Should contain "24" as the day
    expect(formatted).toContain('24')
  })

  it('formats with custom locale', () => {
    const formatted = formatLocalDate('2024-12-24', 'en-US')
    // Should contain "24" as the day
    expect(formatted).toContain('24')
  })

  it('preserves correct day without timezone shift', () => {
    // The formatted output should show day 24, not 23
    const formatted = formatLocalDate('2024-12-24', 'es-ES')
    expect(formatted).toContain('24')
    expect(formatted).not.toContain('23')
  })
})

describe('formatName', () => {
  it('capitalizes each word and keeps Spanish particles lowercase', async () => {
    const { formatName } = await import('../utils')
    expect(formatName('nancy villena')).toBe('Nancy Villena')
    expect(formatName('Rodolfo NUÑEZ')).toBe('Rodolfo Nuñez')
    expect(formatName('  maría  DE la paz ')).toBe('María de la Paz')
    expect(formatName("ana-maría o'higgins")).toBe("Ana-María O'Higgins")
    expect(formatName('ana.perez@example.com')).toBe('ana.perez@example.com')
    expect(formatName(null)).toBe('')
  })
})

describe('safeRedirect', () => {
  it('keeps paths inside the site and rejects other domains', async () => {
    const { safeRedirect } = await import('../routes')
    expect(safeRedirect('/groups?id=1')).toBe('/groups?id=1')
    expect(safeRedirect('//evil.com')).toBe('/dashboard')
    expect(safeRedirect('https://evil.com')).toBe('/dashboard')
    expect(safeRedirect(null)).toBe('/dashboard')
  })
})
