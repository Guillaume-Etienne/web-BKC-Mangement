import { describe, it, expect } from 'vitest'
import {
  countNights, getRoomNightlyRate, computeAccommodationRevenue, computeExternalAccommodationCost,
  computeLessonsRevenue, getLessonClientRate, getInstructorRate, getConfiguredRate, computeRentalsRevenue,
  computeTaxiRevenue, computeStandaloneTaxiRevenue, computeTaxiMarginEur,
  computeActivityRevenueForBooking, computeCenterAccessRevenue,
  computeDiningForBooking, computeDiningRevenue, computeInstructorDiningCharges,
  computeBookingTotal, computeBookingPaid, computeBookingDiscounts,
  computeInstructorEarned, computeInstructorDebts, computeInstructorPaid, computeInstructorBalance,
  computeSeasonTotals, suggestDeposit, fmtEur, fmtMonth,
} from './utils'
import {
  mkAccommodation, mkActivityBooking, mkAttendee, mkBooking, mkBookingRoom, mkBookingRoomPrice,
  mkData, mkDiningEvent, mkExternalBooking, mkHouseSetup,
  mkInstructor, mkInstructorDebt, mkInstructorPayment, mkLesson, mkLessonOverride, mkLessonPrices,
  mkParticipant, mkPayment, mkPrice, mkRental, mkRoom, mkRoomRate, mkTaxiTrip,
} from './utils.fixtures'
import type { Lesson } from '../../types/database'

/** fr-FR / en-GB use narrow no-break spaces — normalise before comparing. */
const norm = (s: string) => s.replace(/\s/gu, ' ')

// ─── 1. Nights ────────────────────────────────────────────────────────────────

describe('countNights', () => {
  it('counts nights between check-in and check-out', () => {
    expect(countNights('2026-11-01', '2026-11-08')).toBe(7)
  })
  it('returns 0 for a same-day stay', () => {
    expect(countNights('2026-11-01', '2026-11-01')).toBe(0)
  })
  it('never returns a negative count when dates are reversed', () => {
    expect(countNights('2026-11-08', '2026-11-01')).toBe(0)
  })
  it('returns 0 when a date is missing', () => {
    expect(countNights('', '2026-11-08')).toBe(0)
    expect(countNights('2026-11-01', '')).toBe(0)
  })
  it('counts correctly across a month boundary', () => {
    expect(countNights('2026-10-30', '2026-11-02')).toBe(3)
  })
})

// ─── 2. Room nightly rate (snapshot → base rate fallback) ─────────────────────

describe('getRoomNightlyRate', () => {
  const { acc, roomF, roomB, rates } = mkHouseSetup(100)
  const base = { accommodations: [acc], rooms: [roomF, roomB], roomRates: rates }

  it('uses the booking price snapshot when present', () => {
    const data = mkData({
      ...base,
      bookingRooms: [mkBookingRoom({ room_id: 'roomF' })],
      bookingRoomPrices: [mkBookingRoomPrice({ room_id: 'roomF', price_per_night: 60 })],
    })
    expect(getRoomNightlyRate('bk1', 'roomF', data)).toBe(60)
  })

  it('falls back to the room base rate when there is no snapshot', () => {
    const data = mkData({ ...base, bookingRooms: [mkBookingRoom({ room_id: 'roomF' })] })
    expect(getRoomNightlyRate('bk1', 'roomF', data)).toBe(55)
  })

  it('returns 0 when neither snapshot nor base rate exists', () => {
    const data = mkData({
      accommodations: [acc], rooms: [roomF], roomRates: [],
      bookingRooms: [mkBookingRoom({ room_id: 'roomF' })],
    })
    expect(getRoomNightlyRate('bk1', 'roomF', data)).toBe(0)
  })

  it('splits the configured full-house rate across rooms when the whole house is booked', () => {
    const data = mkData({
      ...base,
      bookingRooms: [mkBookingRoom({ room_id: 'roomF' }), mkBookingRoom({ room_id: 'roomB' })],
    })
    expect(getRoomNightlyRate('bk1', 'roomF', data)).toBe(50)
    expect(getRoomNightlyRate('bk1', 'roomB', data)).toBe(50)
  })

  it('falls back to per-room rates when no full-house rate is configured', () => {
    const noFull = mkHouseSetup(null)
    const data = mkData({
      accommodations: [noFull.acc], rooms: [noFull.roomF, noFull.roomB], roomRates: noFull.rates,
      bookingRooms: [mkBookingRoom({ room_id: 'roomF' }), mkBookingRoom({ room_id: 'roomB' })],
    })
    expect(getRoomNightlyRate('bk1', 'roomF', data)).toBe(55)
  })

  it('does not apply the full-house split when only one room of the house is booked', () => {
    const data = mkData({ ...base, bookingRooms: [mkBookingRoom({ room_id: 'roomF' })] })
    expect(getRoomNightlyRate('bk1', 'roomF', data)).toBe(55)
  })

  it('never applies the full-house split to a bungalow', () => {
    const bung = mkAccommodation({ id: 'accBu', name: 'Bungalow', type: 'bungalow', total_rooms: 1 })
    const room = mkRoom({ id: 'roomBu', accommodation_id: 'accBu' })
    const data = mkData({
      accommodations: [bung], rooms: [room],
      roomRates: [mkRoomRate({ room_id: 'roomBu', price_per_night: 35 }), mkRoomRate({ id: 'rf', room_id: 'full_accBu', price_per_night: 100 })],
      bookingRooms: [mkBookingRoom({ room_id: 'roomBu' })],
    })
    expect(getRoomNightlyRate('bk1', 'roomBu', data)).toBe(35)
  })
})

// ─── 3. Accommodation revenue ─────────────────────────────────────────────────

