// Generated once at build time (static export).
export const dynamic = 'force-static'

import { MetadataRoute } from 'next'

const baseUrl = 'https://ghostswap.nvrkth.com'

// Public pages only (signed-in pages are noindex). lastModified is the date each page's
// content really changed: Google ignores dates that move on every build. It also ignores
// changeFrequency and priority, so they're left out.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: baseUrl, lastModified: '2026-10-13' },
    { url: `${baseUrl}/login`, lastModified: '2026-10-13' },
    { url: `${baseUrl}/register`, lastModified: '2026-10-13' },
    { url: `${baseUrl}/privacy`, lastModified: '2026-10-12' },
    { url: `${baseUrl}/terms`, lastModified: '2026-10-12' },
  ]
}
