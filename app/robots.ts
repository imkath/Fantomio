// Generated once at build time (static export).
export const dynamic = 'force-static'

import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/auth/', '/dashboard', '/groups/'],
      },
    ],
    sitemap: 'https://ghostswap.nvrkth.com/sitemap.xml',
  }
}
