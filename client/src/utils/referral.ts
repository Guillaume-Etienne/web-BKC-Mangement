import type { EnquirySource } from '../types/database'

/** "How did you hear about us?", turned into one comparable answer.
 *
 *  The same question used to be asked twice, two different ways: a curated
 *  trilingual list on the enquiry form (`enquiry_sources`), a free text box on
 *  the booking form. Half the attribution ended up as an id and half as
 *  whatever someone typed in their own language, so the end-of-season stat —
 *  the entire reason the list exists — could not be computed.
 *
 *  Resolved to the **English label**, not the visitor's: the answer has to group
 *  with the others, and "Instagram" / "Instagram" / "Instagram" is a coincidence
 *  that stops being one on the first source with a real translation. The chosen
 *  id also travels in the payload, so a later `bookings.source_id` column can be
 *  backfilled exactly rather than by matching strings.
 */
export function referralLabel(
  choice: { referral_source_id: string; referral_source: string },
  sources: EnquirySource[]
): string {
  const { referral_source_id: id, referral_source: free } = choice
  // "Other" is the honest answer for someone who came through a friend. It is
  // kept as typed — that free line is also how gui learns which entry to add.
  if (id === 'other') return free.trim()
  if (!id) return ''
  const source = sources.find(s => s.id === id)
  // An id with no matching row means the list changed under the visitor's feet.
  // Better an empty answer than a stale label that would be counted as fact.
  return source?.label?.en?.trim() ?? ''
}
