import type { Booking, BookingParticipant, Payment, Lesson, LessonType, Instructor, LessonRateOverride, DiningEvent, PriceItem, BillableType, PriceTier, Agency, AgencyBillingLine } from '../../types/database'
import { lessonBillable } from '../../types/database'
import type { SharedAccountingData } from './types'
import { getBaseNightlyRate } from '../../utils/roomPricing'

/** An accounting dataset with every collection empty.
 *  Spread a partial on top when a caller only needs a few slices — that keeps the
 *  compiler in play instead of casting to `any` and discovering a missing field
 *  as a runtime crash. */
export function emptyAccountingData(): SharedAccountingData {
  return {
    accommodations: [], bookingParticipants: [], houseRentals: [], bookings: [], clients: [],
    rooms: [], bookingRooms: [], bookingRoomPrices: [], roomRates: [],
    externalAccommodationBkgs: [], diningEvents: [],
    lessons: [], instructors: [], priceItems: [], priceTiers: [], equipment: [], equipmentRentals: [],
    taxiTrips: [], taxiManagerPayments: [], eurMznRate: 65, seasons: [],
    payments: [], instructorDebts: [], instructorPayments: [], lessonRateOverrides: [],
    expenses: [], palmeirasRents: [], palmeirasReversals: [], palmeirasEntries: [],
    activityBookings: [], activityPayments: [],
    agencies: [], agencyRateItems: [], agencyBillingLines: [],
  }
}

// ── Partner-agency billing ──────────────────────────────────────────────────
//
// A lesson, rental, taxi trip or room carrying an `agency_billing_line_id` is
// billed to the agency that sent the guest, NOT to the guest. The money is real
// either way, it just changes debtor — so every client-facing total below skips
// those rows, and `computeAgencyTotals` counts them instead. Getting only half
// of that right is the expensive mistake: skip them everywhere and the revenue
// vanishes, skip them nowhere and the same euro is billed twice.

/** True when this row is owed by an agency rather than by the client.
 *  Loose `!=` on purpose, like `resolveLessonRate`: rows fetched before the
 *  column existed come back with `undefined`, and `undefined !== null` would
 *  read as "agency billed" and silently drop the row from the client's bill. */
export function isAgencyBilled(row: { agency_billing_line_id?: string | null }): boolean {
  return row.agency_billing_line_id != null
}

/** Same question for a booked room, which carries the flag on its price
 *  snapshot (`booking_room_prices`) — the row `bookingRooms` has no field of
 *  its own. No snapshot at all → billed to the client, as always. */
export function isRoomAgencyBilled(bookingId: string, roomId: string, data: SharedAccountingData): boolean {
  const snapshot = data.bookingRoomPrices.find(p => p.booking_id === bookingId && p.room_id === roomId)
  return snapshot ? isAgencyBilled(snapshot) : false
}

/** Everything the marker needs, so callers outside accounting (the planning
 *  views) can pass the two slices they already have instead of a full dataset. */
export interface AgencyLookup {
  agencies: Agency[]
  bookings: Pick<Booking, 'id' | 'agency_id'>[]
  agencyBillingLines: Pick<AgencyBillingLine, 'id' | 'agency_id'>[]
}

/** The badge shown beside a client's name — `"(FF)"` — or null when there is
 *  nothing to show. One function for every screen, so a booking can never read
 *  as an agency booking in the planning and as a direct one in accounting.
 *
 *  Resolution order, and it matters:
 *  1. a service billed to an agency names its invoice line, which names the
 *     agency — that is the strongest statement ("this lesson is on their
 *     package"), and it holds even on a booking whose own tag was cleared;
 *  2. otherwise the booking's own `agency_id` ("this guest came through them").
 *
 *  Returns null when the agency has no `short_code`: an empty code means "no
 *  badge", never a badge invented from the name. That is the whole reason the
 *  code lives in the database — matching agencies by name in the source is the
 *  mistake this project already paid for three times (see data-model.md). */
export function agencyMarker(
  row: { booking_id?: string | null; agency_billing_line_id?: string | null },
  lookup: AgencyLookup
): string | null {
  const line = row.agency_billing_line_id
    ? lookup.agencyBillingLines.find(l => l.id === row.agency_billing_line_id)
    : undefined
  const agencyId = line?.agency_id
    ?? (row.booking_id ? lookup.bookings.find(b => b.id === row.booking_id)?.agency_id : null)
  if (!agencyId) return null
  const code = lookup.agencies.find(a => a.id === agencyId)?.short_code?.trim()
  return code ? `(${code})` : null
}

