// ── Reads that failed on a share page (2026-11-15) ──────────────────────────
//
// The #065 case: one read on the guest's page timed out, came back as "nothing",
// the Dining section vanished and the balance was wrong — without a word to the
// guest, and invisible to gui (logged in as admin, his reads never failed).
// Share pages now count their failed reads instead of swallowing them, try once
// more (a dropped 3G connection is the likeliest cause here), and say so if it
// still fails.

/** What a supabase read resolves to — only the parts this module looks at. */
type ReadResult<D> = { data: D | null; error: unknown } | null | undefined

/** `.single()` on zero rows. Not a failure: "not found" is an answer. */
const NO_ROWS = 'PGRST116'

export interface LoadCheck {
  /** The read's data, or `fallback` when it brought none — and a failed read
   *  is remembered. A `null` result (a read that was skipped) is not a failure. */
  take<D, F>(res: ReadResult<D>, fallback: F): D | F
  /** True when at least one read failed. */
  readonly failed: boolean
}

export function loadCheck(): LoadCheck {
  let failures = 0
  return {
    take<D, F>(res: ReadResult<D>, fallback: F): D | F {
      if (res?.error && errorCode(res.error) !== NO_ROWS) failures++
      return res?.data ?? fallback
    },
    get failed() { return failures > 0 },
  }
}

/** True when a read failed for a reason other than "no such row" — the line
 *  between "this link points at nothing" and "we could not ask". */
export function readFailed(res: ReadResult<unknown>): boolean {
  return !!res?.error && errorCode(res.error) !== NO_ROWS
}

/** Runs a page load, and runs it once more after a short pause if it reported a
 *  failure. Resolves to whether the load (finally) went through. */
export async function retryOnce(load: () => Promise<boolean>, pauseMs = 1500): Promise<boolean> {
  if (await load()) return true
  await new Promise(r => setTimeout(r, pauseMs))
  return load()
}

function errorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code ?? '') : ''
}
