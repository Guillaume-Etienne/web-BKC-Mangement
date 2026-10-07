import { describe, it, expect } from 'vitest'
import type { PartnerHotelPayment, PartnerHotelStay } from '../types/database'
import {
  stayNights, stayTotalMzn, stayCommissionMzn, stayExpectedMzn, stayDueMzn,
  hotelBalanceMzn, commissionEur,
} from './partnerHotel'

function stay(over: Partial<PartnerHotelStay> = {}): PartnerHotelStay {
  return {
    id: 's1', hotel_id: 'h1', booking_id: null, display_name: 'Doe',
    check_in: '2026-11-12', check_out: '2026-11-14',
    nb_persons: 2, couples_count: 1, children_count: 0,
    rooms: [{ label: 'Double', rate_mzn: 3500 }],
    commission_pct: 10, airport_transfer: false, transfer_time: null, big_bags: 0,
    hotel_confirmed: false, guests_paid: false, paid_by: 'guest_to_hotel',
    notes: null, internal_notes: null, created_at: '',
    ...over,
  }
}

function payment(direction: PartnerHotelPayment['direction'], amount_mzn: number): PartnerHotelPayment {
  return { id: 'p', hotel_id: 'h1', date: '2026-12-01', amount_mzn, direction, notes: null, created_at: '' }
}

describe('partner hotel stay money', () => {
  it('bills every room for every night', () => {
    const s = stay({ rooms: [{ label: 'A', rate_mzn: 3500 }, { label: 'B', rate_mzn: 4000 }] })
    expect(stayNights(s)).toBe(2)
    expect(stayTotalMzn(s)).toBe(15000)
    expect(stayCommissionMzn(s)).toBe(1500)
  })

  it('guest pays the hotel → the hotel owes us the commission', () => {
    expect(stayExpectedMzn(stay())).toBe(700)
  })

  it('guest pays us → we owe the hotel the rest', () => {
    expect(stayExpectedMzn(stay({ paid_by: 'guest_to_us' }))).toBe(-6300)
  })

  it('nothing is owed until the guests have paid', () => {
    expect(stayDueMzn(stay())).toBe(0)
    expect(stayDueMzn(stay({ guests_paid: true }))).toBe(700)
  })

  it('a stay with no room costs nothing', () => {
    expect(stayTotalMzn(stay({ rooms: [] }))).toBe(0)
  })
})

describe('hotelBalanceMzn', () => {
  it('subtracts what the hotel sent, adds what we sent', () => {
    const stays = [
      stay({ guests_paid: true }),                                   // +700
      stay({ id: 's2', guests_paid: true, paid_by: 'guest_to_us' }), // -6300
      stay({ id: 's3' }),                                            // not paid yet: 0
    ]
    expect(hotelBalanceMzn(stays, [])).toBe(-5600)
    expect(hotelBalanceMzn(stays, [payment('us_to_hotel', 6300), payment('hotel_to_us', 700)])).toBe(0)
  })
})

describe('commissionEur', () => {
  it('converts every commission, paid or not, at the current rate', () => {
    expect(commissionEur([stay(), stay({ id: 's2' })], 70)).toBe(20)
  })
  it('a missing rate yields 0, not Infinity', () => {
    expect(commissionEur([stay()], 0)).toBe(0)
  })
})

describe('partner hotels in the season totals', () => {
  it('adds our commission in EUR, and drops the stays of a cancelled booking', async () => {
    const { computeSeasonTotals, emptyAccountingData } = await import('../components/accounting/utils')
    const { _booking } = await import('../types/canary')
    const data = {
      ...emptyAccountingData(),
      eurMznRate: 70,
      bookings: [
        { ..._booking, id: 'live', status: 'confirmed' as const },
        { ..._booking, id: 'gone', status: 'cancelled' as const },
      ],
      partnerHotelStays: [
        stay({ id: 'a', booking_id: 'live' }),   // 700 MZN = 10 €
        stay({ id: 'b', booking_id: 'gone' }),   // cancelled: out
        stay({ id: 'c', booking_id: null }),     // standalone: in, 10 €
      ],
    }
    const t = computeSeasonTotals(data)
    expect(t.partnerHotelRev).toBe(20)
    expect(t.totalRevenue).toBeGreaterThanOrEqual(20)
  })
})