describe('computeAccommodationRevenue', () => {
  const { acc, roomF, roomB, rates } = mkHouseSetup(100)
  const base = { accommodations: [acc], rooms: [roomF, roomB], roomRates: rates }
  const booking = mkBooking({ check_in: '2026-11-01', check_out: '2026-11-08' }) // 7 nights

  it('bills one room at its snapshot price for the whole stay', () => {
    const data = mkData({
      ...base,
      bookingRooms: [mkBookingRoom({ room_id: 'roomF' })],
      bookingRoomPrices: [mkBookingRoomPrice({ room_id: 'roomF', price_per_night: 60 })],
    })
    expect(computeAccommodationRevenue(booking, data)).toBe(420) // 60 × 7
  })

  it('bills a full house at the house rate, not the sum of room rates', () => {
    const data = mkData({
      ...base,
      bookingRooms: [mkBookingRoom({ room_id: 'roomF' }), mkBookingRoom({ room_id: 'roomB' })],
    })
    expect(computeAccommodationRevenue(booking, data)).toBe(700) // 100 × 7, not 110 × 7
  })

  it('bills an external accommodation on its own dates', () => {
    const data = mkData({
      externalAccommodationBkgs: [mkExternalBooking({ check_in: '2026-11-01', check_out: '2026-11-05' })],
    })
    expect(computeAccommodationRevenue(booking, data)).toBe(600) // 150 × 4
  })

  it('adds own rooms and external stays together', () => {
    const data = mkData({
      ...base,
      bookingRooms: [mkBookingRoom({ room_id: 'roomF' })],
      bookingRoomPrices: [mkBookingRoomPrice({ room_id: 'roomF', price_per_night: 60 })],
      externalAccommodationBkgs: [mkExternalBooking()],
    })
    expect(computeAccommodationRevenue(booking, data)).toBe(1020) // 420 + 600
  })

  it('returns 0 for a zero-night booking', () => {
    const sameDay = mkBooking({ check_in: '2026-11-01', check_out: '2026-11-01' })
    const data = mkData({
      ...base,
      bookingRooms: [mkBookingRoom({ room_id: 'roomF' })],
      bookingRoomPrices: [mkBookingRoomPrice({ room_id: 'roomF', price_per_night: 60 })],
    })
    expect(computeAccommodationRevenue(sameDay, data)).toBe(0)
  })

  it('still credits an external stay on a zero-night booking, so the margin stays honest', () => {
    // The external stay carries its own dates. Bailing out on the booking nights
    // credited nothing while the cost was still charged → a phantom loss.
    const sameDay = mkBooking({ check_in: '2026-11-01', check_out: '2026-11-01' })
    const data = mkData({
      externalAccommodationBkgs: [mkExternalBooking({ check_in: '2026-11-01', check_out: '2026-11-05' })],
    })
    expect(computeAccommodationRevenue(sameDay, data)).toBe(600)              // 150 × 4
    expect(computeExternalAccommodationCost(sameDay, data)).toBe(320)         // 80 × 4
    expect(computeAccommodationRevenue(sameDay, data)
      - computeExternalAccommodationCost(sameDay, data)).toBe(280)            // a margin, not a loss
  })

  it('bills a room with no rate at all as 0 rather than crashing', () => {
    const data = mkData({
      accommodations: [acc], rooms: [roomF], roomRates: [],
      bookingRooms: [mkBookingRoom({ room_id: 'roomF' })],
    })
    expect(computeAccommodationRevenue(booking, data)).toBe(0)
  })
})

// ─── 4. External accommodation cost & margin ──────────────────────────────────

describe('computeExternalAccommodationCost', () => {
  const booking = mkBooking()

  it('costs the stay at the booking cost snapshot', () => {
    const data = mkData({
      externalAccommodationBkgs: [mkExternalBooking({ check_in: '2026-11-01', check_out: '2026-11-05' })],
    })
    expect(computeExternalAccommodationCost(booking, data)).toBe(320) // 80 × 4
  })

  it('leaves a margin of sell − cost on the stay', () => {
    const data = mkData({
      externalAccommodationBkgs: [mkExternalBooking({ check_in: '2026-11-01', check_out: '2026-11-05' })],
    })
    const revenue = computeAccommodationRevenue(booking, data)
    expect(revenue - computeExternalAccommodationCost(booking, data)).toBe(280) // 600 − 320
  })

  // The whole reason the flat rate replaced a per-night price: what was agreed
  // with the hotel must not move because a departure date did.
  it('keeps the agreed amount when the stay dates change', () => {
    const short = mkData({
      externalAccommodationBkgs: [mkExternalBooking({ check_in: '2026-11-01', check_out: '2026-11-02', total_cost: 320 })],
    })
    const long = mkData({
      externalAccommodationBkgs: [mkExternalBooking({ check_in: '2026-11-01', check_out: '2026-11-20', total_cost: 320 })],
    })
    expect(computeExternalAccommodationCost(booking, short)).toBe(320)
    expect(computeExternalAccommodationCost(booking, long)).toBe(320)
  })

  it('sums several external stays on the same booking', () => {
    const data = mkData({
      externalAccommodationBkgs: [
        mkExternalBooking({ id: 'e1', check_in: '2026-11-01', check_out: '2026-11-03', total_cost: 160 }),
        mkExternalBooking({ id: 'e2', check_in: '2026-11-03', check_out: '2026-11-05', total_cost: 180 }),
      ],
    })
    expect(computeExternalAccommodationCost(booking, data)).toBe(340) // 160 + 180
  })

  // A self-managed stay: the guest sleeps there, no money moves through us.
  it('bills nothing for a stay left at zero', () => {
    const data = mkData({
      externalAccommodationBkgs: [mkExternalBooking({ total_cost: 0, total_sell_price: 0 })],
    })
    expect(computeExternalAccommodationCost(booking, data)).toBe(0)
    expect(computeAccommodationRevenue(booking, data)).toBe(0)
  })

  it('costs nothing when the booking has no external stay', () => {
    expect(computeExternalAccommodationCost(booking, mkData())).toBe(0)
  })

  it('ignores external stays belonging to another booking', () => {
    const data = mkData({
      externalAccommodationBkgs: [mkExternalBooking({ booking_id: 'other' })],
    })
    expect(computeExternalAccommodationCost(booking, data)).toBe(0)
  })
})