/** Hours already taught against one invoice line — the "14h of the 20h package
 *  done" counter. Group lessons count their wall-clock duration once: a package
 *  is a number of hours in the water, not a number of billed heads. */
export function agencyLineHoursUsed(lineId: string, lessons: Lesson[]): number {
  return lessons
    .filter(l => l.agency_billing_line_id === lineId)
    .reduce((sum, l) => sum + l.duration_hours, 0)
}

/** One invoice line, resolved against everything the screen needs to show it:
 *  which agency, which booking, whose package, and how much of it is used. Built
 *  here rather than in the component so the joins are tested once — every one of
 *  them can come back empty on real data (a line whose booking was deleted, a
 *  package not tied to a named traveller). */
export interface AgencyInvoiceRow {
  line: AgencyBillingLine
  agencyName: string
  commissionPercent: number
  bookingNumber: number | null
  guestName: string           // the package holder, else the booking's client
  label: string               // rate card label, else the note, else a fallback
  hoursUsed: number           // 0 when the line carries no package
  commission: number
  net: number
}

/** Invoice lines ready to display, newest booking first. Cancelled bookings are
 *  dropped, exactly like computeAgencyTotals — the two must never disagree about
 *  what counts, or the table would not add up to the KPIs above it. */
export function buildAgencyInvoiceRows(
  data: SharedAccountingData,
  filter?: { agencyId?: string }
): AgencyInvoiceRow[] {
  const cancelled = new Set(data.bookings.filter(b => b.status === 'cancelled').map(b => b.id))
  return data.agencyBillingLines
    .filter(l => !cancelled.has(l.booking_id) && (!filter?.agencyId || l.agency_id === filter.agencyId))
    .map(line => {
      const agency  = data.agencies.find(a => a.id === line.agency_id)
      const booking = data.bookings.find(b => b.id === line.booking_id)
      const part    = data.bookingParticipants.find(p => p.id === line.participant_id)
      const client  = data.clients.find(c => c.id === booking?.client_id)
      const item    = data.agencyRateItems.find(r => r.id === line.agency_rate_item_id)
      const pct     = agency?.commission_percent ?? 0
      const commission = line.price * pct / 100
      return {
        line,
        agencyName: agency?.name ?? '(unknown agency)',
        commissionPercent: pct,
        bookingNumber: booking?.booking_number ?? null,
        guestName: part
          ? `${part.first_name} ${part.last_name ?? ''}`.trim()
          : client ? `${client.first_name} ${client.last_name ?? ''}`.trim() : '—',
        label: item?.label ?? line.notes ?? 'Custom line',
        hoursUsed: agencyLineHoursUsed(line.id, data.lessons),
        commission,
        net: line.price - commission,
      }
    })
    .sort((a, b) => (b.bookingNumber ?? 0) - (a.bookingNumber ?? 0) || a.label.localeCompare(b.label))
}

export interface AgencyTotals {
  gross: number        // what we invoice the agency, at its own catalogue price
  commission: number   // what the agency retains (its % of gross)
  net: number          // what actually reaches the centre
  invoiced: number     // gross of the lines already marked invoiced_at
  paid: number         // net of the lines already marked paid_at
  outstanding: number  // net billed but not yet paid
}

/** Agency-billed money over a set of lines, commission applied per line — each
 *  agency has its own rate, so a single global percentage would be wrong as soon
 *  as a second agency exists. Cancelled bookings are dropped for the same reason
 *  they are dropped from client revenue: nothing was sold. */
export function computeAgencyTotals(
  data: SharedAccountingData,
  filter?: { agencyId?: string; bookingId?: string }
): AgencyTotals {
  const cancelled = new Set(data.bookings.filter(b => b.status === 'cancelled').map(b => b.id))
  const lines = data.agencyBillingLines.filter(l =>
    !cancelled.has(l.booking_id) &&
    (!filter?.agencyId  || l.agency_id  === filter.agencyId) &&
    (!filter?.bookingId || l.booking_id === filter.bookingId)
  )

  let gross = 0, commission = 0, invoiced = 0, paid = 0, outstanding = 0
  for (const l of lines) {
    const pct = data.agencies.find(a => a.id === l.agency_id)?.commission_percent ?? 0
    const cut = l.price * pct / 100
    gross += l.price
    commission += cut
    if (l.invoiced_at) invoiced += l.price
    if (l.paid_at) paid += l.price - cut
    else outstanding += l.price - cut
  }
  return { gross, commission, net: gross - commission, invoiced, paid, outstanding }
}

