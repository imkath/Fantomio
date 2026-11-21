// The group page as it was last seen in this browser, so a return visit paints at once while
// the real data loads behind it. It is only a preview: the page refuses every action until
// the database answers, and that answer replaces it. Keyed by group and by the signed-in user,
// and checked again on read, so one person never sees what another one left on the device.
// It lives in sessionStorage (gone when the tab closes) and never holds the draw: who someone
// gives to is exactly what must not stay on a shared computer, so `match` is dropped on write.

const PREFIX = 'fantomio:grupo:'
const VERSION = 1
// Older than this, the preview could mislead more than it helps (a draw, a reveal). A tab can
// stay open for days.
export const GROUP_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export const groupCacheKey = (groupId: string, userId: string) => `${PREFIX}${groupId}:${userId}`

interface Envelope<T> {
  v: number
  groupId: string
  userId: string
  savedAt: number
  data: T
}

// What may be kept: everything but the person's match.
export type Cached<T> = Omit<T, 'match'>

export function readGroupCache<T extends object>(
  groupId: string,
  userId: string,
  now = Date.now()
): Cached<T> | null {
  if (!groupId || !userId) return null
  try {
    const raw = window.sessionStorage.getItem(groupCacheKey(groupId, userId))
    if (!raw) return null
    const entry = JSON.parse(raw) as Envelope<Cached<T>> | null
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
    // Written by an older version that still kept it: never hand it back.
    const { match: _match, ...data } = entry.data as Cached<T> & { match?: unknown }
    return data as Cached<T>
  } catch {
    return null
  }
}

export function writeGroupCache<T extends object>(
  groupId: string,
  userId: string,
  data: T,
  now = Date.now()
) {
  if (!groupId || !userId) return
  try {
    const { match: _match, ...safe } = data as T & { match?: unknown }
    const entry: Envelope<Cached<T>> = { v: VERSION, groupId, userId, savedAt: now, data: safe }
    window.sessionStorage.setItem(groupCacheKey(groupId, userId), JSON.stringify(entry))
  } catch {
    // Private mode or full storage: the page just loads the slow way next time.
  }
}

export function clearGroupCache(groupId: string, userId: string) {
  try {
    window.sessionStorage.removeItem(groupCacheKey(groupId, userId))
  } catch {
    // Nothing to clear.
  }
}

// On sign-out: nobody else using this browser should find someone's groups in it.
export function clearAllGroupCaches() {
  try {
    const keys: string[] = []
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i)
      if (key?.startsWith(PREFIX)) keys.push(key)
    }
    keys.forEach((key) => window.sessionStorage.removeItem(key))
  } catch {
    // Nothing to clear.
  }
}
