import { describe, expect, it } from 'vitest'
import { guessCurrency } from '../currency'

describe('guessCurrency', () => {
  it('uses the time zone first, even when the language points elsewhere', () => {
    expect(guessCurrency('America/Santiago', ['es-ES'])).toBe('CLP')
    expect(guessCurrency('America/Santiago', ['en-US'])).toBe('CLP')
    expect(guessCurrency('America/Mexico_City', ['es'])).toBe('MXN')
    expect(guessCurrency('America/Tijuana', [])).toBe('MXN')
    expect(guessCurrency('America/Argentina/Buenos_Aires', [])).toBe('ARS')
    expect(guessCurrency('America/Bogota', [])).toBe('COP')
    expect(guessCurrency('America/Lima', [])).toBe('PEN')
    expect(guessCurrency('America/Sao_Paulo', [])).toBe('BRL')
    expect(guessCurrency('Europe/Madrid', [])).toBe('EUR')
    expect(guessCurrency('Atlantic/Canary', [])).toBe('EUR')
    expect(guessCurrency('Europe/London', [])).toBe('GBP')
  })

  it('falls back to the language region when the zone is not one we know', () => {
    expect(guessCurrency('UTC', ['es-CL', 'es'])).toBe('CLP')
    expect(guessCurrency(undefined, ['pt-BR'])).toBe('BRL')
    expect(guessCurrency('Asia/Tokyo', ['fr-FR'])).toBe('EUR')
  })

  it('starts on dollars when nothing matches', () => {
    expect(guessCurrency('America/Guayaquil', ['es'])).toBe('USD')
    expect(guessCurrency('America/Montevideo', ['es-UY'])).toBe('USD')
    expect(guessCurrency(undefined, [])).toBe('USD')
  })
})
