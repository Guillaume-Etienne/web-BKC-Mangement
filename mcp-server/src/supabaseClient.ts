import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const target = (process.env.SUPABASE_TARGET ?? 'test').trim().toLowerCase()
if (target !== 'test' && target !== 'prod') {
  throw new Error(`SUPABASE_TARGET must be "test" or "prod", got "${target}"`)
}

const url = target === 'prod' ? process.env.SUPABASE_URL_PROD : process.env.SUPABASE_URL_TEST
const key = target === 'prod' ? process.env.SUPABASE_SERVICE_ROLE_KEY_PROD : process.env.SUPABASE_SERVICE_ROLE_KEY_TEST

if (!url || !key) {
  throw new Error(
    `Missing Supabase config for target "${target}". Copy mcp-server/.env.example to ` +
    `mcp-server/.env and fill in SUPABASE_URL_${target.toUpperCase()} / ` +
    `SUPABASE_SERVICE_ROLE_KEY_${target.toUpperCase()}.`
  )
}

// Same convention as client/src/lib/supabase.ts: no generic <Database> — this
// hand-maintained project has per-table interfaces (types/database.ts), not a
// generated schema type. Query results are cast to those interfaces at the
// call site, same as the app does with useTable<T>().
export const supabase = createClient(url, key, {
  auth: { persistSession: false },
})

export const supabaseTarget = target as 'test' | 'prod'
