/** Where the people who actually came were found — and how many of the ones who
 *  wrote in became guests.
 *
 *  ENQUIRIES.md, quoting gui: the source list's "raison d'être, c'est la
 *  statistique", and the archive "n'est pas un cimetière : c'est là qu'on lit le
 *  taux de transformation et l'origine réelle des clients en fin de saison".
 *  The list, the trilingual labels and the never-delete rule were all built for
 *  this number, which was then never computed.
 *
 *  ⚠️ A booking's origin is resolved from four places, in this order:
 *    1. `bookings.source_id` — set when the question was actually asked, either
 *       in the wizard or on the form (2026-09-03);
 *    2. the enquiry that became this booking (`enquiries.booking_id`);
 *    3. the booking form that created it (`payload.referral_source_id`, or its
 *       free line);
 *    4. the booking's own `referral_source` text — older rows, and "Other".
 *  The last three are read-time fallbacks for everything written before the
 *  column existed, so no history had to be rewritten to make the count work.
 *  Anything else is counted as unknown, out loud. A statistic that quietly drops
 *  what it cannot classify looks clean and lies, which is the exact argument
 *  that put "Other" on the public form in the first place.
 */
import type { Booking, EnquirySource, Enquiry, FormSubmission } from '../types/database'
import { norm } from './enquiries'

/** The rows this needs from a submission — kept narrow so callers can pass a
 *  projection rather than the whole payload. */
export interface AttributionSubmission {
  created_booking_id: string | null
  payload: Pick<FormSubmission['payload'], 'referral_source' | 'referral_source_id'>
}

export interface AttributionInput {
  enquiries: Enquiry[]
  bookings: Booking[]
  submissions: AttributionSubmission[]
  sources: EnquirySource[]
  /** Restrict to one season. Enquiries are attributed by arrival month and
   *  bookings by check-in — the same rule the accounts use. */
  range?: { start: string; end: string } | null
}

export interface Origin {
  sourceId: string | null
  freeText: string | null
}

const UNKNOWN = 'unknown'

/** A grouping key that survives spelling: "Instagram" and " instagram " are the
 *  same answer, and counting them apart would invent a second source. */
export function originKey(o: Origin): string {
  if (o.sourceId) return o.sourceId
  const free = norm(o.freeText ?? '').trim()
  return free ? `other:${free}` : UNKNOWN
}

/** Where one booking came from. Exported because it is the interesting half:
 *  the aggregate below is just counting. */
export function bookingOrigin(
  booking: Booking,
  enquiries: Enquiry[],
  submissions: AttributionSubmission[]
): Origin {
  // The answer stored on the booking itself wins: it is the only one somebody
  // chose *for this booking*, rather than inherited from an earlier step.
  if (booking.source_id) return { sourceId: booking.source_id, freeText: null }

  const fromEnquiry = enquiries.find(e => e.booking_id === booking.id)
  if (fromEnquiry && (fromEnquiry.source_id || fromEnquiry.source_other)) {
    return { sourceId: fromEnquiry.source_id, freeText: fromEnquiry.source_other }
  }
  const fromForm = submissions.find(s => s.created_booking_id === booking.id)
  if (fromForm && (fromForm.payload?.referral_source_id || fromForm.payload?.referral_source)) {
    return {
      sourceId: fromForm.payload.referral_source_id ?? null,
      freeText: fromForm.payload.referral_source || null,
    }
  }
  return { sourceId: null, freeText: booking.referral_source || null }
}

export interface AttributionRow {
  key: string
  label: string
  /** People who wrote in from that source. */
  enquiries: number
  /** …and actually ended up with a booking. */
  bookings: number
}

export interface AttributionStats {
  rows: AttributionRow[]
  conversion: {
    open: number
    won: number
    lost: number
    /** won / (won + lost). null when nothing has been settled yet. */
    rate: number | null
  }
  /** Enquiries with no arrival month, which a season view cannot place. Shown
   *  rather than dropped: they are usually the ones nobody has qualified. */
  undatedEnquiries: number
}

function labelOf(o: Origin, sources: EnquirySource[]): string {
  if (o.sourceId) {
    const s = sources.find(x => x.id === o.sourceId)
    // A source that no longer exists still has to be named, or its rows would
    // silently pile up under "unknown" and the past would change.
    return s?.label?.en?.trim() || 'Removed source'
  }
  if (o.freeText?.trim()) return o.freeText.trim()
  return 'Unknown'
}

function inRange(dateISO: string | null, range: { start: string; end: string }): boolean {
  if (!dateISO) return false
  return dateISO >= range.start && dateISO <= range.end
}

export function computeAttribution(input: AttributionInput): AttributionStats {
  const { sources, range } = input

  // Enquiries land in a season by the month they said they were coming; a
  // booking by its check-in, the same attribution rule as the accounts.
  const enquiries = range
    ? input.enquiries.filter(e => e.arrival_month && inRange(`${e.arrival_month}-01`, {
        start: range.start.slice(0, 7) + '-01',
        end: range.end.slice(0, 7) + '-31',
      }))
    : input.enquiries

  // A cancelled booking is not somebody who came.
  const bookings = input.bookings
    .filter(b => b.status !== 'cancelled')
    .filter(b => (range ? inRange(b.check_in, range) : true))

  const rows = new Map<string, AttributionRow>()
  const bump = (o: Origin, field: 'enquiries' | 'bookings') => {
    const key = originKey(o)
    const row = rows.get(key) ?? { key, label: labelOf(o, sources), enquiries: 0, bookings: 0 }
    row[field] += 1
    rows.set(key, row)
  }

  for (const e of enquiries) bump({ sourceId: e.source_id, freeText: e.source_other }, 'enquiries')
  for (const b of bookings) bump(bookingOrigin(b, input.enquiries, input.submissions), 'bookings')

  let open = 0, won = 0, lost = 0
  for (const e of enquiries) {
    if (e.status === 'won') won++
    else if (e.status === 'lost') lost++
    else open++
  }
  // Open enquiries are deliberately out of the rate: they have not failed, they
  // have not answered. Counting them as losses would make every healthy month
  // look like a bad one.
  const settled = won + lost
  const rate = settled === 0 ? null : won / settled

  return {
    rows: [...rows.values()].sort((a, b) =>
      (b.bookings - a.bookings) || (b.enquiries - a.enquiries) || a.label.localeCompare(b.label)
    ),
    conversion: { open, won, lost, rate },
    undatedEnquiries: input.enquiries.filter(e => !e.arrival_month).length,
  }
}
