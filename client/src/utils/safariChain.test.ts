import { describe, it, expect } from 'vitest'
import type { ActivityBooking, PartnerHotelStay, TaxiTrip } from '../types/database'
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
    airport_transfer: false, transfer_time: null, departure_transfer: false, departure_transfer_time: null,
    big_bags: 0, hotel_confirmed: false,
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

// Whole trip: Bilene stay + taxis (case #021, 2026-11-08). Scenario A = safari
// 14→15, Maputo nights 13 and 15, flight on the 16th.
describe('chainSafari — whole trip', () => {
  type T = { booking_id: string | null; date: string; type: TaxiTrip['type'] }
  const taxi = (date: string, type: TaxiTrip['type'], booking_id: string | null = 'b1'): T => ({ booking_id, date, type })
  const dropOff = (s: PartnerHotelStay, time: string | null = '17:00') => ({ ...s, departure_transfer: true, departure_transfer_time: time })
  const pickUp  = (s: PartnerHotelStay, time: string | null = '09:00') => ({ ...s, airport_transfer: true, transfer_time: time })
  const sA = safari({ date: '2026-11-14', end_date: '2026-11-15' })
  const kinds = (c: ReturnType<typeof chainSafari>) => c.issues.map(i => i.kind)

  it('Bilene first, everything in place: no issue', () => {
    const c = chainSafari(sA,
      [stay('s1', '2026-11-13', '2026-11-14'), dropOff(stay('s2', '2026-11-15', '2026-11-16'))],
      { stay: { check_in: '2026-11-04', check_out: '2026-11-13' }, taxis: [taxi('2026-11-13', 'center-to-town')] })
    expect(c.bilene).toBe('before')
    expect(c.issues).toEqual([])
  })

  it('#021 as stored on 08/11: Bilene too long, no taxi to Maputo, a leftover airport taxi, no drop-off', () => {
    const c = chainSafari(sA,
      [stay('s1', '2026-11-13', '2026-11-14'), stay('s2', '2026-11-15', '2026-11-16')],
      { stay: { check_in: '2026-11-04', check_out: '2026-11-14' }, taxis: [taxi('2026-11-15', 'center-to-aero')] })
    expect(c.issues).toEqual([
      { kind: 'bilene_overlap', nights: 1 },
      { kind: 'no_taxi', tripType: 'center-to-town', date: '2026-11-13' },
      { kind: 'stray_airport_taxi', tripType: 'center-to-aero', date: '2026-11-15' },
      { kind: 'no_transfer', which: 'dropoff', date: '2026-11-16' },
    ])
  })

  it('switching to 3 days without moving the rest shows every leftover', () => {
    // Safari now 13→15, but the Maputo night, Bilene check-out and taxi still say scenario A.
    const c = chainSafari(safari({ date: '2026-11-13', end_date: '2026-11-15' }),
      [stay('s1', '2026-11-13', '2026-11-14'), dropOff(stay('s2', '2026-11-15', '2026-11-16'))],
      { stay: { check_in: '2026-11-04', check_out: '2026-11-13' }, taxis: [taxi('2026-11-13', 'center-to-town')] })
    expect(kinds(c)).toEqual(['no_stay_before', 'overlap'])
  })

  it('scenario B fully moved: no issue', () => {
    const c = chainSafari(safari({ date: '2026-11-13', end_date: '2026-11-15' }),
      [stay('s1', '2026-11-12', '2026-11-13'), dropOff(stay('s2', '2026-11-15', '2026-11-16'))],
      { stay: { check_in: '2026-11-04', check_out: '2026-11-12' }, taxis: [taxi('2026-11-12', 'center-to-town')] })
    expect(c.issues).toEqual([])
  })

  it('counts the nights between leaving Bilene and the Maputo arrival', () => {
    const c = chainSafari(sA,
      [stay('s1', '2026-11-13', '2026-11-14'), dropOff(stay('s2', '2026-11-15', '2026-11-16'))],
      { stay: { check_in: '2026-11-04', check_out: '2026-11-11' }, taxis: [taxi('2026-11-11', 'center-to-town')] })
    expect(c.issues).toEqual([{ kind: 'bilene_gap', nights: 2 }])
  })

  it('a drop-off without time is still to finish', () => {
    const c = chainSafari(sA,
      [stay('s1', '2026-11-13', '2026-11-14'), dropOff(stay('s2', '2026-11-15', '2026-11-16'), null)],
      { stay: { check_in: '2026-11-04', check_out: '2026-11-13' }, taxis: [taxi('2026-11-13', 'center-to-town')] })
    expect(c.issues).toEqual([{ kind: 'transfer_no_time', which: 'dropoff', date: '2026-11-16' }])
  })

  it('ignores the taxis of another booking', () => {
    const c = chainSafari(sA,
      [stay('s1', '2026-11-13', '2026-11-14'), dropOff(stay('s2', '2026-11-15', '2026-11-16'))],
      { stay: { check_in: '2026-11-04', check_out: '2026-11-13' }, taxis: [taxi('2026-11-13', 'center-to-town', 'other')] })
    expect(kinds(c)).toEqual(['no_taxi'])
  })

  it('safari first: hotel pick-up, our taxi to Bilene, no airport taxi of ours', () => {
    const ok = chainSafari(sA,
      [pickUp(stay('s1', '2026-11-13', '2026-11-14')), stay('s2', '2026-11-15', '2026-11-16')],
      { stay: { check_in: '2026-11-16', check_out: '2026-11-25' }, taxis: [taxi('2026-11-16', 'town-to-center')] })
    expect(ok.bilene).toBe('after')
    expect(ok.issues).toEqual([])

    const ko = chainSafari(sA,
      [stay('s1', '2026-11-13', '2026-11-14'), stay('s2', '2026-11-15', '2026-11-16')],
      { stay: { check_in: '2026-11-15', check_out: '2026-11-25' }, taxis: [taxi('2026-11-15', 'aero-to-center')] })
    expect(ko.issues).toEqual([
      { kind: 'bilene_overlap', nights: 1 },
      { kind: 'no_taxi', tripType: 'town-to-center', date: '2026-11-16' },
      { kind: 'stray_airport_taxi', tripType: 'aero-to-center', date: '2026-11-15' },
      { kind: 'no_transfer', which: 'pickup', date: '2026-11-13' },
    ])
  })

  it('trip inside the Bilene stay: a taxi each way, the kept room is not reported', () => {
    const stays = [stay('s1', '2026-11-13', '2026-11-14'), stay('s2', '2026-11-15', '2026-11-16')]
    const ctx = { stay: { check_in: '2026-11-04', check_out: '2026-11-25' } }
    const none = chainSafari(sA, stays, ctx)
    expect(none.bilene).toBe('around')
    expect(none.issues).toEqual([
      { kind: 'no_taxi', tripType: 'center-to-town', date: '2026-11-13' },
      { kind: 'no_taxi', tripType: 'town-to-center', date: '2026-11-16' },
    ])
    const both = chainSafari(sA, stays, { ...ctx, taxis: [taxi('2026-11-13', 'center-to-town'), taxi('2026-11-16', 'town-to-center')] })
    expect(both.issues).toEqual([])
  })

  it('Bilene links wait for the hotel night: only the missing night is said', () => {
    const c = chainSafari(sA, [], { stay: { check_in: '2026-11-04', check_out: '2026-11-14' }, taxis: [] })
    expect(kinds(c)).toEqual(['no_stay_before', 'no_stay_after'])
  })
})
