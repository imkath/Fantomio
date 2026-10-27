// Applies pending migrations from supabase/migrations to the production database and records
// each one in supabase_migrations.schema_migrations, the same history table the Supabase CLI
// uses (`supabase migration list` reads it). It goes through the Management API, so it needs a
// personal access token instead of the database password.
//
//   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/db-push.mjs           # list pending, apply nothing
//   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/db-push.mjs --apply   # apply them in order
//
// Each migration runs in one transaction together with its history row: it is applied and
// recorded, or neither. Run the database tests (tests/db) on the branch before applying.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REF = process.env.SUPABASE_PROJECT_REF ?? 'ocgmlgldrmdemdjphcrv'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const DIR = fileURLToPath(new URL('../supabase/migrations/', import.meta.url))
const apply = process.argv.includes('--apply')

if (!TOKEN) {
  console.error('Set SUPABASE_ACCESS_TOKEN (a Supabase personal access token).')
  process.exit(1)
}

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`)
  return JSON.parse(text)
}

const quote = (s) => `'${s.replaceAll("'", "''")}'`

await query(`
  CREATE SCHEMA IF NOT EXISTS supabase_migrations;
  CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
    version TEXT PRIMARY KEY, statements TEXT[], name TEXT
  );`)
const applied = new Set(
  (await query('SELECT version FROM supabase_migrations.schema_migrations')).map((r) => r.version)
)

const pending = readdirSync(DIR)
  .filter((f) => /^\d{14}_.+\.sql$/.test(f))
  .sort()
  .filter((f) => !applied.has(f.slice(0, 14)))

if (!pending.length) {
  console.log('Nothing pending: production is up to date.')
  process.exit(0)
}
console.log(`Pending (${pending.length}):\n  ${pending.join('\n  ')}`)
if (!apply) {
  console.log('\nDry run. Add --apply to apply them.')
  process.exit(0)
}

for (const file of pending) {
  const version = file.slice(0, 14)
  const name = file.slice(15, -4)
  const sql = readFileSync(join(DIR, file), 'utf8')
  process.stdout.write(`Applying ${file}... `)
  await query(`BEGIN;
${sql}
;
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (${quote(version)}, ${quote(name)}, ARRAY[${quote(sql)}]);
COMMIT;`)
  console.log('ok')
}
