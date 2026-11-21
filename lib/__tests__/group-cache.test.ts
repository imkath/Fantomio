import { describe, it, expect, beforeEach } from 'vitest'
import {
  GROUP_CACHE_MAX_AGE_MS,
  clearAllGroupCaches,
  clearGroupCache,
  groupCacheKey,
  readGroupCache,
  writeGroupCache,
} from '@/lib/group-cache'

describe('group cache', () => {
  beforeEach(() => window.localStorage.clear())

  it('returns what was saved for the same group and user', () => {
    writeGroupCache('g1', 'u1', { name: 'Oficina' })
    expect(readGroupCache('g1', 'u1')).toEqual({ name: 'Oficina' })
  })

  it('never returns the copy another user left for the same group', () => {
    writeGroupCache('g1', 'u1', { name: 'Oficina' })
    expect(readGroupCache('g1', 'u2')).toBeNull()
  })

  it('rejects an entry whose stored user does not match the key', () => {
    window.localStorage.setItem(
      groupCacheKey('g1', 'u2'),
      JSON.stringify({ v: 1, groupId: 'g1', userId: 'u1', savedAt: Date.now(), data: { x: 1 } })
    )
    expect(readGroupCache('g1', 'u2')).toBeNull()
    expect(window.localStorage.getItem(groupCacheKey('g1', 'u2'))).toBeNull()
  })

  it('needs a user: without a session there is no cache', () => {
    writeGroupCache('g1', '', { name: 'Oficina' })
    expect(window.localStorage.length).toBe(0)
    expect(readGroupCache('g1', '')).toBeNull()
  })

  it('drops entries that are too old', () => {
    writeGroupCache('g1', 'u1', { name: 'Oficina' }, 0)
    expect(readGroupCache('g1', 'u1', GROUP_CACHE_MAX_AGE_MS + 1)).toBeNull()
    expect(window.localStorage.getItem(groupCacheKey('g1', 'u1'))).toBeNull()
  })

  it('ignores broken JSON', () => {
    window.localStorage.setItem(groupCacheKey('g1', 'u1'), '{nope')
    expect(readGroupCache('g1', 'u1')).toBeNull()
  })

  it('clears one group, and all of them on sign-out without touching other keys', () => {
    writeGroupCache('g1', 'u1', { a: 1 })
    writeGroupCache('g2', 'u1', { b: 2 })
    window.localStorage.setItem('fantomio:lista:g1:u1', 'draft')
    clearGroupCache('g1', 'u1')
    expect(readGroupCache('g1', 'u1')).toBeNull()
    expect(readGroupCache('g2', 'u1')).toEqual({ b: 2 })
    clearAllGroupCaches()
    expect(readGroupCache('g2', 'u1')).toBeNull()
    expect(window.localStorage.getItem('fantomio:lista:g1:u1')).toBe('draft')
  })
})
