import { describe, it, expect } from 'vitest'
import {
  legacySeasonYear, currentSeasonIndex, seasonWindowAt, seasonOffsetBounds, monthColumns,
} from './seasonWindow'
import { toISODate } from './dates'
import type { Season } from '../types/database'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const SHORT  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const mkSeason = (label: string, start: string, end: string): Season =>
  ({ id: label, label, start_date: start, end_date: end })

/** Two adjacent seasons, the shape gui actually runs: Sept → mid-March. */
const SEASONS: Season[] = [
  mkSeason('2025-2026', '2025-09-01', '2026-03-15'),
  mkSeason('2026-2027', '2026-09-01', '2027-03-15'),
]

// ─── 1. The legacy rule (fallback only) ───────────────────────────────────────

describe('legacySeasonYear', () => {
  it('starts the season in September', () => {
    expect(legacySeasonYear(new Date(2026, 8, 15))).toBe(2026)  // Sep
    expect(legacySeasonYear(new Date(2026, 11, 31))).toBe(2026) // Dec
  })
  it('keeps January to March on the season that started last September', () => {
    expect(legacySeasonYear(new Date(2027, 0, 5))).toBe(2026)
    expect(legacySeasonYear(new Date(2027, 2, 30))).toBe(2026)
  })
  it('shows the upcoming season during the April–August gap', () => {
    expect(legacySeasonYear(new Date(2026, 5, 15))).toBe(2026)
  })
})

// ─── 2. Which season the planning opens on ────────────────────────────────────

describe('currentSeasonIndex', () => {
  it('picks the season containing today', () => {
    expect(currentSeasonIndex(SEASONS, new Date(2026, 0, 20))).toBe(0)  // Jan 2026
    expect(currentSeasonIndex(SEASONS, new Date(2026, 9, 3))).toBe(1)   // Oct 2026
  })

  it('picks the UPCOMING season in the gap that belongs to none', () => {
    // 1 June 2026: the 25-26 season ended in March, 26-27 has not started.
    // The useful view is the one being filled, not the one just closed.
    expect(currentSeasonIndex(SEASONS, new Date(2026, 5, 1))).toBe(1)
  })

  it('falls back to the last season once every one is over', () => {
    expect(currentSeasonIndex(SEASONS, new Date(2030, 0, 1))).toBe(1)
  })

  it('picks the first season when today is before them all', () => {
    expect(currentSeasonIndex(SEASONS, new Date(2020, 0, 1))).toBe(0)
  })
})

// ─── 3. The window itself ─────────────────────────────────────────────────────

describe('seasonWindowAt', () => {
  it('uses the configured dates, not a hardcoded Sep 1 → Mar 31', () => {
    const w = seasonWindowAt(SEASONS, new Date(2026, 9, 3), 0)
    expect(w.configured).toBe(true)
    expect(w.label).toBe('2026-2027')
    expect(toISODate(w.start)).toBe('2026-09-01')
    expect(toISODate(w.end)).toBe('2027-03-15')   // mid-March, as typed
  })

  it('walks to the previous season and stops at the first', () => {
    const today = new Date(2026, 9, 3)
    expect(seasonWindowAt(SEASONS, today, -1).label).toBe('2025-2026')
    expect(seasonWindowAt(SEASONS, today, -5).label).toBe('2025-2026') // clamped
  })

  it('stops at the last season instead of inventing one', () => {
    const today = new Date(2026, 9, 3)
    expect(seasonWindowAt(SEASONS, today, +9).label).toBe('2026-2027')
  })

  it('falls back to Sep→Mar when no season is configured', () => {
    const w = seasonWindowAt([], new Date(2026, 9, 3), 0)
    expect(w.configured).toBe(false)
    expect(toISODate(w.start)).toBe('2026-09-01')
    expect(toISODate(w.end)).toBe('2027-03-31')
    expect(w.label).toBe('2026/27')
  })

  it('still browses any year without a configured season', () => {
    const w = seasonWindowAt([], new Date(2026, 9, 3), -2)
    expect(toISODate(w.start)).toBe('2024-09-01')
  })

  it('shortens a two-year label for the mobile selector, leaves anything else alone', () => {
    const today = new Date(2026, 9, 3)
    expect(seasonWindowAt(SEASONS, today, 0).shortLabel).toBe('26/27')
    expect(seasonWindowAt([mkSeason('Test run', '2026-09-01', '2027-03-15')], today, 0).shortLabel)
      .toBe('Test run')
  })
})

describe('seasonOffsetBounds', () => {
  it('bounds the arrows to the seasons on record', () => {
    expect(seasonOffsetBounds(SEASONS, new Date(2026, 9, 3))).toEqual({ min: -1, max: 0 })
    expect(seasonOffsetBounds(SEASONS, new Date(2026, 0, 20))).toEqual({ min: 0, max: 1 })
  })
  it('leaves them unbounded with no season configured', () => {
    expect(seasonOffsetBounds([], new Date(2026, 9, 3))).toEqual({ min: -Infinity, max: Infinity })
  })
})

// ─── 4. The header columns ────────────────────────────────────────────────────

describe('monthColumns', () => {
  const totalDays = (start: Date, end: Date) =>
    Math.round((end.getTime() - start.getTime()) / 86400000) + 1

  it('covers whole months when the window starts and ends on month bounds', () => {
    const start = new Date(2026, 8, 1), end = new Date(2027, 2, 31)
    const cols = monthColumns(start, end, MONTHS, SHORT)
    expect(cols.map(c => c.days)).toEqual([30, 31, 30, 31, 31, 28, 31])
    expect(cols.reduce((s, c) => s + c.days, 0)).toBe(totalDays(start, end))
  })

  it('clips the last month when the season ends mid-March', () => {
    // The regression this guards: counting March as 31 days would slide every
    // booking bar half a month away from its header.
    const start = new Date(2026, 8, 1), end = new Date(2027, 2, 15)
    const cols = monthColumns(start, end, MONTHS, SHORT)
    expect(cols[cols.length - 1]).toMatchObject({ label: 'March 2027', days: 15 })
    expect(cols.reduce((s, c) => s + c.days, 0)).toBe(totalDays(start, end))
  })

  it('clips the first month when the season starts mid-September', () => {
    const start = new Date(2026, 8, 20), end = new Date(2027, 2, 15)
    const cols = monthColumns(start, end, MONTHS, SHORT)
    expect(cols[0]).toMatchObject({ label: 'September 2026', days: 11, colStart: 0 })
    expect(cols[1].colStart).toBe(11)
    expect(cols.reduce((s, c) => s + c.days, 0)).toBe(totalDays(start, end))
  })

  it('handles a window inside a single month', () => {
    const start = new Date(2026, 8, 10), end = new Date(2026, 8, 20)
    const cols = monthColumns(start, end, MONTHS, SHORT)
    expect(cols).toHaveLength(1)
    expect(cols[0].days).toBe(11)
  })

  it('counts February 2028 as a leap month', () => {
    const start = new Date(2028, 1, 1), end = new Date(2028, 1, 29)
    expect(monthColumns(start, end, MONTHS, SHORT)[0].days).toBe(29)
  })
})
