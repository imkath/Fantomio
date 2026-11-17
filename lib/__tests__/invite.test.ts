import { describe, expect, it } from 'vitest'
import { inviteMessage, whatsappUrl } from '@/lib/invite'
import { formatMoney } from '@/lib/currency'

const url = 'https://fantomio.com/join?code=ABC123'

describe('inviteMessage', () => {
  it('names the group, gives date and budget, and ends with the link', () => {
    const text = inviteMessage({
      name: 'Oficina 2026',
      url,
      exchangeDate: '2026-12-19',
      budget: 15000,
      currency: 'CLP',
    })
    expect(text).toContain('*Oficina 2026*')
    expect(text).toContain('19 de diciembre')
    expect(text).toContain('$15.000')
    expect(text.trim().endsWith(url)).toBe(true)
    expect(text).not.toContain('a ciegas')
  })

  it('leaves out what the group has not set', () => {
    const text = inviteMessage({ name: 'Familia', url })
    expect(text).not.toMatch(/intercambio|monto/i)
    expect(text).toContain(url)
  })

  it('says when the draw is blind', () => {
    expect(inviteMessage({ name: 'Amigas', url, blind: true })).toContain('a ciegas')
  })

  it('keeps the whole message intact inside the WhatsApp link', () => {
    const text = inviteMessage({ name: 'Tíos & primos', url, budget: 10000 })
    const encoded = whatsappUrl(text)
    expect(decodeURIComponent(encoded.split('text=')[1])).toBe(text)
  })
})

describe('formatMoney', () => {
  it('writes amounts the way people do', () => {
    expect(formatMoney(15000)).toBe('$15.000')
    expect(formatMoney(20, 'USD')).toBe('US$20')
  })
})
