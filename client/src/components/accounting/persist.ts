/** Optimistic writes that undo themselves when the database refuses.
 *
 *  Every accounting screen updates local state before the Supabase round-trip,
 *  so the UI stays instant. The danger is the write that never lands: RLS says
 *  no, a constraint trips, the phone drops off the wifi at the beach. Before
 *  this, the books simply showed money that was never recorded, and said
 *  nothing until someone reloaded the page.
 */

/** What a Supabase query resolves to, narrowed to the part we act on. */
export interface WriteResult {
  error: { message: string } | null
}

/** How the user is told a write was lost. Swapped out in tests. */
export type Notify = (message: string) => void

/** Compose the message shown when a write is rolled back. Exported for tests
 *  and so the wording lives in one place. */
export function rollbackMessage(what: string, reason: string): string {
  return `Could not save ${what}.\n\n${reason}\n\nThe change was undone — nothing was recorded.`
}

/** Run an optimistic write; undo it if the database refuses.
 *
 *  `rollback` is expected to restore the whole array the caller snapshotted
 *  before mutating, which puts the rows back exactly as they were, order
 *  included.
 *
 *  Known limit, accepted: two writes to the same table inside one round-trip
 *  would both be undone if the first fails. That needs a failure AND two edits
 *  in the same second; the next refetch re-syncs from the DB regardless.
 *
 *  @returns a promise that settles once the write (and any rollback) is done —
 *           handlers ignore it, tests await it.
 */
export function persistWith(
  notify: Notify,
  query: PromiseLike<WriteResult>,
  rollback: () => void,
  what: string,
): Promise<void> {
  return Promise.resolve(query).then(
    ({ error }) => {
      if (!error) return
      console.error(`Save failed (${what}):`, error.message)
      rollback()
      notify(rollbackMessage(what, error.message))
    },
    // A thrown/rejected query (offline, DNS, CORS) is just as lost as one that
    // came back with an error — same treatment, never a silent swallow.
    (thrown: unknown) => {
      const reason = thrown instanceof Error ? thrown.message : String(thrown)
      console.error(`Save threw (${what}):`, thrown)
      rollback()
      notify(rollbackMessage(what, reason))
    },
  )
}

/** Production binding: tells the user with a blocking alert.
 *  Blocking is deliberate here — a lost payment deserves to stop the user
 *  rather than scroll past as a toast. */
export function persist(
  query: PromiseLike<WriteResult>,
  rollback: () => void,
  what: string,
): Promise<void> {
  return persistWith(msg => alert(msg), query, rollback, what)
}