// ─── 5. Lessons revenue ───────────────────────────────────────────────────────

describe('computeLessonsRevenue', () => {
  const booking = mkBooking()
  const instructor = mkInstructor()
  const priceItems = mkLessonPrices() // private 60 · group 36 · supervision 40

  it('bills a private lesson at the price-list rate × hours', () => {
    const data = mkData({ priceItems, instructors: [instructor], lessons: [mkLesson({ type: 'private', duration_hours: 2 })] })
    expect(computeLessonsRevenue(booking, data)).toBe(120) // 60 × 2
  })

  it('bills a supervision at the supervision rate', () => {
    const data = mkData({ priceItems, instructors: [instructor], lessons: [mkLesson({ type: 'supervision', duration_hours: 3 })] })
    expect(computeLessonsRevenue(booking, data)).toBe(120) // 40 × 3
  })

  it('bills a group lesson per head', () => {
    const data = mkData({
      priceItems, instructors: [instructor],
      lessons: [mkLesson({ type: 'group', duration_hours: 2, participant_ids: ['p1', 'p2', 'p3'] })],
    })
    expect(computeLessonsRevenue(booking, data)).toBe(216) // 36 × 2 × 3
  })

  it('never bills the client at the instructor payout rate', () => {
    // Instructor costs 40/h, the client owes the 60/h list price
    const data = mkData({ priceItems, instructors: [instructor], lessons: [mkLesson({ duration_hours: 1 })] })
    expect(computeLessonsRevenue(booking, data)).toBe(60)
  })

  it('uses the price snapshot frozen on the lesson over the current price list', () => {
    const data = mkData({
      priceItems, instructors: [instructor],
      lessons: [mkLesson({ duration_hours: 2, price_per_hour: 50 })],
    })
    expect(computeLessonsRevenue(booking, data)).toBe(100) // 50 × 2, not 60 × 2
  })

  it('honours a snapshot of 0 — a free lesson stays free', () => {
    const data = mkData({ priceItems, lessons: [mkLesson({ duration_hours: 2, price_per_hour: 0 })] })
    expect(computeLessonsRevenue(booking, data)).toBe(0)
  })

  it('bills nothing when the type has no configured price and no snapshot', () => {
    const data = mkData({ priceItems: [], lessons: [mkLesson({ duration_hours: 2 })] })
    expect(computeLessonsRevenue(booking, data)).toBe(0)
  })

  it('still bills a lesson whose instructor was deleted', () => {
    const data = mkData({ priceItems, instructors: [], lessons: [mkLesson({ duration_hours: 2 })] })
    expect(computeLessonsRevenue(booking, data)).toBe(120)
  })

  it('sums several lessons on the booking', () => {
    const data = mkData({
      priceItems, instructors: [instructor],
      lessons: [
        mkLesson({ id: 'l1', type: 'private', duration_hours: 2 }),
        mkLesson({ id: 'l2', type: 'supervision', duration_hours: 1 }),
      ],
    })
    expect(computeLessonsRevenue(booking, data)).toBe(160) // 120 + 40
  })

  it('ignores lessons attached to another booking', () => {
    const data = mkData({ priceItems, instructors: [instructor], lessons: [mkLesson({ booking_id: 'other' })] })
    expect(computeLessonsRevenue(booking, data)).toBe(0)
  })
})

describe('getLessonClientRate', () => {
  const priceItems = mkLessonPrices()
  it('reads the price list for each lesson type', () => {
    expect(getLessonClientRate(mkLesson({ type: 'private' }), priceItems)).toBe(60)
    expect(getLessonClientRate(mkLesson({ type: 'group' }), priceItems)).toBe(36)
    expect(getLessonClientRate(mkLesson({ type: 'supervision' }), priceItems)).toBe(40)
  })
  it('prefers the snapshot frozen on the lesson', () => {
    expect(getLessonClientRate(mkLesson({ price_per_hour: 45 }), priceItems)).toBe(45)
  })
  it('matches on what the rate bills, never on the price row name', () => {
    const renamed = mkLessonPrices().map(p => ({ ...p, name: 'Renamed by the owner' }))
    expect(getLessonClientRate(mkLesson({ type: 'private' }), renamed)).toBe(60)
  })
  it('returns 0 when the type has no price row', () => {
    expect(getLessonClientRate(mkLesson({ type: 'group' }), [])).toBe(0)
  })
  it('survives a row loaded before the migration added the column', () => {
    // Deploy lands before the migration: the column is absent, not null
    const legacy = { ...mkLesson(), price_per_hour: undefined } as unknown as Lesson
    expect(getLessonClientRate(legacy, priceItems)).toBe(60)
    expect(Number.isNaN(getLessonClientRate(legacy, priceItems))).toBe(false)
  })
})