/** Nightly rate for a room within a booking (snapshot → base rate fallback).
 *  Without the fallback, any booking saved before booking_room_prices existed —
 *  or whose snapshot was deleted — would be counted at 0 €. */
export function getRoomNightlyRate(
  bookingId: string,
  roomId: string,
  data: SharedAccountingData
): number {
  const snapshot = data.bookingRoomPrices.find(
    p => p.booking_id === bookingId && p.room_id === roomId
  )
  if (snapshot) return snapshot.price_per_night
  const bookedRoomIds = data.bookingRooms
    .filter(br => br.booking_id === bookingId)
    .map(br => br.room_id)
  return getBaseNightlyRate(roomId, bookedRoomIds, data.rooms, data.accommodations, data.roomRates)
}

/** Number of nights between check_in and check_out */
export function countNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0
  return Math.max(
    0,
    Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
  )
}

/** Accommodation revenue for a booking (own rooms + external), as owed BY THE
 *  CLIENT — rooms billed to a partner agency are left out (see isAgencyBilled).
 *  No early return on a zero-night booking: own rooms fall out at 0 on their own,
 *  and an external stay carries its own dates — bailing out early credited no
 *  revenue for it while computeExternalAccommodationCost still charged the cost. */
export function computeAccommodationRevenue(booking: Booking, data: SharedAccountingData): number {
  const nights = countNights(booking.check_in, booking.check_out)

  const ownRooms = data.bookingRooms
    .filter(br => br.booking_id === booking.id)
    .filter(br => !isRoomAgencyBilled(booking.id, br.room_id, data))
    .reduce((sum, br) => sum + getRoomNightlyRate(booking.id, br.room_id, data) * nights, 0)

  // External stays are priced as a lump sum for the whole stay, not per night:
  // moving a departure date must not silently re-price what was agreed.
  const extAccomm = data.externalAccommodationBkgs
    .filter(e => e.booking_id === booking.id)
    .reduce((sum, e) => sum + e.total_sell_price, 0)

  return ownRooms + extAccomm
}

/** External accommodation cost for a booking (what we pay the provider).
 *  A lump sum per stay, like the sell price — never derived from the dates. */
export function computeExternalAccommodationCost(booking: Booking, data: SharedAccountingData): number {
  return data.externalAccommodationBkgs
    .filter(e => e.booking_id === booking.id)
    .reduce((sum, e) => sum + e.total_cost, 0)
}

/** Every `booking_participants.id` ever linked to this client, across every one
 *  of their bookings — the cross-booking join a lifetime hours count needs and
 *  that nothing else in the app does today (every existing participant lookup
 *  is scoped to a single booking). */
export function clientParticipantIds(clientId: string, bookingParticipants: BookingParticipant[]): Set<string> {
  return new Set(bookingParticipants.filter(p => p.client_id === clientId).map(p => p.id))
}

/** Sum of `duration_hours` for lessons of this type touching any of these
 *  participants, strictly before `excludeLessonId` in chronological order.
 *  "Before", not "up to and including": the lesson that crosses a tier stays at
 *  the old rate, only the next one gets the new one — no splitting a single
 *  lesson across two prices. Omit `excludeLessonId` for a plain running total
 *  (the client fiche's lifetime counter, or a brand new lesson that has no id
 *  yet). Model: `runningBalances` in cashFlowUtils.ts (sort ascending, walk). */
export function cumulativeHoursBefore(
  participantIds: Set<string>,
  lessonType: LessonType,
  allLessons: Lesson[],
  excludeLessonId?: string
): number {
  const chronological = allLessons
    .filter(l => l.type === lessonType && l.participant_ids.some(id => participantIds.has(id)))
    .sort((a, b) => (a.date + a.start_time + a.id).localeCompare(b.date + b.start_time + b.id))
  let sum = 0
  for (const l of chronological) {
    if (l.id === excludeLessonId) break
    sum += l.duration_hours
  }
  return sum
}

/** The €/h a volume tier sets once cumulative hours reach it — the highest
 *  `min_hours` at or below the total, or null when none is configured (not a
 *  tiered billable type, or still under the first threshold: the base
 *  `price_items` rate applies, which is the implicit "0h+" tier). */
