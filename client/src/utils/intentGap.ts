/** What the enquiry said they wanted, that the booking does not show.
 *
 *  "Ce qu'ils veulent" is written in three vocabularies that nothing ever
 *  reconciled: three group booleans on the enquiry (`wants_*`), six per-person
 *  flags on the participants, and the `bookings.num_*` counters cached from
 *  those. So an intention could be captured in the first conversation and then
 *  quietly fail to exist on the booking — nobody was comparing.
 *
 *  ⚠️ This raises a question, it never fills anything in. Turning "they asked
 *  about lessons" into a lesson flag would invent a fact: the guest may have
 *  changed their mind, or gui may have said no. `ENQUIRIES.md` settled the same
 *  point for participants — a conversion creates no named traveller — and the
 *  reason is identical: an invented number propagates all the way into the
 *  accounts, where nobody can tell it apart from a real one.
 *
 *  Only omissions are reported. A booking with MORE than the enquiry asked for
 *  is the normal, happy case: people add things once they are talking to you.
 */
import type { Enquiry } from '../types/database'

/** What the booking currently says, in the wizard's own terms. */
export interface BookingIntent {
  /** Named travellers on the booking. */
  participantCount: number
  /** Anyone down for a kite or a wing lesson. */
  wantsLessons: boolean
  wantsRental: boolean
  /** A room, or a stay somewhere we do not price ourselves. */
  hasAccommodation: boolean
}

export function intentGaps(enquiry: Enquiry, booking: BookingIntent): string[] {
  const gaps: string[] = []

  if (enquiry.wants_lessons && !booking.wantsLessons) {
    gaps.push('asked about lessons — nobody on this booking is down for one')
  }
  if (enquiry.wants_rental && !booking.wantsRental) {
    gaps.push('asked about rental — nobody on this booking is down for one')
  }
  if (enquiry.wants_accommodation && !booking.hasAccommodation) {
    gaps.push('asked about accommodation — no room is booked')
  }
  // Only once somebody has been named: before that this is "not filled in yet",
  // not a discrepancy, and a panel that nags from the first second gets ignored.
  if (enquiry.party_size != null && booking.participantCount > 0
      && enquiry.party_size > booking.participantCount) {
    gaps.push(`said ${enquiry.party_size} people — ${booking.participantCount} named here`)
  }

  return gaps
}