describe('getInstructorRate', () => {
  const instructor = mkInstructor()
  it('uses the private payout rate for a private lesson', () => {
    expect(getInstructorRate(mkLesson({ type: 'private' }), instructor, [])).toBe(40)
  })
  it('uses the group payout rate for a group lesson', () => {
    expect(getInstructorRate(mkLesson({ type: 'group' }), instructor, [])).toBe(25)
  })
  it('uses the supervision payout rate for a supervision', () => {
    expect(getInstructorRate(mkLesson({ type: 'supervision' }), instructor, [])).toBe(15)
  })
  it('lets a payout override win over the instructor rate', () => {
    expect(getInstructorRate(mkLesson(), instructor, [mkLessonOverride({ rate: 70 })])).toBe(70)
  })
  it('pays nothing for an owner-instructor set to 0', () => {
    const owner = mkInstructor({ rate_private: 0, rate_group: 0, rate_supervision: 0 })
    expect(getInstructorRate(mkLesson({ type: 'private' }), owner, [])).toBe(0)
  })

  it('pays the rate frozen on the lesson, not the one in force today', () => {
    // The whole point of the snapshot: raising someone's rate in October must not
    // raise what is owed for the lessons they gave in July.
    const lesson = mkLesson({ type: 'private', instructor_rate: 40 })
    const afterRaise = mkInstructor({ rate_private: 55 })
    expect(getInstructorRate(lesson, afterRaise, [])).toBe(40)
  })

  it('still lets an override win over the frozen rate', () => {
    const lesson = mkLesson({ instructor_rate: 40 })
    expect(getInstructorRate(lesson, instructor, [mkLessonOverride({ rate: 70 })])).toBe(70)
  })

  it('falls back to the current rate for a lesson given before the snapshot existed', () => {
    const legacy = { ...mkLesson({ type: 'private' }), instructor_rate: undefined } as unknown as Lesson
    expect(getInstructorRate(legacy, instructor, [])).toBe(40)
  })

  it('freezes 0 as a real rate, not as "nothing recorded"', () => {
    // An owner giving the lesson is paid 0. That is a decision, and a later raise
    // of the scale must not resurrect a debt towards them.
    const lesson = mkLesson({ type: 'private', instructor_rate: 0 })
    expect(getInstructorRate(lesson, mkInstructor({ rate_private: 55 }), [])).toBe(0)
  })
})

describe('getConfiguredRate', () => {
  it('tells "not configured" apart from "configured at zero"', () => {
    // 0 is a decision (free), null is nobody said — the screens colour them differently
    expect(getConfiguredRate([mkPrice('meal', 0)], 'meal')).toBe(0)
    expect(getConfiguredRate([], 'meal')).toBeNull()
  })
  it('reads the posts that used to be hardcoded', () => {
    const items = [mkPrice('center_access', 5), mkPrice('rental_kite', 40)]
    expect(getConfiguredRate(items, 'center_access')).toBe(5)
    expect(getConfiguredRate(items, 'rental_kite')).toBe(40)
    expect(getConfiguredRate(items, 'rental_foilboard')).toBeNull()
  })
})

// ─── 6. Equipment rentals ─────────────────────────────────────────────────────

describe('computeRentalsRevenue', () => {
  const booking = mkBooking()
  it('sums the prices entered on the booking rentals', () => {
    const data = mkData({ equipmentRentals: [mkRental({ id: 'r1', price: 45 }), mkRental({ id: 'r2', price: 25 })] })
    expect(computeRentalsRevenue(booking, data)).toBe(70)
  })
  it('ignores rentals of another booking', () => {
    const data = mkData({ equipmentRentals: [mkRental({ booking_id: 'other' })] })
    expect(computeRentalsRevenue(booking, data)).toBe(0)
  })
  it('returns 0 without rentals', () => {
    expect(computeRentalsRevenue(booking, mkData())).toBe(0)
  })
})

// ─── 7. Taxi ──────────────────────────────────────────────────────────────────

describe('taxi revenue and margin', () => {
  const booking = mkBooking()

  it('bills the client the EUR price of the booking trips', () => {
    const data = mkData({ taxiTrips: [mkTaxiTrip({ id: 't1' }), mkTaxiTrip({ id: 't2', type: 'center-to-aero' })] })
    expect(computeTaxiRevenue(booking, data)).toBe(240)
  })

  it('excludes standalone trips from the booking revenue', () => {
    const data = mkData({ taxiTrips: [mkTaxiTrip({ booking_id: null })] })
    expect(computeTaxiRevenue(booking, data)).toBe(0)
  })

  it('counts only unlinked trips as standalone revenue', () => {
    const data = mkData({
      taxiTrips: [mkTaxiTrip({ id: 't1', booking_id: null, price_eur: 90 }), mkTaxiTrip({ id: 't2', booking_id: 'bk1' })],
    })
    expect(computeStandaloneTaxiRevenue(data)).toBe(90)
  })

  it('computes the centre margin after driver and manager costs', () => {
    // 120 € − (6000 + 1000) MZN / 73 = 24.11 → 24
    expect(computeTaxiMarginEur({ price_eur: 120, price_driver_mzn: 6000, margin_manager_mzn: 1000 }, 73)).toBe(24)
  })

  it('keeps the whole MZN margin for the centre on a private taxi (manager = 0)', () => {
    expect(computeTaxiMarginEur({ price_eur: 120, price_driver_mzn: 6000, margin_manager_mzn: 0 }, 73)).toBe(38)
  })

  it('returns a negative margin when costs exceed the billed price', () => {
    expect(computeTaxiMarginEur({ price_eur: 50, price_driver_mzn: 6000, margin_manager_mzn: 1000 }, 73)).toBe(-46)
  })

  it('sums per-trip margins rather than rounding the aggregate', () => {
    // The dashboard total must equal the sum of the lines it summarises. Rounding the
    // aggregate instead drifts: 3 trips at 6100+1000 MZN / 73 give 69 € per-trip
    // but 68 € if the total cost is rounded once.
    const trips = [1, 2, 3].map(() => ({ price_eur: 120, price_driver_mzn: 6100, margin_manager_mzn: 1000 }))
    const perTrip = trips.reduce((s, t) => s + computeTaxiMarginEur(t, 73), 0)
    const aggregate = trips.reduce((s, t) => s + t.price_eur, 0)
      - Math.round(trips.reduce((s, t) => s + t.price_driver_mzn + t.margin_manager_mzn, 0) / 73)
    expect(perTrip).toBe(69)
    expect(aggregate).toBe(68)
  })

  it('guards against a zero exchange rate instead of dividing by zero', () => {
    expect(computeTaxiMarginEur({ price_eur: 120, price_driver_mzn: 6000, margin_manager_mzn: 1000 }, 0)).toBe(-6880)
  })
})

