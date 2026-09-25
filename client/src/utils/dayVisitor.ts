/** Walk-ins — people who come for a lesson or a rental and nothing else.
 *
 *  Design: `.claude/docs/WALK_INS.md`. A visit is an ordinary booking with
 *  `kind = 'day_visitor'`, no room, created behind the scenes from the Daily
 *  tab. It keeps everything a booking brings for free (participants, payments,
 *  accounting, instructor pay, client dossier) and is kept OUT of everything
 *  that is about a stay: the accommodation grid, Now (meals), stay alerts,
 *  stay documents.
 *
 *  ⚠️ `check_out = check_in + 1`: the `check_dates` constraint demands
 *  check_out > check_in. A visit is nonetheless active on ITS DAY ONLY — never
 *  read a day visitor's check_out as "still here". `isOnSiteOn` is the one
 *  place that knows this.
 *
 *  Every helper treats a missing `kind` as a stay: on a base without the
 *  2026-09-25 migration nothing changes.
 */
import type { Booking, BookingParticipant, Client } from '../types/database'
import { addDaysISO, type ISODate } from './dates'

export function isDayVisitor(b: Pick<Booking, 'kind'>): boolean {
  return b.kind === 'day_visitor'
}

/** The bookings that are actual stays — what every accommodation screen,
 *  stay alert and stay document should look at. */
export function stayBookings<T extends Pick<Booking, 'kind'>>(bookings: T[]): T[] {
  return bookings.filter(b => !isDayVisitor(b))
}

/** Is this booking's party around on `date`? A stay covers check_in through
 *  check_out included (a guest can still take a lesson on departure morning);
 *  a walk-in visit covers its own day only. Cancelled = nobody. */
export function isOnSiteOn(b: Pick<Booking, 'kind' | 'status' | 'check_in' | 'check_out'>, date: ISODate): boolean {
  if (b.status === 'cancelled') return false
  if (isDayVisitor(b)) return b.check_in === date
  return b.check_in <= date && b.check_out >= date
}

/** The row to insert for a new visit. Confirmed: the person is standing in
 *  front of us. `kind` is left to the caller — it is written by a separate
 *  UPDATE so a base without the column still gets its booking. */
export function newVisitBookingRow(clientId: string, date: ISODate) {
  return {
    client_id: clientId,
    check_in: date,
    check_out: addDaysISO(date, 1),
    status: 'confirmed' as const,
    center_access_rate: 0,
  }
}

/** The participant row that stands for the client on their visit. */
export function newVisitParticipantRow(bookingId: string, client: Pick<Client, 'id' | 'first_name' | 'last_name' | 'kite_level'>) {
  return {
    booking_id: bookingId,
    client_id: client.id,
    first_name: client.first_name,
    last_name: client.last_name || null,
    kite_level: client.kite_level ?? null,
    does_kite: true,
  }
}

/** A visit this client already has on that day — a lesson in the morning and
 *  a rental in the afternoon are ONE visit, one balance, not two bookings.
 *  Returns the booking and the participant standing for the client, or null. */
export function findVisitOn(
  bookings: Booking[],
  participants: BookingParticipant[],
  clientId: string,
  date: ISODate,
): { booking: Booking; participant: BookingParticipant } | null {
  for (const b of bookings) {
    if (!isDayVisitor(b) || b.client_id !== clientId || !isOnSiteOn(b, date)) continue
    const p = participants.find(x => x.booking_id === b.id && x.client_id === clientId)
      ?? participants.find(x => x.booking_id === b.id)
    if (p) return { booking: b, participant: p }
  }
  return null
}

/** €/h to offer for a walk-in lesson: the client's own rate when gui set one,
 *  else the official one (which may itself be unset → null, never a fake 0). */
export function suggestedLessonRate(client: Pick<Client, 'custom_lesson_rate'> | undefined, official: number | null): number | null {
  const custom = client?.custom_lesson_rate
  return custom !== null && custom !== undefined ? Number(custom) : official
}

/** Every visit of a client, most recent first — for the client file. */
export function visitsOf(bookings: Booking[], clientId: string): Booking[] {
  return bookings
    .filter(b => isDayVisitor(b) && b.client_id === clientId && b.status !== 'cancelled')
    .sort((a, b) => b.check_in.localeCompare(a.check_in))
}

/** Clients matching a quick search, best first: name starts with the query,
 *  then contains it; phone digits match too (locals are found by WhatsApp). */
export function searchClients<T extends Pick<Client, 'first_name' | 'last_name' | 'phone' | 'email'>>(clients: T[], query: string, limit = 8): T[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const digits = q.replace(/\D/g, '')
  const scored: { c: T; score: number }[] = []
  for (const c of clients) {
    const full = `${c.first_name} ${c.last_name ?? ''}`.toLowerCase().trim()
    const rev = `${c.last_name ?? ''} ${c.first_name}`.toLowerCase().trim()
    let score = 0
    if (full.startsWith(q) || rev.startsWith(q)) score = 3
    else if (full.split(/\s+/).some(w => w.startsWith(q))) score = 2
    else if (full.includes(q) || (c.email ?? '').toLowerCase().includes(q)) score = 1
    else if (digits.length >= 3 && (c.phone ?? '').replace(/\D/g, '').includes(digits)) score = 1
    if (score > 0) scored.push({ c, score })
  }
  return scored
    .sort((a, b) => b.score - a.score || `${a.c.first_name} ${a.c.last_name}`.localeCompare(`${b.c.first_name} ${b.c.last_name}`))
    .slice(0, limit)
    .map(s => s.c)
}
