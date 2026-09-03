import { describe, it, expect } from 'vitest'
import { intentGaps, type BookingIntent } from './intentGap'
import type { Enquiry } from '../types/database'

function mkEnquiry(over: Partial<Enquiry> = {}): Enquiry {
  return {
    id: 'e1', created_at: '2026-08-01T10:00:00Z', channel: 'form',
    name: 'Cindy', email: null, phone: null, language: 'fr', message: null,
    source_id: null, source_other: null,
    party_size: null, arrival_month: null,
    wants_lessons: false, wants_rental: false, wants_accommodation: false,
    budget_eur: null, status: 'won', lost_reason: null,
    last_contact_at: '2026-08-01T10:00:00Z',
    client_id: null, booking_id: 'b1', form_submission_id: null,
    crm_synced_at: null, crm_error: null,
    ...over,
  }
}

const full: BookingIntent = {
  participantCount: 3, wantsLessons: true, wantsRental: true, hasAccommodation: true,
}
const empty: BookingIntent = {
  participantCount: 0, wantsLessons: false, wantsRental: false, hasAccommodation: false,
}

describe('intentGaps', () => {
  it('says nothing when the booking covers what was asked', () => {
    const e = mkEnquiry({ wants_lessons: true, wants_rental: true, wants_accommodation: true, party_size: 3 })
    expect(intentGaps(e, full)).toEqual([])
  })

  it('says nothing when the enquiry asked for nothing in particular', () => {
    expect(intentGaps(mkEnquiry(), empty)).toEqual([])
  })

  it('names each intention the booking does not show', () => {
    const e = mkEnquiry({ wants_lessons: true, wants_rental: true, wants_accommodation: true })
    const gaps = intentGaps(e, { ...empty, participantCount: 1 })
    expect(gaps).toHaveLength(3)
    expect(gaps[0]).toContain('lessons')
    expect(gaps[1]).toContain('rental')
    expect(gaps[2]).toContain('accommodation')
  })

  it('counts a wing lesson as a lesson', () => {
    // The caller folds kite and wing into one flag; the enquiry only ever says
    // "lessons", so splitting them here would invent a distinction.
    const e = mkEnquiry({ wants_lessons: true })
    expect(intentGaps(e, { ...empty, wantsLessons: true, participantCount: 1 })).toEqual([])
  })

  it('never complains about a booking that got MORE than was asked', () => {
    // People add things once they are talking to you. That is the happy case.
    expect(intentGaps(mkEnquiry({ party_size: 1 }), full)).toEqual([])
  })

  it('flags a party that shrank on the way in', () => {
    const e = mkEnquiry({ party_size: 4 })
    expect(intentGaps(e, { ...empty, participantCount: 2 })).toEqual(['said 4 people — 2 named here'])
  })

  it('stays quiet on the party size until somebody is named', () => {
    // Zero named travellers means "not filled in yet", not a discrepancy — and a
    // panel that nags from the first second stops being read.
    expect(intentGaps(mkEnquiry({ party_size: 4 }), empty)).toEqual([])
  })

  it('accepts an unqualified enquiry without inventing anything', () => {
    expect(intentGaps(mkEnquiry({ party_size: null }), { ...empty, participantCount: 1 })).toEqual([])
  })
})
