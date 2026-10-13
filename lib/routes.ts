// A group's page. The site is static, so one page serves every group and reads the id from
// the query; old /groups/<id> links redirect here (public/_redirects).
export const groupPath = (id: string) => `/groups?id=${id}`

// Only paths inside this site: never let ?next= or ?redirectTo= send someone to another domain.
export function safeRedirect(value: string | null | undefined, fallback = '/dashboard') {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : fallback
}
