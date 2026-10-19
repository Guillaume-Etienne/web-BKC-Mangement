/** What a booking is still missing before it can be worked.
 *
 *  Lived inside `BookingsPage` until now. It moved out because it decides
 *  something real — the ⚠️ marker, and which bookings the "Complete" and
 *  "Incomplete" filters show — and a rule that decides gets a test.
 */
import type { Booking, BookingParticipant, TaxiTrip } from '../types/database'
import { isDayVisitor } from './dayVisitor'

export type MissingField =
  | 'room'
  | 'participants'
  | 'passports'
  | 'arrival_time'
  | 'visa_dates'
  | 'visa_incoherent'
  | 'taxi_time'
  | 'taxi_off_stay'

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

/** Why the visa dates cannot be right, or null. They may be wider than the
 *  stay (guests land a few days early), never narrower or reversed: the letter
 *  prints them as they are, and PROD had an exit date before the entry date
 *  (#033, #054) and an exit before the check-out (#021) that nobody noticed. */
export function visaDatesProblem(
  entry: string | null | undefined, exit: string | null | undefined,
  checkIn: string | null | undefined, checkOut: string | null | undefined,
): string | null {
  if (!entry || !exit) return null
  if (exit < entry) return 'The exit date is before the entry date.'
  if (checkIn && entry > checkIn) return 'The guests enter Mozambique after their check-in.'
  if (checkOut && exit < checkOut) return 'The guests leave Mozambique before their check-out.'
  return null
}

/** A transfer more than a day away from the stay it belongs to: the stay was
 *  moved and the taxi was not (#029: departure 06/02 for a stay ending 21/01).
 *  A day of slack on either side covers night flights. */
export function taxiOffStay(b: Pick<Booking, 'check_in' | 'check_out'>, t: Pick<TaxiTrip, 'date'>): boolean {
  const shift = (iso: string, d: number) => {
    const x = new Date(iso + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10)
  }
  return t.date < shift(b.check_in, -1) || t.date > shift(b.check_out, 1)
}

export function getMissingFields(
  b: Booking,
  hasRoom: boolean,
  bParticipants: BookingParticipant[],
  taxiTrips: Pick<TaxiTrip, 'booking_id' | 'date'>[] = [],
): MissingField[] {
  if (b.status === 'cancelled') return []
  // A walk-in visit is a lesson or a rental, settled on the spot: no room,
  // passport, arrival time or visa is ever coming (utils/dayVisitor.ts).
  if (isDayVisitor(b)) return []
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
  else if (visaDatesProblem(b.visa_entry_date, b.visa_exit_date, b.check_in, b.check_out)) missing.push('visa_incoherent')
  if ((b.taxi_arrival && !b.arrival_time) || (b.taxi_departure && !b.departure_time)) missing.push('taxi_time')
  if (taxiTrips.some(t => t.booking_id === b.id && taxiOffStay(b, t))) missing.push('taxi_off_stay')
  return missing
}

export const MISSING_LABELS: Record<MissingField, string> = {
  room: 'No room',
  participants: 'No guests',
  passports: 'A guest has no passport number',
  arrival_time: 'No arrival time',
  visa_dates: 'Visa dates missing',
  visa_incoherent: 'Visa dates do not cover the stay',
  taxi_time: 'Taxi time missing',
  taxi_off_stay: 'A taxi is dated outside the stay',
}
