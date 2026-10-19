/** A deploy replaced the code-split files while a tab (or the installed app)
 *  was open: the old index.html names chunks Vercel no longer has, and the next
 *  page change dies on "error loading dynamically imported module". The
 *  client_errors log showed one per deploy or so (2026-09-29 → 10-18), shared
 *  pages included. Reloading fetches the new index.html and fixes it — so do it
 *  ourselves instead of showing a screen that asks the visitor to.
 *
 *  Guarded twice: offline, a reload would trade our screen for the browser's
 *  dinosaur; and at most once a minute, so a chunk that is really missing (a
 *  broken deploy) ends on the explanation screen instead of a reload loop. */

const KEY = 'bkc_chunk_reload_at'
const MIN_GAP_MS = 60_000

export function reloadForNewVersion(): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0)
    if (Date.now() - last < MIN_GAP_MS) return false
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    // No storage, no loop guard: better the explanation screen than a loop.
    return false
  }
  window.location.reload()
  return true
}
