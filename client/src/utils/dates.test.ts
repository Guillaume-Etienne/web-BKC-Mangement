import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  toISODate, todayISO, toISOMonth, fromISODate, addDaysISO, addDays, daysBetween,
} from './dates'

/** These assertions are written to fail under the old
 *  `new Date().toISOString().slice(0, 10)` whenever the machine sits east of
 *  Greenwich — which is where the centre is (Mozambique, UTC+2). They pass in
 *  any zone, so they keep their meaning on a laptop in Europe too. */
describe('toISODate', () => {
  afterEach(() => { vi.useRealTimers() })

  it('names the day the wall clock shows, not the UTC one', () => {
    // Local midnight is the case that used to break: converted to UTC it falls
    // back into the previous day for every zone ahead of Greenwich.
    expect(toISODate(new Date(2026, 7, 5, 0, 0, 0))).toBe('2026-08-05')
  })

  it('still names that day one minute before it ends', () => {
    expect(toISODate(new Date(2026, 7, 5, 23, 59, 0))).toBe('2026-08-05')
  })

  it('pads month and day so the string always sorts and compares', () => {
    // The app compares these as plain strings (check_in <= date), so '2026-1-5'
    // would quietly sort before '2026-01-10'.
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('handles the last day of the year without rolling over', () => {
    expect(toISODate(new Date(2026, 11, 31, 23, 0))).toBe('2026-12-31')
  })
})

describe('todayISO', () => {
  afterEach(() => { vi.useRealTimers() })

  it('gives today just after midnight, not yesterday', () => {
    // 00:30 local — the window where the centre would have dated a payment,
    // a rental or a taxi trip to the day before.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 5, 0, 30))
    expect(todayISO()).toBe('2026-08-05')
  })

  it('gives today in the middle of the afternoon', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 5, 15, 0))
    expect(todayISO()).toBe('2026-08-05')
  })
})

describe('toISOMonth', () => {
  it('is the accounting key, YYYY-MM', () => {
    expect(toISOMonth(new Date(2026, 7, 5))).toBe('2026-08')
  })

  it('keeps the first of the month in its own month', () => {
    // Under a UTC shift this landed in the previous month — the case that moves
    // revenue across an accounting close.
    expect(toISOMonth(new Date(2026, 7, 1, 0, 0))).toBe('2026-08')
  })
})

describe('fromISODate', () => {
  it('parses to local midnight, so the day survives the round trip', () => {
    expect(toISODate(fromISODate('2026-08-05'))).toBe('2026-08-05')
  })
})

describe('addDaysISO', () => {
  it('steps forward a day', () => {
    expect(addDaysISO('2026-08-05', 1)).toBe('2026-08-06')
  })

  it('steps back across a month boundary', () => {
    expect(addDaysISO('2026-08-01', -1)).toBe('2026-07-31')
  })

  it('steps across a year boundary', () => {
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('knows February has 29 days in a leap year', () => {
    expect(addDaysISO('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('returns empty for an empty date rather than "NaN-NaN-NaN"', () => {
    expect(addDaysISO('', 1)).toBe('')
  })
})

describe('addDays', () => {
  it('does not mutate the Date it was given', () => {
    const original = new Date(2026, 7, 5)
    addDays(original, 10)
    expect(toISODate(original)).toBe('2026-08-05')
  })
})

describe('daysBetween', () => {
  it('counts the nights of a stay', () => {
    expect(daysBetween('2026-11-04', '2026-11-15')).toBe(11)
  })

  it('is zero for the same day', () => {
    expect(daysBetween('2026-11-04', '2026-11-04')).toBe(0)
  })

  it('goes negative when the dates are the wrong way round', () => {
    expect(daysBetween('2026-11-15', '2026-11-04')).toBe(-11)
  })

  it('counts whole days across a DST change', () => {
    // Europe springs forward on 29 March 2026; a raw ms/86400000 would give
    // 30.958 days here and truncate to 30.
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31)
  })
})
