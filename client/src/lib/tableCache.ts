// Last rows read per query, kept in memory for the whole session (2026-10-18).
//
// Before it, every page re-read all its tables from scratch on every visit and
// showed empty lists until the slowest answer came back — 41 requests for the
// accounting page, on a connection that drops out now and then. Now `useTable`
// shows the last known rows at once and re-reads them in the background.
//
// The one rule that keeps it honest: ANY write to a table (insert, update,
// upsert, delete — from any screen) drops that table's entries, before and
// after the request. The next visit then loads exactly as before the cache
// existed, so a value just changed is never shown in its old state. What the
// cache can still show for a second is a change made by SOMEONE ELSE (the
// other admin, another device) since the last visit — then the background
// read replaces it.

const cache = new Map<string, unknown[]>()

// Bumped on every write. A read remembers the value when it starts; if a write
// to its table landed in between, its rows predate that write and must not
// reach the screen (they would undo the optimistic update the page just made).
const writeGen = new Map<string, number>()
let globalGen = 0

export function readGeneration(table: string): string {
  return `${globalGen}:${writeGen.get(table) ?? 0}`
}

function bump(table: string): void {
  writeGen.set(table, (writeGen.get(table) ?? 0) + 1)
}

export function cacheKey(table: string, select: string, order?: string, ascending?: boolean): string {
  return `${table}|${select}|${order ?? ''}|${ascending ?? ''}`
}

export function getCached<T>(key: string): T[] | undefined {
  return cache.get(key) as T[] | undefined
}

export function setCached(key: string, rows: unknown[]): void {
  cache.set(key, rows)
}

/** Drop every entry reading this table — directly, or embedded in another
 *  table's select (`bookings` embeds `client:clients(...)`, so a client
 *  renamed must not keep showing the old name in the bookings list). */
export function invalidateTable(table: string): void {
  bump(table)
  for (const key of [...cache.keys()]) {
    const [t, select] = key.split('|')
    if (t === table || select.includes(`${table}(`)) { cache.delete(key); bump(t) }
  }
}

export function clearTableCache(): void {
  cache.clear()
  globalGen++
}

/** The table a write request touches, `'*'` for an RPC or an Edge Function
 *  (either may write anything — send-email logs to email_logs), or null when it
 *  is not a write. */
export function writtenTable(url: string, method: string | undefined): string | null {
  const m = (method ?? 'GET').toUpperCase()
  if (m === 'GET' || m === 'HEAD') return null
  if (url.includes('/functions/v1/')) return '*'
  const match = url.match(/\/rest\/v1\/([^/?#]+)/)
  if (!match) return null
  return match[1] === 'rpc' ? '*' : decodeURIComponent(match[1])
}

/** Called around every Supabase request (lib/loadingTracker.ts). */
export function invalidateForRequest(url: string, method: string | undefined): void {
  const t = writtenTable(url, method)
  if (t === '*') clearTableCache()
  else if (t) invalidateTable(t)
}
