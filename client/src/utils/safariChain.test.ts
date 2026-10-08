import { describe, it, expect } from 'vitest'
import type { ActivityBooking, PartnerHotelStay } from '../types/database'
import { chainSafari, safariEnd } from './safariChain'

function safari(over: Partial<ActivityBooking> = {}): ActivityBooking {
  return {
    id: 'a1', provider_id: 'p1', booking_id: 'b1', date: '2026-11-14', end_date: '2026-11-17',
    label: 'Kruger 3 days', nb_persons: 2, participant_ids: [], price_client: 0, price_provider: 0,
    payment_flow: 'we_pay_provider', notes: null, created_at: '',
    ...over,
  }
}

function stay(id: string, check_in: string, check_out: string, booking_id: string | null = 'b1'): PartnerHotelStay {
  return {
    id, hotel_id: 'h1', booking_id, group_id: null, display_name: 'Doe', check_in, check_out,
    nb_persons: 2, couples_count: 1, children_count: 0, rooms: [], commission_pct: 10,
    airport_transfer: false, transfer_time: null, big_bags: 0, hotel_confirmed: false,
    guests_paid: false, paid_by: 'guest_to_hotel', notes: null, internal_notes: null, created_at: '',
  }
}

describe('chainSafari', () => {
  it('hotel → safari → hotel back to back: no issue', () => {
    const c = chainSafari(safari(), [stay('s1', '2026-11-12', '2026-11-14'), stay('s2', '2026-11-17', '2026-11-18')])
    expect(c.before?.id).toBe('s1')
    expect(c.after?.id).toBe('s2')
    expect(c.issues).toEqual([])
  })

  it('missing nights on both sides', () => {
    expect(chainSafari(safari(), []).issues.map(i => i.kind)).toEqual(['no_stay_before', 'no_stay_after'])
  })

  it('counts the uncovered nights of a gap', () => {
    const c = chainSafari(safari(), [stay('s1', '2026-11-12', '2026-11-13'), stay('s2', '2026-11-19', '2026-11-20')])
    expect(c.issues).toEqual([{ kind: 'gap_before', nights: 1 }, { kind: 'gap_after', nights: 2 }])
  })

  it('flags a hotel stay inside the safari', () => {
    const c = chainSafari(safari(), [stay('s1', '2026-11-12', '2026-11-14'), stay('x', '2026-11-15', '2026-11-16'), stay('s2', '2026-11-17', '2026-11-18')])
    expect(c.issues).toEqual([{ kind: 'overlap', stayId: 'x' }])
  })

  it('ignores the stays of another booking', () => {
    const c = chainSafari(safari(), [stay('s1', '2026-11-12', '2026-11-14', 'other')])
    expect(c.before).toBeNull()
  })

  it('a safari without booking is not checked', () => {
    expect(chainSafari(safari({ booking_id: null }), []).issues).toEqual([])
  })

  it('without end date, a safari lasts its single day', () => {
    expect(safariEnd(safari({ end_date: null }))).toBe('2026-11-14')
    expect(safariEnd(safari({ end_date: undefined }))).toBe('2026-11-14')
    const c = chainSafari(safari({ end_date: null }), [stay('s1', '2026-11-12', '2026-11-14'), stay('s2', '2026-11-14', '2026-11-15')])
    expect(c.issues).toEqual([])
  })
})
