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
import { daysBetween, addDaysISO } from './dates'

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

// ── One reservation = several nights (arrival, absence, return) ──────────────

/** The nights of one reservation share a group_id; an ungrouped row is alone. */
export function stayGroupKey(s: Pick<PartnerHotelStay, 'id' | 'group_id'>): string {
  return s.group_id ?? s.id
}

export interface StayGroup {
  key:      string
  stays:    PartnerHotelStay[]                // by check-in
  first:    PartnerHotelStay                  // carries the shared fields (name, pax, rooms…)
  start:    string                            // first check-in
  end:      string                            // last check-out
  nights:   number
  totalMzn: number
  commissionMzn: number
  absences: { from: string; to: string }[]    // between two nights, e.g. the safari
}

export function groupStays(stays: PartnerHotelStay[]): StayGroup[] {
  const byKey = new Map<string, PartnerHotelStay[]>()
  for (const s of stays) {
    const k = stayGroupKey(s)
    byKey.set(k, [...(byKey.get(k) ?? []), s])
  }
  const groups: StayGroup[] = []
  for (const [key, list] of byKey) {
    const sorted = [...list].sort((a, b) => a.check_in.localeCompare(b.check_in))
    const absences: StayGroup['absences'] = []
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].check_in > sorted[i - 1].check_out) {
        absences.push({ from: sorted[i - 1].check_out, to: sorted[i].check_in })
      }
    }
    groups.push({
      key, stays: sorted, first: sorted[0],
      start: sorted[0].check_in,
      end: sorted.reduce((m, s) => s.check_out > m ? s.check_out : m, sorted[0].check_out),
      nights: sorted.reduce((n, s) => n + stayNights(s), 0),
      totalMzn: sorted.reduce((n, s) => n + stayTotalMzn(s), 0),
      commissionMzn: sorted.reduce((n, s) => n + stayCommissionMzn(s), 0),
      absences,
    })
  }
  return groups.sort((a, b) => a.start.localeCompare(b.start))
}

/** Arrival night = the eve of the safari, return night = its last day. */
export function nightsAroundSafari(start: string, end: string): {
  arrival: { check_in: string; check_out: string }
  ret:     { check_in: string; check_out: string }
} {
  return {
    arrival: { check_in: addDaysISO(start, -1), check_out: start },
    ret:     { check_in: end, check_out: addDaysISO(end, 1) },
  }
}

// ── Day by day (the hotel's front-desk view) ─────────────────────────────────

export interface HotelDay {
  date:       string
  arrivals:   PartnerHotelStay[]   // check-in that day
  departures: PartnerHotelStay[]   // check-out that day
  staying:    PartnerHotelStay[]   // in the hotel that night, arrived earlier
}

/** Every day from `from` to the last check-out on which something happens. */
export function hotelDays(stays: PartnerHotelStay[], from: string): HotelDay[] {
  const relevant = stays.filter(s => s.check_out >= from)
  if (relevant.length === 0) return []
  const last = relevant.reduce((m, s) => s.check_out > m ? s.check_out : m, from)
  const days: HotelDay[] = []
  for (let d = from; d <= last; d = addDaysISO(d, 1)) {
    const day: HotelDay = {
      date: d,
      arrivals:   relevant.filter(s => s.check_in === d),
      departures: relevant.filter(s => s.check_out === d),
      staying:    relevant.filter(s => s.check_in < d && s.check_out > d),
    }
    if (day.arrivals.length || day.departures.length || day.staying.length) days.push(day)
  }
  return days
}
