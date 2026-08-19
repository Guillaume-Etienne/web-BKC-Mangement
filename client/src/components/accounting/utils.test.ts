import { describe, it, expect } from 'vitest'
import {
  countNights, getRoomNightlyRate, computeAccommodationRevenue, computeExternalAccommodationCost,
  computeLessonsRevenue, getLessonClientRate, resolveLessonRate, getInstructorRate, getConfiguredRate, computeRentalsRevenue,
  computeTaxiRevenue, computeStandaloneTaxiRevenue, computeTaxiMarginEur,
  computeActivityRevenueForBooking, computeCenterAccessRevenue,
  computeDiningForBooking, computeDiningRevenue, computeInstructorDiningCharges,
  computeBookingTotal, computeBookingPaid, computeBookingDiscounts,
  computeInstructorEarned, computeInstructorDebts, computeInstructorPaid, computeInstructorBalance,
  computeSeasonTotals, suggestDeposit, fmtEur, fmtMonth,
  clientParticipantIds, cumulativeHoursBefore, getTierRate,
  isAgencyBilled, agencyLineHoursUsed, computeAgencyTotals, reFreezeInstructorRate, buildAgencyInvoiceRows, agencyMarker,
  nextInvoiceNumber, agencyInvoiceLineLabel, buildAgencyInvoiceDoc,
} from './utils'
import {
  mkAccommodation, mkActivityBooking, mkAgency, mkAgencyLine, mkAgencyInvoice, mkAgencyRateItem, mkAttendee, mkBooking, mkBookingRoom, mkBookingRoomPrice,
  mkClient,
  mkData, mkDiningEvent, mkExternalBooking, mkHouseSetup,
  mkInstructor, mkInstructorDebt, mkInstructorPayment, mkLesson, mkLessonOverride, mkLessonPrices,
  mkParticipant, mkPayment, mkPrice, mkPriceTier, mkRental, mkRoom, mkRoomRate, mkTaxiTrip,
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

  it('bills an external stay at its flat rate, whatever its dates', () => {
    const data = mkData({
      externalAccommodationBkgs: [mkExternalBooking({ check_in: '2026-11-01', check_out: '2026-11-05' })],
    })
    // 600 for the stay — not 600 × 4 nights, and not re-divided per night either.
    expect(computeAccommodationRevenue(booking, data)).toBe(600)
  })

  it('counts an occupied external spot once, not twice', () => {
    // The booking holds a real room (so the planning shows it) AND a flat stay
    // line. The room carries an explicit 0 because the place is externally
    // billed; the money must come from the stay line alone.
    const extAcc  = mkAccommodation({ id: 'accX', name: 'San Martinho', type: 'other', external_billing: true })
    const extRoom = mkRoom({ id: 'spot1', accommodation_id: 'accX', name: 'Spot 1' })
    const data = mkData({
      accommodations: [extAcc],
      rooms: [extRoom],
      bookingRooms: [mkBookingRoom({ room_id: 'spot1' })],
      bookingRoomPrices: [mkBookingRoomPrice({ room_id: 'spot1', price_per_night: 0 })],
      externalAccommodationBkgs: [mkExternalBooking({ accommodation_id: 'accX', total_sell_price: 600 })],
    })
    expect(computeAccommodationRevenue(booking, data)).toBe(600)
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

// ─── Volume-tiered lesson pricing (2026-08-16) ─────────────────────────────────

describe('clientParticipantIds', () => {
  it('collects every booking_participants row linked to a client, across bookings', () => {
    const participants = [
      mkParticipant({ id: 'p1', booking_id: 'bk1', client_id: 'cli1' }),
      mkParticipant({ id: 'p2', booking_id: 'bk2', client_id: 'cli1' }), // returning next stay
      mkParticipant({ id: 'p3', booking_id: 'bk1', client_id: 'cli2' }), // someone else
      mkParticipant({ id: 'p4', booking_id: 'bk1', client_id: null }),  // never linked
    ]
    expect(clientParticipantIds('cli1', participants)).toEqual(new Set(['p1', 'p2']))
  })
})

describe('cumulativeHoursBefore', () => {
  const ids = new Set(['p1'])
  // Chronological: les1 (11-01, 4h) → les2 (11-02, 4h) → les3 (11-03, 4h)
  const lessons = [
    mkLesson({ id: 'les1', date: '2026-11-01', duration_hours: 4, type: 'private', participant_ids: ['p1'] }),
    mkLesson({ id: 'les2', date: '2026-11-02', duration_hours: 4, type: 'private', participant_ids: ['p1'] }),
    mkLesson({ id: 'les3', date: '2026-11-03', duration_hours: 4, type: 'private', participant_ids: ['p1'] }),
  ]
  it('sums every matching lesson when nothing is excluded (a lifetime total)', () => {
    expect(cumulativeHoursBefore(ids, 'private', lessons)).toBe(12)
  })
  it('sums only what came strictly before the excluded lesson', () => {
    expect(cumulativeHoursBefore(ids, 'private', lessons, 'les3')).toBe(8)
    expect(cumulativeHoursBefore(ids, 'private', lessons, 'les1')).toBe(0)
  })
  it('ignores lessons of a different type or a different participant', () => {
    const mixed = [
      ...lessons,
      mkLesson({ id: 'lesGroup', date: '2026-11-04', duration_hours: 10, type: 'group', participant_ids: ['p1'] }),
      mkLesson({ id: 'lesOther', date: '2026-11-04', duration_hours: 10, type: 'private', participant_ids: ['p9'] }),
    ]
    expect(cumulativeHoursBefore(ids, 'private', mixed)).toBe(12)
  })
})

describe('getTierRate', () => {
  const tiers = [
    mkPriceTier({ id: 't10', billable_type: 'lesson_private', min_hours: 10, price_per_hour: 25 }),
    mkPriceTier({ id: 't20', billable_type: 'lesson_private', min_hours: 20, price_per_hour: 20 }),
  ]
  it('returns null under the first threshold — the base price_items rate applies', () => {
    expect(getTierRate('lesson_private', 5, tiers)).toBe(null)
  })
  it('picks the highest threshold reached', () => {
    expect(getTierRate('lesson_private', 15, tiers)).toBe(25)
    expect(getTierRate('lesson_private', 25, tiers)).toBe(20)
  })
  it('is exact-boundary inclusive: reaching min_hours exactly counts', () => {
    expect(getTierRate('lesson_private', 10, tiers)).toBe(25)
  })
  it('ignores tiers configured for a different billable type', () => {
    expect(getTierRate('lesson_group', 25, tiers)).toBe(null)
  })
})

describe('getLessonClientRate / resolveLessonRate with tiers', () => {
  const priceItems = mkLessonPrices() // private=60, group=36
  const tiers = [mkPriceTier({ billable_type: 'lesson_private', min_hours: 8, price_per_hour: 25 })]
  const bookingParticipants = [mkParticipant({ id: 'p1', booking_id: 'bk1', client_id: 'cli1' })]
  // Same shape as cumulativeHoursBefore's fixture: 4h + 4h before a 3rd lesson.
  const priorLessons = [
    mkLesson({ id: 'les1', date: '2026-11-01', duration_hours: 4, type: 'private', participant_ids: ['p1'], price_per_hour: null }),
    mkLesson({ id: 'les2', date: '2026-11-02', duration_hours: 4, type: 'private', participant_ids: ['p1'], price_per_hour: null }),
  ]

  it('stays at the base rate for the lesson that crosses the threshold, not before it', () => {
    // Before les1: 0h cumulative → base rate.
    expect(getLessonClientRate(priorLessons[0], priceItems, { tiers, allLessons: priorLessons, bookingParticipants })).toBe(60)
    // Before les2: 4h cumulative, still under 8h → base rate.
    expect(getLessonClientRate(priorLessons[1], priceItems, { tiers, allLessons: priorLessons, bookingParticipants })).toBe(60)
  })
  it('gives the tiered rate to the lesson that reaches the threshold', () => {
    const les3 = mkLesson({ id: 'les3', date: '2026-11-03', duration_hours: 4, type: 'private', participant_ids: ['p1'], price_per_hour: null })
    const allLessons = [...priorLessons, les3]
    expect(getLessonClientRate(les3, priceItems, { tiers, allLessons, bookingParticipants })).toBe(25)
  })
  it('counts hours from a previous, separate booking — the lifetime rule', () => {
    const returningVisit = mkLesson({
      id: 'les_return', booking_id: 'bk2', date: '2027-01-10', duration_hours: 1,
      type: 'private', participant_ids: ['p2'], price_per_hour: null,
    })
    const bp = [
      mkParticipant({ id: 'p1', booking_id: 'bk1', client_id: 'cli1' }),
      mkParticipant({ id: 'p2', booking_id: 'bk2', client_id: 'cli1' }), // same client, new stay
    ]
    // 8h already done last time (from priorLessons + les3-equivalent) puts this
    // brand new booking's very first lesson straight into the tier.
    const les3 = mkLesson({ id: 'les3', date: '2026-11-03', duration_hours: 4, type: 'private', participant_ids: ['p1'], price_per_hour: null })
    const allLessons = [...priorLessons, les3, returningVisit]
    expect(getLessonClientRate(returningVisit, priceItems, { tiers, allLessons, bookingParticipants: bp })).toBe(25)
  })
  it('for a group lesson, keys off the FIRST participant only (decision gui)', () => {
    // p1 has 8h of history (tiered), p2 has none — the lesson still bills one
    // rate for everyone, based on p1 since they're listed first.
    const groupTiers = [mkPriceTier({ billable_type: 'lesson_group', min_hours: 8, price_per_hour: 20 })]
    const groupHistory = [
      mkLesson({ id: 'g1', date: '2026-11-01', duration_hours: 4, type: 'group', participant_ids: ['p1'] }),
      mkLesson({ id: 'g2', date: '2026-11-02', duration_hours: 4, type: 'group', participant_ids: ['p1'] }),
    ]
    const newGroupLesson = mkLesson({ id: 'g3', date: '2026-11-03', type: 'group', participant_ids: ['p1', 'p2'], price_per_hour: null })
    const allLessons = [...groupHistory, newGroupLesson]
    expect(getLessonClientRate(newGroupLesson, priceItems, { tiers: groupTiers, allLessons, bookingParticipants })).toBe(20)
  })
  it('falls back to counting just this lesson\'s own participant when nobody is linked to a Client', () => {
    // No client_id on the lead participant → still tiers on this booking's own
    // hours rather than refusing to tier at all.
    const unlinked = [mkParticipant({ id: 'pX', booking_id: 'bk9', client_id: null })]
    const history = [
      mkLesson({ id: 'h1', date: '2026-11-01', duration_hours: 4, type: 'private', participant_ids: ['pX'] }),
      mkLesson({ id: 'h2', date: '2026-11-02', duration_hours: 4, type: 'private', participant_ids: ['pX'] }),
    ]
    const next = mkLesson({ id: 'h3', date: '2026-11-03', duration_hours: 1, type: 'private', participant_ids: ['pX'], price_per_hour: null })
    const allLessons = [...history, next]
    expect(getLessonClientRate(next, priceItems, { tiers, allLessons, bookingParticipants: unlinked })).toBe(25)
  })
  it('the snapshot always wins, even with a tier context that would say otherwise', () => {
    const custom = mkLesson({ price_per_hour: 99, type: 'private', participant_ids: ['p1'] })
    expect(getLessonClientRate(custom, priceItems, { tiers, allLessons: [], bookingParticipants })).toBe(99)
  })
  it('never tiers supervision lessons', () => {
    const supervisionTiers = [mkPriceTier({ billable_type: 'lesson_private', min_hours: 0, price_per_hour: 5 })]
    const sup = mkLesson({ type: 'supervision', participant_ids: ['p1'], price_per_hour: null })
    expect(getLessonClientRate(sup, priceItems, { tiers: supervisionTiers, allLessons: [sup], bookingParticipants })).toBe(40)
  })
  it('resolveLessonRate returns null (not 0) when nothing is configured — what a new lesson should freeze', () => {
    expect(resolveLessonRate({ id: '', type: 'private', participant_ids: ['p1'], price_per_hour: null }, [])).toBe(null)
    // getLessonClientRate is the display-friendly 0 for the same input.
    expect(getLessonClientRate(mkLesson({ type: 'private', price_per_hour: null }), [])).toBe(0)
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
      - t.instructorCosts - t.houseRentalCosts - t.bungalowCosts - t.externalStayCosts
      - t.activityCosts - t.totalExpenses
    )
  })

  it('subtracts what an external place is paid, keeping only the margin', () => {
    const data = fullSeason()
    data.externalAccommodationBkgs = [mkExternalBooking({ total_cost: 210, total_sell_price: 315 })]
    const t = computeSeasonTotals(data)
    // The guest's 315 lands in accommodation revenue…
    expect(t.accomRev).toBe(735)             // 420 + 315
    expect(t.externalStayCosts).toBe(210)
    // …so only the 105 € margin may reach the bottom line. Counting the sell price
    // without the purchase price would book the hotel's own money as ours.
    expect(t.netResult).toBe(611)            // 506 + 315 − 210
  })

  it('ignores an external stay attached to a cancelled booking', () => {
    const data = fullSeason()
    data.bookings = [mkBooking({ status: 'cancelled' })]
    data.externalAccommodationBkgs = [mkExternalBooking({ total_cost: 210, total_sell_price: 315 })]
    expect(computeSeasonTotals(data).externalStayCosts).toBe(0)
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

// ─── 16. Re-freezing the payout when a lesson changes hands ───────────────────

describe('reFreezeInstructorRate', () => {
  const remi  = mkInstructor({ id: 'remi', rate_private: 18, rate_group: 20, rate_supervision: 5 })
  const owner = mkInstructor({ id: 'gui',  rate_private: 0,  rate_group: 0,  rate_supervision: 0 })
  const all = [remi, owner]

  it('re-freezes on the new instructor scale when the lesson is reassigned', () => {
    const before = mkLesson({ instructor_id: 'remi', instructor_rate: 18 })
    const after  = reFreezeInstructorRate({ ...before, instructor_id: 'gui' }, before, all)
    expect(after.instructor_rate).toBe(0)
  })

  it('re-freezes the other way too, so a real debt is not erased', () => {
    // The dangerous direction: a lesson created on an owner at 0 €/h, handed to
    // a paid instructor the day before. Keeping the 0 would owe them nothing.
    const before = mkLesson({ instructor_id: 'gui', instructor_rate: 0 })
    const after  = reFreezeInstructorRate({ ...before, instructor_id: 'remi' }, before, all)
    expect(after.instructor_rate).toBe(18)
  })

  it('follows a change of lesson type, which has its own scale', () => {
    const before = mkLesson({ instructor_id: 'remi', type: 'private', instructor_rate: 18 })
    const after  = reFreezeInstructorRate({ ...before, type: 'group' }, before, all)
    expect(after.instructor_rate).toBe(20)
  })

  it('leaves the snapshot alone when neither changed', () => {
    // Even if the instructor has been given a raise since — that is what the
    // snapshot is for. Here their scale says 18 but the lesson was frozen at 15.
    const before = mkLesson({ instructor_id: 'remi', instructor_rate: 15 })
    const after  = reFreezeInstructorRate({ ...before, notes: 'moved to 10am' }, before, all)
    expect(after.instructor_rate).toBe(15)
  })

  it('leaves an unknown instructor unresolved rather than free', () => {
    const before = mkLesson({ instructor_id: 'remi', instructor_rate: 18 })
    const after  = reFreezeInstructorRate({ ...before, instructor_id: 'ghost' }, before, all)
    expect(after.instructor_rate).toBeNull()
  })

  it('feeds through to what the instructor is owed', () => {
    const before = mkLesson({ id: 'l1', instructor_id: 'remi', duration_hours: 2, instructor_rate: 18 })
    const moved  = reFreezeInstructorRate({ ...before, instructor_id: 'gui' }, before, all)
    const data = mkData({ instructors: all, lessons: [moved], bookings: [mkBooking()] })
    expect(computeInstructorEarned('gui', data)).toBe(0)
    expect(computeInstructorEarned('remi', data)).toBe(0)
  })
})

// ─── 17. Partner-agency billing ───────────────────────────────────────────────

describe('isAgencyBilled', () => {
  it('reads a set line id as agency-billed', () => {
    expect(isAgencyBilled({ agency_billing_line_id: 'abl1' })).toBe(true)
  })
  it('reads null as billed to the client', () => {
    expect(isAgencyBilled({ agency_billing_line_id: null })).toBe(false)
  })
  it('reads a MISSING column as billed to the client', () => {
    // A row fetched before the column existed comes back without the field. The
    // dangerous direction is the other one: treating undefined as agency-billed
    // would silently drop every old lesson off the client's bill.
    expect(isAgencyBilled({})).toBe(false)
  })
})

describe('client revenue skips agency-billed rows', () => {
  const bk = mkBooking()

  it('leaves an agency-billed lesson off the client bill', () => {
    const base = { bookings: [bk], priceItems: mkLessonPrices(), bookingParticipants: [mkParticipant({ id: 'p1' })] }
    const client = mkData({ ...base, lessons: [mkLesson({ duration_hours: 2 })] })
    const agency = mkData({ ...base, lessons: [mkLesson({ duration_hours: 2, agency_billing_line_id: 'abl1' })] })
    expect(computeLessonsRevenue(bk, client)).toBe(120)
    expect(computeLessonsRevenue(bk, agency)).toBe(0)
  })

  it('leaves an agency-billed rental off the client bill', () => {
    expect(computeRentalsRevenue(bk, mkData({ equipmentRentals: [mkRental({ price: 45 })] }))).toBe(45)
    expect(computeRentalsRevenue(bk, mkData({
      equipmentRentals: [mkRental({ price: 45, agency_billing_line_id: 'abl1' })],
    }))).toBe(0)
  })

  it('leaves an agency-billed transfer off the client bill', () => {
    expect(computeTaxiRevenue(bk, mkData({ taxiTrips: [mkTaxiTrip()] }))).toBe(120)
    expect(computeTaxiRevenue(bk, mkData({
      taxiTrips: [mkTaxiTrip({ agency_billing_line_id: 'abl1' })],
    }))).toBe(0)
  })

  it('leaves a standalone agency-billed transfer off the standalone total', () => {
    expect(computeStandaloneTaxiRevenue(mkData({
      taxiTrips: [mkTaxiTrip({ booking_id: null, agency_billing_line_id: 'abl1' })],
    }))).toBe(0)
  })

  it('leaves an agency-billed room off the client bill', () => {
    const { acc, roomF, rates } = mkHouseSetup(100)
    const base = { accommodations: [acc], rooms: [roomF], roomRates: rates, bookingRooms: [mkBookingRoom({ room_id: 'roomF' })] }
    const client = mkData({ ...base, bookingRoomPrices: [mkBookingRoomPrice({ room_id: 'roomF', price_per_night: 60 })] })
    const agency = mkData({ ...base, bookingRoomPrices: [mkBookingRoomPrice({ room_id: 'roomF', price_per_night: 60, agency_billing_line_id: 'abl1' })] })
    expect(computeAccommodationRevenue(bk, client)).toBe(420)   // 60 × 7 nights
    expect(computeAccommodationRevenue(bk, agency)).toBe(0)
  })

  it('bills the client only what is left once a package is moved to the agency', () => {
    const data = mkData({
      bookings: [bk], priceItems: mkLessonPrices(), bookingParticipants: [mkParticipant({ id: 'p1' })],
      lessons: [
        mkLesson({ id: 'l1', duration_hours: 2, agency_billing_line_id: 'abl1' }),  // agency's 120
        mkLesson({ id: 'l2', duration_hours: 2, date: '2026-11-03' }),              // client's 120
      ],
      agencies: [mkAgency()],
      agencyBillingLines: [mkAgencyLine()],
    })
    expect(computeBookingTotal(bk, data)).toBe(120)
  })

  it('still counts agency-billed hours towards volume tiers', () => {
    // The guest really did those hours — who paid for them changes nothing to
    // how experienced they are, so the tier ladder must not reset.
    const ids = clientParticipantIds('cli1', [mkParticipant({ id: 'p1', client_id: 'cli1' })])
    const lessons = [
      mkLesson({ id: 'l1', duration_hours: 10, agency_billing_line_id: 'abl1' }),
      mkLesson({ id: 'l2', duration_hours: 2, date: '2026-11-05' }),
    ]
    expect(cumulativeHoursBefore(ids, 'private', lessons, 'l2')).toBe(10)
  })
})

describe('agencyLineHoursUsed', () => {
  it('sums the hours taught against one line', () => {
    const lessons = [
      mkLesson({ id: 'l1', duration_hours: 2, agency_billing_line_id: 'abl1' }),
      mkLesson({ id: 'l2', duration_hours: 3, agency_billing_line_id: 'abl1' }),
      mkLesson({ id: 'l3', duration_hours: 5, agency_billing_line_id: 'abl2' }),
      mkLesson({ id: 'l4', duration_hours: 4 }),
    ]
    expect(agencyLineHoursUsed('abl1', lessons)).toBe(5)
  })

  it('counts a group lesson once, not once per head', () => {
    // A package is hours in the water, not billed heads — unlike client revenue,
    // which multiplies a group lesson by its participants.
    const lessons = [mkLesson({ type: 'group', duration_hours: 2, participant_ids: ['p1', 'p2', 'p3'], agency_billing_line_id: 'abl1' })]
    expect(agencyLineHoursUsed('abl1', lessons)).toBe(2)
  })

  it('returns 0 for a line nothing is attached to yet', () => {
    expect(agencyLineHoursUsed('abl1', [mkLesson()])).toBe(0)
  })
})

describe('computeAgencyTotals', () => {
  it('applies each agency its own commission', () => {
    const data = mkData({
      bookings: [mkBooking()],
      agencies: [mkAgency({ id: 'ag1', commission_percent: 20 }), mkAgency({ id: 'ag2', name: 'Other', commission_percent: 10 })],
      agencyBillingLines: [
        mkAgencyLine({ id: 'abl1', agency_id: 'ag1', price: 450 }),   // −90
        mkAgencyLine({ id: 'abl2', agency_id: 'ag2', price: 200 }),   // −20
      ],
    })
    const t = computeAgencyTotals(data)
    expect(t.gross).toBe(650)
    expect(t.commission).toBe(110)
    expect(t.net).toBe(540)
  })

  it('scopes to one agency or one booking', () => {
    const data = mkData({
      bookings: [mkBooking({ id: 'bk1' }), mkBooking({ id: 'bk2' })],
      agencies: [mkAgency()],
      agencyBillingLines: [
        mkAgencyLine({ id: 'abl1', booking_id: 'bk1', price: 450 }),
        mkAgencyLine({ id: 'abl2', booking_id: 'bk2', price: 200 }),
      ],
    })
    expect(computeAgencyTotals(data, { bookingId: 'bk1' }).gross).toBe(450)
    expect(computeAgencyTotals(data, { agencyId: 'ag1' }).gross).toBe(650)
    expect(computeAgencyTotals(data, { agencyId: 'nope' }).gross).toBe(0)
  })

  it('splits paid from outstanding, both net of commission', () => {
    // The stamps are read from the INVOICE (2026-08-19), so two invoices are
    // needed to have one paid and one merely sent.
    const data = mkData({
      bookings: [mkBooking()],
      agencies: [mkAgency()],
      agencyInvoices: [
        mkAgencyInvoice({ id: 'inv1', invoice_number: '20261030', invoiced_at: '2026-10-30T10:00:00Z', paid_at: '2026-11-05T10:00:00Z' }),
        mkAgencyInvoice({ id: 'inv2', invoice_number: '20261030-2', invoiced_at: '2026-10-30T10:00:00Z' }),
      ],
      agencyBillingLines: [
        mkAgencyLine({ id: 'abl1', price: 450, agency_invoice_id: 'inv1' }),
        mkAgencyLine({ id: 'abl2', price: 200, agency_invoice_id: 'inv2' }),
      ],
    })
    const t = computeAgencyTotals(data)
    expect(t.invoiced).toBe(650)     // gross, that is what the invoice says
    expect(t.paid).toBe(360)         // 450 − 20%
    expect(t.outstanding).toBe(160)  // 200 − 20%
  })

  it('treats a line on no invoice as neither invoiced nor paid', () => {
    // The normal state between billing a service to the agency and drawing up the
    // paper — it is owed, it is outstanding, and it was never sent.
    const data = mkData({
      bookings: [mkBooking()],
      agencies: [mkAgency()],
      agencyBillingLines: [mkAgencyLine({ price: 450, agency_invoice_id: null })],
    })
    const t = computeAgencyTotals(data)
    expect(t.invoiced).toBe(0)
    expect(t.paid).toBe(0)
    expect(t.outstanding).toBe(360)
  })

  it('drops lines belonging to a cancelled booking', () => {
    const data = mkData({
      bookings: [mkBooking({ status: 'cancelled' })],
      agencies: [mkAgency()],
      agencyBillingLines: [mkAgencyLine({ price: 450 })],
    })
    expect(computeAgencyTotals(data).gross).toBe(0)
  })

  it('assumes no commission for an agency that no longer exists', () => {
    // Never invent a rate: without the agency row the safe reading is that the
    // whole invoiced amount reaches us, not that some unknown cut was taken.
    const data = mkData({ bookings: [mkBooking()], agencies: [], agencyBillingLines: [mkAgencyLine({ price: 450 })] })
    expect(computeAgencyTotals(data).net).toBe(450)
  })
})

describe('agencyMarker', () => {
  const lookup = {
    agencies: [
      mkAgency({ id: 'ag1', name: 'Fun & Fly', short_code: 'FF' }),
      mkAgency({ id: 'ag2', name: 'Decathlon', short_code: 'Decat' }),
      mkAgency({ id: 'ag3', name: 'No Code Agency', short_code: null }),
    ],
    bookings: [
      mkBooking({ id: 'bk1', agency_id: 'ag1' }),
      mkBooking({ id: 'bk2', agency_id: null }),
      mkBooking({ id: 'bk3', agency_id: 'ag3' }),
    ],
    agencyBillingLines: [mkAgencyLine({ id: 'abl1', agency_id: 'ag2' })],
  }

  it('marks a booking tagged to an agency', () => {
    expect(agencyMarker({ booking_id: 'bk1' }, lookup)).toBe('(FF)')
  })

  it('shows nothing for a direct booking', () => {
    expect(agencyMarker({ booking_id: 'bk2' }, lookup)).toBeNull()
  })

  it('lets the invoice line win over the booking tag', () => {
    // A lesson on Decathlon's package inside a Fun & Fly booking reads Decat:
    // who is actually being billed for THIS service is the stronger statement.
    expect(agencyMarker({ booking_id: 'bk1', agency_billing_line_id: 'abl1' }, lookup)).toBe('(Decat)')
  })

  it('marks a billed service even when the booking carries no tag', () => {
    expect(agencyMarker({ booking_id: 'bk2', agency_billing_line_id: 'abl1' }, lookup)).toBe('(Decat)')
  })

  it('shows nothing when the agency has no short code', () => {
    // Empty means "no badge" — never one invented from the agency name.
    expect(agencyMarker({ booking_id: 'bk3' }, lookup)).toBeNull()
  })

  it('treats a blank short code as no code', () => {
    const blank = { ...lookup, agencies: [mkAgency({ id: 'ag1', short_code: '   ' })] }
    expect(agencyMarker({ booking_id: 'bk1' }, blank)).toBeNull()
  })

  it('shows nothing for a row attached to nothing at all', () => {
    expect(agencyMarker({ booking_id: null }, lookup)).toBeNull()
    expect(agencyMarker({}, lookup)).toBeNull()
  })

  it('survives an unknown booking, line or agency', () => {
    expect(agencyMarker({ booking_id: 'gone' }, lookup)).toBeNull()
    expect(agencyMarker({ booking_id: 'bk1', agency_billing_line_id: 'gone' }, lookup)).toBe('(FF)')
  })
})

describe('buildAgencyInvoiceRows', () => {
  function setup() {
    return mkData({
      bookings: [mkBooking({ id: 'bk1', booking_number: 22, client_id: 'cli1' })],
      clients: [mkClient({ id: 'cli1', first_name: 'Loic', last_name: 'SENE' })],
      bookingParticipants: [mkParticipant({ id: 'p1', booking_id: 'bk1', first_name: 'Loic', last_name: 'SENE' })],
      agencies: [mkAgency()],
      agencyRateItems: [mkAgencyRateItem()],
      agencyBillingLines: [mkAgencyLine()],
      lessons: [
        mkLesson({ id: 'l1', duration_hours: 2, agency_billing_line_id: 'abl1' }),
        mkLesson({ id: 'l2', duration_hours: 3, agency_billing_line_id: 'abl1' }),
        mkLesson({ id: 'l3', duration_hours: 4 }),
      ],
    })
  }

  it('resolves the agency, booking, guest and rate card label', () => {
    const [row] = buildAgencyInvoiceRows(setup())
    expect(row.agencyName).toBe('Fun & Fly')
    expect(row.bookingNumber).toBe(22)
    expect(row.guestName).toBe('Loic SENE')
    expect(row.label).toBe('Pack cours Privé 10x2h')
  })

  it('counts only the hours attached to that line', () => {
    expect(buildAgencyInvoiceRows(setup())[0].hoursUsed).toBe(5)
  })

  it('splits commission and net per line', () => {
    const [row] = buildAgencyInvoiceRows(setup())
    expect(row.commission).toBe(90)   // 20 % of 450
    expect(row.net).toBe(360)
  })

  it('falls back to the booking client when no traveller is named', () => {
    const data = setup()
    data.agencyBillingLines = [mkAgencyLine({ participant_id: null })]
    expect(buildAgencyInvoiceRows(data)[0].guestName).toBe('Loic SENE')
  })

  it('falls back to the note, then a placeholder, for a custom line', () => {
    const data = setup()
    data.agencyBillingLines = [mkAgencyLine({ agency_rate_item_id: null, notes: 'Extra transfer' })]
    expect(buildAgencyInvoiceRows(data)[0].label).toBe('Extra transfer')
    data.agencyBillingLines = [mkAgencyLine({ agency_rate_item_id: null, notes: null })]
    expect(buildAgencyInvoiceRows(data)[0].label).toBe('Custom line')
  })

  it('survives a line whose booking or agency is gone', () => {
    // Every join here can come back empty on real data; the row must still
    // render rather than crash the whole accounting tab.
    const data = mkData({ agencyBillingLines: [mkAgencyLine()] })
    const [row] = buildAgencyInvoiceRows(data)
    expect(row.agencyName).toBe('(unknown agency)')
    expect(row.bookingNumber).toBeNull()
    expect(row.guestName).toBe('—')
    expect(row.commissionPercent).toBe(0)
    expect(row.net).toBe(450)
  })

  it('drops cancelled bookings, exactly like computeAgencyTotals', () => {
    const data = setup()
    data.bookings = [mkBooking({ id: 'bk1', status: 'cancelled' })]
    expect(buildAgencyInvoiceRows(data)).toHaveLength(0)
    expect(computeAgencyTotals(data).gross).toBe(0)
  })

  it('scopes to one agency', () => {
    const data = setup()
    data.agencies = [mkAgency({ id: 'ag1' }), mkAgency({ id: 'ag2', name: 'Other' })]
    data.agencyBillingLines = [mkAgencyLine({ id: 'a', agency_id: 'ag1' }), mkAgencyLine({ id: 'b', agency_id: 'ag2' })]
    expect(buildAgencyInvoiceRows(data, { agencyId: 'ag2' }).map(r => r.agencyName)).toEqual(['Other'])
  })

  it('adds up to the same totals the KPIs show', () => {
    // The table and the figures above it are computed separately; this is what
    // stops them from drifting apart.
    const data = setup()
    data.agencyBillingLines = [mkAgencyLine({ id: 'a', price: 450 }), mkAgencyLine({ id: 'b', price: 220 })]
    const rows = buildAgencyInvoiceRows(data)
    const totals = computeAgencyTotals(data)
    expect(rows.reduce((s, r) => s + r.line.price, 0)).toBe(totals.gross)
    expect(rows.reduce((s, r) => s + r.commission, 0)).toBe(totals.commission)
    expect(rows.reduce((s, r) => s + r.net, 0)).toBe(totals.net)
  })
})

describe('computeSeasonTotals with agency billing', () => {
  /** The same booking twice: once billed to the guest, once to Fun & Fly. */
  function pair() {
    const shared = {
      bookings: [mkBooking()],
      priceItems: mkLessonPrices(),
      bookingParticipants: [mkParticipant({ id: 'p1' })],
      instructors: [mkInstructor()],
    }
    const toClient = mkData({ ...shared, lessons: [mkLesson({ duration_hours: 10 })] })   // 10 × 60 = 600
    const toAgency = mkData({
      ...shared,
      lessons: [mkLesson({ duration_hours: 10, agency_billing_line_id: 'abl1' })],
      agencies: [mkAgency()],                                     // 20 %
      agencyBillingLines: [mkAgencyLine({ price: 450 })],          // net 360
    })
    return { toClient, toAgency }
  }

  it('moves the money from client revenue to agency revenue, without losing it', () => {
    const { toClient, toAgency } = pair()
    const c = computeSeasonTotals(toClient)
    const a = computeSeasonTotals(toAgency)
    expect(c.lessonsRev).toBe(600)
    expect(a.lessonsRev).toBe(0)          // the client owes nothing for it
    expect(a.agencyGross).toBe(450)
    expect(a.agencyCommission).toBe(90)
    expect(a.agencyRev).toBe(360)         // what actually reaches us
    expect(a.totalRevenue).toBe(360)      // counted once, at the agency's price
  })

  it('keeps the instructor cost when the client is not the one paying', () => {
    const { toClient, toAgency } = pair()
    expect(computeSeasonTotals(toAgency).instructorCosts)
      .toBe(computeSeasonTotals(toClient).instructorCosts)
  })

  it('stops asking the client for money billed to the agency', () => {
    const { toAgency } = pair()
    const t = computeSeasonTotals(toAgency)
    expect(t.billedNet).toBe(0)
    expect(t.totalDue).toBe(0)
    expect(t.agencyOutstanding).toBe(360)   // owed by the agency instead
  })

  it('bills an agency transfer once, and still pays the driver', () => {
    const data = mkData({
      bookings: [mkBooking()],
      taxiTrips: [mkTaxiTrip({ agency_billing_line_id: 'abl1' })],   // 120 € client price, 96 € cost
      agencies: [mkAgency()],
      agencyBillingLines: [mkAgencyLine({ price: 220, unit_hours: null, agency_rate_item_id: 'ari2' })],
    })
    const t = computeSeasonTotals(data)
    expect(t.taxiRevGross).toBe(0)      // the 120 € client fare is not charged
    expect(t.taxiCosts).toBe(96)        // the driver is paid either way
    expect(t.taxiMargin).toBe(-96)      // the ride alone is a loss…
    expect(t.agencyRev).toBe(176)       // …covered by the agency line, 220 − 20%
    expect(t.totalRevenue).toBe(80)     // 176 − 96
  })

  it('keeps every revenue line adding up to totalRevenue', () => {
    // Caught for real on TEST 2026-08-17: the dashboard showed 4 022 € on top of
    // lines summing to 3 662 €, because the agency share had no row of its own.
    // A total that its own breakdown cannot explain is how people stop trusting
    // the figures, so the identity is locked here rather than in the component.
    const { toAgency } = pair()
    const t = computeSeasonTotals(toAgency)
    const lines = t.accomRev + t.lessonsRev + t.rentalsRev + t.taxiMargin
      + t.activitiesRev + t.eventsRev + t.centerAccessRev + t.agencyRev
    expect(lines).toBe(t.totalRevenue)
  })

  it('leaves every figure untouched when no agency is involved', () => {
    // The regression guard for the whole phase: on today's data — no agency
    // line anywhere — the dashboard must read exactly as before.
    const { toClient } = pair()
    const t = computeSeasonTotals(toClient)
    expect(t.agencyGross).toBe(0)
    expect(t.agencyRev).toBe(0)
    expect(t.totalRevenue).toBe(600)
    expect(t.billedNet).toBe(600)
  })
})

// ── The invoice document (2026-08-19) ────────────────────────────────────────
// Shaped after the real Fun & Fly template. This is what leaves the building with
// money on it, so the labels and the totals are pinned here.
describe('nextInvoiceNumber', () => {
  it('is the issue date as YYYYMMDD, like gui template', () => {
    expect(nextInvoiceNumber('2025-10-29', [])).toBe('20251029')
  })

  it('suffixes a second invoice issued the same day instead of colliding', () => {
    // `invoice_number` is UNIQUE in the database: a collision is a failed insert.
    expect(nextInvoiceNumber('2025-10-29', ['20251029'])).toBe('20251029-2')
    expect(nextInvoiceNumber('2025-10-29', ['20251029', '20251029-2'])).toBe('20251029-3')
  })

  it('ignores numbers from other days', () => {
    expect(nextInvoiceNumber('2025-10-29', ['20251028', '20251030'])).toBe('20251029')
  })
})

describe('agencyInvoiceLineLabel', () => {
  const rateItems = [mkAgencyRateItem({ id: 'ari1', label: 'Pack cours Privé 10x 2h' })]

  it('names an attached transfer in the template French, with its date', () => {
    const line = mkAgencyLine({ id: 'abl1', agency_rate_item_id: null })
    const data = { taxiTrips: [mkTaxiTrip({ date: '2025-10-18', type: 'aero-to-center' as const, agency_billing_line_id: 'abl1' })], agencyRateItems: rateItems }
    expect(agencyInvoiceLineLabel(line, data)).toBe('Transferts aller Maputo - Bilene le 18/10/2025')
  })

  it('says "retour" for the way back', () => {
    const line = mkAgencyLine({ id: 'abl1', agency_rate_item_id: null })
    const data = { taxiTrips: [mkTaxiTrip({ date: '2025-10-28', type: 'center-to-aero' as const, agency_billing_line_id: 'abl1' })], agencyRateItems: rateItems }
    expect(agencyInvoiceLineLabel(line, data)).toBe('Transferts retour Bilene - Maputo le 28/10/2025')
  })

  it('prefers the line note over the rate card, since the note exists for that', () => {
    const line = mkAgencyLine({ notes: 'Pack cours Privé 10x 2h — Loic' })
    expect(agencyInvoiceLineLabel(line, { taxiTrips: [], agencyRateItems: rateItems }))
      .toBe('Pack cours Privé 10x 2h — Loic')
  })

  it('falls back to the rate card label', () => {
    const line = mkAgencyLine({ notes: null })
    expect(agencyInvoiceLineLabel(line, { taxiTrips: [], agencyRateItems: rateItems }))
      .toBe('Pack cours Privé 10x 2h')
  })

  it('never invents a label when nothing names the line', () => {
    const line = mkAgencyLine({ agency_rate_item_id: null, notes: null })
    expect(agencyInvoiceLineLabel(line, { taxiTrips: [], agencyRateItems: [] })).toBe('Prestation')
  })
})

describe('buildAgencyInvoiceDoc', () => {
  /** The real #022 invoice: a 450 € package plus two 220 € transfers, 20 %. */
  const realCase = () => mkData({
    agencies: [mkAgency({ id: 'ag1', name: 'Fun & Fly', commission_percent: 20, short_code: 'FF' })],
    bookings: [mkBooking({ id: 'bk1', booking_number: 22, client_id: 'cl1' })],
    clients: [mkClient({ id: 'cl1', first_name: 'Loic', last_name: 'SENE' })],
    agencyRateItems: [
      mkAgencyRateItem({ id: 'ari1', label: 'Pack cours Privé 10h', price: 450, unit_hours: 10 }),
      mkAgencyRateItem({ id: 'ari2', label: 'Transfert Maputo ↔ Bilene', price: 220, unit_hours: null }),
    ],
    agencyInvoices: [mkAgencyInvoice({ id: 'inv1', invoice_number: '20260819', agency_ref: '134606', issued_on: '2026-08-19' })],
    agencyBillingLines: [
      mkAgencyLine({ id: 'abl1', agency_rate_item_id: 'ari1', price: 450, agency_invoice_id: 'inv1' }),
      mkAgencyLine({ id: 'abl2', agency_rate_item_id: 'ari2', price: 220, unit_hours: null, agency_invoice_id: 'inv1' }),
      mkAgencyLine({ id: 'abl3', agency_rate_item_id: 'ari2', price: 220, unit_hours: null, agency_invoice_id: 'inv1' }),
    ],
    taxiTrips: [
      mkTaxiTrip({ id: 't1', date: '2026-10-19', type: 'aero-to-center', agency_billing_line_id: 'abl2' }),
      mkTaxiTrip({ id: 't2', date: '2026-10-28', type: 'center-to-aero', agency_billing_line_id: 'abl3' }),
    ],
  })

  it('totals gross, commission and net exactly as the template does', () => {
    const doc = buildAgencyInvoiceDoc('inv1', realCase())!
    expect(doc.gross).toBe(890)
    expect(doc.commission).toBe(178)
    expect(doc.net).toBe(712)          // "Total à payer"
    expect(doc.commissionPercent).toBe(20)
  })

  it('agrees with computeAgencyTotals — the KPIs and the paper must not diverge', () => {
    const data = realCase()
    const doc = buildAgencyInvoiceDoc('inv1', data)!
    const totals = computeAgencyTotals(data, { bookingId: 'bk1' })
    expect(doc.gross).toBe(totals.gross)
    expect(doc.net).toBe(totals.net)
  })

  it('labels each line the way the agency reads it', () => {
    const doc = buildAgencyInvoiceDoc('inv1', realCase())!
    expect(doc.lines.map(l => l.label)).toEqual([
      'Pack cours Privé 10h',
      'Transferts aller Maputo - Bilene le 19/10/2026',
      'Transferts retour Bilene - Maputo le 28/10/2026',
    ])
  })

  it('carries the number, the agency ref and the guest', () => {
    const doc = buildAgencyInvoiceDoc('inv1', realCase())!
    expect(doc.invoice.invoice_number).toBe('20260819')
    expect(doc.invoice.agency_ref).toBe('134606')
    expect(doc.bookingNumber).toBe(22)
    expect(doc.guestName).toBe('Loic SENE')
  })

  it('leaves out the lines of another invoice', () => {
    const data = realCase()
    data.agencyBillingLines[2] = { ...data.agencyBillingLines[2], agency_invoice_id: 'other' }
    const doc = buildAgencyInvoiceDoc('inv1', data)!
    expect(doc.lines).toHaveLength(2)
    expect(doc.gross).toBe(670)
  })

  it('returns null on an invoice with no line — better no paper than an empty one', () => {
    const data = realCase()
    data.agencyBillingLines = []
    expect(buildAgencyInvoiceDoc('inv1', data)).toBeNull()
  })

  it('returns null on an unknown invoice instead of throwing', () => {
    expect(buildAgencyInvoiceDoc('nope', realCase())).toBeNull()
  })

  it('survives a deleted booking and a nameless client', () => {
    // Real data breaks joins: the panel must not crash on the way to the printer.
    const data = realCase()
    data.bookings = []
    data.clients = []
    const doc = buildAgencyInvoiceDoc('inv1', data)!
    expect(doc.bookingNumber).toBeNull()
    expect(doc.guestName).toBe('—')
    expect(doc.gross).toBe(890)
  })
})
