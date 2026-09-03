import { describe, it, expect } from 'vitest'
import { computeAttribution, bookingOrigin, originKey, type AttributionInput } from './attribution'
import type { Booking, Enquiry, EnquirySource } from '../types/database'

const sources: EnquirySource[] = [
  { id: 's-insta', label: { fr: 'Instagram', en: 'Instagram', es: 'Instagram' }, sort_order: 1, is_active: true },
  { id: 's-friend', label: { fr: 'Un ami', en: 'A friend', es: 'Un amigo' }, sort_order: 2, is_active: true },
]

function mkEnquiry(over: Partial<Enquiry> = {}): Enquiry {
  return {
    id: 'e1', created_at: '2026-08-01T10:00:00Z', channel: 'form',
    name: 'Someone', email: null, phone: null, language: 'fr', message: null,
    source_id: null, source_other: null,
    party_size: 2, arrival_month: '2026-11',
    wants_lessons: false, wants_rental: false, wants_accommodation: true,
    budget_eur: null, status: 'talking', lost_reason: null,
    last_contact_at: '2026-08-01T10:00:00Z',
    client_id: null, booking_id: null, form_submission_id: null,
    crm_synced_at: null, crm_error: null,
    ...over,
  }
}

function mkBooking(over: Partial<Booking> = {}): Booking {
  return {
    id: 'b1', booking_number: 1, client_id: 'c1',
    check_in: '2026-11-07', check_out: '2026-11-14',
    visa_entry_date: null, visa_exit_date: null,
    status: 'confirmed', notes: null,
    num_lessons: 0, num_equipment_rentals: 0, num_wing_lessons: 0, num_center_access: 0,
    center_access_rate: 5,
    arrival_time: null, departure_time: null,
    luggage_count: 0, boardbag_count: 0,
    taxi_arrival: false, taxi_departure: false,
    couples_count: 0, children_count: 0, amount_paid: 0, import_id: null,
    emergency_contact_name: null, emergency_contact_phone: null, emergency_contact_email: null,
    has_travel_insurance: false, waiver_accepted_at: null, waiver_version: null,
    referral_source: null,
    ...over,
  } as Booking
}

const base: AttributionInput = { enquiries: [], bookings: [], submissions: [], sources }

describe('originKey', () => {
  it('folds spelling and spacing so one answer stays one source', () => {
    expect(originKey({ sourceId: null, freeText: ' Instagram ' }))
      .toBe(originKey({ sourceId: null, freeText: 'instagram' }))
  })

  it('keeps a chosen source apart from a free line that reads the same', () => {
    expect(originKey({ sourceId: 's-insta', freeText: null })).not
      .toBe(originKey({ sourceId: null, freeText: 'Instagram' }))
  })

  it('has one bucket for "we never asked"', () => {
    expect(originKey({ sourceId: null, freeText: null })).toBe('unknown')
    expect(originKey({ sourceId: null, freeText: '   ' })).toBe('unknown')
  })
})

describe('bookingOrigin', () => {
  const booking = mkBooking({ id: 'b1', referral_source: 'typed on the booking' })

  it("prefers the booking's own answer over everything inherited", () => {
    const enquiry = mkEnquiry({ booking_id: 'b1', source_id: 's-insta' })
    const withOwn = mkBooking({ id: 'b1', source_id: 's-friend', referral_source: 'A friend' })
    expect(bookingOrigin(withOwn, [enquiry], [])).toEqual({ sourceId: 's-friend', freeText: null })
  })

  it('prefers the enquiry it came from — the answer given first', () => {
    const enquiry = mkEnquiry({ booking_id: 'b1', source_id: 's-insta' })
    expect(bookingOrigin(booking, [enquiry], [])).toEqual({ sourceId: 's-insta', freeText: null })
  })

  it('falls through an enquiry that was never asked the question', () => {
    const enquiry = mkEnquiry({ booking_id: 'b1', source_id: null, source_other: null })
    const sub = { created_booking_id: 'b1', payload: { referral_source: 'A friend', referral_source_id: 's-friend' } }
    expect(bookingOrigin(booking, [enquiry], [sub])).toEqual({ sourceId: 's-friend', freeText: 'A friend' })
  })

  it('uses the booking form when there was no enquiry', () => {
    const sub = { created_booking_id: 'b1', payload: { referral_source: 'a kite school', referral_source_id: undefined } }
    expect(bookingOrigin(booking, [], [sub])).toEqual({ sourceId: null, freeText: 'a kite school' })
  })

  it('falls back to the booking own field for anything older or typed by hand', () => {
    expect(bookingOrigin(booking, [], [])).toEqual({ sourceId: null, freeText: 'typed on the booking' })
  })

  it('is unknown when nobody ever answered', () => {
    expect(bookingOrigin(mkBooking({ referral_source: null }), [], []))
      .toEqual({ sourceId: null, freeText: null })
  })
})