// ─── 8. Activities ────────────────────────────────────────────────────────────

describe('computeActivityRevenueForBooking', () => {
  const booking = mkBooking()

  it('bills the client price when the centre pays the provider', () => {
    const data = mkData({ activityBookings: [mkActivityBooking({ payment_flow: 'we_pay_provider', price_client: 100 })] })
    expect(computeActivityRevenueForBooking(booking, data)).toBe(100)
  })

  it('bills nothing on the booking when the client pays the provider directly', () => {
    const data = mkData({ activityBookings: [mkActivityBooking({ payment_flow: 'provider_pays_us', price_client: 100 })] })
    expect(computeActivityRevenueForBooking(booking, data)).toBe(0)
  })

  it('only sums the we-pay-provider activities of a mixed booking', () => {
    const data = mkData({
      activityBookings: [
        mkActivityBooking({ id: 'a1', payment_flow: 'we_pay_provider', price_client: 100 }),
        mkActivityBooking({ id: 'a2', payment_flow: 'provider_pays_us', price_client: 80 }),
        mkActivityBooking({ id: 'a3', payment_flow: 'we_pay_provider', price_client: 50 }),
      ],
    })
    expect(computeActivityRevenueForBooking(booking, data)).toBe(150)
  })

  it('ignores activities of another booking', () => {
    const data = mkData({ activityBookings: [mkActivityBooking({ booking_id: 'other' })] })
    expect(computeActivityRevenueForBooking(booking, data)).toBe(0)
  })
})

// ─── 9. Center access (own gear) ──────────────────────────────────────────────

describe('computeCenterAccessRevenue', () => {
  it('bills persons × nights × daily rate', () => {
    expect(computeCenterAccessRevenue(mkBooking({ num_center_access: 2, center_access_rate: 5 }))).toBe(70)
  })
  it('applies a custom daily rate', () => {
    expect(computeCenterAccessRevenue(mkBooking({ num_center_access: 1, center_access_rate: 8 }))).toBe(56)
  })
  it('bills nothing when nobody brings their own gear', () => {
    expect(computeCenterAccessRevenue(mkBooking({ num_center_access: 0, center_access_rate: 5 }))).toBe(0)
  })
  it('bills nothing when the rate is 0', () => {
    expect(computeCenterAccessRevenue(mkBooking({ num_center_access: 3, center_access_rate: 0 }))).toBe(0)
  })
})

// ─── 10. Dining ───────────────────────────────────────────────────────────────

describe('dining charges', () => {
  const booking = mkBooking()
  const participants = [mkParticipant({ id: 'p1' })]

  it('charges the event price to an attending participant', () => {
    const ev = mkDiningEvent({ price_per_person: 12, attendees: [mkAttendee({ person_id: 'p1' })] })
    expect(computeDiningForBooking(booking, [ev], participants)).toBe(12)
  })

  it('lets an individual price override the event price', () => {
    const ev = mkDiningEvent({ price_per_person: 12, attendees: [mkAttendee({ person_id: 'p1', price_override: 20 })] })
    expect(computeDiningForBooking(booking, [ev], participants)).toBe(20)
  })

  it('bills an individual override even when the event itself is free', () => {
    const ev = mkDiningEvent({ price_per_person: 0, attendees: [mkAttendee({ person_id: 'p1', price_override: 20 })] })
    expect(computeDiningForBooking(booking, [ev], participants)).toBe(20)
  })

  it('bills nothing for a free event when no one has an override', () => {
    const ev = mkDiningEvent({ price_per_person: 0, attendees: [mkAttendee({ person_id: 'p1' })] })
    expect(computeDiningForBooking(booking, [ev], participants)).toBe(0)
  })

  it('bills an explicit 0 override even on a paying event', () => {
    const ev = mkDiningEvent({ price_per_person: 12, attendees: [mkAttendee({ person_id: 'p1', price_override: 0 })] })
    expect(computeDiningForBooking(booking, [ev], participants)).toBe(0)
  })

  it('does not charge a non-attending participant', () => {
    const ev = mkDiningEvent({ attendees: [mkAttendee({ person_id: 'p1', is_attending: false })] })
    expect(computeDiningForBooking(booking, [ev], participants)).toBe(0)
  })

  it('does not charge instructor meals to the booking', () => {
    const ev = mkDiningEvent({ attendees: [mkAttendee({ person_id: 'ins1', person_type: 'instructor' })] })
    expect(computeDiningForBooking(booking, [ev], participants)).toBe(0)
  })

  it('falls back to the client id when the booking has no participants', () => {
    const ev = mkDiningEvent({ attendees: [mkAttendee({ person_id: 'cli1' })] })
    expect(computeDiningForBooking(booking, [ev], [])).toBe(12)
  })

  it('counts every attendee — clients and instructors — in the global dining revenue', () => {
    const ev = mkDiningEvent({
      price_per_person: 12,
      attendees: [
        mkAttendee({ id: 'a1', person_id: 'p1' }),
        mkAttendee({ id: 'a2', person_id: 'ins1', person_type: 'instructor' }),
        mkAttendee({ id: 'a3', person_id: 'p2', is_attending: false }),
      ],
    })
    expect(computeDiningRevenue([ev])).toBe(24)
  })

  it('counts an override on a free event in the global dining revenue', () => {
    const ev = mkDiningEvent({
      price_per_person: 0,
      attendees: [
        mkAttendee({ id: 'a1', person_id: 'p1', price_override: 20 }),
        mkAttendee({ id: 'a2', person_id: 'p2' }),
      ],
    })
    expect(computeDiningRevenue([ev])).toBe(20)
  })

  it('charges an instructor an override taken on a free event', () => {
    const ev = mkDiningEvent({
      price_per_person: 0,
      attendees: [mkAttendee({ person_id: 'ins1', person_type: 'instructor', price_override: 15 })],
    })
    expect(computeInstructorDiningCharges('ins1', [ev])).toBe(15)
  })

  it('charges an instructor only for their own meals', () => {
    const ev = mkDiningEvent({
      price_per_person: 12,
      attendees: [
        mkAttendee({ id: 'a1', person_id: 'ins1', person_type: 'instructor' }),
        mkAttendee({ id: 'a2', person_id: 'ins2', person_type: 'instructor' }),
      ],
    })
    expect(computeInstructorDiningCharges('ins1', [ev])).toBe(12)
  })
})

