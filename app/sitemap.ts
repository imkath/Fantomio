// Generated once at build time (static export).
export const dynamic = 'force-static'

import { MetadataRoute } from 'next'
import { GUIDES } from '@/lib/guides'
import { GIFT_LISTS } from '@/lib/regalos'

const baseUrl = 'https://fantomio.com'

// Pages that can rank. Sign-in, sign-up and password pages are noindex and stay out. lastModified is the date each page's
// content really changed: Google ignores dates that move on every build. It also ignores
// changeFrequency and priority, so they're left out.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: baseUrl, lastModified: '2026-10-27' },
    { url: `${baseUrl}/guias`, lastModified: '2026-10-27' },
    ...GUIDES.map((g) => ({ url: `${baseUrl}/${g.slug}`, lastModified: g.updated })),
    { url: `${baseUrl}/regalos`, lastModified: '2026-11-17' },
    ...GIFT_LISTS.map((l) => ({ url: `${baseUrl}/regalos/${l.slug}`, lastModified: l.checked })),
    { url: `${baseUrl}/privacy`, lastModified: '2026-10-27' },
    { url: `${baseUrl}/terms`, lastModified: '2026-10-27' },
  ]
}
