// What the day-by-day grid hands to the shared forms when Teresa adds something
// straight from a cell (2026-11-22). The forms (EditLessonModal / EditRentalModal
// / ExtraLineForm) do the pricing exactly as on the Planning; these helpers only
// pre-fill them, and spread one saved line over the days of a picked range.

import type { Booking, BookingCharge, EquipmentRental, Instructor, Lesson, PriceItem } from '../../types/database'
import { rentalBillable } from '../../types/database'
import { addDaysISO } from '../../utils/dates'
import { GROUP_ROW } from './dayGrid'

/** Every day from `a` to `b`, both included, whichever comes first. */
export function daysBetweenInclusive(a: string, b: string): string[] {
  const [from, to] = a <= b ? [a, b] : [b, a]
  const out: string[] = []
  for (let d = from; d <= to; d = addDaysISO(d, 1)) out.push(d)
  return out
}

const participantOf = (rowId: string) => (rowId === GROUP_ROW ? null : rowId)

/** A board for the whole day — Teresa's most common case — at today's grid price.
 *  list_price stays null: the form freezes it on save from what was finally picked. */
export function newRentalDraft(b: Booking, rowId: string, date: string, priceItems: PriceItem[]): EquipmentRental {
  return {
    id: crypto.randomUUID(),
    booking_id: b.id,
    participant_id: participantOf(rowId),
    date,
    slot: 'full_day',
    rental_type: 'board',
    equipment_id: null,
    board_equipment_id: null,
    price: priceItems.find(p => p.billable_type === rentalBillable('board', 'full_day'))?.price ?? 0,
    list_price: null,
    notes: null,
    client_note: null,
  }
}

/** A 2h private lesson at 9:00 with the instructor this booking had last (else the first one). */
export function newLessonDraft(b: Booking, rowId: string, date: string, instructors: Instructor[], lessons: Lesson[]): Lesson {
  const last = lessons
    .filter(l => l.booking_id === b.id)
    .sort((x, y) => (x.date + x.start_time).localeCompare(y.date + y.start_time))
    .pop()
  const instructorId = (last && instructors.some(i => i.id === last.instructor_id) ? last.instructor_id : instructors[0]?.id) ?? ''
  const pid = participantOf(rowId)
  return {
    id: crypto.randomUUID(),
    booking_id: b.id,
    instructor_id: instructorId,
    participant_ids: pid ? [pid] : [],
    date,
    start_time: '09:00',
    duration_hours: 2,
    type: 'private',
    notes: null,
    kite_id: null,
    board_id: null,
    price_per_hour: null,
    instructor_rate: null,
  }
}

/** The rental saved by the form, once per day of the range (fresh ids). */
export function rentalsForDates(saved: EquipmentRental, dates: string[]): EquipmentRental[] {
  return dates.map((date, i) => ({ ...saved, id: i === 0 ? saved.id : crypto.randomUUID(), date }))
}

/** Same for an extra. */
export function chargesForDates(saved: BookingCharge, dates: string[]): BookingCharge[] {
  return dates.map((date, i) => ({ ...saved, id: i === 0 ? saved.id : crypto.randomUUID(), date }))
}
