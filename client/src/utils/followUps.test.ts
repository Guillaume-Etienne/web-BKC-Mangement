import { describe, it, expect } from 'vitest'
import { computeFollowUps, lastTouchOfBooking, type FollowUpInput } from './followUps'
import type { Booking, Enquiry } from '../types/database'

const NOW = new Date('2026-09-03T12:00:00Z')

function mkEnquiry(over: Partial<Enquiry> = {}): Enquiry {
  return {
    id: 'e1', created_at: '2026-08-01T10:00:00Z', channel: 'form',
    name: 'Cindy', email: null, phone: null, language: 'fr', message: 'Bonjour',
    source_id: null, source_other: null,
    party_size: 3, arrival_month: '2026-11',
    wants_lessons: true, wants_rental: false, wants_accommodation: true,
    budget_eur: null, status: 'talking', lost_reason: null,
    last_contact_at: '2026-09-02T10:00:00Z',
    client_id: null, booking_id: null, form_submission_id: null,
    crm_synced_at: null, crm_error: null,
    ...over,
  }
}

function mkBooking(over: Partial<Booking> = {}): Booking {
  return {
    id: 'b1', booking_number: 23, client_id: 'c1',
    check_in: '2026-11-07', check_out: '2026-11-21',
    visa_entry_date: null, visa_exit_date: null,
    status: 'provisional', notes: null,
    num_lessons: 2, num_equipment_rentals: 0, num_wing_lessons: 0, num_center_access: 0,
    center_access_rate: 5,
    arrival_time: null, departure_time: null,
    luggage_count: 0, boardbag_count: 0,
    taxi_arrival: false, taxi_departure: false,
    couples_count: 0, children_count: 0, amount_paid: 0, import_id: null,
    emergency_contact_name: null, emergency_contact_phone: null, emergency_contact_email: null,
    has_travel_insurance: false, waiver_accepted_at: null, waiver_version: null,
    referral_source: null,
    created_at: '2026-09-01T10:00:00Z',
    client: { first_name: 'Michel', last_name: 'Rulliat' } as Booking['client'],
    ...over,
  } as Booking
}

const NO_TOUCH = { payments: [], emails: [] }
const base: FollowUpInput = { enquiries: [], bookings: [], touch: NO_TOUCH }