export function getTierRate(billableType: BillableType, cumulativeHours: number, tiers: PriceTier[]): number | null {
  const applicable = tiers
    .filter(t => t.billable_type === billableType && t.min_hours <= cumulativeHours)
    .sort((a, b) => b.min_hours - a.min_hours)
  return applicable[0]?.price_per_hour ?? null
}

/** Everything a tiered rate lookup needs beyond the lesson and the price list. */
export interface TierContext {
  tiers: PriceTier[]
  allLessons: Lesson[]
  bookingParticipants: BookingParticipant[]
}

/** What a lesson's client price resolves to right now — snapshot, else tier,
 *  else the flat configured rate — or `null` when nothing is configured at all.
 *  That `null` matters: it is what a newly-created lesson should freeze onto
 *  `price_per_hour` in place of the flat lookup, so a rate configured *after*
 *  the lesson still applies (same "unresolved, not zero" contract the flat
 *  lookup already had before tiers existed). `getLessonClientRate` below is
 *  the display-friendly version that collapses this to a number. */
export function resolveLessonRate(lesson: Pick<Lesson, 'id' | 'type' | 'participant_ids' | 'price_per_hour'>, priceItems: PriceItem[], tierCtx?: TierContext): number | null {
  // Loose != on purpose: before the migration lands, rows come back without the
  // column at all, and `undefined !== null` would return undefined → NaN amounts.
  if (lesson.price_per_hour != null) return lesson.price_per_hour

  if (tierCtx && (lesson.type === 'private' || lesson.type === 'group')) {
    // A group lesson bills one rate for everyone (unchanged), based on the
    // FIRST participant's own history — not individualised per head. Decision
    // gui: simplest, doesn't restructure group billing for a mixed-level edge
    // case that doesn't happen in practice (groups tend to book together).
    const lead = tierCtx.bookingParticipants.find(p => p.id === lesson.participant_ids[0])
    // No client link on the lead participant → still count this booking's own
    // hours rather than giving up on tiering entirely; just can't see their
    // history from other stays.
    const ids = lead?.client_id
      ? clientParticipantIds(lead.client_id, tierCtx.bookingParticipants)
      : new Set(lesson.participant_ids[0] ? [lesson.participant_ids[0]] : [])
    if (ids.size > 0) {
      const cumulative = cumulativeHoursBefore(ids, lesson.type, tierCtx.allLessons, lesson.id)
      const tierRate = getTierRate(lessonBillable(lesson.type), cumulative, tierCtx.tiers)
      if (tierRate != null) return tierRate
    }
  }

  return getConfiguredRate(priceItems, lessonBillable(lesson.type))
}

/** Client price €/h for a lesson — same resolution as `resolveLessonRate`, but
 *  0 instead of null when nothing is configured, for screens that display a
 *  number rather than decide what to freeze onto a new row. This is what the
 *  CLIENT pays and has nothing to do with what the instructor earns (see
 *  getInstructorRate). */
export function getLessonClientRate(lesson: Lesson, priceItems: PriceItem[], tierCtx?: TierContext): number {
  return resolveLessonRate(lesson, priceItems, tierCtx) ?? 0
}

/** The configured rate for a billable post, or null when none is set.
 *  null and 0 mean different things: 0 is "this is free", null is "nobody said" —
 *  the screens show the second in red instead of quietly billing nothing. */
export function getConfiguredRate(priceItems: PriceItem[], type: BillableType): number | null {
  return priceItems.find(p => p.billable_type === type)?.price ?? null
}

/** Lessons revenue for a booking, as owed BY THE CLIENT — lessons billed to a
 *  partner agency are left out (see isAgencyBilled).
 *  Group lessons are priced per head, so multiply by participant count. */
export function computeLessonsRevenue(booking: Booking, data: SharedAccountingData): number {
  const tierCtx = { tiers: data.priceTiers, allLessons: data.lessons, bookingParticipants: data.bookingParticipants }
  return data.lessons
    .filter(l => l.booking_id === booking.id && !isAgencyBilled(l))
    .reduce((sum, l) => {
      const base = getLessonClientRate(l, data.priceItems, tierCtx) * l.duration_hours
      return sum + (l.type === 'group' ? base * l.participant_ids.length : base)
    }, 0)
}

/** Equipment rentals revenue for a booking, agency-billed ones excluded */
export function computeRentalsRevenue(booking: Booking, data: SharedAccountingData): number {
  return data.equipmentRentals
    .filter(r => r.booking_id === booking.id && !isAgencyBilled(r))
    .reduce((sum, r) => sum + r.price, 0)
}

