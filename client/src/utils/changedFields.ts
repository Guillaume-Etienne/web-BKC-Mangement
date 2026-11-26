/** The fields of `next` that differ from `before` (null and undefined count as equal).
 *
 *  Edit forms hand over a WHOLE row. Written back as is, a screen opened before
 *  someone else changed the row (the taxi manager staffing a trip from his share
 *  page) would put his change back to what the screen had. Sending only the fields
 *  the user actually edited leaves the rest alone. No `before` → everything. */
export function changedFields<T extends object>(before: object | undefined, next: T): Partial<T> {
  if (!before) return next
  const b = before as Record<string, unknown>
  return Object.fromEntries(
    Object.entries(next).filter(([k, v]) => (b[k] ?? null) !== (v ?? null)),
  ) as Partial<T>
}
