/** Telling "this table does not exist yet" apart from "something broke".
 *
 *  It matters because the two have different answers: a pending migration is
 *  gui running some SQL, a real failure is a bug. Showing the first as the
 *  second buries it in an error banner nobody can act on.
 *
 *  ⚠️ There is no single code. PostgREST answers **PGRST205** ("Could not find
 *  the table 'public.x' in the schema cache") when its cached schema has never
 *  heard of the table — which is what the browser client actually gets — while
 *  Postgres itself raises **42P01** (undefined_table). Checking only 42P01 is a
 *  trap: it looks right, and it never fires from the front end. Found the hard
 *  way on 2026-09-03, in the browser, after the code had been written twice.
 */

export interface MaybePostgrestError {
  code?: string | null
  message?: string | null
}

export function isMissingTable(error: MaybePostgrestError | null | undefined): boolean {
  if (!error) return false
  if (error.code === 'PGRST205' || error.code === '42P01') return true
  // Last resort: some proxies drop the code but keep the sentence.
  return /could not find the table/i.test(error.message ?? '')
}

/** Same idea, one level down: a column the migration has not added yet.
 *
 *  ⚠️ This one bites harder than a missing table, and it did on 2026-09-03 in
 *  production. PostgREST rejects the WHOLE select when one named column does not
 *  exist — so `select('id, status, source_id')` returns no rows at all, and a
 *  screen that only counts things shows zeros without a single error on screen.
 *  Never name a not-yet-migrated column in a select the app must survive
 *  without: fetch it apart, and let that one query fail. */
export function isMissingColumn(error: MaybePostgrestError | null | undefined): boolean {
  if (!error) return false
  if (error.code === 'PGRST204' || error.code === '42703') return true
  return /column .* does not exist|could not find the .* column/i.test(error.message ?? '')
}
