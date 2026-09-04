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
import type { Booking, Enquiry, Lang } from '../types/database'
import { SILENCE_WARN_DAYS, isQualified, isSettled, silenceDays, fmtArrivalMonth } from './enquiries'
import { toISODate } from './dates'
import { i18n } from '../data/i18n'

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

function wantsOfEnquiry(e: Enquiry, lang: Lang): string {
  const t = i18n.followups
  const bits = [
    e.wants_lessons && t.fu_want_lessons[lang],
    e.wants_rental && t.fu_want_rental[lang],
    e.wants_accommodation && t.fu_want_accommodation[lang],
  ].filter(Boolean)
  const size = e.party_size ? t.fu_party_size[lang].replace('{n}', String(e.party_size)) : null
  return [size, bits.join(' · ') || null].filter(Boolean).join(' · ') || t.fu_not_qualified_yet[lang]
}

function wantsOfBooking(b: Booking, lang: Lang): string {
  const t = i18n.followups
  const bits = [
    b.num_lessons > 0 && (b.num_lessons > 1 ? t.fu_lesson_many[lang] : t.fu_lesson_one[lang]).replace('{n}', String(b.num_lessons)),
    b.num_wing_lessons > 0 && t.fu_wing[lang].replace('{n}', String(b.num_wing_lessons)),
    b.num_equipment_rentals > 0 && (b.num_equipment_rentals > 1 ? t.fu_rental_many[lang] : t.fu_rental_one[lang]).replace('{n}', String(b.num_equipment_rentals)),
    b.num_center_access > 0 && t.fu_center_access[lang].replace('{n}', String(b.num_center_access)),
  ].filter(Boolean)
  return bits.join(' · ') || t.fu_stay_only[lang]
}

function clientName(b: Booking, lang: Lang): string {
  const c = b.client
  return c ? `${c.first_name} ${c.last_name}`.trim() : i18n.followups.fu_booking_ref[lang].replace('{n}', String(b.booking_number).padStart(3, '0'))
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
export function computeFollowUps(input: FollowUpInput, now: Date = new Date(), lang: Lang = 'en'): FollowUp[] {
  const t = i18n.followups
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
      wants: wantsOfEnquiry(e, lang),
      when: e.arrival_month ? fmtArrivalMonth(e.arrival_month) : null,
      silenceDays: silence,
      reason: unqualified ? t.fu_reason_never_read[lang] : t.fu_reason_no_news[lang].replace('{days}', String(silence)),
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
      name: clientName(b, lang),
      wants: wantsOfBooking(b, lang),
      when: `${b.check_in} → ${b.check_out}`,
      silenceDays: silence,
      reason: stayIsOver
        ? t.fu_reason_stay_over[lang]
        : t.fu_reason_still_provisional[lang].replace('{days}', String(silence)),
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
