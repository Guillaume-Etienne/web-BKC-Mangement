import { describe, it, expect } from 'vitest'
import { getMissingFields, guestsMissingPassport, MISSING_LABELS } from './bookingCompleteness'
import type { Booking, BookingParticipant } from '../types/database'

function mkBooking(over: Partial<Booking> = {}): Booking {
  return {
    id: 'b1', booking_number: 1, client_id: 'c1',
    check_in: '2026-11-07', check_out: '2026-11-14',
    visa_entry_date: '2026-11-07', visa_exit_date: '2026-11-14',
    status: 'confirmed', notes: null,
    num_lessons: 0, num_equipment_rentals: 0, num_wing_lessons: 0, num_center_access: 0,
    center_access_rate: 5,
    arrival_time: '14:00', departure_time: '09:00',
    luggage_count: 0, boardbag_count: 0,
    taxi_arrival: false, taxi_departure: false,
    couples_count: 0, children_count: 0, amount_paid: 0, import_id: null,
    emergency_contact_name: null, emergency_contact_phone: null, emergency_contact_email: null,
    has_travel_insurance: false, waiver_accepted_at: null, waiver_version: null,
    referral_source: null,
    ...over,
  } as Booking
}

function mkGuest(over: Partial<BookingParticipant> = {}): BookingParticipant {
  return {
    id: 'p1', booking_id: 'b1', first_name: 'Michel', last_name: 'Rulliat',
    passport_number: '19FR12345', client_id: null, kite_level: null,
    does_kite: true, brings_own_gear: false, needs_storage: false,
    wants_kite_lessons: false, wants_kite_rental: false, wants_wing_lessons: false,
    notes: null, created_at: '2026-08-16T10:00:00Z',
    ...over,
  }
}

describe('getMissingFields', () => {
  it('says nothing when the booking is complete', () => {
    expect(getMissingFields(mkBooking(), true, [mkGuest()])).toEqual([])
  })

  it('never flags a cancelled booking — there is nothing left to finish', () => {
    const missing = getMissingFields(mkBooking({ status: 'cancelled', arrival_time: null }), false, [])
    expect(missing).toEqual([])
  })

  it('flags the room, the arrival time and the visa dates', () => {
    const b = mkBooking({ arrival_time: null, visa_entry_date: null })
    expect(getMissingFields(b, false, [mkGuest()])).toEqual(['room', 'arrival_time', 'visa_dates'])
  })

  it('flags a taxi booked with no time to pick anyone up at', () => {
    const b = mkBooking({ taxi_departure: true, departure_time: null })
    expect(getMissingFields(b, true, [mkGuest()])).toContain('taxi_time')
  })
})

describe('the passport rule', () => {
  it('flags a guest whose passport number is blank', () => {
    const guests = [mkGuest(), mkGuest({ id: 'p2', first_name: 'Sonia', passport_number: null })]
    expect(getMissingFields(mkBooking(), true, guests)).toEqual(['passports'])
  })

  it('treats a space as blank — a typed space looks filled and is not', () => {
    const guests = [mkGuest({ passport_number: '   ' })]
    expect(getMissingFields(mkBooking(), true, guests)).toEqual(['passports'])
  })

  it('does not say it twice when there is no guest at all', () => {
    // "No guests" already says everything; adding "no passport" on top of it
    // would put two warnings on the same fact.
    const missing = getMissingFields(mkBooking(), true, [])
    expect(missing).toEqual(['participants'])
    expect(missing).not.toContain('passports')
  })

  it('ignores the guests of other bookings', () => {
    const guests = [mkGuest(), mkGuest({ id: 'p9', booking_id: 'b2', passport_number: null })]
    expect(getMissingFields(mkBooking(), true, guests)).toEqual([])
  })

  it('names who is missing one, so the fix is one click away', () => {
    const guests = [mkGuest(), mkGuest({ id: 'p2', first_name: 'Sonia', passport_number: '' })]
    expect(guestsMissingPassport('b1', guests).map(g => g.first_name)).toEqual(['Sonia'])
  })
})

describe('MISSING_LABELS', () => {
  it('has a sentence for every field, so no marker can render blank', () => {
    const b = mkBooking({ arrival_time: null, visa_entry_date: null, taxi_arrival: true })
    for (const field of getMissingFields(b, false, [mkGuest({ passport_number: null })])) {
      expect(MISSING_LABELS[field]).toBeTruthy()
    }
  })
})
