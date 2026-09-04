/** Sorting a crash a visitor cannot read into a cause we can act on.
 *
 *  A guest on a shared link has no console, no idea what a chunk is, and no way
 *  to tell us anything except by reading a sentence out over the phone. So the
 *  screen they get has to name the cause and offer the one gesture that fixes
 *  it — which means classifying the error first.
 *
 *  ⚠️ Match on API names and on `error.name`, NEVER on the English sentence.
 *  Browsers **translate DOMException messages**: the client who lost the form on
 *  2026-09-04 read us "Échec de l'exécution de « removeChild » sur « Node »"
 *  from a Chrome in French. The words around it change with the phone's
 *  language; `removeChild` and `NotFoundError` do not. */

export type ErrorKind =
  /** A third party rewrote the DOM under React — page translation above all
   *  (Chrome/Android auto-translate, the Translate extension, Samsung
   *  Internet), sometimes a password manager injecting nodes. React then tries
   *  to remove a node that has moved and the whole tree dies. Recoverable: a
   *  fresh mount rebuilds the DOM React expects. */
  | 'dom-mutated'
  /** A code-split chunk will not download — usually a deploy replaced it while
   *  the tab was open, so the old index.html names files Vercel no longer has.
   *  Recoverable by reload: it fetches the new index.html. */
  | 'chunk'
  /** The request never made it. Bilene, a phone, a beach. Recoverable by
   *  retrying, not by reloading — reloading would cost the visitor their
   *  answers for a problem that is not the page's. */
  | 'network'
  /** The browser refuses to store anything (see safeStorage). Nothing to
   *  retry: the visitor has to change a setting, or carry on without. */
  | 'storage'
  | 'unknown'

interface Named { name?: unknown; message?: unknown }

/** Order matters. "Failed to fetch dynamically imported module" carries both a
 *  chunk signature and a network one, and it is a chunk problem. */
const PATTERNS: [ErrorKind, RegExp][] = [
  ['dom-mutated', /\b(removeChild|insertBefore|replaceChild|appendChild)\b|NotFoundError|HierarchyRequestError/i],
  ['chunk', /dynamically imported module|module script failed|ChunkLoadError|Loading (CSS )?chunk|Unexpected token '<'/i],
  ['network', /Failed to fetch|NetworkError|Network request failed|Load failed|net::ERR|ERR_INTERNET|ERR_NETWORK/i],
  ['storage', /localStorage|sessionStorage|QuotaExceeded|access to storage|The operation is insecure/i],
]

export function classifyError(err: unknown): ErrorKind {
  const e = (err ?? {}) as Named
  const name = typeof e.name === 'string' ? e.name : ''
  const message = typeof e.message === 'string' ? e.message : String(err ?? '')
  const hay = `${name}: ${message}`
  for (const [kind, re] of PATTERNS) if (re.test(hay)) return kind
  return 'unknown'
}

/** Worth remounting the tree by itself, without asking the visitor anything.
 *  Only the DOM family: everything else either needs the network back or needs
 *  a new index.html, and a silent remount would just crash again. */
export function isSelfHealing(kind: ErrorKind): boolean {
  return kind === 'dom-mutated'
}
