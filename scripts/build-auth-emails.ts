// Writes the Supabase auth email templates from lib/email-layout.ts.
// Run: node --experimental-strip-types scripts/build-auth-emails.ts
// Then upload them to the hosted project (Auth > Email Templates, or the Management API).
import { writeFileSync } from 'node:fs'
import { AUTH_EMAILS } from '../lib/email-layout.ts'

for (const [name, { subject, html }] of Object.entries(AUTH_EMAILS)) {
  writeFileSync(`supabase/templates/${name}.html`, html + '\n')
  console.log(`${name}: ${subject}`)
}
