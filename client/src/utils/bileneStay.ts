import { addDaysISO, daysBetween } from './dates'

// ─── The Bilene stay, as the booking form describes it ────────────────────────
// The form asks the same thing three ways: a number of nights, the transfer
// dates, and the country entry/exit dates. They disagree more often than one
// would think. Booking #029 (form of 2026-09-04) was created 14/01 → 21/01
// because "nights in Bilene" sat on its default of 7, while the guest's airport
// transfer was on 06/02. Four of the eight upcoming form bookings still carried
// that untouched 7 on 2026-11-25.
//
// Rule of thumb, shared by the public form and the admin review screen:
//  - the transfer dates are what a driver acts on → the most reliable signal;
//  - nights is what the guest typed (or did not touch);
//  - the country exit may legitimately be LATER (they travel elsewhere in
//    Mozambique after Bilene) — information, never an error.

/** The few answers this needs — shared by the live form state and the stored payload. */
export interface StayAnswers {
  country_entry_date?: string
  country_exit_date?: string
  nights_bilene?: number | null
  transfer_to_bilene_date?: string
  transfer_to_airport_date?: string
}

/** The day they reach Bilene: the transfer pickup when there is one, else the
 *  country entry. '' when neither is known yet. */
export function bileneStart(a: StayAnswers): string {
  return a.transfer_to_bilene_date || a.country_entry_date || ''
}

/** Nights implied by the dates: arrival in Bilene → airport transfer. null when
 *  the dates do not give a positive count (missing, or the wrong way round). */
export function nightsFromDates(a: StayAnswers): number | null {
  const start = bileneStart(a)
  const end = a.transfer_to_airport_date
  if (!start || !end) return null
  const n = daysBetween(start, end)
  return n > 0 ? n : null
}

/** The day they leave Bilene according to the nights they typed. */
export function leaveDateFromNights(a: StayAnswers): string {
  const start = bileneStart(a)
  const n = a.nights_bilene ?? 0
  return start && n > 0 ? addDaysISO(start, n) : ''
}

/** The typed nights and the airport transfer point to two different days. */
export function nightsMismatch(a: StayAnswers): { byNights: string; byTransfer: string } | null {
  const byNights = leaveDateFromNights(a)
  const byTransfer = a.transfer_to_airport_date || ''
  if (!byNights || !byTransfer || byNights === byTransfer) return null
  return { byNights, byTransfer }
}

/** Public form: when an edit changes what the dates imply, the nights follow.
 *  Only on a CHANGE of the implied value, so a guest who then corrects the
 *  nights by hand is not overruled on the next keystroke elsewhere. */
export function withAutoNights<T extends StayAnswers>(prev: T, next: T): T {
  const before = nightsFromDates(prev)
  const after = nightsFromDates(next)
  if (after === null || after === before || after === next.nights_bilene) return next
  return { ...next, nights_bilene: after }
}

/** Admin review: the check-in / check-out to propose for a new booking.
 *  The transfers win over the typed nights (see the header). */
export function proposedStay(a: StayAnswers): { checkIn: string; checkOut: string } {
  const checkIn = bileneStart(a)
  return { checkIn, checkOut: a.transfer_to_airport_date || leaveDateFromNights(a) }
}

export type StayIssue =
  | { kind: 'checkin_vs_transfer'; transfer: string }
  | { kind: 'checkout_vs_transfer'; transfer: string }
  | { kind: 'nights_vs_dates'; typed: number; dates: number }
  | { kind: 'exit_before_checkout'; exit: string }
  /** Not a problem — said so gui knows the later exit was seen. */
  | { kind: 'exit_after_checkout'; exit: string }

/** Everything worth a look between the dates about to be booked and what the
 *  form said. Empty = all consistent. Only 'exit_after_checkout' is benign. */
export function stayIssues(a: StayAnswers, checkIn: string, checkOut: string): StayIssue[] {
  const out: StayIssue[] = []
  if (checkIn && a.transfer_to_bilene_date && a.transfer_to_bilene_date !== checkIn)
    out.push({ kind: 'checkin_vs_transfer', transfer: a.transfer_to_bilene_date })
  if (checkOut && a.transfer_to_airport_date && a.transfer_to_airport_date !== checkOut)
    out.push({ kind: 'checkout_vs_transfer', transfer: a.transfer_to_airport_date })
  const typed = a.nights_bilene ?? 0
  if (checkIn && checkOut && typed > 0) {
    const dates = daysBetween(checkIn, checkOut)
    if (dates !== typed) out.push({ kind: 'nights_vs_dates', typed, dates })
  }
  if (checkOut && a.country_exit_date) {
    if (a.country_exit_date < checkOut) out.push({ kind: 'exit_before_checkout', exit: a.country_exit_date })
    else if (a.country_exit_date > checkOut) out.push({ kind: 'exit_after_checkout', exit: a.country_exit_date })
  }
  return out
}
