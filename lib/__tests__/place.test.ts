import { describe, expect, it } from 'vitest'
import { isMapsLink, mapsUrl, normalizeLink, serviceName } from '../place'

describe('normalizeLink', () => {
  it('adds https and upgrades http', () => {
    expect(normalizeLink('meet.google.com/abc-defg-hij')).toBe(
      'https://meet.google.com/abc-defg-hij'
    )
    expect(normalizeLink('http://zoom.us/j/123')).toBe('https://zoom.us/j/123')
  })

  it('refuses what is not a web address', () => {
    expect(normalizeLink('')).toBeNull()
    expect(normalizeLink('en la casa de la abuela')).toBeNull()
    expect(normalizeLink('javascript:alert(1)')).toBeNull()
    expect(normalizeLink('mailto:a@b.cl')).toBeNull()
  })
})

describe('mapsUrl', () => {
  it('searches the address, encoded', () => {
    expect(mapsUrl('Casa de la abuela', 'Av. Providencia 1234, Santiago')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Av.%20Providencia%201234%2C%20Santiago'
    )
  })

  it('uses a pasted Google Maps link as is', () => {
    expect(isMapsLink('https://maps.app.goo.gl/AbC123')).toBe(true)
    expect(isMapsLink('www.google.com/maps/place/Plaza+de+Armas')).toBe(true)
    expect(isMapsLink('https://www.google.com/search?q=x')).toBe(false)
    expect(mapsUrl(null, 'maps.app.goo.gl/AbC123')).toBe('https://maps.app.goo.gl/AbC123')
  })
})

describe('serviceName', () => {
  it('names the usual call services', () => {
    expect(serviceName('https://meet.google.com/abc')).toBe('Google Meet')
    expect(serviceName('https://us02web.zoom.us/j/1')).toBe('Zoom')
    expect(serviceName('https://discord.gg/abc')).toBe('Discord')
    expect(serviceName('https://teams.microsoft.com/l/meetup')).toBe('Teams')
    expect(serviceName('https://example.com/sala')).toBeNull()
  })
})
