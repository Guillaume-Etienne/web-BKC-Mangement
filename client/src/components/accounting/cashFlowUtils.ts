import type { SharedAccountingData } from './types'
import { computeBookingTotal, computeBookingDiscounts } from './utils'

/** One month of cash movements. Amounts in EUR. */
export interface MonthRow {
  month: string      // YYYY-MM
  billed: number     // invoiced to clients (accrual, by check-in month)
  collected: number  // cash received (by payment date), verified or not
  unverified: number // share of the above still flagged "to verify"
  /** Palmeiras net for the month, rent excluded: reversals owed to us, plus the
   *  free income lines, minus the free expense lines. Goes negative when the
   *  free expenses of a month outweigh what came in.
   *  Holds the identity `palmIn − rent === palmeirasNet` (the dashboard figure),
   *  which is what keeps the two screens from drifting apart — locked by a test. */
  palmIn: number
  expenses: number   // the general expenses table, NOT the Palmeiras free ones
  rent: number       // Palmeiras monthly lease
  instrPaid: number  // payroll actually paid out
  taxiOut: number    // driver + manager cash, MZN→EUR
  /** Activity providers settled this month: cash paid to them minus cash they
   *  paid us. Positive is money leaving the till, like taxiOut; it goes negative
   *  on a `provider_pays_us` provider who owes us more than we owe them.
   *  This is the *cash*, not the cost — the cost is already netted out of
   *  `billed`, which is not part of `net`, so there is no double count. */
  providersOut: number
  net: number        // collected + palmIn − every outflow
}

export type CashFlowTotals = Omit<MonthRow, 'month'>

const EMPTY = (month: string): MonthRow => ({
  month, billed: 0, collected: 0, unverified: 0, palmIn: 0, expenses: 0, rent: 0,
  instrPaid: 0, taxiOut: 0, providersOut: 0, net: 0,
})

/** Monthly cash movements, newest month first.
 *
 *  Cash basis, not accrual: `net` is built from what was actually **collected**,
 *  not from what was billed. The `billed` column sits alongside for comparison.
 *
 *  Conventions worth knowing before changing anything here:
 *  - Revenue is attributed to the **check-in month** of the booking, not spread
 *    across the stay.
 *  - Cancelled bookings are skipped, and discounts are not cash so they never
 *    land in `collected`.
 *  - Booking-linked activities are already inside computeBookingTotal; only the
 *    standalone ones are added, and at their **net margin**.
 *  - Drivers are paid cash right after each trip, so their MZN is counted on
 *    trips marked `done`, at the trip's month — there is no driver payment table
 *    and none is needed. The manager is paid irregularly, so his real dated
 *    payments are used instead.
 *  - Every MZN amount is converted at the current global rate, including for past
 *    months (a deliberate decision: one rate, no per-line history).
 *  - Activity providers are settled irregularly, like the taxi manager, so their
 *    real dated `activity_payments` are used rather than the booking dates.
 */