// ─── 11. Payments & discounts ─────────────────────────────────────────────────

describe('payments and discounts', () => {
  it('sums the real money received', () => {
    const payments = [mkPayment({ id: 'p1', amount: 300 }), mkPayment({ id: 'p2', amount: 200 })]
    expect(computeBookingPaid('bk1', payments)).toBe(500)
  })

  it('excludes discounts from the money received', () => {
    const payments = [mkPayment({ id: 'p1', amount: 300 }), mkPayment({ id: 'p2', amount: 50, is_discount: true })]
    expect(computeBookingPaid('bk1', payments)).toBe(300)
  })

  it('sums discounts separately', () => {
    const payments = [mkPayment({ id: 'p1', amount: 300 }), mkPayment({ id: 'p2', amount: 50, is_discount: true })]
    expect(computeBookingDiscounts('bk1', payments)).toBe(50)
  })

  it('counts an unverified payment as received', () => {
    expect(computeBookingPaid('bk1', [mkPayment({ amount: 100, is_verified: false })])).toBe(100)
  })

  it('ignores payments of another booking', () => {
    expect(computeBookingPaid('bk1', [mkPayment({ booking_id: 'other', amount: 999 })])).toBe(0)
  })

  it('returns 0 when nothing was paid', () => {
    expect(computeBookingPaid('bk1', [])).toBe(0)
    expect(computeBookingDiscounts('bk1', [])).toBe(0)
  })
})

// ─── 12. Instructor payroll ───────────────────────────────────────────────────

describe('instructor payroll', () => {
  const instructor = mkInstructor()

  it('earns the lesson rate × hours', () => {
    const data = mkData({ instructors: [instructor], lessons: [mkLesson({ type: 'private', duration_hours: 2 })] })
    expect(computeInstructorEarned('ins1', data)).toBe(80)
  })

  it('earns on lessons attached to no booking (day activities, trips)', () => {
    const data = mkData({ instructors: [instructor], lessons: [mkLesson({ booking_id: '', duration_hours: 3 })] })
    expect(computeInstructorEarned('ins1', data)).toBe(120)
  })

  it('is paid a flat hourly rate for a group lesson while the client is billed per head', () => {
    const booking = mkBooking()
    const data = mkData({
      priceItems: mkLessonPrices(), instructors: [instructor],
      lessons: [mkLesson({ type: 'group', duration_hours: 2, participant_ids: ['p1', 'p2', 'p3'] })],
    })
    expect(computeInstructorEarned('ins1', data)).toBe(50)  // 25 × 2, whatever the group size
    expect(computeLessonsRevenue(booking, data)).toBe(216) // 36 × 2 × 3 → centre keeps 166
  })

  it('pays a bigger group the same as a small one', () => {
    const small = mkData({ instructors: [instructor], lessons: [mkLesson({ type: 'group', duration_hours: 2, participant_ids: ['p1'] })] })
    const big   = mkData({ instructors: [instructor], lessons: [mkLesson({ type: 'group', duration_hours: 2, participant_ids: ['p1', 'p2', 'p3', 'p4'] })] })
    expect(computeInstructorEarned('ins1', small)).toBe(computeInstructorEarned('ins1', big))
  })

  it('costs nothing when an owner teaches at a 0 payout rate', () => {
    const owner = mkInstructor({ id: 'owner', rate_private: 0, rate_group: 0, rate_supervision: 0 })
    const booking = mkBooking()
    const data = mkData({
      priceItems: mkLessonPrices(), instructors: [owner],
      lessons: [mkLesson({ instructor_id: 'owner', type: 'private', duration_hours: 2 })],
    })
    expect(computeInstructorEarned('owner', data)).toBe(0)
    expect(computeLessonsRevenue(booking, data)).toBe(120) // client still pays full price
  })

  it('earns the overridden rate when a lesson is overridden', () => {
    const data = mkData({
      instructors: [instructor],
      lessons: [mkLesson({ duration_hours: 2 })],
      lessonRateOverrides: [mkLessonOverride({ rate: 60 })],
    })
    expect(computeInstructorEarned('ins1', data)).toBe(120)
  })

  it('ignores another instructor lessons', () => {
    const data = mkData({ instructors: [instructor], lessons: [mkLesson({ instructor_id: 'ins2' })] })
    expect(computeInstructorEarned('ins1', data)).toBe(0)
  })

  it('sums debts and payments', () => {
    const data = mkData({
      instructorDebts: [mkInstructorDebt({ id: 'd1', amount: 20 }), mkInstructorDebt({ id: 'd2', amount: 15 })],
      instructorPayments: [mkInstructorPayment({ amount: 100 })],
    })
    expect(computeInstructorDebts('ins1', data)).toBe(35)
    expect(computeInstructorPaid('ins1', data)).toBe(100)
  })

  it('balances earned minus debts, meals and payments already made', () => {
    const data = mkData({
      instructors: [instructor],
      lessons: [mkLesson({ type: 'private', duration_hours: 4 })],           // 160
      instructorDebts: [mkInstructorDebt({ amount: 20 })],                    // −20
      instructorPayments: [mkInstructorPayment({ amount: 100 })],             // −100
      diningEvents: [mkDiningEvent({
        price_per_person: 12,
        attendees: [mkAttendee({ person_id: 'ins1', person_type: 'instructor' })],
      })],                                                                    // −12
    })
    expect(computeInstructorBalance('ins1', data)).toBe(28)
  })
})

