import { describe, it, expect } from 'vitest'
import {
  silenceDays, silenceTone, fmtArrivalMonth, isSettled, isQualified,
  monthBand, groupByArrivalMonth, matchesSearch, SILENCE_WARN_DAYS,
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

// ─── The scannable table (step 2) ─────────────────────────────────────────────

describe('monthBand', () => {
  it('spans from the earliest arrival to the latest, gaps included', () => {
    // The empty months are the point: scanning the column shows where the
    // season is thin, which a list of dates never tells you.
    expect(monthBand(['2026-12', '2027-03', '2027-01'])).toEqual(
      ['2026-12', '2027-01', '2027-02', '2027-03'])
  })
  it('crosses a year boundary', () => {
    expect(monthBand(['2026-11', '2027-02'])).toEqual(
      ['2026-11', '2026-12', '2027-01', '2027-02'])
  })
  it('ignores enquiries with no month', () => {
    expect(monthBand([null, '2027-02', null])).toEqual(['2027-02'])
  })
  it('is empty when nobody has said when', () => {
    expect(monthBand([null, null])).toEqual([])
  })
  it('refuses to stretch to a hundred cells for one stray year', () => {
    expect(monthBand(['2026-09', '2035-01']).length).toBe(14)
  })
})

describe('groupByArrivalMonth', () => {
  const list = [
    mkEnquiry({ id: 'a', arrival_month: '2027-02', party_size: 4, last_contact_at: '2026-08-10T00:00:00Z' }),
    mkEnquiry({ id: 'b', arrival_month: '2027-02', party_size: 2, status: 'won', last_contact_at: '2026-08-01T00:00:00Z' }),
    mkEnquiry({ id: 'c', arrival_month: null, party_size: null }),
    mkEnquiry({ id: 'd', arrival_month: '2026-12', party_size: 3 }),
  ]

  it('puts the undated group first — that is the day’s pile, not the leftovers', () => {
    expect(groupByArrivalMonth(list).map(g => g.key)).toEqual([null, '2026-12', '2027-02'])
  })

  it('carries totals on the group, so a collapsed header still says something', () => {
    const feb = groupByArrivalMonth(list).find(g => g.key === '2027-02')!
    expect(feb.items).toHaveLength(2)
    expect(feb.people).toBe(6)
    expect(feb.won).toBe(1)
  })

  it('sorts inside a group by silence, longest first', () => {
    const feb = groupByArrivalMonth(list).find(g => g.key === '2027-02')!
    expect(feb.items.map(e => e.id)).toEqual(['b', 'a'])
  })
})

describe('matchesSearch', () => {
  const e = mkEnquiry({
    name: 'Müller', email: 'muller@example.com',
    message: 'We are four in February', source_other: 'a friend who came in 2024',
  })

  it('matches an empty query', () => {
    expect(matchesSearch(e, [], '   ')).toBe(true)
  })
  it('ignores case and accents — typing "muller" finds "Müller"', () => {
    expect(matchesSearch(e, [], 'muller')).toBe(true)
    expect(matchesSearch(e, [], 'MÜLLER')).toBe(true)
  })
  it('searches the message and the notes, not just the name', () => {
    expect(matchesSearch(e, [], 'february')).toBe(true)
    expect(matchesSearch(e, ['called them, waiting on flights'], 'flights')).toBe(true)
  })
  it('searches how they said they found us', () => {
    expect(matchesSearch(e, [], 'friend')).toBe(true)
  })
  it('says no when it is not there', () => {
    expect(matchesSearch(e, ['nothing here'], 'kitesurf')).toBe(false)
  })
})
