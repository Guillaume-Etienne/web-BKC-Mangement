import { describe, it, expect } from 'vitest'
import { depositState, askedState, stayState } from './documentsOverview'
import type { Payment } from '../types/database'

function pay(patch: Partial<Payment> = {}): Payment {
  return {
    id: crypto.randomUUID(), booking_id: 'b1', date: '2026-09-01', amount: 100,
    method: 'transfer', is_deposit: false, is_verified: true, is_discount: false,
    notes: null, ...patch,
  }
}

describe('depositState', () => {
  it('stays grey when nothing came in', () => {
    expect(depositState('b1', [])).toEqual({ tone: 'none', received: 0, flagged: 0 })
  })

  it('goes green on a payment flagged as a deposit', () => {
    const s = depositState('b1', [pay({ amount: 120, is_deposit: true })])
    expect(s).toEqual({ tone: 'paid', received: 120, flagged: 120 })
  })

  // The box is ticked by hand and gets forgotten. Amber says "money is in, but
  // I am not the one who gets to decide it was the deposit".
  it('goes amber when money arrived with the Deposit box unticked', () => {
    expect(depositState('b1', [pay({ amount: 100 })]).tone).toBe('unflagged')
  })

  it('counts a payment still flagged "to verify"', () => {
    const s = depositState('b1', [pay({ amount: 300, is_deposit: true, is_verified: false })])
    expect(s.tone).toBe('paid')
    expect(s.received).toBe(300)
  })

  it('does not count a discount as money received', () => {
    expect(depositState('b1', [pay({ amount: 50, is_discount: true })]).tone).toBe('none')
  })

  it('ignores the other bookings', () => {
    const s = depositState('b1', [pay({ booking_id: 'b2', amount: 500, is_deposit: true })])
    expect(s).toEqual({ tone: 'none', received: 0, flagged: 0 })
  })

  it('adds the balance to the deposit in what it reports as received', () => {
    const s = depositState('b1', [pay({ amount: 120, is_deposit: true }), pay({ amount: 380 })])
    expect(s).toEqual({ tone: 'paid', received: 500, flagged: 120 })
  })
})

describe('askedState', () => {
  const today = '2026-09-05'

  it('is blank until someone clicks', () => {
    expect(askedState(null, 'none', today)).toEqual({ tone: 'none', days: 0 })
    expect(askedState(undefined, 'none', today).tone).toBe('none')
  })

  it('reads a full timestamp, not just a date', () => {
    expect(askedState('2026-09-01T14:32:07.123Z', 'none', today).days).toBe(4)
  })

  // The whole point of the marker: two weeks asked, still nothing in.
  it('turns stale after a fortnight with no deposit', () => {
    expect(askedState('2026-08-22', 'none', today).tone).toBe('stale')
    expect(askedState('2026-08-23', 'none', today).tone).toBe('asked')
  })

  it('never goes stale once the deposit is in', () => {
    expect(askedState('2026-01-01', 'paid', today).tone).toBe('asked')
  })

  // Money arrived but nobody ticked the Deposit box: that is not proof it was
  // paid, so the chase must keep showing.
  it('still chases when the money is there but unflagged', () => {
    expect(askedState('2026-08-01', 'unflagged', today).tone).toBe('stale')
  })

  it('never reports a negative age for a marker dated ahead', () => {
    expect(askedState('2026-09-30', 'none', today).days).toBe(0)
  })
})

describe('stayState', () => {
  const today = '2026-09-05'

  it('calls a finished stay done', () => {
    expect(stayState('2026-08-01', '2026-08-10', today).tone).toBe('past')
  })

  // Check-out is today: they are still here, and the last documents still matter.
  it('keeps a stay ending today out of the past', () => {
    expect(stayState('2026-08-30', today, today).tone).toBe('here')
  })

  it('says here now once they have arrived', () => {
    expect(stayState('2026-09-01', '2026-09-12', today).label).toBe('here now')
  })

  it('names today and tomorrow rather than counting them', () => {
    expect(stayState(today, '2026-09-12', today).label).toBe('here now')
    expect(stayState('2026-09-06', '2026-09-12', today).label).toBe('tomorrow')
  })

  it('turns amber a week out, not before', () => {
    expect(stayState('2026-09-12', '2026-09-20', today).tone).toBe('soon')
    expect(stayState('2026-09-13', '2026-09-20', today).tone).toBe('later')
  })

  it('counts the days for anything further away', () => {
    expect(stayState('2026-10-05', '2026-10-12', today)).toMatchObject({ label: 'in 30 d', days: 30 })
  })
})
