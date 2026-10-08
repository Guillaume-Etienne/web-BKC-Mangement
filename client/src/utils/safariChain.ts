// A safari and the Maputo partner-hotel nights around it form one trip:
// hotel → safari → hotel. This lines them up per booking and says what does
// not chain: a missing night, a gap, an overlap.
//
// Convention: the hotel stay before ends the day the safari starts
// (check_out = safari start), the stay after begins the day it ends
// (check_in = safari end). Anything else is reported, never corrected.
import type { ActivityBooking, PartnerHotelStay } from '../types/database'
import { daysBetween } from './dates'

export type ChainIssue =
  | { kind: 'no_stay_before' }
  | { kind: 'no_stay_after' }
  | { kind: 'gap_before'; nights: number }   // hotel left N nights before the safari starts
  | { kind: 'gap_after'; nights: number }    // N nights between safari end and hotel check-in
  | { kind: 'overlap'; stayId: string }      // a hotel stay inside the safari dates

export interface SafariChain {
  safari: ActivityBooking
  start:  string
  end:    string
  before: PartnerHotelStay | null
  after:  PartnerHotelStay | null
  issues: ChainIssue[]
}

export function safariEnd(a: Pick<ActivityBooking, 'date' | 'end_date'>): string {
  return a.end_date && a.end_date >= a.date ? a.end_date : a.date
}

export function chainSafari(safari: ActivityBooking, stays: PartnerHotelStay[]): SafariChain {
  const start = safari.date
  const end = safariEnd(safari)
  // Without a booking nothing ties a hotel night to this safari.
  if (!safari.booking_id) return { safari, start, end, before: null, after: null, issues: [] }

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
  return { safari, start, end, before, after, issues }
}

export function issueLabel(i: ChainIssue): string {
  switch (i.kind) {
    case 'no_stay_before': return 'No Maputo night before'
    case 'no_stay_after':  return 'No Maputo night after'
    case 'gap_before':     return `${i.nights} night${i.nights > 1 ? 's' : ''} uncovered before the safari`
    case 'gap_after':      return `${i.nights} night${i.nights > 1 ? 's' : ''} uncovered after the safari`
    case 'overlap':        return 'A hotel stay overlaps the safari'
  }
}
