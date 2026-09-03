/** "Qui attend quoi" — one working list, prospects and half-finished bookings
 *  together, sorted by how long they have been waiting.
 *
 *  The gap this fills: the **Silence** column only ever existed for prospects.
 *  The day someone became a booking they left that list — and a provisional
 *  booking nobody has spoken to for three weeks appeared nowhere. The Home
 *  pending actions do not catch it either: they speak in deadlines (check-in in
 *  N days, visa in N days), never in silence. So the file that has gone quiet is
 *  exactly the one nothing was watching.
 *
 *  Two rules keep this list short enough to be read every morning:
 *   • an enquiry nobody has qualified is always on it — a person is waiting for
 *     an answer, and reading it takes twenty seconds;
 *   • everything else needs a real silence (SILENCE_WARN_DAYS) before it counts.
 *     A list that shows someone contacted yesterday is a list gui stops opening.
 */
import type { Booking, Enquiry } from '../types/database'
import { SILENCE_WARN_DAYS, isQualified, isSettled, silenceDays, fmtArrivalMonth } from './enquiries'
import { toISODate } from './dates'

export interface FollowUp {
  id: string
  kind: 'enquiry' | 'booking'
  /** The row to open. */
  targetId: string
  name: string
  /** What this person is after, in one line. */
  wants: string
  /** When they are expected — a month for an enquiry, real dates for a booking. */
  when: string | null
  silenceDays: number
  /** Why this is on the list, in gui's language. */
  reason: string
  tone: 'urgent' | 'normal'
}

/** The dated things that count as "we are still in touch". Only what the Home
 *  page already loads for the pending actions — this list must not cost a query. */
export interface TouchInput {
  payments: { booking_id: string; date: string }[]
  emails: { booking_id: string; sent_at?: string | null; created_at?: string | null }[]
}

function wantsOfEnquiry(e: Enquiry): string {
  const bits = [
    e.wants_lessons && '🪁 lessons',
    e.wants_rental && '🎿 rental',
    e.wants_accommodation && '🛏 accommodation',
  ].filter(Boolean)
  const size = e.party_size ? `${e.party_size} pax` : null
  return [size, bits.join(' · ') || null].filter(Boolean).join(' · ') || 'not qualified yet'
}

function wantsOfBooking(b: Booking): string {
  const bits = [
    b.num_lessons > 0 && `🪁 ${b.num_lessons} lessons`,
    b.num_wing_lessons > 0 && `🪽 ${b.num_wing_lessons} wing`,
    b.num_equipment_rentals > 0 && `🎿 ${b.num_equipment_rentals} rentals`,
    b.num_center_access > 0 && `🎟 ${b.num_center_access} center access`,
  ].filter(Boolean)
  return bits.join(' · ') || 'stay only'
}

function clientName(b: Booking): string {
  const c = b.client
  return c ? `${c.first_name} ${c.last_name}`.trim() : `Booking #${String(b.booking_number).padStart(3, '0')}`
}

function daysBetween(fromISO: string, now: Date): number {
  const t = new Date(fromISO).getTime()
  if (Number.isNaN(t)) return 0
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000))
}

/** The most recent sign of life on a booking: its creation, a payment recorded,
 *  a document emailed. Future-dated things are ignored — a stay in November is
 *  not news in September, and counting it would silence the very file that needs
 *  chasing. */
export function lastTouchOfBooking(b: Booking, touch: TouchInput, now: Date): string | null {
  const nowMs = now.getTime()
  const candidates: (string | null | undefined)[] = [
    b.created_at,
    ...touch.payments.filter(p => p.booking_id === b.id).map(p => p.date),
    ...touch.emails.filter(m => m.booking_id === b.id).map(m => m.sent_at ?? m.created_at),
  ]
  let best: string | null = null
  for (const c of candidates) {
    if (!c) continue
    const t = new Date(c).getTime()
    if (Number.isNaN(t) || t > nowMs) continue
    if (best === null || t > new Date(best).getTime()) best = c
  }
  return best
}

export interface FollowUpInput {
  enquiries: Enquiry[]
  bookings: Booking[]
  touch: TouchInput
}

/** Who is waiting on gui today, worst first. */
export function computeFollowUps(input: FollowUpInput, now: Date = new Date()): FollowUp[] {
  const out: FollowUp[] = []
  const today = toISODate(now)

  for (const e of input.enquiries) {
    if (isSettled(e.status)) continue
    const silence = silenceDays(e.last_contact_at, now)
    const unqualified = !isQualified(e)
    // An unqualified enquiry is on the list from day one: someone wrote in and
    // has had no answer. Everything else waits for a real silence.
    if (!unqualified && silence < SILENCE_WARN_DAYS) continue
    out.push({
      id: `enquiry:${e.id}`,
      kind: 'enquiry',
      targetId: e.id,
      name: e.name,
      wants: wantsOfEnquiry(e),
      when: e.arrival_month ? fmtArrivalMonth(e.arrival_month) : null,
      silenceDays: silence,
      reason: unqualified ? 'never read — nobody has answered them' : `no news for ${silence} days`,
      tone: unqualified ? 'urgent' : 'normal',
    })
  }

  for (const b of input.bookings) {
    if (b.status !== 'provisional') continue
    const last = lastTouchOfBooking(b, input.touch, now)
    const silence = last ? daysBetween(last, now) : 0
    const stayIsOver = b.check_out < today

    // A stay that happened while the booking stayed provisional is its own
    // problem — the money was never settled — and does not need to be silent
    // to deserve a line.
    if (!stayIsOver && silence < SILENCE_WARN_DAYS) continue

    out.push({
      id: `booking:${b.id}`,
      kind: 'booking',
      targetId: b.id,
      name: clientName(b),
      wants: wantsOfBooking(b),
      when: `${b.check_in} → ${b.check_out}`,
      silenceDays: silence,
      reason: stayIsOver
        ? 'the stay is over and the booking is still provisional'
        : `still provisional · nothing for ${silence} days`,
      tone: stayIsOver ? 'urgent' : 'normal',
    })
  }

  // Urgent first, then the longest wait. Ties broken by id so the order never
  // shuffles between two renders.
  return out.sort((a, b) => {
    if (a.tone !== b.tone) return a.tone === 'urgent' ? -1 : 1
    if (a.silenceDays !== b.silenceDays) return b.silenceDays - a.silenceDays
    return a.id.localeCompare(b.id)
  })
}
