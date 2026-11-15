import { supabase } from './supabase'

/** Which screens the two admins actually use (Options → Database → Usage).
 *
 *  Built to cost nothing: a view is a number in an in-memory Map. The network is
 *  touched at most once per flush, and a flush happens only when the app goes to
 *  the background / closes, or every 5 minutes while open. A failed flush is
 *  dropped on purpose — a lost count never justifies a retry loop or an error
 *  on screen. The keys are a page (`taxis`) or one of its tabs (`taxis#drivers`),
 *  nothing else: no client name, no booking id, no URL. */

const FLUSH_EVERY_MS = 5 * 60 * 1000
const DEDUPE_MS = 1500

let pending = new Map<string, number>()
let lastKey = ''
let lastAt = 0
let started = false

/** Count one view. Same key twice within 1.5 s is one view (React StrictMode
 *  mounts twice in dev; a double click on a tab is not two visits). */
export function trackView(key: string): void {
  if (!started) return
  const now = Date.now()
  if (key === lastKey && now - lastAt < DEDUPE_MS) return
  lastKey = key
  lastAt = now
  pending.set(key, (pending.get(key) ?? 0) + 1)
}

function flush(): void {
  if (pending.size === 0) return
  const items = [...pending].map(([page, n]) => ({ page, n }))
  pending = new Map()
  // Not awaited, error ignored: see the header.
  void Promise.resolve(supabase.rpc('track_page_views', { p_items: items })).catch(() => { /* dropped */ })
}

/** Start counting for a logged-in admin; returns the cleanup. Called once from
 *  App when there is a session — share pages (guests) never start it. */
export function startUsageTracking(): () => void {
  started = true
  const onHide = () => { if (document.visibilityState === 'hidden') flush() }
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', flush)
  const timer = window.setInterval(flush, FLUSH_EVERY_MS)
  return () => {
    flush() // before `started` flips: logout keeps what was counted
    started = false
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', flush)
    window.clearInterval(timer)
  }
}
