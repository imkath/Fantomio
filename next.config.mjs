/** @type {import('next').NextConfig} */
const nextConfig = {
  // The whole site is exported as static files and served by Cloudflare Workers Static Assets,
  // which are free, unlimited and never run the Worker (no CPU limit to hit). Pages read their
  // data in the browser straight from Supabase, where RLS and database functions decide what
  // each person may see or do. Headers and redirects live in public/_headers and _redirects.
  output: 'export',
  poweredByHeader: false,
  images: { unoptimized: true },
}

export default nextConfig
