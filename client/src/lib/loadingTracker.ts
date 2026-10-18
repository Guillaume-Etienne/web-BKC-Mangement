// Counts what the app is still waiting for — every Supabase HTTP request plus
// every lazy page chunk in flight — so the green bar under the navigation can
// say "not finished yet". Before it, a slow screen looked exactly like a
// finished one with no data.
//
// Requests are grouped into a "burst": progress = settled / started within it.
// A burst only ends after SETTLE_MS of silence, because pages often chain their
// queries (load bookings, THEN their lessons): ending on the first zero would
// fill the bar to 100 % and restart it, i.e. claim "done" while it isn't.
import { invalidateForRequest } from './tableCache'

const SETTLE_MS = 200

let pending = 0
let started = 0
let settled = 0
let complete = true
let settleTimer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

function emit() { listeners.forEach(l => l()) }

export function startLoading() {
  clearTimeout(settleTimer)
  if (complete) { started = 0; settled = 0; complete = false }
  pending++
  started++
  emit()
}

export function stopLoading() {
  pending = Math.max(0, pending - 1)
  settled++
  if (pending === 0) settleTimer = setTimeout(() => { complete = true; emit() }, SETTLE_MS)
  emit()
}

export function subscribeLoading(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

/** 1 = everything loaded; otherwise the share of the current burst already settled. */
export function getLoadingProgress() {
  return complete ? 1 : started ? settled / started : 0
}

/** Drop-in for `fetch`, handed to createClient: each request counts until it
 *  settles. A write also drops the cached reads of its table, before it leaves
 *  AND once it lands — a read already in flight when the write started could
 *  otherwise put the old rows back in the cache (see tableCache.ts). */
export const trackedFetch: typeof fetch = (input, init) => {
  startLoading()
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = init?.method ?? (input instanceof Request ? input.method : undefined)
  invalidateForRequest(url, method)
  return fetch(input, init).finally(() => {
    invalidateForRequest(url, method)
    stopLoading()
  })
}
