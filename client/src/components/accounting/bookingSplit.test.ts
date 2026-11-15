import { describe, it, expect } from 'vitest'
import { bookingSplitItems, type SplitWords } from './bookingSplit'
import { computeBookingTotal } from './utils'
import { splitPerPerson, splitSum } from '../../utils/perPersonSplit'
import {
  mkAccommodation, mkRoom, mkBookingRoom, mkBookingRoomPrice, mkBooking, mkParticipant, mkLesson,
  mkLessonPrices, mkRental, mkTaxiTrip, mkExternalBooking, mkCharge, mkAttendee, mkDiningEvent,
  mkActivityBooking, mkInstructor, mkData,
} from './utils.fixtures'
import type { SharedAccountingData } from './types'
import type { Booking } from '../../types/database'

const words: SplitWords = { lesson: 'lesson', rental: 'rental', dining: 'dining', centerAccess: 'Center access' }

function split(b: Booking, data: SharedAccountingData) {
  const ids = data.bookingParticipants.filter(p => p.booking_id === b.id).map(p => p.id)
  return splitPerPerson(ids, bookingSplitItems(b, data, words))
}
const totalOf = (s: ReturnType<typeof split>, id: string) => s.find(x => x.participantId === id)!.total

// A stay touching every source of revenue at once.
const booking = mkBooking({ num_center_access: 1, center_access_rate: 7 }) // 7 nights
const alice = mkParticipant({ id: 'p1', first_name: 'Alice', brings_own_gear: true })
const bob   = mkParticipant({ id: 'p2', first_name: 'Bob' })
const other = mkParticipant({ id: 'p9', booking_id: 'bk2', first_name: 'Zoe' }) // another booking
const full: SharedAccountingData = mkData({
  accommodations: [mkAccommodation({ id: 'acc1', name: 'H 10' }), mkAccommodation({ id: 'accSM', name: 'San Martinho', type: 'other' })],
  rooms: [mkRoom({ id: 'room1', accommodation_id: 'acc1', name: 'B' })],
  bookingRooms: [mkBookingRoom()],
  bookingRoomPrices: [mkBookingRoomPrice({ price_per_night: 40 })],                 // 280
  externalAccommodationBkgs: [mkExternalBooking({ accommodation_id: 'accSM', total_sell_price: 99.99 })],
  bookingParticipants: [alice, bob, other],
  instructors: [mkInstructor()],
  priceItems: mkLessonPrices(),
  lessons: [
    mkLesson({ id: 'l1', participant_ids: ['p1'], price_per_hour: 60 }),            // 120 Alice
    mkLesson({ id: 'l2', type: 'group', participant_ids: ['p1', 'p2', 'p9'], price_per_hour: 45 }), // 90 + 90 (Zoe owed by bk2)
    mkLesson({ id: 'l3', booking_id: 'bk2', type: 'group', participant_ids: ['p9', 'p2'], price_per_hour: 45 }), // 90 Bob, owned by bk2
  ],
  equipmentRentals: [
    mkRental({ id: 'r1', participant_id: 'p2', price: 55 }),
    mkRental({ id: 'r2', participant_id: null, price: 30 }),                       // nobody named → 15 + 15
  ],
  taxiTrips: [mkTaxiTrip({ price_eur: 120 })],                                     // 60 + 60
  diningEvents: [mkDiningEvent({ price_per_person: 12, attendees: [
    mkAttendee({ id: 'a1', person_id: 'p1' }),
    mkAttendee({ id: 'a2', person_id: 'p2', price_override: 0 }),                  // free for Bob
    mkAttendee({ id: 'a3', person_id: 'p9' }),                                     // not ours
  ] })],
  activityBookings: [mkActivityBooking({ participant_ids: ['p1', 'p2'], nb_persons: 3, price_client: 100 })],
  bookingCharges: [
    mkCharge({ id: 'c1', label: 'Board', unit_price: 300, participant_id: 'p2' }),
    mkCharge({ id: 'c2', label: 'Drinks', quantity: 3, unit_price: 3.33 }),        // 9.99 shared
  ],
})

