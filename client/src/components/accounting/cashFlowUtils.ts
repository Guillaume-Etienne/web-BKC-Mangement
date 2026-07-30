import type { SharedAccountingData } from './types'
import { computeBookingTotal, computeBookingDiscounts } from './utils'

/** One month of cash movements. Amounts in EUR. */
export interface MonthRow {
  month: string      // YYYY-MM
  billed: number     // invoiced to clients (accrual, by check-in month)
  collected: number  // cash actually received (by payment date)
  palmIn: number     // Palmeiras reversals owed to us
  expenses: number
  rent: number       // Palmeiras monthly lease
  instrPaid: number  // payroll actually paid out
  taxiOut: number    // driver + manager cash, MZN→EUR
  net: number        // collected + palmIn − every outflow
}

export type CashFlowTotals = Omit<MonthRow, 'month'>

const EMPTY = (month: string): MonthRow => ({
  month, billed: 0, collected: 0, palmIn: 0, expenses: 0, rent: 0, instrPaid: 0, taxiOut: 0, net: 0,
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
 */
export function buildCashFlowRows(data: SharedAccountingData): MonthRow[] {
  const {
    payments, expenses, palmeirasRents, palmeirasReversals,
    bookings, instructorPayments, taxiTrips, taxiManagerPayments,
    activityBookings, eurMznRate,
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
    ensure(p.date.slice(0, 7)).collected += p.amount
  }

  for (const r of palmeirasReversals) ensure(r.month).palmIn += r.net_amount
  for (const r of palmeirasRents)     ensure(r.month).rent   += r.amount
  for (const e of expenses)           ensure(e.date.slice(0, 7)).expenses  += e.amount
  for (const p of instructorPayments) ensure(p.date.slice(0, 7)).instrPaid += p.amount

  const rate = eurMznRate || 1
  for (const t of taxiTrips.filter(t => t.status === 'done')) {
    ensure(t.date.slice(0, 7)).taxiOut += t.price_driver_mzn / rate
  }
  for (const p of taxiManagerPayments) {
    ensure(p.date.slice(0, 7)).taxiOut += p.amount_mzn / rate
  }

  for (const row of Object.values(idx)) {
    row.net = row.collected + row.palmIn - row.expenses - row.rent - row.instrPaid - row.taxiOut
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
    palmIn:    acc.palmIn    + r.palmIn,
    expenses:  acc.expenses  + r.expenses,
    rent:      acc.rent      + r.rent,
    instrPaid: acc.instrPaid + r.instrPaid,
    taxiOut:   acc.taxiOut   + r.taxiOut,
    net:       acc.net       + r.net,
  }), { billed: 0, collected: 0, palmIn: 0, expenses: 0, rent: 0, instrPaid: 0, taxiOut: 0, net: 0 })
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