// ─── 13. Booking total (all revenue sources) ──────────────────────────────────

describe('computeBookingTotal', () => {
  it('adds every revenue source of the booking', () => {
    const booking = mkBooking({ num_center_access: 2, center_access_rate: 5 })
    const { acc, roomF, rates } = mkHouseSetup(100)
    const data = mkData({
      accommodations: [acc], rooms: [roomF], roomRates: rates,
      bookingRooms: [mkBookingRoom({ room_id: 'roomF' })],
      bookingRoomPrices: [mkBookingRoomPrice({ room_id: 'roomF', price_per_night: 60 })],  // 420
      priceItems: mkLessonPrices(),
      instructors: [mkInstructor()],
      lessons: [mkLesson({ type: 'private', duration_hours: 2 })],                          // 120
      equipmentRentals: [mkRental({ price: 45 })],                                          // 45
      taxiTrips: [mkTaxiTrip({ price_eur: 120 })],                                          // 120
      bookingParticipants: [mkParticipant({ id: 'p1' })],
      diningEvents: [mkDiningEvent({ price_per_person: 12, attendees: [mkAttendee({ person_id: 'p1' })] })], // 12
      activityBookings: [mkActivityBooking({ payment_flow: 'we_pay_provider', price_client: 100 })],        // 100
    })
    expect(computeBookingTotal(booking, data)).toBe(887) // + 70 center access
  })

  it('totals 0 for a booking with nothing on it', () => {
    expect(computeBookingTotal(mkBooking(), mkData())).toBe(0)
  })

  it('still totals a cancelled booking — status filtering is the caller job', () => {
    const booking = mkBooking({ status: 'cancelled', num_center_access: 1, center_access_rate: 5 })
    expect(computeBookingTotal(booking, mkData())).toBe(35)
  })
})

// ─── 14. Season totals (accounting dashboard) ─────────────────────────────────

