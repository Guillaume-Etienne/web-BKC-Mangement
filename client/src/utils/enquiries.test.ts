import { describe, it, expect } from 'vitest'
import {
  silenceDays, silenceTone, fmtArrivalMonth, wantsLabels, isSettled, isQualified,
  SILENCE_WARN_DAYS,
} from './enquiries'
import type { Enquiry } from '../types/database'

function mkEnquiry(over: Partial<Enquiry> = {}): Enquiry {
  return {
    id: 'e1', created_at: '2026-08-01T10:00:00Z', channel: 'form',
    name: 'Muller', email: null, phone: null, language: 'en', message: null,
    source_id: null, source_other: null,
    party_size: null, arrival_month: null,
    wants_lessons: false, wants_rental: false, wants_accommodation: false,
    budget_eur: null, status: 'new', lost_reason: null,
    last_contact_at: '2026-08-01T10:00:00Z',
    client_id: null, booking_id: null, form_submission_id: null,
    crm_synced_at: null, crm_error: null,
    ...over,
  }
}

describe('silenceDays', () => {
  const now = new Date('2026-08-14T12:00:00Z')

  it('counts whole days since the last exchange', () => {
    expect(silenceDays('2026-08-14T11:00:00Z', now)).toBe(0)
    expect(silenceDays('2026-08-13T11:00:00Z', now)).toBe(1)
    expect(silenceDays('2026-08-04T12:00:00Z', now)).toBe(10)
  })

  it('never goes negative when a contact is dated in the future', () => {
    expect(silenceDays('2026-09-01T00:00:00Z', now)).toBe(0)
  })
})

describe('silenceTone', () => {
  it('stays quiet below the threshold and escalates past it', () => {
    expect(silenceTone(SILENCE_WARN_DAYS - 1)).toContain('gray')
    expect(silenceTone(SILENCE_WARN_DAYS)).toContain('amber')
    expect(silenceTone(SILENCE_WARN_DAYS * 2)).toContain('red')
  })
})

describe('fmtArrivalMonth', () => {
  it('renders a month, never a day', () => {
    expect(fmtArrivalMonth('2027-02')).toBe('Feb 2027')
    expect(fmtArrivalMonth('2026-12')).toBe('Dec 2026')
  })
  it('shows a dash when nobody said when', () => {
    expect(fmtArrivalMonth(null)).toBe('—')
  })
  it('returns junk unchanged rather than inventing a date', () => {
    expect(fmtArrivalMonth('2027-13')).toBe('2027-13')
    expect(fmtArrivalMonth('nope')).toBe('nope')
  })
})

describe('wantsLabels', () => {
  it('keeps a fixed order so absence reads as fast as presence', () => {
    expect(wantsLabels({ wants_lessons: true, wants_rental: false, wants_accommodation: true }))
      .toEqual(['🪁 lessons', '🛏 stay'])
    expect(wantsLabels({ wants_lessons: false, wants_rental: false, wants_accommodation: false }))
      .toEqual([])
  })
})

describe('isSettled', () => {
  it('treats won and lost as out of the working list', () => {
    expect(isSettled('won')).toBe(true)
    expect(isSettled('lost')).toBe(true)
    expect(isSettled('new')).toBe(false)
    expect(isSettled('talking')).toBe(false)
    expect(isSettled('waiting')).toBe(false)
  })
})

describe('isQualified', () => {
  it('is false on a fresh enquiry — that is the day’s pile, not an error', () => {
    expect(isQualified(mkEnquiry({ message: 'Hi, any room in February?' }))).toBe(false)
  })
  it('turns true as soon as gui fills anything', () => {
    expect(isQualified(mkEnquiry({ party_size: 4 }))).toBe(true)
    expect(isQualified(mkEnquiry({ arrival_month: '2027-02' }))).toBe(true)
    expect(isQualified(mkEnquiry({ wants_rental: true }))).toBe(true)
  })
  it('is not fooled by a budget alone', () => {
    // A budget without a size or a date is not a qualified enquiry: it is a
    // number typed in passing, and the row still needs reading.
    expect(isQualified(mkEnquiry({ budget_eur: 1500 }))).toBe(false)
  })
})
