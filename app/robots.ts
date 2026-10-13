// Generated once at build time (static export).
export const dynamic = 'force-static'

import { MetadataRoute } from 'next'

// Everything may be crawled. Signed-in pages keep themselves out of the index with a
// noindex tag instead: robots.txt only controls crawling, and a blocked page can't show
// Google its noindex.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: 'https://ghostswap.nvrkth.com/sitemap.xml',
  }
}
