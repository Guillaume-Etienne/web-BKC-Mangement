import { describe, it, expect } from 'vitest'
import { buildCashFlowRows, filterRowsByPeriod, sumCashFlowRows, runningBalances } from './cashFlowUtils'
import { computeSeasonTotals } from './utils'
import type { MonthRow } from './cashFlowUtils'
import {
  mkData, mkBooking, mkBookingRoom, mkBookingRoomPrice, mkHouseSetup,
  mkPayment, mkTaxiTrip, mkActivityBooking, mkInstructorPayment,
} from './utils.fixtures'

/** Pick one month out of the result set. */
const month = (rows: MonthRow[], m: string) => rows.find(r => r.month === m)

describe('buildCashFlowRows', () => {
  it('returns no month at all when there is nothing to report', () => {
    expect(buildCashFlowRows(mkData())).toEqual([])
  })

  it('attributes billed revenue to the check-in month, not across the stay', () => {
    // Stay straddles two months but the whole amount lands on the check-in month
    const { acc, roomF, rates } = mkHouseSetup(100)
    const rows = buildCashFlowRows(mkData({
      accommodations: [acc], rooms: [roomF], roomRates: rates,
      bookings: [mkBooking({ check_in: '2026-10-28', check_out: '2026-11-04' })], // 7 nights
      bookingRooms: [mkBookingRoom({ room_id: 'roomF' })],
      bookingRoomPrices: [mkBookingRoomPrice({ room_id: 'roomF', price_per_night: 60 })],
    }))
    expect(month(rows, '2026-10')?.billed).toBe(420)
    expect(month(rows, '2026-11')).toBeUndefined()
  })

  it('skips cancelled bookings', () => {
    const { acc, roomF, rates } = mkHouseSetup(100)
    const rows = buildCashFlowRows(mkData({
      accommodations: [acc], rooms: [roomF], roomRates: rates,
      bookings: [mkBooking({ status: 'cancelled' })],
      bookingRooms: [mkBookingRoom({ room_id: 'roomF' })],
      bookingRoomPrices: [mkBookingRoomPrice({ room_id: 'roomF', price_per_night: 60 })],
    }))
    expect(rows).toEqual([])
  })

  it('records cash on the payment date, not the stay', () => {
    const rows = buildCashFlowRows(mkData({
      bookings: [mkBooking({ check_in: '2026-11-01', check_out: '2026-11-08' })],
      payments: [mkPayment({ date: '2026-09-15', amount: 300 })],  // deposit, months earlier
    }))
    expect(month(rows, '2026-09')?.collected).toBe(300)
    expect(month(rows, '2026-11')?.collected).toBe(0)
  })

  it('never counts a discount as cash received', () => {
    const rows = buildCashFlowRows(mkData({
      payments: [
        mkPayment({ id: 'p1', date: '2026-11-05', amount: 300 }),
        mkPayment({ id: 'p2', date: '2026-11-05', amount: 50, is_discount: true }),
      ],
    }))
    expect(month(rows, '2026-11')?.collected).toBe(300)
  })

  it('counts an unverified payment as cash, and flags how much is unverified', () => {
    // It counts because the amount comes from what the owner typed on the booking:
    // excluding it would overstate what the client still owes. The share is
    // surfaced separately so the headline figure can be trusted at a glance.
    const rows = buildCashFlowRows(mkData({
      payments: [
        mkPayment({ id: 'p1', date: '2026-11-05', amount: 120, is_verified: false }),
        mkPayment({ id: 'p2', date: '2026-11-06', amount: 80,  is_verified: true }),
      ],
    }))
    expect(month(rows, '2026-11')?.collected).toBe(200)
    expect(month(rows, '2026-11')?.unverified).toBe(120)
  })

  it('never counts a discount as unverified cash', () => {
    const rows = buildCashFlowRows(mkData({
      payments: [mkPayment({ date: '2026-11-05', amount: 50, is_discount: true, is_verified: false })],
    }))
    expect(month(rows, '2026-11')).toBeUndefined()
  })

  it('bills standalone taxi trips on the trip date', () => {
    const rows = buildCashFlowRows(mkData({
      taxiTrips: [mkTaxiTrip({ booking_id: null, date: '2026-11-03', price_eur: 90 })],
    }))
    expect(month(rows, '2026-11')?.billed).toBe(90)
  })

  it('bills a standalone activity at its margin, not its client price', () => {
    const rows = buildCashFlowRows(mkData({
      activityBookings: [mkActivityBooking({
        booking_id: null, date: '2026-11-04',
        payment_flow: 'we_pay_provider', price_client: 100, price_provider: 70,
      })],
    }))
    expect(month(rows, '2026-11')?.billed).toBe(30)
  })

  it('bills a standalone provider-pays activity at their reversal', () => {
    const rows = buildCashFlowRows(mkData({
      activityBookings: [mkActivityBooking({
        booking_id: null, date: '2026-11-04',
        payment_flow: 'provider_pays_us', price_client: 100, price_provider: 70,
      })],
    }))
    expect(month(rows, '2026-11')?.billed).toBe(70)
  })

  it('pays drivers cash on trips marked done, and ignores the others', () => {
    const rows = buildCashFlowRows(mkData({
      eurMznRate: 73,
      taxiTrips: [
        mkTaxiTrip({ id: 't1', date: '2026-11-02', status: 'done',      price_driver_mzn: 7300 }),
        mkTaxiTrip({ id: 't2', date: '2026-11-02', status: 'confirmed', price_driver_mzn: 7300 }),
      ],
    }))
    expect(month(rows, '2026-11')?.taxiOut).toBe(100)  // only the done one, 7300/73
  })

  it('adds the manager real dated payments to the taxi outflow', () => {
    const rows = buildCashFlowRows(mkData({
      eurMznRate: 73,
      taxiManagerPayments: [{ id: 'tm1', date: '2026-12-01', amount_mzn: 3650, notes: null }],
    }))
    expect(month(rows, '2026-12')?.taxiOut).toBe(50)
  })

  it('guards against a zero exchange rate instead of dividing by zero', () => {
    const rows = buildCashFlowRows(mkData({
      eurMznRate: 0,
      taxiTrips: [mkTaxiTrip({ date: '2026-11-02', status: 'done', price_driver_mzn: 7300 })],
    }))
    expect(month(rows, '2026-11')?.taxiOut).toBe(7300)  // rate 1 fallback, not Infinity
    expect(Number.isFinite(month(rows, '2026-11')!.net)).toBe(true)
  })

  it('nets cash in against every outflow', () => {
    const rows = buildCashFlowRows(mkData({
      eurMznRate: 73,
      payments: [mkPayment({ date: '2026-11-10', amount: 1000 })],
      palmeirasReversals: [{ id: 'pr1', month: '2026-11', gross_amount: 500, percent: 10, net_amount: 50, notes: null }],
      expenses: [{ id: 'e1', date: '2026-11-12', category: 'fuel', amount: 80, description: 'x' }],
      palmeirasRents: [{ id: 'prt1', month: '2026-11', amount: 200, notes: null }],
      instructorPayments: [mkInstructorPayment({ date: '2026-11-28', amount: 300 })],
      taxiTrips: [mkTaxiTrip({ date: '2026-11-02', status: 'done', price_driver_mzn: 7300 })],
    }))
    const r = month(rows, '2026-11')!
    expect(r.net).toBe(370)   // 1000 + 50 − 80 − 200 − 300 − 100
  })

  it('builds a net from collected cash, never from what was merely billed', () => {
    const { acc, roomF, rates } = mkHouseSetup(100)
    const rows = buildCashFlowRows(mkData({
      accommodations: [acc], rooms: [roomF], roomRates: rates,
      bookings: [mkBooking({ check_in: '2026-11-01', check_out: '2026-11-08' })],
      bookingRooms: [mkBookingRoom({ room_id: 'roomF' })],
      bookingRoomPrices: [mkBookingRoomPrice({ room_id: 'roomF', price_per_night: 60 })],
    }))
    const r = month(rows, '2026-11')!
    expect(r.billed).toBe(420)
    expect(r.collected).toBe(0)
    expect(r.net).toBe(0)      // nothing banked yet
  })

  it('reports billed net of discounts, like the dashboard figure', () => {
    const { acc, roomF, rates } = mkHouseSetup(100)
    const rows = buildCashFlowRows(mkData({
      accommodations: [acc], rooms: [roomF], roomRates: rates,
      bookings: [mkBooking({ check_in: '2026-11-01', check_out: '2026-11-08' })],
      bookingRooms: [mkBookingRoom({ room_id: 'roomF' })],
      bookingRoomPrices: [mkBookingRoomPrice({ room_id: 'roomF', price_per_night: 60 })],
      payments: [mkPayment({ date: '2026-11-05', amount: 30, is_discount: true })],
    }))
    expect(month(rows, '2026-11')?.billed).toBe(390)      // 420 − 30
    expect(month(rows, '2026-11')?.collected).toBe(0)     // a discount is not cash
  })

  it('books the discount on the check-in month, not the month it was granted', () => {
    const { acc, roomF, rates } = mkHouseSetup(100)
    const rows = buildCashFlowRows(mkData({
      accommodations: [acc], rooms: [roomF], roomRates: rates,
      bookings: [mkBooking({ check_in: '2026-11-01', check_out: '2026-11-08' })],
      bookingRooms: [mkBookingRoom({ room_id: 'roomF' })],
      bookingRoomPrices: [mkBookingRoomPrice({ room_id: 'roomF', price_per_night: 60 })],
      payments: [mkPayment({ date: '2026-12-20', amount: 30, is_discount: true })],
    }))
    expect(month(rows, '2026-11')?.billed).toBe(390)   // the booking stays coherent
    expect(month(rows, '2026-12')).toBeUndefined()     // no phantom month
  })

  it('sorts months newest first', () => {
    const rows = buildCashFlowRows(mkData({
      payments: [
        mkPayment({ id: 'p1', date: '2026-09-01', amount: 10 }),
        mkPayment({ id: 'p2', date: '2026-11-01', amount: 10 }),
        mkPayment({ id: 'p3', date: '2026-10-01', amount: 10 }),
      ],
    }))
    expect(rows.map(r => r.month)).toEqual(['2026-11', '2026-10', '2026-09'])
  })
})

