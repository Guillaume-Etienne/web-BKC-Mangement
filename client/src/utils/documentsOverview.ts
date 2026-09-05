import type { Payment } from '../types/database'
import { daysBetween } from './dates'
import type { ISODate } from './dates'

// ── The two computed columns of Documents → Overview ─────────────────────────
//
// Both are pure and live here rather than in the page because one of them counts
// money: the grid says "the deposit is in" and the owner stops chasing it, so the
// arithmetic is worth a test of its own.

export type DepositTone = 'none' | 'unflagged' | 'paid'

export interface DepositState {
  tone: DepositTone
  received: number   // every euro on the booking, discounts excluded
  flagged: number    // the share explicitly recorded as a deposit
}

/** What the Deposit cell knows about a booking.
 *
 *  Nothing in the database records that a deposit was *asked* for — the only
 *  deposit trace anywhere is `payments.is_deposit`, ticked by hand when the
 *  payment is entered. So this reads what came in, and distinguishes the two
 *  cases that look identical on a booking page:
 *
 *  - `paid`      a payment is flagged Deposit — the answer is unambiguous.
 *  - `unflagged` money arrived but nobody ticked the box. Almost certainly the
 *                deposit, but the app must not say so on its own: it shows amber
 *                and the owner ticks the box in Accounting → Bookings.
 *  - `none`      not a cent.
 *
 *  Discounts are not money received (same rule as computeBookingPaid), and
 *  unverified payments still count — they came from a real amount the owner
 *  typed, and hiding them would read as "never paid". */
export function depositState(bookingId: string, payments: Payment[]): DepositState {
  let received = 0
  let flagged  = 0
  for (const p of payments) {
    if (p.booking_id !== bookingId || p.is_discount) continue
    received += p.amount
    if (p.is_deposit) flagged += p.amount
  }
  return {
    tone: flagged > 0 ? 'paid' : received > 0 ? 'unflagged' : 'none',
    received,
    flagged,
  }
}

export type StayTone = 'here' | 'soon' | 'later' | 'past'

export interface StayState {
  tone: StayTone
  label: string
  days: number   // whole days from today to check-in; negative once it has started
}

/** How far away the stay is, for the Arrival column.
 *
 *  The grid is a to-do list, and a document is only late relative to an arrival:
 *  a Welcome Guide unsent at D-3 is a problem, the same blank cell six months out
 *  is not. `soon` (a week or less) is what the amber is for. */
export function stayState(checkIn: ISODate, checkOut: ISODate, today: ISODate): StayState {
  const days = daysBetween(today, checkIn)
  if (checkOut < today) return { tone: 'past',  label: 'done',       days }
  if (checkIn  <= today) return { tone: 'here',  label: 'here now',   days }
  if (days <= 1)         return { tone: 'soon',  label: days === 0 ? 'today' : 'tomorrow', days }
  return { tone: days <= 7 ? 'soon' : 'later', label: `in ${days} d`, days }
}
