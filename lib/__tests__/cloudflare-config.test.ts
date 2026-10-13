import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('Cloudflare static hosting', () => {
  it('serves the static export with no Worker script', () => {
    const source = readFileSync(join(process.cwd(), 'wrangler.jsonc'), 'utf8')
    const config = JSON.parse(
      source.replace(/^\s*\/\/.*$/gm, '').replace(/,\s*([}\]])/g, '$1')
    ) as { main?: string; assets?: { directory?: string } }

    expect(config.main).toBeUndefined()
    expect(config.assets?.directory).toBe('./out')
  })

  it('serves the Google verification file at its exact path, without a redirect', () => {
    const redirects = readFileSync(join(process.cwd(), 'public/_redirects'), 'utf8')
    expect(redirects).toMatch(/^\/google7fd3d25307db1a76\.html \/google-site-verification 200$/m)
  })
})