/** A month row carrying only the fields a test cares about. */
const row = (month: string, net = 0): MonthRow =>
  ({ month, billed: 0, collected: 0, unverified: 0, palmIn: 0, expenses: 0, rent: 0, instrPaid: 0, taxiOut: 0, net })

describe('filterRowsByPeriod', () => {
  const rows = ['2026-12', '2026-11', '2026-10', '2026-09'].map(m => row(m))

  it('keeps the range bounds', () => {
    expect(filterRowsByPeriod(rows, '2026-10', '2026-11').map(r => r.month)).toEqual(['2026-11', '2026-10'])
  })
  it('returns nothing when the range is empty', () => {
    expect(filterRowsByPeriod(rows, '2027-01', '2027-06')).toEqual([])
  })
})

describe('sumCashFlowRows', () => {
  it('sums every column', () => {
    const rows: MonthRow[] = [
      { month: '2026-10', billed: 100, collected: 60, unverified: 20, palmIn: 5, expenses: 10, rent: 20, instrPaid: 8, taxiOut: 2, net: 25 },
      { month: '2026-11', billed: 200, collected: 40, unverified: 0,  palmIn: 5, expenses: 10, rent: 20, instrPaid: 2, taxiOut: 3, net: 10 },
    ]
    expect(sumCashFlowRows(rows)).toEqual({
      billed: 300, collected: 100, unverified: 20, palmIn: 10, expenses: 20, rent: 40, instrPaid: 10, taxiOut: 5, net: 35,
    })
  })

  it('sums to zero on an empty period', () => {
    expect(sumCashFlowRows([]).net).toBe(0)
  })
})

