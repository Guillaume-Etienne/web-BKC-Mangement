/** "Is this someone we already have?" — the one rule, shared by every path that
 *  turns an outside contact into a `clients` row.
 *
 *  Why it exists: three paths create clients (the booking wizard, approving a
 *  form submission, the MCP conversion) and only the wizard let gui pick an
 *  existing one. The other two inserted blindly — including when the enquiry
 *  already carried a `client_id` that gui had attached by hand. A second row
 *  for someone who already came splits their history in two, and "already been
 *  here in 2026" is the single most useful thing the enquiry list can say.
 *
 *  ⚠️ Matching is deliberately narrow: an explicit link first, then an exact
 *  email. Never a name. These paths run without gui watching, and on fuzzy data
 *  an automatic merge mixes two people's files — the same reason
 *  `findCandidateEnquiries` only ever *suggests*. Two guests called "Julie"
 *  must stay two rows; the cost of a rare duplicate is a merge, the cost of a
 *  wrong merge is a corrupted file.
 */

/** Trimmed and lower-cased, or null when there is nothing worth comparing. */
export function normEmail(value: string | null | undefined): string | null {
  const v = (value ?? '').trim().toLowerCase()
  return v === '' ? null : v
}

/** The minimum a row needs for this module to reason about it. */
export interface ClientLike {
  id: string
  email: string | null
}

export type ClientMatchReason = 'linked' | 'email'

export interface ClientMatch<T extends ClientLike> {
  client: T
  /** `linked`: gui already tied this enquiry to that client. `email`: exact address. */
  reason: ClientMatchReason
}

/** The client to reuse, or null when this is genuinely someone new.
 *
 *  `linkedClientId` wins over the email: it is a human decision already taken
 *  (the enquiry's `client_id`), and a person can perfectly well book with a
 *  different address than the one they first wrote from. */
export function findExistingClient<T extends ClientLike>(
  clients: T[],
  { linkedClientId, email }: { linkedClientId?: string | null; email?: string | null }
): ClientMatch<T> | null {
  if (linkedClientId) {
    const linked = clients.find(c => c.id === linkedClientId)
    if (linked) return { client: linked, reason: 'linked' }
    // Falls through on purpose: a dangling id (client deleted) must not stop us
    // from finding the same person by email.
  }

  const wanted = normEmail(email)
  if (wanted) {
    const byEmail = clients.find(c => normEmail(c.email) === wanted)
    if (byEmail) return { client: byEmail, reason: 'email' }
  }

  return null
}

/** What the incoming form can add to a client we are reusing — and nothing else.
 *
 *  Only fields the existing row leaves empty. Reusing a client must never
 *  overwrite what gui typed: the booking form is filled by the guest, in a
 *  hurry, and a phone number corrected by hand three months ago outranks
 *  whatever they retyped today. Empty strings count as empty on both sides. */
export function blanksToFill<T extends object>(existing: T, incoming: Partial<T>): Partial<T> {
  const patch: Partial<T> = {}
  for (const key of Object.keys(incoming) as (keyof T)[]) {
    const next = incoming[key]
    if (next === null || next === undefined || next === '') continue
    const current = existing[key]
    if (current === null || current === undefined || current === '') patch[key] = next
  }
  return patch
}
