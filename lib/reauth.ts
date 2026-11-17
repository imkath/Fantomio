// Sensitive account changes (deleting the account, merging, connecting or removing Google, a
// first password) ask for a recent sign-in, so a session left open on a shared computer, or a
// stolen token, can't be used for them. The database checks the same window for deletion and
// merges (signed_in_recently in the migrations); this check only spares people a failed try.
export const RECENT_SIGN_IN_MINUTES = 30

// When the person signed in, from the access token's "amr" claim (Supabase writes the method
// and its time there; refreshing the session keeps it).
export function signedInAt(accessToken: string | undefined): number | null {
  if (!accessToken) return null
  try {
    const payload = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(atob(payload)) as { amr?: Array<{ timestamp?: number }> }
    const times = (claims.amr ?? []).map((a) => a.timestamp ?? 0)
    return times.length ? Math.max(...times) * 1000 : null
  } catch {
    return null
  }
}

export function isRecentSignIn(accessToken: string | undefined, now = Date.now()): boolean {
  const at = signedInAt(accessToken)
  return at !== null && now - at < RECENT_SIGN_IN_MINUTES * 60 * 1000
}