/** Taxi revenue for a booking, agency-billed trips excluded.
 *  Only the client-facing PRICE moves to the agency — the driver and manager
 *  are still paid in MZN either way, so taxi costs are untouched by this. */
export function computeTaxiRevenue(booking: Booking, data: SharedAccountingData): number {
  return data.taxiTrips
    .filter(t => t.booking_id === booking.id && !isAgencyBilled(t))
    .reduce((sum, t) => sum + t.price_eur, 0)
}

/** Activity charges on a booking (what the client owes the center).
 *  we_pay_provider → client pays us price_client (we then pay provider)
 *  provider_pays_us → client pays provider directly, NOT billed on the booking
 */
export function computeActivityRevenueForBooking(booking: Booking, data: SharedAccountingData): number {
  return data.activityBookings
    .filter(a => a.booking_id === booking.id)
    .reduce((sum, a) => {
      if (a.payment_flow === 'we_pay_provider') return sum + a.price_client
      return sum // provider_pays_us: no charge on booking
    }, 0)
}

/** Centre net margin (EUR) on a taxi trip: client EUR minus driver+manager MZN cost converted at the global rate */
export function computeTaxiMarginEur(
  trip: { price_eur: number; price_driver_mzn: number; margin_manager_mzn: number },
  eurMznRate: number
): number {
  return Math.round(trip.price_eur - (trip.price_driver_mzn + trip.margin_manager_mzn) / (eurMznRate || 1))
}

/** Center access revenue for a booking: persons × nights × per-day rate */
export function computeCenterAccessRevenue(booking: Booking): number {
  return booking.num_center_access * countNights(booking.check_in, booking.check_out) * (booking.center_access_rate ?? 0)
}

/** Taxi revenue for trips not linked to any booking, agency-billed ones excluded */
export function computeStandaloneTaxiRevenue(data: SharedAccountingData): number {
  return data.taxiTrips
    .filter(t => t.booking_id === null && !isAgencyBilled(t))
    .reduce((sum, t) => sum + t.price_eur, 0)
}

/** Full computed total for a booking (before discounts) */
export function computeBookingTotal(booking: Booking, data: SharedAccountingData): number {
  return (
    computeAccommodationRevenue(booking, data) +
    computeLessonsRevenue(booking, data) +
    computeRentalsRevenue(booking, data) +
    computeTaxiRevenue(booking, data) +
    computeDiningForBooking(booking, data.diningEvents, data.bookingParticipants) +
    computeActivityRevenueForBooking(booking, data) +
    computeCenterAccessRevenue(booking)
  )
}

/** Total discounts applied to a booking */
export function computeBookingDiscounts(bookingId: string, payments: Payment[]): number {
  return payments
    .filter(p => p.booking_id === bookingId && p.is_discount)
    .reduce((sum, p) => sum + p.amount, 0)
}

/** Total actual money received for a booking (excludes discounts).
 *  Counts payments that are still flagged "to verify": they come from the amount
 *  the owner typed on the booking, so excluding them would overstate what the
 *  client still owes. Use computeBookingUnverifiedPaid to surface that share. */
export function computeBookingPaid(bookingId: string, payments: Payment[]): number {
  return payments
    .filter(p => p.booking_id === bookingId && !p.is_discount)
    .reduce((sum, p) => sum + p.amount, 0)
}

/** Share of the money received that has not been reconciled yet. */
export function computeBookingUnverifiedPaid(bookingId: string, payments: Payment[]): number {
  return payments
    .filter(p => p.booking_id === bookingId && !p.is_discount && !p.is_verified)
    .reduce((sum, p) => sum + p.amount, 0)
}

/** Payout rate €/h for a lesson — what the INSTRUCTOR earns, from their own
 *  Options → Instructors rates (may legitimately be 0 for the owners), or the
 *  per-lesson override when one was recorded. Never the client price. */
export function getInstructorRate(
  lesson: Lesson,
  instructor: Instructor,
  overrides: LessonRateOverride[]
): number {
  // An override is a decision taken on THIS lesson, so it outranks everything.
  const override = overrides.find(o => o.lesson_id === lesson.id)
  if (override) return override.rate
  // Then the rate frozen when the lesson was given. Without it, raising someone's
  // rate in October would raise what we owe them for July — payroll rewritten
  // backwards. Loose != so a pre-migration row (no column) falls through cleanly.
  if (lesson.instructor_rate != null) return lesson.instructor_rate
  return lesson.type === 'private' ? instructor.rate_private
    : lesson.type === 'group'     ? instructor.rate_group
    : instructor.rate_supervision
}

