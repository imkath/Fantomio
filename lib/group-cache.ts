// The group page as it was last seen in this browser, so a return visit paints at once while
// the real data loads behind it. It is only a preview: the page refuses every action until
// the database answers, and that answer replaces it. Keyed by group and by the signed-in user,
// and checked again on read, so one person never sees what another one left on the device.

const PREFIX = 'fantomio:grupo:'
const VERSION = 1
// Older than this, the preview could mislead more than it helps (a draw, a reveal).
export const GROUP_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export const groupCacheKey = (groupId: string, userId: string) => `${PREFIX}${groupId}:${userId}`

interface Envelope<T> {
  v: number
  groupId: string
  userId: string
  savedAt: number
  data: T
}

export function readGroupCache<T>(groupId: string, userId: string, now = Date.now()): T | null {
  if (!groupId || !userId) return null
  try {
    const raw = window.localStorage.getItem(groupCacheKey(groupId, userId))
    if (!raw) return null
    const entry = JSON.parse(raw) as Envelope<T> | null
    if (
      !entry ||
      entry.v !== VERSION ||
      entry.groupId !== groupId ||
      entry.userId !== userId ||
      typeof entry.savedAt !== 'number' ||
      now - entry.savedAt > GROUP_CACHE_MAX_AGE_MS ||
      !entry.data
    ) {
      clearGroupCache(groupId, userId)
      return null
    }
    return entry.data
  } catch {
    return null
  }
}

export function writeGroupCache<T>(groupId: string, userId: string, data: T, now = Date.now()) {
  if (!groupId || !userId) return
  try {
    const entry: Envelope<T> = { v: VERSION, groupId, userId, savedAt: now, data }
    window.localStorage.setItem(groupCacheKey(groupId, userId), JSON.stringify(entry))
  } catch {
    // Private mode or full storage: the page just loads the slow way next time.
  }
}

export function clearGroupCache(groupId: string, userId: string) {
  try {
    window.localStorage.removeItem(groupCacheKey(groupId, userId))
  } catch {
    // Nothing to clear.
  }
}

// On sign-out: nobody else using this browser should find someone's groups in it.
export function clearAllGroupCaches() {
  try {
    const keys: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key?.startsWith(PREFIX)) keys.push(key)
    }
    keys.forEach((key) => window.localStorage.removeItem(key))
  } catch {
    // Nothing to clear.
  }
}
