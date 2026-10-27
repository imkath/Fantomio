import type { Session } from '@supabase/supabase-js'

// "Unir otra cuenta" happens in two sessions: it starts in the account that stays, then the
// person signs in with the other one to prove it's theirs. The first session is set aside in
// this tab (not signed out: signing out revokes it on the server) and comes back with
// setSession once the merge is done, so the other account's Google can be connected to it
// through Supabase's own linkIdentity, without touching its auth tables.

const KEY = 'ghostswap:merge'
// Pending Google connection, for when the first session couldn't come back.
const LINK_KEY = 'ghostswap:link-google'
const TTL = 15 * 60 * 1000 // same window as merge_requests

export interface PendingMerge {
  code: string
  email: string
  at: number
  keep: { access_token: string; refresh_token: string }
}

export function saveMerge(code: string, email: string, session: Session): boolean {
  const pending: PendingMerge = {
    code,
    email,
    at: Date.now(),
    keep: { access_token: session.access_token, refresh_token: session.refresh_token },
  }
  try {
    sessionStorage.setItem(KEY, JSON.stringify(pending))
    return true
  } catch {
    return false
  }
}

export function readMerge(): PendingMerge | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null') as PendingMerge | null
    if (!saved?.code || !saved.keep?.refresh_token) return null
    if (Date.now() - saved.at > TTL) {
      forgetMerge()
      return null
    }
    return saved
  } catch {
    return null
  }
}

export function forgetMerge() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // Nothing to clean.
  }
}

export function rememberGoogleLink(googleEmail: string) {
  try {
    localStorage.setItem(LINK_KEY, googleEmail)
  } catch {
    // The account page just won't show the reminder.
  }
}

export function pendingGoogleLink(): string | null {
  try {
    return localStorage.getItem(LINK_KEY)
  } catch {
    return null
  }
}

export function forgetGoogleLink() {
  try {
    localStorage.removeItem(LINK_KEY)
  } catch {
    // Nothing to clean.
  }
}

export const authCallback = (next: string) =>
  `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
