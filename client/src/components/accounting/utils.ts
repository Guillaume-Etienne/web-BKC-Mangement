import type { Booking, BookingParticipant, Payment, Lesson, Instructor, LessonRateOverride, DiningEvent, PriceItem } from '../../types/database'
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
    externalAccommodationBkgs: [], externalAccommodations: [], diningEvents: [],
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

/** Accommodation revenue for a booking (own rooms + external) */
export function computeAccommodationRevenue(booking: Booking, data: SharedAccountingData): number {
  const nights = countNights(booking.check_in, booking.check_out)
  if (nights === 0) return 0

  const ownRooms = data.bookingRooms
    .filter(br => br.booking_id === booking.id)
    .reduce((sum, br) => sum + getRoomNightlyRate(booking.id, br.room_id, data) * nights, 0)

  const extAccomm = data.externalAccommodationBkgs
    .filter(e => e.booking_id === booking.id)
    .reduce((sum, e) => {
      const n = countNights(e.check_in, e.check_out)
      return sum + e.sell_price_per_night * n
    }, 0)

  return ownRooms + extAccomm
}

/** External accommodation cost for a booking (what we pay the provider).
 *  Uses the booking's own cost snapshot — same rule as the sell price — so that
 *  changing the master rate never rewrites the cost of past stays. */
export function computeExternalAccommodationCost(booking: Booking, data: SharedAccountingData): number {
  return data.externalAccommodationBkgs
    .filter(e => e.booking_id === booking.id)
    .reduce((sum, e) => sum + e.cost_per_night * countNights(e.check_in, e.check_out), 0)
}

/** Client price €/h for a lesson: the snapshot taken at creation, else the rate
 *  currently configured in Options → Pricing. This is what the CLIENT pays and
 *  has nothing to do with what the instructor earns (see getInstructorRate). */
export function getLessonClientRate(lesson: Lesson, priceItems: PriceItem[]): number {
  // Loose != on purpose: before the migration lands, rows come back without the
  // column at all, and `undefined !== null` would return undefined → NaN amounts.
  if (lesson.price_per_hour != null) return lesson.price_per_hour
  return priceItems.find(p => p.lesson_type === lesson.type)?.price ?? 0
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

/** Total actual money received for a booking (excludes discounts) */
export function computeBookingPaid(bookingId: string, payments: Payment[]): number {
  return payments
    .filter(p => p.booking_id === bookingId && !p.is_discount)
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
  const override = overrides.find(o => o.lesson_id === lesson.id)
  if (override) return override.rate
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
