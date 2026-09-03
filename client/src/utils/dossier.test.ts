import { describe, it, expect } from 'vitest'
import { buildDossier, dossierMoney, daysSinceLastTouch, type DossierInput } from './dossier'
import type { ActivityBooking, Booking, EmailLog, Enquiry, EnquiryNote, FormSubmission, Payment, TaxiTrip } from '../types/database'

const EMPTY: DossierInput = {
  enquiries: [], enquiryNotes: [], submissions: [], bookings: [],
  payments: [], emails: [], taxiTrips: [], activities: [],
}

function mkBooking(over: Partial<Booking> = {}): Booking {
  return {
    id: 'b1', booking_number: 23, client_id: 'c1',
    check_in: '2026-11-07', check_out: '2026-11-21',
    visa_entry_date: null, visa_exit_date: null,
    status: 'provisional', notes: null,
    num_lessons: 0, num_equipment_rentals: 0, num_wing_lessons: 0, num_center_access: 0,
    center_access_rate: 5,
    arrival_time: null, departure_time: null,
    luggage_count: 0, boardbag_count: 0,
    taxi_arrival: false, taxi_departure: false,
    couples_count: 0, children_count: 0, amount_paid: 0, import_id: null,
    emergency_contact_name: null, emergency_contact_phone: null, emergency_contact_email: null,
    has_travel_insurance: false, waiver_accepted_at: null, waiver_version: null,
    referral_source: null,
    created_at: '2026-08-16T15:39:03Z',
    ...over,
  } as Booking
}

function mkPayment(over: Partial<Payment> = {}): Payment {
  return {
    id: 'p1', booking_id: 'b1', date: '2026-09-01', amount: 500,
    method: 'transfer', is_deposit: false, is_verified: true, is_discount: false, notes: null,
    ...over,
  } as Payment
}

