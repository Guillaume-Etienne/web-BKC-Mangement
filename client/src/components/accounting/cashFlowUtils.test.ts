import { describe, it, expect } from 'vitest'
import { buildCashFlowRows, filterRowsByPeriod, sumCashFlowRows, runningBalances } from './cashFlowUtils'
import { computeSeasonTotals } from './utils'
import type { MonthRow } from './cashFlowUtils'
import {
  mkData, mkBooking, mkBookingRoom, mkBookingRoomPrice, mkHouseSetup,
  mkPayment, mkTaxiTrip, mkActivityBooking, mkInstructorPayment,
  mkAgency, mkAgencyLine,
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
  ({ month, billed: 0, collected: 0, unverified: 0, palmIn: 0, expenses: 0, rent: 0, instrPaid: 0, taxiOut: 0, providersOut: 0, agenciesIn: 0, net })

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
      { month: '2026-10', billed: 100, collected: 60, unverified: 20, palmIn: 5, expenses: 10, rent: 20, instrPaid: 8, taxiOut: 2, providersOut: 7, agenciesIn: 30, net: 25 },
      { month: '2026-11', billed: 200, collected: 40, unverified: 0,  palmIn: 5, expenses: 10, rent: 20, instrPaid: 2, taxiOut: 3, providersOut: -4, agenciesIn: 12, net: 10 },
    ]
    expect(sumCashFlowRows(rows)).toEqual({
      billed: 300, collected: 100, unverified: 20, palmIn: 10, expenses: 20, rent: 40, instrPaid: 10, taxiOut: 5, providersOut: 3, agenciesIn: 42, net: 35,
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

describe('activity provider settlements', () => {
  const pay = (over: Partial<{ id: string; provider_id: string; date: string; amount: number; direction: 'to_provider' | 'from_provider'; notes: string | null; created_at: string }> = {}) => ({
    id: 'ap1', provider_id: 'prov1', date: '2026-11-10', amount: 70,
    direction: 'to_provider' as const, notes: null, created_at: '2026-11-10', ...over,
  })

  it('counts what we paid a provider as cash leaving the till', () => {
    const rows = buildCashFlowRows(mkData({ activityPayments: [pay({ amount: 70 })] }))
    expect(month(rows, '2026-11')?.providersOut).toBe(70)
  })

  it('nets off what a provider paid us', () => {
    // A `provider_pays_us` provider sends us their cut; same column, other way.
    const rows = buildCashFlowRows(mkData({
      activityPayments: [pay({ amount: 70 }), pay({ id: 'ap2', amount: 30, direction: 'from_provider' })],
    }))
    expect(month(rows, '2026-11')?.providersOut).toBe(40)
  })

  it('goes negative when a provider owes us more than we owe them', () => {
    const rows = buildCashFlowRows(mkData({
      activityPayments: [pay({ amount: 100, direction: 'from_provider' })],
    }))
    expect(month(rows, '2026-11')?.providersOut).toBe(-100)
  })

  it('lands on the month it was settled, not the month of the activity', () => {
    // Providers are settled irregularly, like the taxi manager.
    const rows = buildCashFlowRows(mkData({ activityPayments: [pay({ date: '2027-02-03' })] }))
    expect(month(rows, '2027-02')?.providersOut).toBe(70)
    expect(month(rows, '2026-11')).toBeUndefined()
  })

  it('takes the settlement out of the month net', () => {
    const rows = buildCashFlowRows(mkData({
      payments: [mkPayment({ amount: 200, date: '2026-11-05' })],
      activityPayments: [pay({ amount: 70 })],
    }))
    expect(month(rows, '2026-11')?.net).toBe(130)   // 200 collected − 70 paid out
  })

  it('does not double count the provider cost already netted out of billed', () => {
    // A standalone activity is billed at its margin (client − provider), so the
    // cost is in `billed`. `billed` is not part of `net`, so subtracting the real
    // cash on top is right, not a second hit.
    const data = mkData({
      // booking_id: null — only standalone activities reach `billed`; the
      // booking-linked ones are already inside computeBookingTotal.
      activityBookings: [mkActivityBooking({ booking_id: null, payment_flow: 'we_pay_provider', price_client: 100, price_provider: 70, date: '2026-11-02' })],
      activityPayments: [pay({ amount: 70 })],
    })
    const row = month(buildCashFlowRows(data), '2026-11')
    expect(row?.billed).toBe(30)          // the margin
    expect(row?.providersOut).toBe(70)    // the cash
    expect(row?.net).toBe(-70)            // nothing collected yet, 70 went out
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

// ── Partner agencies (2026-08-19) ─────────────────────────────────────────────
// The column gui asked for after Palmeiras and the providers. An agency invoice
// never passes through `payments`, so nothing in this table used to show the day
// the money arrived.
describe('buildCashFlowRows — partner agencies', () => {
  /** One booking checking in November, one 450 € line at 20 % commission → 360 € net. */
  const withAgency = (lineOver = {}) => mkData({
    agencies: [mkAgency({ commission_percent: 20 })],
    bookings: [mkBooking({ id: 'bk1', check_in: '2026-11-04', check_out: '2026-11-11' })],
    agencyBillingLines: [mkAgencyLine({ price: 450, ...lineOver })],
  })

  it('books the cash on paid_at, net of commission — not on the booking month', () => {
    const rows = buildCashFlowRows(withAgency({ invoiced_at: '2026-11-30', paid_at: '2026-12-09' }))
    expect(month(rows, '2026-12')?.agenciesIn).toBe(360)   // 450 − 20 %
    expect(month(rows, '2026-11')?.agenciesIn).toBe(0)     // billed there, not collected
  })

  it('counts an unpaid line as billed and as no cash at all', () => {
    // Exactly how an unpaid client booking behaves: revenue generated, till empty.
    const rows = buildCashFlowRows(withAgency({ invoiced_at: '2026-11-30', paid_at: null }))
    expect(month(rows, '2026-11')?.billed).toBe(360)
    expect(sumCashFlowRows(rows).agenciesIn).toBe(0)
  })

  it('bills on the booking check-in month, since an invoice line carries no date', () => {
    // Same rule as the season filter on the Agencies tab, so the two agree.
    const rows = buildCashFlowRows(withAgency({ paid_at: '2027-02-01' }))
    expect(month(rows, '2026-11')?.billed).toBe(360)
  })

  it('ignores the lines of a cancelled booking', () => {
    const rows = buildCashFlowRows(mkData({
      agencies: [mkAgency()],
      bookings: [mkBooking({ id: 'bk1', status: 'cancelled' })],
      agencyBillingLines: [mkAgencyLine({ paid_at: '2026-12-09' })],
    }))
    expect(sumCashFlowRows(rows).agenciesIn).toBe(0)
  })

  it('feeds net, so the cash actually reaches the bottom line', () => {
    const rows = buildCashFlowRows(withAgency({ paid_at: '2026-12-09' }))
    expect(month(rows, '2026-12')?.net).toBe(360)
  })

  it('does not double count: the guest owes nothing for an agency-billed service', () => {
    // The services on the line are excluded from client totals (Phase 5) and the
    // agency settles outside `payments`, so 360 € must appear once, not twice.
    const data = withAgency({ paid_at: '2026-12-09' })
    const totals = sumCashFlowRows(buildCashFlowRows(data))
    expect(totals.collected).toBe(0)
    expect(totals.agenciesIn).toBe(360)
  })

  it('agrees with the dashboard on what an agency brings in', () => {
    // Same guard as the Palmeiras identity above: the dashboard counts agency.net
    // in totalRevenue, so the billed column here has to land on the same figure.
    const data = withAgency({ paid_at: '2026-12-09' })
    const totals = sumCashFlowRows(buildCashFlowRows(data))
    expect(totals.billed).toBe(computeSeasonTotals(data).agencyRev)
  })

  it('splits two agencies with different commissions onto their own paid months', () => {
    const rows = buildCashFlowRows(mkData({
      agencies: [
        mkAgency({ id: 'ag1', commission_percent: 20 }),
        mkAgency({ id: 'ag2', name: 'Adekua', commission_percent: 10, short_code: 'Adek' }),
      ],
      bookings: [mkBooking({ id: 'bk1', check_in: '2026-11-04', check_out: '2026-11-11' })],
      agencyBillingLines: [
        mkAgencyLine({ id: 'abl1', agency_id: 'ag1', price: 450, paid_at: '2026-12-09' }), // 360
        mkAgencyLine({ id: 'abl2', agency_id: 'ag2', price: 200, paid_at: '2027-01-05' }), // 180
      ],
    }))
    expect(month(rows, '2026-12')?.agenciesIn).toBe(360)
    expect(month(rows, '2027-01')?.agenciesIn).toBe(180)
    expect(month(rows, '2026-11')?.billed).toBe(540)
  })
})
