import type { Booking } from '../types/database'
import type { SharedAccountingData } from '../components/accounting/types'
import {
  computeBookingDiscounts, computeBookingPaid, computeBookingTotal, emptyAccountingData,
} from '../components/accounting/utils'

// A walk-in's TAB (gui, 2026-11-15): a regular comes back several times, pays
// for all of it at once, and is sent ONE link — the "my visits" page
// (WalkInSharePage), which already adds every visit up.
//
// One visit per day stays the rule (dayVisitor.ts): the Daily, instructor pay
// and the season filter all rest on it. What is shared is only the settling:
// one payment typed once, split across the visits OLDEST FIRST, a partial
// payment eating into the next one (gui). Each visit keeps its own balance, so
// accounting per booking and the cards of the shared page stay true.

const cents = (n: number) => Math.round(n * 100) / 100

export interface VisitBalance {
  booking: Booking
  /** computeBookingTotal — the same figure accounting shows for the booking. */
  billed: number
  /** Money received (discounts excluded), verified or not — as accounting. */
  paid: number
  discounts: number
  /** billed − paid − discounts. Negative when the visit was overpaid. */
  due: number
}

/** Each visit's balance, OLDEST first (the order money is applied in). */
export function visitBalances(visits: Booking[], data: Partial<SharedAccountingData>): VisitBalance[] {
  const full: SharedAccountingData = { ...emptyAccountingData(), ...data }
  return [...visits]
    .sort((a, b) => a.check_in.localeCompare(b.check_in) || (a.created_at ?? '').localeCompare(b.created_at ?? ''))
    .map(booking => {
      const billed = cents(computeBookingTotal(booking, full))
      const paid = cents(computeBookingPaid(booking.id, full.payments))
      const discounts = cents(computeBookingDiscounts(booking.id, full.payments))
      return { booking, billed, paid, discounts, due: cents(billed - paid - discounts) }
    })
}

/** What the client owes over the whole tab — net: a visit paid too much
 *  offsets the others, exactly as the shared page totals it. */
export function tabDue(balances: VisitBalance[]): number {
  return cents(balances.reduce((s, v) => s + v.due, 0))
}

export interface TabSplit {
  bookingId: string
  amount: number
}

/** How one payment is spread over the visits: oldest unpaid visit first, each
 *  settled before the next is touched. Anything left once every visit is
 *  settled lands on the MOST RECENT visit (an overpayment the form warns about)
 *  rather than being dropped — the money was received. */
export function splitTabPayment(balances: VisitBalance[], amount: number): TabSplit[] {
  if (!(amount > 0) || balances.length === 0) return []
  let left = cents(amount)
  const share = new Map<string, number>()
  for (const v of balances) {
    if (left <= 0) break
    if (v.due <= 0) continue
    const take = cents(Math.min(left, v.due))
    share.set(v.booking.id, take)
    left = cents(left - take)
  }
  if (left > 0) {
    const last = balances[balances.length - 1].booking.id
    share.set(last, cents((share.get(last) ?? 0) + left))
  }
  return balances
    .filter(v => share.has(v.booking.id))
    .map(v => ({ bookingId: v.booking.id, amount: share.get(v.booking.id)! }))
}