describe('runningBalances', () => {
  it('accumulates oldest to newest whatever the input order', () => {
    const rows = [row('2026-11', -50), row('2026-09', 100), row('2026-10', 30)]
    expect(runningBalances(rows)).toEqual({ '2026-09': 100, '2026-10': 130, '2026-11': 80 })
  })

  it('does not mutate the rows it was given', () => {
    const rows = [row('2026-11', 1), row('2026-09', 1)]
    runningBalances(rows)
    expect(rows.map(r => r.month)).toEqual(['2026-11', '2026-09'])
  })
})

describe('Palmeiras free entries', () => {
  /** Reversal + rent + one free line each way, all in the same month. */
  const withEntries = () => mkData({
    palmeirasReversals: [{ id: 'pr1', month: '2026-11', gross_amount: 300, percent: 10, net_amount: 30, notes: null }],
    palmeirasRents:     [{ id: 'prt1', month: '2026-11', amount: 20, notes: null }],
    palmeirasEntries: [
      { id: 'pe1', month: '2026-11', type: 'income',  description: 'misc', amount: 10 },
      { id: 'pe2', month: '2026-11', type: 'expense', description: 'misc', amount: 5 },
    ],
  })

  it('counts the free lines in the month they belong to', () => {
    // 30 reversal + 10 income − 5 expense. They used to be dropped entirely:
    // the season result showed them, this table did not.
    const rows = buildCashFlowRows(withEntries())
    expect(month(rows, '2026-11')?.palmIn).toBe(35)
  })

  it('keeps the free expenses out of the general expenses column', () => {
    // That column is the `expenses` table; mixing Palmeiras into it would make
    // one figure mean two different things.
    expect(month(buildCashFlowRows(withEntries()), '2026-11')?.expenses).toBe(0)
  })

  it('goes negative when a month spends more than it takes in', () => {
    const rows = buildCashFlowRows(mkData({
      palmeirasEntries: [{ id: 'pe1', month: '2026-11', type: 'expense', description: 'repair', amount: 80 }],
    }))
    expect(month(rows, '2026-11')?.palmIn).toBe(-80)
  })

  it('opens a month that has nothing but a free line', () => {
    // The month must exist in the table at all — `ensure` is what creates it.
    const rows = buildCashFlowRows(mkData({
      palmeirasEntries: [{ id: 'pe1', month: '2026-07', type: 'income', description: 'x', amount: 15 }],
    }))
    expect(month(rows, '2026-07')?.palmIn).toBe(15)
  })

  it('carries the free lines into the running balance', () => {
    // `net` feeds runningBalances, so a dropped line used to shift the cumulative
    // balance of every later month, not just its own.
    const rows = buildCashFlowRows(withEntries())
    expect(month(rows, '2026-11')?.net).toBe(15)   // 35 palmIn − 20 rent
  })

  it('agrees with the dashboard: palmIn − rent === palmeirasNet', () => {
    // The identity that keeps the two screens from drifting apart. If someone
    // adds a Palmeiras source to one of them and forgets the other, this fails.
    const data = withEntries()
    const totals = sumCashFlowRows(buildCashFlowRows(data))
    expect(totals.palmIn - totals.rent).toBe(computeSeasonTotals(data).palmeirasNet)
  })
})
