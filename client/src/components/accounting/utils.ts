import type { Booking, BookingParticipant, Payment, Lesson, Instructor, LessonRateOverride, DiningEvent, PriceItem, BillableType } from '../../types/database'
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
    lessons: [], instructors: [], priceItems: [], equipment: [], equipmentRentals: [],
    taxiTrips: [], taxiManagerPayments: [], eurMznRate: 65, seasons: [],
    payments: [], instructorDebts: [], instructorPayments: [], lessonRateOverrides: [],
    expenses: [], palmeirasRents: [], palmeirasReversals: [], palmeirasEntries: [],
    activityBookings: [], activityPayments: [],
  }
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

/** Accommodation revenue for a booking (own rooms + external).
 *  No early return on a zero-night booking: own rooms fall out at 0 on their own,
 *  and an external stay carries its own dates — bailing out early credited no
 *  revenue for it while computeExternalAccommodationCost still charged the cost. */
export function computeAccommodationRevenue(booking: Booking, data: SharedAccountingData): number {
  const nights = countNights(booking.check_in, booking.check_out)

  const ownRooms = data.bookingRooms
    .filter(br => br.booking_id === booking.id)
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

/** Client price €/h for a lesson: the snapshot taken at creation, else the rate
 *  currently configured in Options → Pricing. This is what the CLIENT pays and
 *  has nothing to do with what the instructor earns (see getInstructorRate). */
export function getLessonClientRate(lesson: Lesson, priceItems: PriceItem[]): number {
  // Loose != on purpose: before the migration lands, rows come back without the
  // column at all, and `undefined !== null` would return undefined → NaN amounts.
  if (lesson.price_per_hour != null) return lesson.price_per_hour
  return getConfiguredRate(priceItems, lessonBillable(lesson.type)) ?? 0
}

/** The configured rate for a billable post, or null when none is set.
 *  null and 0 mean different things: 0 is "this is free", null is "nobody said" —
 *  the screens show the second in red instead of quietly billing nothing. */
export function getConfiguredRate(priceItems: PriceItem[], type: BillableType): number | null {
  return priceItems.find(p => p.billable_type === type)?.price ?? null
}

/** Lessons revenue for a booking.
 *  Group lessons are priced per head, so multiply by participant count. */
export function computeLessonsRevenue(booking: Booking, data: SharedAccountingData): number {
  return data.lessons
    .filter(l => l.booking_id === booking.id)
    .reduce((sum, l) => {
      const base = getLessonClientRate(l, data.priceItems) * l.duration_hours
      return sum + (l.type === 'group' ? base * l.participant_ids.length : base)
    }, 0)
}

/** Equipment rentals revenue for a booking */
export function computeRentalsRevenue(booking: Booking, data: SharedAccountingData): number {
  return data.equipmentRentals
    .filter(r => r.booking_id === booking.id)
    .reduce((sum, r) => sum + r.price, 0)
}

/** Taxi revenue for a booking */
export function computeTaxiRevenue(booking: Booking, data: SharedAccountingData): number {
  return data.taxiTrips
    .filter(t => t.booking_id === booking.id)
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

/** Taxi revenue for trips not linked to any booking */
export function computeStandaloneTaxiRevenue(data: SharedAccountingData): number {
  return data.taxiTrips
    .filter(t => t.booking_id === null)
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
  totalRevenue: number
  billedNet: number
  totalPaid: number
  unverifiedPaid: number
  totalDue: number
  instructorCosts: number
  activityCosts: number
  houseRentalCosts: number
  bungalowCosts: number
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
  const taxiRevGross = activeTrips.reduce((s, t) => s + t.price_eur, 0)
  const taxiMargin   = activeTrips.reduce((s, t) => s + computeTaxiMarginEur(t, data.eurMznRate), 0)
  const taxiCosts    = taxiRevGross - taxiMargin

  // we_pay_provider → the client pays us; provider_pays_us → the provider reverses their cut
  const activeActs    = data.activityBookings.filter(a => a.booking_id === null || activeIds.has(a.booking_id))
  const activitiesRev = activeActs.reduce((s, a) => s + (a.payment_flow === 'we_pay_provider' ? a.price_client : a.price_provider), 0)
  const activityCosts = activeActs.reduce((s, a) => s + (a.payment_flow === 'we_pay_provider' ? a.price_provider : 0), 0)

  const eventsRev    = computeDiningRevenue(data.diningEvents)
  const totalRevenue = accomRev + lessonsRev + rentalsRev + taxiMargin + eventsRev + activitiesRev + centerAccessRev

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

  const palmeirasNet =
    data.palmeirasReversals.reduce((s, r) => s + r.net_amount, 0)
    + data.palmeirasEntries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0)
    - data.palmeirasRents.reduce((s, r) => s + r.amount, 0)
    - data.palmeirasEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0)

  const netResult = totalRevenue + palmeirasNet
    - instructorCosts - houseRentalCosts - bungalowCosts - activityCosts - totalExpenses

  return {
    accomRev, lessonsRev, rentalsRev, taxiRevGross, taxiCosts, taxiMargin,
    activitiesRev, eventsRev, centerAccessRev, totalRevenue,
    billedNet, totalPaid, unverifiedPaid, totalDue,
    instructorCosts, activityCosts, houseRentalCosts, bungalowCosts, totalExpenses,
    palmeirasNet, netResult,
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
