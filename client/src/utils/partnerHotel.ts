// Partner hotels (Hotel CasaMoz, Maputo) — the money of a stop-over.
//
// The hotel bills per room per night, in MZN. We earn a commission on it
// (10 % by default, frozen on each stay). Who owes whom depends on who the
// guest paid:
//   guest_to_hotel → the hotel owes us our commission
//   guest_to_us    → we owe the hotel the price minus our commission
// Nothing is owed until the guests have paid: before that the amount is only
// expected, and is not counted in the balance.
import type { PartnerHotelPayment, PartnerHotelStay } from '../types/database'
import { daysBetween } from './dates'

export function stayNights(s: Pick<PartnerHotelStay, 'check_in' | 'check_out'>): number {
  return Math.max(0, daysBetween(s.check_in, s.check_out))
}

/** Price of one night, all rooms together. */
export function stayNightlyMzn(s: Pick<PartnerHotelStay, 'rooms'>): number {
  return (s.rooms ?? []).reduce((sum, r) => sum + (Number(r.rate_mzn) || 0), 0)
}

export function stayTotalMzn(s: Pick<PartnerHotelStay, 'rooms' | 'check_in' | 'check_out'>): number {
  return stayNightlyMzn(s) * stayNights(s)
}

export function stayCommissionMzn(
  s: Pick<PartnerHotelStay, 'rooms' | 'check_in' | 'check_out' | 'commission_pct'>,
): number {
  return Math.round(stayTotalMzn(s) * (Number(s.commission_pct) || 0) / 100)
}

/** What the hotel owes us for this stay (negative = we owe the hotel).
 *  Computed whether or not the guests have paid — see `stayDueMzn`. */
export function stayExpectedMzn(s: PartnerHotelStay): number {
  const commission = stayCommissionMzn(s)
  return s.paid_by === 'guest_to_hotel' ? commission : -(stayTotalMzn(s) - commission)
}

/** Same, but only once the guests have paid — the part that is really owed. */
export function stayDueMzn(s: PartnerHotelStay): number {
  return s.guests_paid ? stayExpectedMzn(s) : 0
}

/** The hotel's account: positive = the hotel owes us, negative = we owe it.
 *  Owed by paid stays, minus what the hotel has sent us, plus what we sent it. */
export function hotelBalanceMzn(stays: PartnerHotelStay[], payments: PartnerHotelPayment[]): number {
  const due = stays.reduce((s, st) => s + stayDueMzn(st), 0)
  const settled = payments.reduce(
    (s, p) => s + (p.direction === 'hotel_to_us' ? p.amount_mzn : -p.amount_mzn), 0)
  return due - settled
}

/** Our commission on all these stays, in EUR at the given rate (approximate). */
export function commissionEur(stays: PartnerHotelStay[], eurMznRate: number): number {
  if (!eurMznRate) return 0
  const mzn = stays.reduce((s, st) => s + stayCommissionMzn(st), 0)
  return Math.round(mzn / eurMznRate)
}

export function fmtMzn(n: number): string {
  return `${Math.round(n).toLocaleString('en-US')} MZN`
}