/** Pay rate to freeze on a lesson being created, from the instructor's current scale. */
export function currentInstructorRate(lesson: Pick<Lesson, 'type'>, instructor: Instructor): number {
  return lesson.type === 'private' ? instructor.rate_private
    : lesson.type === 'group'     ? instructor.rate_group
    : instructor.rate_supervision
}

/** Re-freeze the payout when a lesson changes hands — or changes type, which has
 *  its own scale. The snapshot belongs to whoever actually teaches the lesson.
 *
 *  Why this exists: the planning is built the day before, so lessons get
 *  reassigned (edited, or dragged into another instructor's column) long after
 *  they were created. Carrying the original instructor's rate over would pay the
 *  new one on someone else's scale — silently, and in both directions: an owner
 *  at 0 €/h inheriting 18 €/h invents a cost, and a paid instructor inheriting
 *  0 €/h erases a real debt towards them.
 *
 *  Anything else leaves the lesson untouched, snapshot included — that is the
 *  whole point of freezing it (raising someone's rate in October must not
 *  rewrite what July owed them). */
export function reFreezeInstructorRate(
  updated: Lesson,
  previous: Pick<Lesson, 'instructor_id' | 'type'>,
  instructors: Instructor[]
): Lesson {
  if (updated.instructor_id === previous.instructor_id && updated.type === previous.type) return updated
  const instr = instructors.find(i => i.id === updated.instructor_id)
  // Unknown instructor → null, "nobody said", not 0 "this is free": the same
  // distinction getConfiguredRate makes, so the figure shows up as unresolved
  // instead of quietly costing nothing.
  return { ...updated, instructor_rate: instr ? currentInstructorRate(updated, instr) : null }
}

/** Total earned by an instructor (lessons × payout rates, after overrides).
 *  Flat per hour: a group lesson pays the same whatever the number of students
 *  (the centre keeps the difference — the client is billed per head).
 *  Includes ALL lessons regardless of booking_id — day activities and
 *  scheduled trips (no booking) are center revenue, not booking-specific. */
export function computeInstructorEarned(
  instructorId: string,
  data: SharedAccountingData
): number {
  const instr = data.instructors.find(i => i.id === instructorId)
  if (!instr) return 0
  return data.lessons
    .filter(l => l.instructor_id === instructorId)
    .reduce((sum, l) => sum + getInstructorRate(l, instr, data.lessonRateOverrides) * l.duration_hours, 0)
}

/** Total debts owed by an instructor to the centre */
export function computeInstructorDebts(instructorId: string, data: SharedAccountingData): number {
  return data.instructorDebts
    .filter(d => d.instructor_id === instructorId)
    .reduce((sum, d) => sum + d.amount, 0)
}

/** Total payments already made to an instructor */
export function computeInstructorPaid(instructorId: string, data: SharedAccountingData): number {
  return data.instructorPayments
    .filter(p => p.instructor_id === instructorId)
    .reduce((sum, p) => sum + p.amount, 0)
}

/** Balance owed to an instructor: earned − debts − dining charges − already paid */
export function computeInstructorBalance(instructorId: string, data: SharedAccountingData): number {
  return (
    computeInstructorEarned(instructorId, data) -
    computeInstructorDebts(instructorId, data) -
    computeInstructorDiningCharges(instructorId, data.diningEvents) -
    computeInstructorPaid(instructorId, data)
  )
}

/** Revenue from dining events (price_per_person × attendees, with individual overrides).
 *  A free event bills nothing by default, but an attendee carrying an explicit
 *  price_override is still charged — that is the whole point of the override. */
export function computeDiningRevenue(events: DiningEvent[]): number {
  return events.reduce((total, ev) => {
    const attendees = ev.attendees ?? []
    return total + attendees
      .filter(a => a.is_attending)
      .reduce((s, a) => s + (a.price_override ?? ev.price_per_person), 0)
  }, 0)
}

/** Dining charges attributable to a booking (matches client/participant attendees).
 *  NOTE: attendee.person_id is matched against BookingParticipant.id with no FK constraint.
 *  If a participant is deleted, their dining charges become orphaned. */
