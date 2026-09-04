/** localStorage is not a given, and it does not fail politely.
 *
 *  When a browser is set to block site data — Chrome's "block third-party
 *  cookies" on some builds, iOS Lockdown Mode, a private window, and several
 *  in-app browsers a guest opens a shared link from (Instagram, Facebook,
 *  WeChat) — `localStorage.getItem` **throws a SecurityError**. It does not
 *  return null. An unguarded read at module scope therefore takes down the
 *  whole module graph, and the visitor gets a white screen with nothing on it
 *  to act on: no message, no button, no idea it is their own browser setting.
 *
 *  Every read and write in the app goes through here. A preference that cannot
 *  be stored is not an error — it is a preference that lasts one visit. */

export function readLocal(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

/** @returns false when the browser refused to store — callers that care can
 *  tell the visitor their draft only lives as long as the tab. */
export function writeLocal(key: string, value: string): boolean {
  try { localStorage.setItem(key, value); return true } catch { return false }
}

export function removeLocal(key: string): void {
  try { localStorage.removeItem(key) } catch { /* it was never stored */ }
}