export function buildCashFlowRows(data: SharedAccountingData): MonthRow[] {
  const {
    payments, expenses, palmeirasRents, palmeirasReversals, palmeirasEntries,
    bookings, instructorPayments, taxiTrips, taxiManagerPayments,
    activityBookings, activityPayments, eurMznRate,
  } = data

  const idx: Record<string, MonthRow> = {}
  const ensure = (m: string) => (idx[m] ??= EMPTY(m))

  for (const b of bookings.filter(b => b.status !== 'cancelled')) {
    // Net of discounts, like the dashboard: a gesture granted to a client is not
    // revenue generated. Both are booked on the check-in month so a booking always
    // shows one coherent figure, whatever date the discount carries.
    ensure(b.check_in.slice(0, 7)).billed +=
      computeBookingTotal(b, data) - computeBookingDiscounts(b.id, payments)
  }

  for (const t of taxiTrips.filter(t => t.booking_id === null)) {
    ensure(t.date.slice(0, 7)).billed += t.price_eur
  }

  for (const a of activityBookings.filter(a => a.booking_id === null)) {
    const net = a.payment_flow === 'we_pay_provider'
      ? a.price_client - a.price_provider
      : a.price_provider
    ensure(a.date.slice(0, 7)).billed += net
  }

  for (const p of payments.filter(p => !p.is_discount)) {
    const row = ensure(p.date.slice(0, 7))
    row.collected += p.amount
    if (!p.is_verified) row.unverified += p.amount
  }

  for (const r of palmeirasReversals) ensure(r.month).palmIn += r.net_amount
  for (const r of palmeirasRents)     ensure(r.month).rent   += r.amount
  // The free entries — the hand-typed Palmeiras lines that fit neither a reversal
  // nor the rent. The dashboard has always counted them in `palmeirasNet`; this
  // table did not even read them, so a free line showed up in the season result
  // and nowhere in the month it belonged to. Worse, `net` feeds runningBalances,
  // so one missed line shifted the cumulative balance of every later month too.
  for (const e of palmeirasEntries) {
    if (e.type === 'income') ensure(e.month).palmIn += e.amount
    else                     ensure(e.month).palmIn -= e.amount
  }
  for (const e of expenses)           ensure(e.date.slice(0, 7)).expenses  += e.amount
  for (const p of instructorPayments) ensure(p.date.slice(0, 7)).instrPaid += p.amount

  const rate = eurMznRate || 1
  for (const t of taxiTrips.filter(t => t.status === 'done')) {
    ensure(t.date.slice(0, 7)).taxiOut += t.price_driver_mzn / rate
  }
  for (const p of taxiManagerPayments) {
    ensure(p.date.slice(0, 7)).taxiOut += p.amount_mzn / rate
  }

  // Settling an activity provider moves real cash, and nothing in this table used
  // to show it: the provider's cost was netted out of `billed` (accrual), but the
  // day the money actually left the till was invisible. Same treatment as the taxi
  // manager — their own dated payments, not the booking dates.
  for (const p of activityPayments) {
    const row = ensure(p.date.slice(0, 7))
    if (p.direction === 'to_provider') row.providersOut += p.amount
    else                               row.providersOut -= p.amount
  }

  for (const row of Object.values(idx)) {
    row.net = row.collected + row.palmIn
      - row.expenses - row.rent - row.instrPaid - row.taxiOut - row.providersOut
  }

  return Object.values(idx).sort((a, b) => b.month.localeCompare(a.month))
}

/** Keep the months within an inclusive YYYY-MM range. */
export function filterRowsByPeriod(rows: MonthRow[], from: string, to: string): MonthRow[] {
  return rows.filter(r => r.month >= from && r.month <= to)
}

/** Column-by-column sum of the given months. */
export function sumCashFlowRows(rows: MonthRow[]): CashFlowTotals {
  return rows.reduce<CashFlowTotals>((acc, r) => ({
    billed:    acc.billed    + r.billed,
    collected: acc.collected + r.collected,
    unverified: acc.unverified + r.unverified,
    palmIn:    acc.palmIn    + r.palmIn,
    expenses:  acc.expenses  + r.expenses,
    rent:      acc.rent      + r.rent,
    instrPaid: acc.instrPaid + r.instrPaid,
    taxiOut:   acc.taxiOut   + r.taxiOut,
    providersOut: acc.providersOut + r.providersOut,
    net:       acc.net       + r.net,
  }), { billed: 0, collected: 0, unverified: 0, palmIn: 0, expenses: 0, rent: 0,
        instrPaid: 0, taxiOut: 0, providersOut: 0, net: 0 })
}

/** Cumulative net per month, walking oldest → newest. */
export function runningBalances(rows: MonthRow[]): Record<string, number> {
  const out: Record<string, number> = {}
  let cumul = 0
  for (const r of [...rows].sort((a, b) => a.month.localeCompare(b.month))) {
    cumul += r.net
    out[r.month] = cumul
  }
  return out
}
