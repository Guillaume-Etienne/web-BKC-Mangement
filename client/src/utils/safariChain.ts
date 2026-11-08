// A safari and the Maputo partner-hotel nights around it form one trip:
// hotel → safari → hotel. This lines them up per booking and says what does
// not chain: a missing night, a gap, an overlap.
//
// Convention: the hotel stay before ends the day the safari starts
// (check_out = safari start), the stay after begins the day it ends
// (check_in = safari end). Anything else is reported, never corrected.
//
// With the booking's Bilene stay and its taxis (optional `ctx`), the check runs
// over the whole trip (2026-11-08, case #021). Three shapes, read from where
// the Bilene stay sits against the Maputo nights:
//   - Bilene first  : Bilene → our taxi → Maputo → safari → Maputo → airport.
//                     The hotel drives them to the airport (drop-off).
//   - safari first  : airport → Maputo → safari → Maputo → our taxi → Bilene.
//                     The hotel picks them up at the airport.
//   - trip inside   : Bilene → Maputo → safari → Maputo → Bilene, taxi both ways.
//                     The Bilene room kept meanwhile is a choice, not reported.
// Bilene ↔ Maputo links are checked only once the hotel night exists: before
// that, the missing night is the one thing to say.
import type { ActivityBooking, PartnerHotelStay, TaxiTrip, TaxiTripType } from '../types/database'
import { daysBetween, fmtDateShort } from './dates'
import { taxiTripLabel } from '../data/taxiTripTypes'

export type ChainIssue =
  | { kind: 'no_stay_before' }
  | { kind: 'no_stay_after' }
  | { kind: 'gap_before'; nights: number }   // hotel left N nights before the safari starts
  | { kind: 'gap_after'; nights: number }    // N nights between safari end and hotel check-in
  | { kind: 'overlap'; stayId: string }      // a hotel stay inside the safari dates
  | { kind: 'bilene_overlap'; nights: number }  // Bilene still booked N nights they spend in Maputo
  | { kind: 'bilene_gap'; nights: number }      // N nights neither in Bilene nor in Maputo
  | { kind: 'no_taxi'; tripType: TaxiTripType; date: string }       // our Bilene ↔ Maputo taxi
  | { kind: 'stray_airport_taxi'; tripType: TaxiTripType; date: string } // the hotel does the airport
  | { kind: 'no_transfer'; which: 'pickup' | 'dropoff'; date: string }
  | { kind: 'transfer_no_time'; which: 'pickup' | 'dropoff'; date: string }

export type BileneSide = 'before' | 'after' | 'around'

export interface SafariChain {
  safari: ActivityBooking
  start:  string
  end:    string
  before: PartnerHotelStay | null
  after:  PartnerHotelStay | null
  /** Where the Bilene stay sits against the trip — null when unknown or unchecked. */
  bilene: BileneSide | null
  issues: ChainIssue[]
}

/** What the whole-trip check needs from the booking and its taxis. */
export interface ChainContext {
  stay?:  { check_in: string; check_out: string }
  taxis?: Pick<TaxiTrip, 'booking_id' | 'date' | 'type'>[]
}

export function safariEnd(a: Pick<ActivityBooking, 'date' | 'end_date'>): string {
  return a.end_date && a.end_date >= a.date ? a.end_date : a.date
}

/** Bilene first, safari first, or the trip in the middle of the Bilene stay. */
export function bileneSide(stay: { check_in: string; check_out: string }, tripStart: string, tripEnd: string): BileneSide | null {
  const startsBefore = stay.check_in < tripStart
  const endsAfter    = stay.check_out > tripEnd
  if (startsBefore && endsAfter) return 'around'
  if (startsBefore) return 'before'
  if (endsAfter) return 'after'
  return null   // a Bilene stay inside the trip: nothing sensible to check
}

