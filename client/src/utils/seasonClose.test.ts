import { describe, it, expect } from 'vitest'
import { staleEnquiries, STALE_SILENCE_DAYS } from './seasonClose'
import type { Enquiry } from '../types/database'

const NOW = new Date('2026-09-03T12:00:00Z')

function mkEnquiry(over: Partial<Enquiry> = {}): Enquiry {
  return {
    id: 'e1', created_at: '2026-08-01T10:00:00Z', channel: 'form',
    name: 'Someone', email: null, phone: null, language: 'fr', message: null,
    source_id: null, source_other: null,
    party_size: null, arrival_month: null,
    wants_lessons: false, wants_rental: false, wants_accommodation: false,
    budget_eur: null, status: 'talking', lost_reason: null,
    last_contact_at: '2026-09-01T10:00:00Z',
    client_id: null, booking_id: null, form_submission_id: null,
    crm_synced_at: null, crm_error: null,
    ...over,
  }
}

describe('staleEnquiries', () => {
  it('is empty when everything is still alive', () => {
    expect(staleEnquiries([mkEnquiry({ arrival_month: '2026-11' })], NOW)).toEqual([])
  })

  it('closes on the date, not on the silence — a month that is over is over', () => {
    // Spoke to them three days ago, but they were coming in February.
    const past = mkEnquiry({ arrival_month: '2026-02', last_contact_at: '2026-08-31T10:00:00Z' })
    const [row] = staleEnquiries([past], NOW)
    expect(row.reason).toContain('Feb 2026')
    expect(row.reason).toContain('over')
  })

  it('leaves the current month alone — they may still be arriving', () => {
    expect(staleEnquiries([mkEnquiry({ arrival_month: '2026-09' })], NOW)).toEqual([])
  })

  it('never touches someone who is simply early', () => {
    // "Next December", then nothing for months. Early, not dead.
    const early = mkEnquiry({ arrival_month: '2027-12', last_contact_at: '2026-01-01T10:00:00Z' })
    expect(staleEnquiries([early], NOW)).toEqual([])
  })

  it('closes an undated enquiry only after a long silence', () => {
    const day = 86_400_000
    const justUnder = new Date(NOW.getTime() - (STALE_SILENCE_DAYS - 1) * day).toISOString()
    const justOver = new Date(NOW.getTime() - STALE_SILENCE_DAYS * day).toISOString()
    expect(staleEnquiries([mkEnquiry({ last_contact_at: justUnder })], NOW)).toEqual([])
    const [row] = staleEnquiries([mkEnquiry({ last_contact_at: justOver })], NOW)
    expect(row.reason).toContain('no dates')
  })

  it('never proposes an enquiry that is already won or lost', () => {
    for (const status of ['won', 'lost'] as const) {
      const settled = mkEnquiry({ status, arrival_month: '2026-02' })
      expect(staleEnquiries([settled], NOW)).toEqual([])
    }
  })

  it('puts the longest-dead first', () => {
    const rows = staleEnquiries([
      mkEnquiry({ id: 'recent', name: 'Recent', arrival_month: '2026-08', last_contact_at: '2026-08-30T10:00:00Z' }),
      mkEnquiry({ id: 'ancient', name: 'Ancient', arrival_month: '2026-01', last_contact_at: '2026-01-05T10:00:00Z' }),
    ], NOW)
    expect(rows.map(r => r.enquiry.name)).toEqual(['Ancient', 'Recent'])
  })

  it('is stable when two have been silent exactly as long', () => {
    const a = mkEnquiry({ id: 'a', name: 'Bob', arrival_month: '2026-02', last_contact_at: '2026-02-01T10:00:00Z' })
    const b = mkEnquiry({ id: 'b', name: 'Alice', arrival_month: '2026-02', last_contact_at: '2026-02-01T10:00:00Z' })
    expect(staleEnquiries([a, b], NOW).map(r => r.enquiry.name)).toEqual(['Alice', 'Bob'])
    expect(staleEnquiries([b, a], NOW).map(r => r.enquiry.name)).toEqual(['Alice', 'Bob'])
  })
})