describe('bookingSplitItems — shares add up to computeBookingTotal', () => {
  it('on a stay with every source of revenue', () => {
    const s = split(booking, full)
    expect(splitSum(s)).toBe(Math.round(computeBookingTotal(booking, full) * 100) / 100)
  })

  it('puts each line on the right person', () => {
    const s = split(booking, full)
    // Spare cents rotate: the ext stay's (99.99) goes to Alice, the drinks' (9.99) to Bob.
    // Alice: ½ room 140 + ½ ext 50.00 + 120 + 90 + 15 + 60 + 12 + ½ act 50 + 49 (own gear) + ½ drinks 4.99
    // Bob:   ½ room 140 + ½ ext 49.99 + 90 + 90 + 55 + 15 + 60 + ½ act 50 + 300 + ½ drinks 5.00
    expect(totalOf(s, 'p1')).toBe(590.99)
    expect(totalOf(s, 'p2')).toBe(854.99)
    expect(totalOf(s, 'p1') + totalOf(s, 'p2')).toBeCloseTo(computeBookingTotal(booking, full), 2)
  })

  it('gives center access to the own-gear traveller only', () => {
    const s = split(booking, full)
    const ca = (id: string) => s.find(x => x.participantId === id)!.lines.filter(l => l.category === 'center_access')
    expect(ca('p1').map(l => l.amount)).toEqual([49])
    expect(ca('p2')).toEqual([])
  })

  it('shares center access equally when nobody is flagged "own gear"', () => {
    const data = { ...full, bookingParticipants: [mkParticipant({ id: 'p1' }), bob] }
    const s = split(booking, data)
    expect(splitSum(s)).toBe(Math.round(computeBookingTotal(booking, data) * 100) / 100)
    expect(s.map(x => x.lines.find(l => l.category === 'center_access')!.amount)).toEqual([24.5, 24.5])
  })

  it('leaves out what an agency pays, exactly like the total', () => {
    const data: SharedAccountingData = {
      ...full,
      bookingRoomPrices: [mkBookingRoomPrice({ price_per_night: 40, agency_billing_line_id: 'line1' })],
      lessons: full.lessons.map(l => l.id === 'l1' ? { ...l, agency_billing_line_id: 'line2' } : l),
      taxiTrips: [mkTaxiTrip({ price_eur: 120, agency_billing_line_id: 'line3' })],
    }
    const s = split(booking, data)
    expect(splitSum(s)).toBe(Math.round(computeBookingTotal(booking, data) * 100) / 100)
    expect(s.flatMap(x => x.lines).some(l => l.category === 'taxis')).toBe(false)
  })

  it('leaves out a bungalow paid to its owner, exactly like the total', () => {
    const data = { ...full, bookingRoomPrices: [mkBookingRoomPrice({ price_per_night: 40, paid_to_owner: true })] }
    const s = split(booking, data)
    expect(splitSum(s)).toBe(Math.round(computeBookingTotal(booking, data) * 100) / 100)
    expect(s.flatMap(x => x.lines).some(l => l.label.startsWith('H 10/B'))).toBe(false)
  })

  it('a group lesson of another booking bills only our head', () => {
    const s = split(booking, full)
    const bobGroups = s.find(x => x.participantId === 'p2')!.lines.filter(l => l.category === 'lessons')
    expect(bobGroups.map(l => l.amount)).toEqual([90, 90]) // l2 and l3, one head each
  })

  it('a self-managed San Martinho stay at 0 € adds no line', () => {
    const data = { ...full, externalAccommodationBkgs: [mkExternalBooking({ accommodation_id: 'accSM', total_sell_price: 0 })] }
    const s = split(booking, data)
    expect(s.flatMap(x => x.lines).some(l => l.label === 'San Martinho')).toBe(false)
    expect(splitSum(s)).toBe(Math.round(computeBookingTotal(booking, data) * 100) / 100)
  })

  it('a walk-in (one traveller, no room) carries everything', () => {
    const walkIn = mkBooking({ id: 'wk', check_in: '2026-11-14', check_out: '2026-11-15', num_center_access: 0 })
    const p = mkParticipant({ id: 'pw', booking_id: 'wk' })
    const data = mkData({
      bookingParticipants: [p], priceItems: mkLessonPrices(),
      lessons: [mkLesson({ id: 'lw', booking_id: 'wk', participant_ids: ['pw'], price_per_hour: 50, duration_hours: 1 })],
      equipmentRentals: [mkRental({ id: 'rw', booking_id: 'wk', participant_id: 'pw', price: 55 })],
    })
    const s = split(walkIn, data)
    expect(s.map(x => x.total)).toEqual([105])
    expect(splitSum(s)).toBe(computeBookingTotal(walkIn, data))
  })
})
