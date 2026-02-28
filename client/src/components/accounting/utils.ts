import type { Booking, Payment, Lesson, Instructor, LessonRateOverride } from '../../types/database'
import type { SharedAccountingData } from './types'

/** Nightly rate for a room within a booking (snapshot → base rate fallback) */
export function getRoomNightlyRate(
  bookingId: string,
  roomId: string,
  data: SharedAccountingData
): number {
  const snapshot = data.bookingRoomPrices.find(
    p => p.booking_id === bookingId && p.room_id === roomId
  )
  return snapshot?.price_per_night ?? 0
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

/** Lessons revenue for a booking */
export function computeLessonsRevenue(booking: Booking, data: SharedAccountingData): number {
  return data.lessons
    .filter(l => l.booking_id === booking.id)
    .reduce((sum, l) => {
      const instr = data.instructors.find(i => i.id === l.instructor_id)
      if (!instr) return sum
      const rate = l.type === 'private' ? instr.rate_private
        : l.type === 'group'   ? instr.rate_group
        : instr.rate_supervision
      return sum + rate * l.duration_hours
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
    .reduce((sum, t) => sum + t.price_paid_by_client, 0)
}

/** Full computed total for a booking */
export function computeBookingTotal(booking: Booking, data: SharedAccountingData): number {
  return (
    computeAccommodationRevenue(booking, data) +
    computeLessonsRevenue(booking, data) +
    computeRentalsRevenue(booking, data) +
    computeTaxiRevenue(booking, data)
  )
}

/** Total amount paid for a booking */
export function computeBookingPaid(bookingId: string, payments: Payment[]): number {
  return payments
    .filter(p => p.booking_id === bookingId)
    .reduce((sum, p) => sum + p.amount, 0)
}

/** Effective rate for a lesson (override or base) */
export function getLessonRate(
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

/** Total earned by an instructor (lessons × rates, after overrides) */
export function computeInstructorEarned(
  instructorId: string,
  data: SharedAccountingData
): number {
  return data.lessons
    .filter(l => l.instructor_id === instructorId)
    .reduce((sum, l) => {
      const instr = data.instructors.find(i => i.id === instructorId)
      if (!instr) return sum
      return sum + getLessonRate(l, instr, data.lessonRateOverrides) * l.duration_hours
    }, 0)
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

/** Balance owed to an instructor: earned − debts − already paid */
export function computeInstructorBalance(instructorId: string, data: SharedAccountingData): number {
  return (
    computeInstructorEarned(instructorId, data) -
    computeInstructorDebts(instructorId, data) -
    computeInstructorPaid(instructorId, data)
  )
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
