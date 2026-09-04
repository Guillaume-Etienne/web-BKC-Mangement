/** What a booking is still missing before it can be worked.
 *
 *  Lived inside `BookingsPage` until now. It moved out because it decides
 *  something real — the ⚠️ marker, and which bookings the "Complete" and
 *  "Incomplete" filters show — and a rule that decides gets a test.
 */
import type { Booking, BookingParticipant } from '../types/database'

export type MissingField =
  | 'room'
  | 'participants'
  | 'passports'
  | 'arrival_time'
  | 'visa_dates'
  | 'taxi_time'

/** Guests of this booking whose passport number is still blank.
 *
 *  The visa letter is built from these numbers: one guest without one and the
 *  document cannot be issued for the group. Whitespace counts as blank — a
 *  space typed into the field looks filled and is not. */
export function guestsMissingPassport(
  bookingId: string,
  participants: BookingParticipant[],
): BookingParticipant[] {
  return participants.filter(p => p.booking_id === bookingId && !p.passport_number?.trim())
}

export function getMissingFields(
  b: Booking,
  hasRoom: boolean,
  bParticipants: BookingParticipant[],
): MissingField[] {
  if (b.status === 'cancelled') return []
  const missing: MissingField[] = []
  if (!hasRoom) missing.push('room')

  const guests = bParticipants.filter(p => p.booking_id === b.id)
  if (guests.length === 0) {
    missing.push('participants')
  } else if (guestsMissingPassport(b.id, bParticipants).length > 0) {
    // Only once somebody is listed: "no guests" already says everything there
    // is to say, and stacking a second warning on top of it says it twice.
    missing.push('passports')
  }

  if (!b.arrival_time) missing.push('arrival_time')
  if (!b.visa_entry_date || !b.visa_exit_date) missing.push('visa_dates')
  if ((b.taxi_arrival && !b.arrival_time) || (b.taxi_departure && !b.departure_time)) missing.push('taxi_time')
  return missing
}

export const MISSING_LABELS: Record<MissingField, string> = {
  room: 'No room',
  participants: 'No guests',
  passports: 'A guest has no passport number',
  arrival_time: 'No arrival time',
  visa_dates: 'Visa dates missing',
  taxi_time: 'Taxi time missing',
}