export function chainSafari(safari: ActivityBooking, stays: PartnerHotelStay[], ctx: ChainContext = {}): SafariChain {
  const start = safari.date
  const end = safariEnd(safari)
  // Without a booking nothing ties a hotel night to this safari.
  if (!safari.booking_id) return { safari, start, end, before: null, after: null, bilene: null, issues: [] }

  const own = stays.filter(s => s.booking_id === safari.booking_id)
  const before = own
    .filter(s => s.check_out <= start)
    .sort((a, b) => b.check_out.localeCompare(a.check_out))[0] ?? null
  const after = own
    .filter(s => s.check_in >= end)
    .sort((a, b) => a.check_in.localeCompare(b.check_in))[0] ?? null

  const issues: ChainIssue[] = []
  if (!before) issues.push({ kind: 'no_stay_before' })
  else if (before.check_out < start) issues.push({ kind: 'gap_before', nights: daysBetween(before.check_out, start) })
  if (!after) issues.push({ kind: 'no_stay_after' })
  else if (after.check_in > end) issues.push({ kind: 'gap_after', nights: daysBetween(end, after.check_in) })
  for (const s of own) {
    if (s.check_in < end && s.check_out > start) issues.push({ kind: 'overlap', stayId: s.id })
  }

  const bilene = ctx.stay
    ? bileneSide(ctx.stay, before?.check_in ?? start, after?.check_out ?? end)
    : null
  if (ctx.stay && bilene) {
    const taxis = (ctx.taxis ?? []).filter(t => t.booking_id === safari.booking_id)
    const hasTaxi = (type: TaxiTripType, a: string, b: string) => {
      const [from, to] = a <= b ? [a, b] : [b, a]
      return taxis.some(t => t.type === type && t.date >= from && t.date <= to)
    }

    // Leaving Bilene for Maputo.
    if ((bilene === 'before' || bilene === 'around') && before) {
      const out = ctx.stay.check_out
      if (bilene === 'before') {
        if (out > before.check_in) issues.push({ kind: 'bilene_overlap', nights: daysBetween(before.check_in, out) })
        else if (out < before.check_in) issues.push({ kind: 'bilene_gap', nights: daysBetween(out, before.check_in) })
      }
      // The day they leave is the hotel arrival; a Bilene check-out off by a few
      // days is already reported above, so a taxi on either date counts.
      const leave = bilene === 'before' ? out : before.check_in
      if (!hasTaxi('center-to-town', leave, before.check_in)) {
        issues.push({ kind: 'no_taxi', tripType: 'center-to-town', date: before.check_in })
      }
    }
    // Coming back from Maputo to Bilene.
    if ((bilene === 'after' || bilene === 'around') && after) {
      const back = ctx.stay.check_in
      if (bilene === 'after') {
        if (back < after.check_out) issues.push({ kind: 'bilene_overlap', nights: daysBetween(back, after.check_out) })
        else if (back > after.check_out) issues.push({ kind: 'bilene_gap', nights: daysBetween(after.check_out, back) })
      }
      const arrive = bilene === 'after' ? back : after.check_out
      if (!hasTaxi('town-to-center', after.check_out, arrive)) {
        issues.push({ kind: 'no_taxi', tripType: 'town-to-center', date: after.check_out })
      }
    }

    // They fly out of Maputo: the hotel does the airport, not our taxi.
    if (bilene === 'before' && after) {
      const from = before && before.check_in < ctx.stay.check_out ? before.check_in : ctx.stay.check_out
      for (const t of taxis) {
        if (t.type === 'center-to-aero' && t.date >= from) issues.push({ kind: 'stray_airport_taxi', tripType: t.type, date: t.date })
      }
      if (!after.departure_transfer) issues.push({ kind: 'no_transfer', which: 'dropoff', date: after.check_out })
      else if (!after.departure_transfer_time) issues.push({ kind: 'transfer_no_time', which: 'dropoff', date: after.check_out })
    }
    // They land in Maputo: same, on the way in.
    if (bilene === 'after' && before) {
      const to = after && after.check_out > ctx.stay.check_in ? after.check_out : ctx.stay.check_in
      for (const t of taxis) {
        if (t.type === 'aero-to-center' && t.date <= to) issues.push({ kind: 'stray_airport_taxi', tripType: t.type, date: t.date })
      }
      if (!before.airport_transfer) issues.push({ kind: 'no_transfer', which: 'pickup', date: before.check_in })
      else if (!before.transfer_time) issues.push({ kind: 'transfer_no_time', which: 'pickup', date: before.check_in })
    }
  }

  return { safari, start, end, before, after, bilene, issues }
}

const plural = (n: number) => `${n} night${n > 1 ? 's' : ''}`

export function issueLabel(i: ChainIssue): string {
  switch (i.kind) {
    case 'no_stay_before':     return 'No Maputo night before'
    case 'no_stay_after':      return 'No Maputo night after'
    case 'gap_before':         return `${plural(i.nights)} uncovered before the safari`
    case 'gap_after':          return `${plural(i.nights)} uncovered after the safari`
    case 'overlap':            return 'A hotel stay overlaps the safari'
    case 'bilene_overlap':     return `Bilene still booked for ${plural(i.nights)} of the trip`
    case 'bilene_gap':         return `${plural(i.nights)} uncovered between Bilene and Maputo`
    case 'no_taxi':            return `No taxi ${taxiTripLabel(i.tripType)} on ${fmtDateShort(i.date)}`
    case 'stray_airport_taxi': return `Taxi ${taxiTripLabel(i.tripType)} on ${fmtDateShort(i.date)}: the hotel does the airport`
    case 'no_transfer':        return `No airport ${i.which === 'dropoff' ? 'drop-off' : 'pick-up'} by the hotel on ${fmtDateShort(i.date)}`
    case 'transfer_no_time':   return `${i.which === 'dropoff' ? 'Drop-off' : 'Pick-up'} time missing on ${fmtDateShort(i.date)}`
  }
}
