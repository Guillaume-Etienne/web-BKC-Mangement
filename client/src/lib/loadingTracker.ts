// Counts what the app is still waiting for — every Supabase HTTP request plus
// every lazy page chunk in flight — so the green bar under the navigation can
// say "not finished yet". Before it, a slow screen looked exactly like a
// finished one with no data.
let pending = 0
const listeners = new Set<() => void>()

function emit() { listeners.forEach(l => l()) }

export function startLoading() { pending++; emit() }
export function stopLoading() { pending = Math.max(0, pending - 1); emit() }

export function subscribeLoading(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}
export function isLoading() { return pending > 0 }

/** Drop-in for `fetch`, handed to createClient: each request counts until it settles. */
export const trackedFetch: typeof fetch = (input, init) => {
  startLoading()
  return fetch(input, init).finally(stopLoading)
}
