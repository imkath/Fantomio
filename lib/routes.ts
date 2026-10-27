// A group's page. The site is static, so one page serves every group and reads the id from
// the query; old /groups/<id> links redirect here (public/_redirects).
export const groupPath = (id: string) => `/groups?id=${id}`

// Only paths inside this site: never let ?next= or ?redirectTo= send someone to another domain.
// Checking the prefix isn't enough: URL parsing turns a backslash into "/" and drops tabs and
// newlines, so "/<backslash>evil.com" or "/<tab>/evil.com" become "//evil.com". We refuse those
// characters and then resolve the path the way the router will, keeping it only if it stays here.
export function safeRedirect(value: string | null | undefined, fallback = '/dashboard') {
  if (!value || !value.startsWith('/') || /[\\\s]/.test(value)) return fallback
  const base = 'https://fantomio.invalid'
  try {
    const url = new URL(value, base)
    return url.origin === base ? url.pathname + url.search + url.hash : fallback
  } catch {
    return fallback
  }
}