describe('computeFollowUps', () => {
  it('is empty when everyone was spoken to recently', () => {
    expect(computeFollowUps({
      ...base,
      enquiries: [mkEnquiry({ last_contact_at: '2026-09-02T10:00:00Z' })],
      bookings: [mkBooking({ created_at: '2026-09-01T10:00:00Z' })],
    }, NOW)).toEqual([])
  })

  it('always lists an enquiry nobody has read, even one that arrived today', () => {
    const fresh = mkEnquiry({
      created_at: '2026-09-03T09:00:00Z', last_contact_at: '2026-09-03T09:00:00Z',
      party_size: null, arrival_month: null,
      wants_lessons: false, wants_rental: false, wants_accommodation: false,
    })
    const [row] = computeFollowUps({ ...base, enquiries: [fresh] }, NOW)
    expect(row.tone).toBe('urgent')
    expect(row.reason).toContain('never read')
    expect(row.silenceDays).toBe(0)
    expect(row.wants).toBe('not qualified yet')
  })

  it('leaves a qualified enquiry alone until the silence is real', () => {
    const six = computeFollowUps({ ...base, enquiries: [mkEnquiry({ last_contact_at: '2026-08-28T12:00:00Z' })] }, NOW)
    expect(six).toEqual([])   // 6 days
    const seven = computeFollowUps({ ...base, enquiries: [mkEnquiry({ last_contact_at: '2026-08-27T12:00:00Z' })] }, NOW)
    expect(seven).toHaveLength(1)
    expect(seven[0].reason).toBe('no news for 7 days')
  })

  it('never lists a won or lost enquiry', () => {
    for (const status of ['won', 'lost'] as const) {
      const settled = mkEnquiry({ status, last_contact_at: '2026-06-01T10:00:00Z' })
      expect(computeFollowUps({ ...base, enquiries: [settled] }, NOW)).toEqual([])
    }
  })

  it('catches a provisional booking gone quiet — the case nothing used to watch', () => {
    const quiet = mkBooking({ created_at: '2026-08-10T10:00:00Z' })
    const [row] = computeFollowUps({ ...base, bookings: [quiet] }, NOW)
    expect(row.kind).toBe('booking')
    expect(row.name).toBe('Michel Rulliat')
    expect(row.silenceDays).toBe(24)
    expect(row.wants).toContain('2 lessons')
  })

  it('ignores confirmed and cancelled bookings — silence there is normal', () => {
    for (const status of ['confirmed', 'cancelled'] as const) {
      const b = mkBooking({ status, created_at: '2026-06-01T10:00:00Z' })
      expect(computeFollowUps({ ...base, bookings: [b] }, NOW)).toEqual([])
    }
  })

  it('counts a payment or an email as a sign of life', () => {
    const b = mkBooking({ created_at: '2026-08-01T10:00:00Z' })
    const withPayment = computeFollowUps({
      ...base, bookings: [b],
      touch: { payments: [{ booking_id: 'b1', date: '2026-09-02' }], emails: [] },
    }, NOW)
    expect(withPayment).toEqual([])

    const withEmail = computeFollowUps({
      ...base, bookings: [b],
      touch: { payments: [], emails: [{ booking_id: 'b1', sent_at: '2026-09-01T08:00:00Z' }] },
    }, NOW)
    expect(withEmail).toEqual([])
  })

  it('does not let a future stay count as a sign of life', () => {
    // check_in is in November; without the guard the booking would look fresh.
    const b = mkBooking({ created_at: '2026-07-01T10:00:00Z', check_in: '2026-11-07' })
    const [row] = computeFollowUps({ ...base, bookings: [b] }, NOW)
    expect(row.silenceDays).toBeGreaterThan(60)
  })

  it('flags a stay that happened while the booking stayed provisional, silent or not', () => {
    const over = mkBooking({
      check_in: '2026-08-20', check_out: '2026-08-27', created_at: '2026-09-03T09:00:00Z',
    })
    const [row] = computeFollowUps({ ...base, bookings: [over] }, NOW)
    expect(row.tone).toBe('urgent')
    expect(row.reason).toContain('stay is over')
  })

  it('puts the urgent first, then the longest wait', () => {
    const rows = computeFollowUps({
      ...base,
      enquiries: [
        mkEnquiry({ id: 'old', name: 'Old', last_contact_at: '2026-07-01T10:00:00Z' }),
        mkEnquiry({ id: 'mid', name: 'Mid', last_contact_at: '2026-08-20T10:00:00Z' }),
        mkEnquiry({
          id: 'raw', name: 'Raw', last_contact_at: '2026-09-03T10:00:00Z',
          party_size: null, arrival_month: null,
          wants_lessons: false, wants_rental: false, wants_accommodation: false,
        }),
      ],
    }, NOW)
    expect(rows.map(r => r.name)).toEqual(['Raw', 'Old', 'Mid'])
  })

  it('is stable: same input, same order', () => {
    const input = {
      ...base,
      enquiries: [
        mkEnquiry({ id: 'a', name: 'A', last_contact_at: '2026-08-01T10:00:00Z' }),
        mkEnquiry({ id: 'b', name: 'B', last_contact_at: '2026-08-01T10:00:00Z' }),
      ],
    }
    expect(computeFollowUps(input, NOW).map(r => r.id))
      .toEqual(computeFollowUps({ ...input, enquiries: [...input.enquiries].reverse() }, NOW).map(r => r.id))
  })
})

describe('lastTouchOfBooking', () => {
  it('is the creation date when nothing else ever happened', () => {
    expect(lastTouchOfBooking(mkBooking(), NO_TOUCH, NOW)).toBe('2026-09-01T10:00:00Z')
  })

  it('takes the most recent of creation, payments and emails', () => {
    const touch = {
      payments: [{ booking_id: 'b1', date: '2026-09-02' }],
      emails: [{ booking_id: 'b1', sent_at: '2026-08-15T10:00:00Z' }],
    }
    expect(lastTouchOfBooking(mkBooking(), touch, NOW)).toBe('2026-09-02')
  })

  it('ignores rows belonging to another booking', () => {
    const touch = { payments: [{ booking_id: 'other', date: '2026-09-03' }], emails: [] }
    expect(lastTouchOfBooking(mkBooking(), touch, NOW)).toBe('2026-09-01T10:00:00Z')
  })

  it('falls back to created_at on an email that was never sent', () => {
    const touch = {
      payments: [],
      emails: [{ booking_id: 'b1', sent_at: null, created_at: '2026-09-02T10:00:00Z' }],
    }
    expect(lastTouchOfBooking(mkBooking(), touch, NOW)).toBe('2026-09-02T10:00:00Z')
  })
})
