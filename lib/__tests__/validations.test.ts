import { describe, it, expect } from 'vitest'
import {
  updateGroupSchema,
  groupIdSchema,
  memberIdSchema,
  wishlistItemSchema,
  updateWishlistSchema,
} from '../validations'

describe('groupIdSchema', () => {
  it('accepts valid UUID', () => {
    const result = groupIdSchema.safeParse('123e4567-e89b-12d3-a456-426614174000')
    expect(result.success).toBe(true)
  })

  it('rejects invalid UUID', () => {
    const result = groupIdSchema.safeParse('invalid-id')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('ID de grupo inválido')
  })

  it('rejects empty string', () => {
    const result = groupIdSchema.safeParse('')
    expect(result.success).toBe(false)
  })
})

describe('memberIdSchema', () => {
  it('accepts valid UUID', () => {
    const result = memberIdSchema.safeParse('123e4567-e89b-12d3-a456-426614174000')
    expect(result.success).toBe(true)
  })

  it('rejects invalid UUID', () => {
    const result = memberIdSchema.safeParse('not-a-uuid')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('ID de miembro inválido')
  })
})

describe('updateGroupSchema', () => {
  it('accepts valid group update data', () => {
    const result = updateGroupSchema.safeParse({
      name: 'Mi Grupo',
      budget: 50,
      currency: 'USD',
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (all fields optional)', () => {
    const result = updateGroupSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = updateGroupSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('El nombre es requerido')
  })

  it('rejects name over 100 characters', () => {
    const result = updateGroupSchema.safeParse({ name: 'a'.repeat(101) })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('El nombre es muy largo')
  })

  it('rejects negative budget', () => {
    const result = updateGroupSchema.safeParse({ budget: -10 })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('El presupuesto debe ser positivo')
  })

  it('accepts null budget', () => {
    const result = updateGroupSchema.safeParse({ budget: null })
    expect(result.success).toBe(true)
  })

  it('accepts date-only format for exchange_date', () => {
    const result = updateGroupSchema.safeParse({
      exchange_date: '2024-12-25',
    })
    expect(result.success).toBe(true)
  })

  it('rejects datetime with time for exchange_date', () => {
    const result = updateGroupSchema.safeParse({
      exchange_date: '2024-12-25T10:00:00.000Z',
    })
    expect(result.success).toBe(false)
  })

  it('converts empty string to null for exchange_date', () => {
    const result = updateGroupSchema.safeParse({ exchange_date: '' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.exchange_date).toBeNull()
  })

  it('accepts null exchange_date', () => {
    const result = updateGroupSchema.safeParse({ exchange_date: null })
    expect(result.success).toBe(true)
  })
})

describe('wishlistItemSchema', () => {
  it('accepts valid wishlist item', () => {
    const result = wishlistItemSchema.safeParse({
      name: 'Nintendo Switch',
      url: 'https://amazon.com/switch',
      description: 'Color rojo',
      priority: 1,
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = wishlistItemSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('El nombre es requerido')
  })

  it('rejects name over 200 characters', () => {
    const result = wishlistItemSchema.safeParse({ name: 'a'.repeat(201) })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('El nombre es muy largo')
  })

  it('rejects invalid URL', () => {
    const result = wishlistItemSchema.safeParse({
      name: 'Item',
      url: 'not-a-url',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('URL inválida')
  })

  it('accepts empty string URL', () => {
    const result = wishlistItemSchema.safeParse({
      name: 'Item',
      url: '',
    })
    expect(result.success).toBe(true)
  })

  it('rejects description over 500 characters', () => {
    const result = wishlistItemSchema.safeParse({
      name: 'Item',
      description: 'a'.repeat(501),
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('La descripción es muy larga')
  })

  it('rejects priority out of range', () => {
    const result = wishlistItemSchema.safeParse({
      name: 'Item',
      priority: 6,
    })
    expect(result.success).toBe(false)
  })
})

describe('updateWishlistSchema', () => {
  it('accepts valid wishlist array', () => {
    const result = updateWishlistSchema.safeParse([{ name: 'Item 1' }, { name: 'Item 2' }])
    expect(result.success).toBe(true)
  })

  it('accepts empty array', () => {
    const result = updateWishlistSchema.safeParse([])
    expect(result.success).toBe(true)
  })

  it('rejects more than 5 items', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ name: `Item ${i}` }))
    const result = updateWishlistSchema.safeParse(items)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Máximo 5 items permitidos')
  })
})