describe('buildDossier', () => {
  it('is empty when nothing has happened', () => {
    expect(buildDossier(EMPTY)).toEqual([])
  })

  it('puts the newest event first', () => {
    const events = buildDossier({
      ...EMPTY,
      bookings: [mkBooking()],
      payments: [mkPayment({ date: '2026-09-01' })],
    })
    // stay (2026-11-07) > payment (2026-09-01) > booking created (2026-08-16)
    expect(events.map(e => e.kind)).toEqual(['stay', 'payment', 'booking'])
  })

  it('gives every line a stable unique id', () => {
    const events = buildDossier({ ...EMPTY, bookings: [mkBooking()], payments: [mkPayment()] })
    const ids = events.map(e => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('stay:b1')
    expect(ids).toContain('payment:p1')
  })

  it('keeps the order stable when two events share a date', () => {
    const input = {
      ...EMPTY,
      payments: [mkPayment({ id: 'pB', date: '2026-09-01' }), mkPayment({ id: 'pA', date: '2026-09-01' })],
    }
    expect(buildDossier(input).map(e => e.id)).toEqual(['payment:pA', 'payment:pB'])
    // Same result whichever order the rows arrived in.
    const flipped = { ...input, payments: [...input.payments].reverse() }
    expect(buildDossier(flipped).map(e => e.id)).toEqual(['payment:pA', 'payment:pB'])
  })

  it('flags an unverified payment, not a verified one', () => {
    const [warn] = buildDossier({ ...EMPTY, payments: [mkPayment({ is_verified: false })] })
    expect(warn.tone).toBe('warn')
    expect(warn.detail).toContain('not verified')
    const [ok] = buildDossier({ ...EMPTY, payments: [mkPayment({ is_verified: true })] })
    expect(ok.tone).toBe('normal')
  })

  it('keeps the enquiry message verbatim — it is what they actually asked for', () => {
    const enquiry = {
      id: 'e1', created_at: '2026-08-01T10:00:00Z', channel: 'form', name: 'Cindy',
      email: null, phone: null, language: 'fr', message: 'Nous sommes 3 et envisageons…',
      source_id: null, source_other: null, party_size: 3, arrival_month: '2026-11',
      wants_lessons: false, wants_rental: false, wants_accommodation: true,
      budget_eur: null, status: 'talking', lost_reason: null,
      last_contact_at: '2026-08-01T10:00:00Z',
      client_id: 'c1', booking_id: null, form_submission_id: null,
      crm_synced_at: null, crm_error: null,
    } as Enquiry
    const [ev] = buildDossier({ ...EMPTY, enquiries: [enquiry] })
    expect(ev.title).toBe('Enquiry received')
    expect(ev.detail).toContain('3 people')
    expect(ev.detail).toContain('accommodation')
    expect(ev.detail).toContain('Nous sommes 3 et envisageons…')
  })

  it('marks a booking form still waiting for review', () => {
    const submission = {
      id: 's1', submitted_at: '2026-08-20T09:00:00Z', status: 'pending', language: 'en',
      reference_name: 'Bruno', email: null, num_travelers: 2, arrival_date: null,
      payload: {} as FormSubmission['payload'], reviewed_at: null, created_booking_id: null,
    } as FormSubmission
    const [ev] = buildDossier({ ...EMPTY, submissions: [submission] })
    expect(ev.tone).toBe('warn')
    expect(ev.detail).toContain('waiting for review')
    expect(ev.detail).toContain('2 travellers')
  })

  it('names the booking a payment, email or transfer belongs to', () => {
    const events = buildDossier({
      ...EMPTY,
      bookings: [mkBooking({ id: 'b1', booking_number: 23 })],
      payments: [mkPayment({ booking_id: 'b1' })],
    })
    expect(events.find(e => e.kind === 'payment')!.detail).toContain('#023')
  })

  it('reports a failed email with its error rather than as sent', () => {
    const mail = {
      id: 'm1', booking_id: 'b1', type: 'visa_letter', status: 'failed',
      recipient_email: 'a@b.c', sent_at: null, delivered_at: null, opened_at: null,
      error: '550 rejected by DMARC policy', created_at: '2026-09-02T08:00:00Z',
    } as EmailLog
    const [ev] = buildDossier({ ...EMPTY, emails: [mail] })
    expect(ev.title).toBe('Visa letter failed')
    expect(ev.detail).toContain('550 rejected')
    expect(ev.tone).toBe('warn')
    expect(ev.at).toBe('2026-09-02T08:00:00Z')  // falls back to created_at
  })

  it('flags a transfer that still needs its details', () => {
    const trip = {
      id: 't1', date: '2026-11-07', start_time: '07:40', type: 'aero-to-center',
      status: 'needs_details', taxi_driver_id: null, booking_id: 'b1',
      nb_persons: 1, nb_luggage: 1, nb_boardbags: 0, notes: null,
      price_eur: 0, price_driver_mzn: 0, margin_manager_mzn: 0,
    } as TaxiTrip
    const [ev] = buildDossier({ ...EMPTY, taxiTrips: [trip] })
    expect(ev.title).toBe('Airport → center')
    expect(ev.detail).toContain('needs details')
    expect(ev.tone).toBe('warn')
  })

  it('names the activity provider when it knows it', () => {
    const act = {
      id: 'a1', provider_id: 'pr1', booking_id: 'b1', date: '2026-11-10',
      label: 'Whale shark tour', nb_persons: 2, participant_ids: [],
      price_client: 180, price_provider: 140, payment_flow: 'we_pay_provider',
      notes: null, created_at: '2026-09-01T00:00:00Z',
    } as ActivityBooking
    const [ev] = buildDossier({ ...EMPTY, activities: [act], providerNames: { pr1: 'Bilene Safaris' } })
    expect(ev.title).toBe('Whale shark tour')
    expect(ev.detail).toContain('Bilene Safaris')
    expect(ev.amount).toBe(180)
  })

  it('merges both note tables into one stream of the same kind', () => {
    const events = buildDossier({
      ...EMPTY,
      enquiryNotes: [{ id: 'n1', enquiry_id: 'e1', created_at: '2026-08-05T10:00:00Z', body: 'From the enquiry' }],
      clientNotes: [{ id: 'n2', client_id: 'c1', created_at: '2026-08-20T10:00:00Z', body: 'From the client file' }],
    })
    expect(events.map(e => e.kind)).toEqual(['note', 'note'])
    expect(events.map(e => e.detail)).toEqual(['From the client file', 'From the enquiry'])
    // Ids stay distinct even if the two tables ever hand out the same uuid.
    expect(new Set(events.map(e => e.id)).size).toBe(2)
  })

  it('shows dated notes as their own lines', () => {
    const notes: EnquiryNote[] = [
      { id: 'n1', enquiry_id: 'e1', created_at: '2026-08-05T10:00:00Z', body: 'Called, wants November' },
    ]
    const [ev] = buildDossier({ ...EMPTY, enquiryNotes: notes })
    expect(ev.kind).toBe('note')
    expect(ev.detail).toBe('Called, wants November')
  })
})

describe('dossierMoney', () => {
  it('keeps unverified money apart from what we actually have', () => {
    const m = dossierMoney([
      mkPayment({ id: '1', amount: 500, is_verified: true }),
      mkPayment({ id: '2', amount: 200, is_verified: false }),
      mkPayment({ id: '3', amount: 50, is_discount: true, is_verified: true }),
    ])
    expect(m).toEqual({ paid: 500, unverified: 200, discounts: 50 })
  })

  it('is all zeros when nothing was ever paid', () => {
    expect(dossierMoney([])).toEqual({ paid: 0, unverified: 0, discounts: 0 })
  })
})

describe('daysSinceLastTouch', () => {
  const now = new Date('2026-09-03T12:00:00Z')

  it('is null when nothing has happened', () => {
    expect(daysSinceLastTouch([], now)).toBeNull()
  })

  it('counts from the most recent past event', () => {
    const events = buildDossier({ ...EMPTY, payments: [mkPayment({ date: '2026-08-27' })] })
    expect(daysSinceLastTouch(events, now)).toBe(7)
  })

  it('ignores a stay in the future — a November booking is not a sign of life in September', () => {
    const events = buildDossier({
      ...EMPTY,
      bookings: [mkBooking({ check_in: '2026-11-07', created_at: '2026-08-16T15:39:03Z' })],
    })
    // The booking's creation (16 Aug 15:39) is the last real sign of life.
    expect(daysSinceLastTouch(events, now)).toBe(17)
  })

  it('never goes negative', () => {
    const events = buildDossier({ ...EMPTY, payments: [mkPayment({ date: '2026-09-03' })] })
    expect(daysSinceLastTouch(events, now)).toBe(0)
  })
})