export function computeDiningForBooking(booking: Booking, diningEvents: DiningEvent[], bookingParticipants: BookingParticipant[]): number {
  const bParts = bookingParticipants.filter(p => p.booking_id === booking.id)
  const hasParticipants = bParts.length > 0
  const matchIds = new Set(
    hasParticipants
      ? bParts.map(p => p.id)
      : [booking.client_id]
  )
  return diningEvents.reduce((total, ev) => {
    return total + (ev.attendees ?? [])
      .filter(a => a.is_attending && a.person_type === 'participant' && matchIds.has(a.person_id))
      .reduce((s, a) => s + (a.price_override ?? ev.price_per_person), 0)
  }, 0)
}

/** Dining charges attributable to an instructor (deducted from their payroll) */
export function computeInstructorDiningCharges(instructorId: string, diningEvents: DiningEvent[]): number {
  return diningEvents.reduce((total, ev) => {
    return total + (ev.attendees ?? [])
      .filter(a => a.is_attending && a.person_type === 'instructor' && a.person_id === instructorId)
      .reduce((s, a) => s + (a.price_override ?? ev.price_per_person), 0)
  }, 0)
}

/** Season-wide totals shown on the accounting dashboard. */
export interface SeasonTotals {
  accomRev: number
  lessonsRev: number
  rentalsRev: number
  taxiRevGross: number
  taxiCosts: number
  taxiMargin: number
  activitiesRev: number
  eventsRev: number
  centerAccessRev: number
  agencyGross: number        // billed to partner agencies, before their commission
  agencyCommission: number   // what they retain
  agencyRev: number          // what reaches us — the part counted in totalRevenue
  agencyOutstanding: number  // net billed to agencies and not yet paid
  totalRevenue: number
  billedNet: number          // owed BY CLIENTS (agency-billed rows excluded)
  totalPaid: number
  unverifiedPaid: number
  totalDue: number           // still owed by clients; agencies are agencyOutstanding
  instructorCosts: number
  activityCosts: number
  houseRentalCosts: number
  bungalowCosts: number
  externalStayCosts: number   // what we pay places we don't own (external_billing)
  totalExpenses: number
  palmeirasNet: number
  netResult: number
}

/** Every headline figure of the accounting dashboard, in one pure function.
 *
 *  Conventions that are easy to get wrong, so they live here rather than in a
 *  component:
 *  - Cancelled bookings are excluded from revenue, and so are the taxi trips and
 *    activities attached to them. Standalone ones (no booking) are kept.
 *  - The taxi figure is the centre MARGIN, not the gross: billed minus driver pay
 *    minus manager commission. Taxi costs are therefore never subtracted again in
 *    the net result. Margins are rounded per trip so the total equals the sum of
 *    the lines shown elsewhere.
 *  - Instructor cost covers ALL lessons, including any attached to a cancelled
 *    booking: the instructor taught, so the centre owes them. That asymmetry is
 *    deliberate — such a booking is a real loss, and the result should show it.
 *  - Dining revenue covers every event, including instructor meals, which are
 *    deducted from their payroll separately.
 */