describe('computeSeasonTotals', () => {
  /** One booking carrying every revenue source, plus every cost line. */
  function fullSeason() {
    const { acc, roomF, rates } = mkHouseSetup(100)
    return mkData({
      accommodations: [acc], rooms: [roomF], roomRates: rates,
      bookings: [mkBooking({ num_center_access: 2, center_access_rate: 5 })],   // 7 nights
      bookingRooms: [mkBookingRoom({ room_id: 'roomF' })],
      bookingRoomPrices: [mkBookingRoomPrice({ room_id: 'roomF', price_per_night: 60 })], // 420
      priceItems: mkLessonPrices(),
      instructors: [mkInstructor()],
      lessons: [mkLesson({ type: 'private', duration_hours: 2 })],              // rev 120 / cost 80
      equipmentRentals: [mkRental({ price: 45 })],                              // 45
      taxiTrips: [mkTaxiTrip()],                                                // gross 120, margin 24
      bookingParticipants: [mkParticipant({ id: 'p1' })],
      diningEvents: [mkDiningEvent({ price_per_person: 12, attendees: [mkAttendee({ person_id: 'p1' })] })], // 12
      activityBookings: [mkActivityBooking({ payment_flow: 'we_pay_provider', price_client: 100, price_provider: 70 })],
      payments: [mkPayment({ amount: 300 })],
      expenses: [{ id: 'e1', date: '2026-11-02', category: 'fuel', amount: 50, description: 'x' }],
      houseRentals: [{ id: 'h1', accommodation_id: 'accH', start_date: '2026-11-01', end_date: '2026-11-30', total_cost: 100, notes: null }],
      palmeirasReversals: [{ id: 'pr1', month: '2026-11', gross_amount: 300, percent: 10, net_amount: 30, notes: null }],
      palmeirasRents: [{ id: 'prt1', month: '2026-11', amount: 20, notes: null }],
      palmeirasEntries: [
        { id: 'pe1', month: '2026-11', type: 'income', description: 'misc', amount: 10 },
        { id: 'pe2', month: '2026-11', type: 'expense', description: 'misc', amount: 5 },
      ],
    })
  }

  it('breaks revenue down by source', () => {
    const t = computeSeasonTotals(fullSeason())
    expect(t.accomRev).toBe(420)
    expect(t.lessonsRev).toBe(120)
    expect(t.rentalsRev).toBe(45)
    expect(t.eventsRev).toBe(12)
    expect(t.activitiesRev).toBe(100)
    expect(t.centerAccessRev).toBe(70)
  })

  it('counts taxi as the centre margin, not the gross fare', () => {
    const t = computeSeasonTotals(fullSeason())
    expect(t.taxiRevGross).toBe(120)
    expect(t.taxiMargin).toBe(24)          // 120 − (6000+1000)/73
    expect(t.taxiCosts).toBe(96)
    expect(t.totalRevenue).toBe(791)       // includes the 24, not the 120
  })

  it('bills the client the gross fare while the centre only books the margin', () => {
    const t = computeSeasonTotals(fullSeason())
    // The client owes 887, the centre counts 791 — the 96 € gap is the taxi cost,
    // already netted off, which is why it must not be subtracted again.
    expect(t.billedNet).toBe(887)
    expect(t.billedNet - t.totalRevenue).toBe(t.taxiCosts)
  })

  it('tracks what is collected and what is still due', () => {
    const t = computeSeasonTotals(fullSeason())
    expect(t.totalPaid).toBe(300)
    expect(t.totalDue).toBe(587)
    expect(t.unverifiedPaid).toBe(0)   // the fixture payment is verified
  })

  it('surfaces how much of the collected cash is still unverified', () => {
    const data = fullSeason()
    data.payments = [
      mkPayment({ id: 'p1', amount: 200, is_verified: true }),
      mkPayment({ id: 'p2', amount: 100, is_verified: false }),
    ]
    const t = computeSeasonTotals(data)
    expect(t.totalPaid).toBe(300)        // both count towards what the client owes
    expect(t.unverifiedPaid).toBe(100)   // but a third of it is not reconciled
    expect(t.totalDue).toBe(587)         // unchanged: the flag is informational
  })

  it('excludes discounts from the billed total', () => {
    const data = fullSeason()
    data.payments = [mkPayment({ amount: 300 }), mkPayment({ id: 'd1', amount: 87, is_discount: true })]
    const t = computeSeasonTotals(data)
    expect(t.billedNet).toBe(800)   // 887 − 87
    expect(t.totalPaid).toBe(300)   // the discount is not money received
    expect(t.totalDue).toBe(500)
  })

  it('lists every cost line', () => {
    const t = computeSeasonTotals(fullSeason())
    expect(t.instructorCosts).toBe(80)     // 40 × 2, payout scale
    expect(t.activityCosts).toBe(70)
    expect(t.houseRentalCosts).toBe(100)
    expect(t.totalExpenses).toBe(50)
    expect(t.palmeirasNet).toBe(15)        // 30 + 10 − 20 − 5
  })

  it('lands the net result on revenue + palmeiras − every cost', () => {
    const t = computeSeasonTotals(fullSeason())
    expect(t.netResult).toBe(506)
    expect(t.netResult).toBe(
      t.totalRevenue + t.palmeirasNet
      - t.instructorCosts - t.houseRentalCosts - t.bungalowCosts
      - t.activityCosts - t.totalExpenses
    )
  })

  it('totals zero on an empty season', () => {
    const t = computeSeasonTotals(mkData())
    expect(t.totalRevenue).toBe(0)
    expect(t.netResult).toBe(0)
    expect(t.totalDue).toBe(0)
  })

  it('drops the revenue of a cancelled booking but keeps the instructor cost', () => {
    // Deliberate asymmetry: the lesson was taught, so the instructor is owed.
    // Such a booking is a genuine loss and the result must show it.
    const data = mkData({
      bookings: [mkBooking({ status: 'cancelled' })],
      priceItems: mkLessonPrices(),
      instructors: [mkInstructor()],
      lessons: [mkLesson({ type: 'private', duration_hours: 2 })],
    })
    const t = computeSeasonTotals(data)
    expect(t.lessonsRev).toBe(0)
    expect(t.instructorCosts).toBe(80)
    expect(t.netResult).toBe(-80)
  })

  it('keeps standalone taxi trips but drops those of a cancelled booking', () => {
    const data = mkData({
      bookings: [mkBooking({ id: 'dead', status: 'cancelled' })],
      taxiTrips: [
        mkTaxiTrip({ id: 't1', booking_id: null }),      // standalone → kept
        mkTaxiTrip({ id: 't2', booking_id: 'dead' }),    // cancelled → dropped
      ],
    })
    const t = computeSeasonTotals(data)
    expect(t.taxiRevGross).toBe(120)
    expect(t.taxiMargin).toBe(24)
  })

  it('books the provider reversal as revenue when the client pays the provider', () => {
    const data = mkData({
      bookings: [mkBooking()],
      activityBookings: [mkActivityBooking({ payment_flow: 'provider_pays_us', price_client: 100, price_provider: 70 })],
    })
    const t = computeSeasonTotals(data)
    expect(t.activitiesRev).toBe(70)   // their cut comes to us
    expect(t.activityCosts).toBe(0)    // we never pay them
  })

  it('subtracts the bungalow owner cost only for live bookings', () => {
    const bung = mkAccommodation({ id: 'accBu', type: 'bungalow', total_rooms: 1, cost_per_night: 25 })
    const room = mkRoom({ id: 'roomBu', accommodation_id: 'accBu' })
    const base = {
      accommodations: [bung], rooms: [room],
      roomRates: [mkRoomRate({ room_id: 'roomBu', price_per_night: 35 })],
      bookingRooms: [mkBookingRoom({ room_id: 'roomBu' })],
    }
    const live = computeSeasonTotals(mkData({ ...base, bookings: [mkBooking()] }))
    expect(live.bungalowCosts).toBe(175)   // 25 × 7 nights
    const dead = computeSeasonTotals(mkData({ ...base, bookings: [mkBooking({ status: 'cancelled' })] }))
    expect(dead.bungalowCosts).toBe(0)
  })
})

// ─── 15. Deposit suggestion & formatting ──────────────────────────────────────

describe('suggestDeposit', () => {
  it('suggests 30% of the total', () => {
    expect(suggestDeposit(1000)).toBe(300)
  })
  it('never suggests less than 120 €', () => {
    expect(suggestDeposit(300)).toBe(120)
    expect(suggestDeposit(0)).toBe(120)
  })
  it('switches from the floor to the percentage at 400 €', () => {
    expect(suggestDeposit(400)).toBe(120)
    expect(suggestDeposit(500)).toBe(150)
  })
})

describe('formatting', () => {
  it('rounds euros to the nearest unit', () => {
    expect(norm(fmtEur(1234.6))).toBe('1 235 €')
  })
  it('formats a plain amount', () => {
    expect(norm(fmtEur(80))).toBe('80 €')
  })
  it('formats a month key as a short English month', () => {
    expect(norm(fmtMonth('2026-02'))).toBe('Feb 2026')
  })
})
