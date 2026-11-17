import { describe, expect, it } from 'vitest'
import { isRecentSignIn, signedInAt } from '@/lib/reauth'

const token = (claims: object) =>
  ['x', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'sig'].join('.')

describe('recent sign-in', () => {
  const now = Date.UTC(2026, 10, 17, 12)
  const at = (minutesAgo: number) =>
    token({ amr: [{ method: 'password', timestamp: (now - minutesAgo * 60_000) / 1000 }] })

  it('counts a sign-in from minutes ago', () => {
    expect(isRecentSignIn(at(5), now)).toBe(true)
  })

  it('asks again after half an hour', () => {
    expect(isRecentSignIn(at(31), now)).toBe(false)
  })

  it('uses the latest method when there are several', () => {
    const t = token({
      amr: [
        { method: 'password', timestamp: (now - 600 * 60_000) / 1000 },
        { method: 'oauth', timestamp: (now - 2 * 60_000) / 1000 },
      ],
    })
    expect(isRecentSignIn(t, now)).toBe(true)
  })

  it('treats a missing or broken token as not recent', () => {
    expect(isRecentSignIn(undefined, now)).toBe(false)
    expect(isRecentSignIn('nope', now)).toBe(false)
    expect(signedInAt(token({}))).toBeNull()
  })
})