describe('computeAttribution', () => {
  it('is empty and honest with nothing to count', () => {
    const s = computeAttribution(base)
    expect(s.rows).toEqual([])
    expect(s.conversion).toEqual({ open: 0, won: 0, lost: 0, rate: null })
  })

  it('counts who wrote in and who actually came, per source', () => {
    const s = computeAttribution({
      ...base,
      enquiries: [
        mkEnquiry({ id: 'e1', source_id: 's-insta', status: 'won', booking_id: 'b1' }),
        mkEnquiry({ id: 'e2', source_id: 's-insta', status: 'lost' }),
        mkEnquiry({ id: 'e3', source_id: 's-friend', status: 'talking' }),
      ],
      bookings: [mkBooking({ id: 'b1' })],
    })
    const insta = s.rows.find(r => r.key === 's-insta')!
    expect(insta).toMatchObject({ label: 'Instagram', enquiries: 2, bookings: 1 })
    expect(s.rows.find(r => r.key === 's-friend')).toMatchObject({ enquiries: 1, bookings: 0 })
  })

  it('puts what actually converted at the top', () => {
    const s = computeAttribution({
      ...base,
      enquiries: [
        mkEnquiry({ id: 'e1', source_id: 's-friend', status: 'won', booking_id: 'b1' }),
        mkEnquiry({ id: 'e2', source_id: 's-insta' }),
        mkEnquiry({ id: 'e3', source_id: 's-insta' }),
        mkEnquiry({ id: 'e4', source_id: 's-insta' }),
      ],
      bookings: [mkBooking({ id: 'b1' })],
    })
    // Instagram has three times the enquiries; the friend brought the guest.
    expect(s.rows[0].key).toBe('s-friend')
  })

  it('does not count a cancelled booking as somebody who came', () => {
    const s = computeAttribution({
      ...base,
      bookings: [mkBooking({ id: 'b1', status: 'cancelled', referral_source: 'Instagram' })],
    })
    expect(s.rows).toEqual([])
  })

  it('names a source that has since been removed instead of hiding it', () => {
    const s = computeAttribution({
      ...base,
      enquiries: [mkEnquiry({ source_id: 's-gone' })],
    })
    expect(s.rows[0].label).toBe('Removed source')
  })

  it('shows what it could not classify rather than dropping it', () => {
    const s = computeAttribution({
      ...base,
      enquiries: [mkEnquiry({ source_id: null, source_other: null })],
      bookings: [mkBooking({ referral_source: null })],
    })
    expect(s.rows).toHaveLength(1)
    expect(s.rows[0]).toMatchObject({ key: 'unknown', label: 'Unknown', enquiries: 1, bookings: 1 })
  })

  it('rates conversion on settled enquiries only — an open one has not failed', () => {
    const s = computeAttribution({
      ...base,
      enquiries: [
        mkEnquiry({ id: '1', status: 'won' }),
        mkEnquiry({ id: '2', status: 'lost' }),
        mkEnquiry({ id: '3', status: 'talking' }),
        mkEnquiry({ id: '4', status: 'new' }),
      ],
    })
    expect(s.conversion).toEqual({ open: 2, won: 1, lost: 1, rate: 0.5 })
  })

  it('has no rate at all while nothing is settled', () => {
    const s = computeAttribution({ ...base, enquiries: [mkEnquiry({ status: 'talking' })] })
    expect(s.conversion.rate).toBeNull()
  })

  it('scopes to a season by arrival month and check-in', () => {
    const input: AttributionInput = {
      ...base,
      enquiries: [
        mkEnquiry({ id: 'in', source_id: 's-insta', arrival_month: '2026-11' }),
        mkEnquiry({ id: 'out', source_id: 's-insta', arrival_month: '2027-06' }),
      ],
      bookings: [
        mkBooking({ id: 'b-in', check_in: '2026-11-07', referral_source: 'Instagram' }),
        mkBooking({ id: 'b-out', check_in: '2027-06-07', referral_source: 'Instagram' }),
      ],
      range: { start: '2026-09-01', end: '2027-03-15' },
    }
    const s = computeAttribution(input)
    expect(s.rows.find(r => r.key === 's-insta')!.enquiries).toBe(1)
    expect(s.rows.find(r => r.key === 'other:instagram')!.bookings).toBe(1)
  })

  it('says how many enquiries a season view cannot place', () => {
    const s = computeAttribution({
      ...base,
      enquiries: [mkEnquiry({ arrival_month: null }), mkEnquiry({ id: 'e2', arrival_month: '2026-11' })],
      range: { start: '2026-09-01', end: '2027-03-15' },
    })
    expect(s.undatedEnquiries).toBe(1)
    expect(s.conversion.open).toBe(1)   // only the dated one is in scope
  })
})