export function computeSeasonTotals(data: SharedAccountingData): SeasonTotals {
  const activeBookings = data.bookings.filter(b => b.status !== 'cancelled')
  const activeIds = new Set(activeBookings.map(b => b.id))

  const accomRev        = activeBookings.reduce((s, b) => s + computeAccommodationRevenue(b, data), 0)
  const lessonsRev      = activeBookings.reduce((s, b) => s + computeLessonsRevenue(b, data), 0)
  const rentalsRev      = activeBookings.reduce((s, b) => s + computeRentalsRevenue(b, data), 0)
  const centerAccessRev = activeBookings.reduce((s, b) => s + computeCenterAccessRevenue(b), 0)

  const activeTrips  = data.taxiTrips.filter(t => t.booking_id === null || activeIds.has(t.booking_id))
  // Gross counts client-billed trips only — an agency transfer is invoiced on its
  // own line, at the agency's catalogue price, so counting price_eur here too
  // would bill the same ride twice. The COST stays on every active trip: the
  // driver is paid either way, and dropping it would make the ride look free.
  // On a dataset with no agency line this is identical to the previous formula.
  const taxiRevGross = activeTrips.filter(t => !isAgencyBilled(t)).reduce((s, t) => s + t.price_eur, 0)
  const taxiCosts    = activeTrips.reduce((s, t) => s + (t.price_eur - computeTaxiMarginEur(t, data.eurMznRate)), 0)
  const taxiMargin   = taxiRevGross - taxiCosts

  // we_pay_provider → the client pays us; provider_pays_us → the provider reverses their cut
  const activeActs    = data.activityBookings.filter(a => a.booking_id === null || activeIds.has(a.booking_id))
  const activitiesRev = activeActs.reduce((s, a) => s + (a.payment_flow === 'we_pay_provider' ? a.price_client : a.price_provider), 0)
  const activityCosts = activeActs.reduce((s, a) => s + (a.payment_flow === 'we_pay_provider' ? a.price_provider : 0), 0)

  const eventsRev    = computeDiningRevenue(data.diningEvents)

  // Partner agencies. The revenue every other line above just gave up (lessons,
  // rentals, transfers and rooms carrying an agency_billing_line_id) comes back
  // here at the agency's own catalogue price, NET of the commission it retains —
  // the same convention as taxi, where the centre only books what it keeps.
  const agency = computeAgencyTotals(data)

  const totalRevenue = accomRev + lessonsRev + rentalsRev + taxiMargin + eventsRev + activitiesRev + centerAccessRev + agency.net

  const billedNet = activeBookings.reduce(
    (s, b) => s + computeBookingTotal(b, data) - computeBookingDiscounts(b.id, data.payments), 0)
  const totalPaid = activeBookings.reduce((s, b) => s + computeBookingPaid(b.id, data.payments), 0)
  const unverifiedPaid = activeBookings.reduce((s, b) => s + computeBookingUnverifiedPaid(b.id, data.payments), 0)
  const totalDue  = billedNet - totalPaid

  const instructorCosts  = data.instructors.reduce((s, i) => s + computeInstructorEarned(i.id, data), 0)
  const houseRentalCosts = data.houseRentals.reduce((s, r) => s + r.total_cost, 0)
  const totalExpenses    = data.expenses.reduce((s, e) => s + e.amount, 0)

  // Bungalows are sub-let: their sell price is already inside accomRev, only the
  // nightly cost paid to the owner is subtracted here.
  const bungalows = data.accommodations.filter(a => a.type === 'bungalow')
  const bungalowRoomIds = new Set(
    data.rooms.filter(r => bungalows.some(b => b.id === r.accommodation_id)).map(r => r.id)
  )
  const bungalowCosts = data.bookingRooms.reduce((sum, br) => {
    if (!bungalowRoomIds.has(br.room_id)) return sum
    const bk = data.bookings.find(b => b.id === br.booking_id)
    if (!bk || bk.status === 'cancelled') return sum
    const room = data.rooms.find(r => r.id === br.room_id)
    const acc  = bungalows.find(b => b.id === room?.accommodation_id)
    return sum + (acc?.cost_per_night ?? 0) * countNights(bk.check_in, bk.check_out)
  }, 0)

  // Same shape as bungalows, and for the same reason: what the guest pays for an
  // external stay is already inside accomRev, so only what we pay the place is
  // subtracted here. Without this the whole purchase price would be counted as
  // margin — the leak the 2026-08-11 migration closed on the *reading* side.
  const externalStayCosts = data.externalAccommodationBkgs.reduce((sum, e) => {
    const bk = data.bookings.find(b => b.id === e.booking_id)
    if (!bk || bk.status === 'cancelled') return sum
    return sum + e.total_cost
  }, 0)

  const palmeirasNet =
    data.palmeirasReversals.reduce((s, r) => s + r.net_amount, 0)
    + data.palmeirasEntries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0)
    - data.palmeirasRents.reduce((s, r) => s + r.amount, 0)
    - data.palmeirasEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0)

  const netResult = totalRevenue + palmeirasNet
    - instructorCosts - houseRentalCosts - bungalowCosts - externalStayCosts
    - activityCosts - totalExpenses

  return {
    accomRev, lessonsRev, rentalsRev, taxiRevGross, taxiCosts, taxiMargin,
    activitiesRev, eventsRev, centerAccessRev,
    agencyGross: agency.gross, agencyCommission: agency.commission,
    agencyRev: agency.net, agencyOutstanding: agency.outstanding,
    totalRevenue,
    billedNet, totalPaid, unverifiedPaid, totalDue,
    instructorCosts, activityCosts, houseRentalCosts, bungalowCosts, externalStayCosts,
    totalExpenses, palmeirasNet, netResult,
  }
}

/** Format euros */
export function fmtEur(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} €`
}

/** Format YYYY-MM to "Feb 2026" */
export function fmtMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split('-')
  const date = new Date(parseInt(y), parseInt(m) - 1, 1)
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

/** Suggest deposit amount: 30% of total, min 120€ */
export function suggestDeposit(total: number): number {
  return Math.max(120, Math.round(total * 0.3))
}
