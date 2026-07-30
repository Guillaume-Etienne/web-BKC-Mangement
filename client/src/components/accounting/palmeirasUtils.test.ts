import { describe, it, expect } from 'vitest'
import { buildBungalowRows, computePalmeirasTotals } from './palmeirasUtils'
import type { BungalowRow } from './palmeirasUtils'
import { computeSeasonTotals } from './utils'
import {
  mkData, mkBooking, mkBookingRoom, mkBookingRoomPrice, mkAccommodation, mkRoom,
} from './utils.fixtures'

/** A bungalow sub-let at 50 €/night, costing 25 €/night, over a 7-night stay. */
function bungalowSetup(over: { sell?: number; cost?: number; status?: 'confirmed' | 'cancelled' } = {}) {
  const { sell = 50, cost = 25, status = 'confirmed' } = over
  return mkData({
    accommodations: [mkAccommodation({ id: 'accBu', name: 'B-1', type: 'bungalow', total_rooms: 1, cost_per_night: cost })],
    rooms: [mkRoom({ id: 'roomBu', accommodation_id: 'accBu', name: 'Room' })],
    bookings: [mkBooking({ status, check_in: '2026-11-01', check_out: '2026-11-08' })],
    bookingRooms: [mkBookingRoom({ room_id: 'roomBu' })],
    bookingRoomPrices: [mkBookingRoomPrice({ room_id: 'roomBu', price_per_night: sell })],
    clients: [{
      id: 'cli1', first_name: 'Alice', last_name: 'Martin', email: null, phone: null, notes: null,
      nationality: null, passport_number: null, birth_date: null, kite_level: null, import_id: null,
      emergency_contact_name: null, emergency_contact_phone: null,
      emergency_contact_email: null, emergency_contact_relation: null,
    }],
  })
}

describe('buildBungalowRows', () => {
  it('derives a stay with its margin from the booking', () => {
    const [row] = buildBungalowRows(bungalowSetup())
    expect(row.bungalow).toBe('B-1')
    expect(row.bookingRef).toBe('Alice Martin')
    expect(row.nights).toBe(7)
    expect(row.costRate).toBe(25)
    expect(row.sellRate).toBe(50)
    expect(row.margin).toBe(175)          // (50 − 25) × 7
    expect(row.month).toBe('2026-11')     // check-in month
  })

  it('skips a cancelled booking', () => {
    expect(buildBungalowRows(bungalowSetup({ status: 'cancelled' }))).toEqual([])
  })

  it('ignores rooms that are not bungalows', () => {
    const data = mkData({
      accommodations: [mkAccommodation({ id: 'accH', type: 'house', total_rooms: 1 })],
      rooms: [mkRoom({ id: 'roomH', accommodation_id: 'accH' })],
      bookings: [mkBooking()],
      bookingRooms: [mkBookingRoom({ room_id: 'roomH' })],
    })
    expect(buildBungalowRows(data)).toEqual([])
  })

  it('shows a negative margin when the stay is sold below cost', () => {
    const [row] = buildBungalowRows(bungalowSetup({ sell: 20, cost: 25 }))
    expect(row.margin).toBe(-35)          // (20 − 25) × 7
  })

  it('treats a missing price snapshot as sold for nothing, not as free of charge', () => {
    const data = bungalowSetup()
    data.bookingRoomPrices = []
    const [row] = buildBungalowRows(data)
    expect(row.sellRate).toBe(0)
    expect(row.margin).toBe(-175)         // the owner is still owed 25 × 7
  })

  it('falls back to the booking number when the client is unknown', () => {
    const data = bungalowSetup()
    data.clients = []
    expect(buildBungalowRows(data)[0].bookingRef).toBe('#1')
  })
})

describe('computePalmeirasTotals', () => {
  const rents = [{ id: 'r1', month: '2026-11', amount: 850, notes: null }]
  const reversals = [{ id: 'v1', month: '2026-11', gross_amount: 1000, percent: 10, net_amount: 100, notes: null }]
  const entries = [
    { id: 'e1', month: '2026-11', type: 'income' as const,  description: 'misc', amount: 40 },
    { id: 'e2', month: '2026-11', type: 'expense' as const, description: 'misc', amount: 15 },
  ]
  const bungalows: BungalowRow[] = [
    { bungalow: 'B-1', bookingRef: 'Alice', checkIn: '2026-11-01', checkOut: '2026-11-08',
      nights: 7, costRate: 25, sellRate: 50, margin: 175, month: '2026-11' },
  ]

  it('sums each line of the partnership', () => {
    const t = computePalmeirasTotals(rents, reversals, entries, bungalows)
    expect(t.rent).toBe(850)
    expect(t.reversals).toBe(100)
    expect(t.grossReversals).toBe(1000)
    expect(t.bungalowMargin).toBe(175)
    expect(t.bungalowCount).toBe(1)
    expect(t.freeIncome).toBe(40)
    expect(t.freeExpenses).toBe(15)
  })

  it('nets everything the partnership brings against what it costs', () => {
    const t = computePalmeirasTotals(rents, reversals, entries, bungalows)
    expect(t.net).toBe(-550)   // 100 + 175 + 40 − 850 − 15
  })

  it('totals zero on an empty period', () => {
    const t = computePalmeirasTotals([], [], [], [])
    expect(t.net).toBe(0)
    expect(t.bungalowCount).toBe(0)
  })

  it('counts the bungalow margin here but NOT in the dashboard figure', () => {
    // Same data, two scopes. The tab answers "what does Palmeiras yield?" and
    // includes the margin. The dashboard already has the sell price inside
    // accommodation revenue and subtracts the cost on its own line, so counting
    // the margin again would double it. Both are right; they must not be aligned.
    const data = bungalowSetup()
    const tab = computePalmeirasTotals([], [], [], buildBungalowRows(data))
    const dash = computeSeasonTotals(data)

    expect(tab.net).toBe(175)              // the margin
    expect(dash.palmeirasNet).toBe(0)      // no rent, no reversal, no entry

    // and the dashboard still carries that margin, split across two lines
    expect(dash.accomRev).toBe(350)        // 50 × 7 sold to the client
    expect(dash.bungalowCosts).toBe(175)   // 25 × 7 owed to the owner
    expect(dash.accomRev - dash.bungalowCosts).toBe(tab.net)
  })
})
