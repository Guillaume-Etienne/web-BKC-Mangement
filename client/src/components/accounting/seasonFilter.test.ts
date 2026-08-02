import { describe, it, expect } from 'vitest'
import { filterDataToSeason } from './seasonFilter'
import type { DateRange } from './seasonFilter'
import { computeSeasonTotals } from './utils'
import {
  mkData, mkBooking, mkBookingRoom, mkBookingRoomPrice, mkHouseSetup, mkParticipant,
  mkPayment, mkLesson, mkRental, mkTaxiTrip, mkActivityBooking, mkInstructor,
  mkInstructorPayment, mkDiningEvent, mkAttendee, mkLessonPrices,
} from './utils.fixtures'

/** The real PROD window: 15 Sep 2026 → 15 Mar 2027. */
const SEASON: DateRange = { start_date: '2026-09-15', end_date: '2027-03-15' }

describe('filterDataToSeason — bookings', () => {
  it('keeps a booking that starts inside the season', () => {
    const d = filterDataToSeason(mkData({ bookings: [mkBooking({ check_in: '2026-11-04' })] }), SEASON)
    expect(d.bookings).toHaveLength(1)
  })

  it('drops a booking that starts before the season opens', () => {
    const d = filterDataToSeason(mkData({ bookings: [mkBooking({ check_in: '2026-09-14' })] }), SEASON)
    expect(d.bookings).toHaveLength(0)
  })

  it('includes both bounds', () => {
    const d = filterDataToSeason(mkData({
      bookings: [mkBooking({ id: 'first', check_in: '2026-09-15' }), mkBooking({ id: 'last', check_in: '2027-03-15' })],
    }), SEASON)
    expect(d.bookings.map(b => b.id)).toEqual(['first', 'last'])
  })

  it('keeps a stay that straddles the end, because it started inside', () => {
    // The decision of 2026-08-02: a booking belongs wholly to the season of its
    // check-in, never split across two.
    const d = filterDataToSeason(mkData({
      bookings: [mkBooking({ check_in: '2027-03-10', check_out: '2027-03-24' })],
    }), SEASON)
    expect(d.bookings).toHaveLength(1)
  })

  it('keeps a cancelled booking whose check-in is in the season', () => {
    // computeSeasonTotals excludes it from revenue itself but still charges its
    // lessons to the instructor — that asymmetry has to survive the filter.
    const d = filterDataToSeason(mkData({
      bookings: [mkBooking({ status: 'cancelled', check_in: '2026-11-04' })],
    }), SEASON)
    expect(d.bookings).toHaveLength(1)
  })
})

describe('filterDataToSeason — what hangs off a booking', () => {
  const twoSeasons = () => mkData({
    bookings: [
      mkBooking({ id: 'in',  check_in: '2026-11-04' }),
      mkBooking({ id: 'out', check_in: '2026-06-01' }),   // previous season
    ],
    bookingParticipants: [mkParticipant({ id: 'pIn', booking_id: 'in' }), mkParticipant({ id: 'pOut', booking_id: 'out' })],
    bookingRooms:      [mkBookingRoom({ booking_id: 'in' }), mkBookingRoom({ booking_id: 'out' })],
    bookingRoomPrices: [mkBookingRoomPrice({ booking_id: 'in' }), mkBookingRoomPrice({ booking_id: 'out' })],
    payments:          [mkPayment({ id: 'payIn', booking_id: 'in' }), mkPayment({ id: 'payOut', booking_id: 'out' })],
    lessons:           [mkLesson({ id: 'lIn', booking_id: 'in' }), mkLesson({ id: 'lOut', booking_id: 'out' })],
    equipmentRentals:  [mkRental({ id: 'rIn', booking_id: 'in' }), mkRental({ id: 'rOut', booking_id: 'out' })],
  })

  it('keeps only the rows of the bookings it kept', () => {
    const d = filterDataToSeason(twoSeasons(), SEASON)
    expect(d.bookingParticipants.map(p => p.id)).toEqual(['pIn'])
    expect(d.bookingRooms).toHaveLength(1)
    expect(d.bookingRoomPrices).toHaveLength(1)
    expect(d.payments.map(p => p.id)).toEqual(['payIn'])
    expect(d.lessons.map(l => l.id)).toEqual(['lIn'])
    expect(d.equipmentRentals.map(r => r.id)).toEqual(['rIn'])
  })

  it('follows the booking even when the lesson itself falls outside the season', () => {
    // The whole point of the rule: revenue and instructor pay stay together.
    const d = filterDataToSeason(mkData({
      bookings: [mkBooking({ id: 'in', check_in: '2027-03-12' })],
      lessons:  [mkLesson({ id: 'after', booking_id: 'in', date: '2027-03-20' })],  // past the end
    }), SEASON)
    expect(d.lessons.map(l => l.id)).toEqual(['after'])
  })

  it('falls back to its own date for a lesson attached to no booking', () => {
    // Forecast creates lessons with an empty booking_id.
    const d = filterDataToSeason(mkData({
      lessons: [
        mkLesson({ id: 'inSeason',  booking_id: '', date: '2026-11-04' }),
        mkLesson({ id: 'outSeason', booking_id: '', date: '2026-06-04' }),
      ],
    }), SEASON)
    expect(d.lessons.map(l => l.id)).toEqual(['inSeason'])
  })

  it('places a standalone taxi trip and activity by their own date', () => {
    const d = filterDataToSeason(mkData({
      taxiTrips: [
        mkTaxiTrip({ id: 'tIn',  booking_id: null, date: '2026-11-04' }),
        mkTaxiTrip({ id: 'tOut', booking_id: null, date: '2026-06-04' }),
      ],
      activityBookings: [
        mkActivityBooking({ id: 'aIn',  booking_id: null, date: '2026-11-04' }),
        mkActivityBooking({ id: 'aOut', booking_id: null, date: '2026-06-04' }),
      ],
    }), SEASON)
    expect(d.taxiTrips.map(t => t.id)).toEqual(['tIn'])
    expect(d.activityBookings.map(a => a.id)).toEqual(['aIn'])
  })
})

describe('filterDataToSeason — standalone rows', () => {
  it('places expenses, meals, payroll and settlements by their own date', () => {
    const d = filterDataToSeason(mkData({
      expenses: [
        { id: 'eIn',  date: '2026-11-02', category: 'fuel', amount: 50, description: 'x' },
        { id: 'eOut', date: '2026-06-02', category: 'fuel', amount: 50, description: 'x' },
      ],
      diningEvents: [
        mkDiningEvent({ id: 'dIn',  date: '2026-11-02' }),
        mkDiningEvent({ id: 'dOut', date: '2026-06-02' }),
      ],
      instructorPayments: [
        mkInstructorPayment({ id: 'ipIn',  date: '2026-11-02' }),
        mkInstructorPayment({ id: 'ipOut', date: '2026-06-02' }),
      ],
      activityPayments: [
        { id: 'apIn',  provider_id: 'prov1', date: '2026-11-02', amount: 70, direction: 'to_provider', notes: null, created_at: '' },
        { id: 'apOut', provider_id: 'prov1', date: '2026-06-02', amount: 70, direction: 'to_provider', notes: null, created_at: '' },
      ],
    }), SEASON)
    expect(d.expenses.map(e => e.id)).toEqual(['eIn'])
    expect(d.diningEvents.map(e => e.id)).toEqual(['dIn'])
    expect(d.instructorPayments.map(p => p.id)).toEqual(['ipIn'])
    expect(d.activityPayments.map(p => p.id)).toEqual(['apIn'])
  })

  it('places Palmeiras rows by their month, opening month included', () => {
    // The season opens on 15 September; a monthly lease is not split in half.
    const d = filterDataToSeason(mkData({
      palmeirasRents: [
        { id: 'rIn',  month: '2026-09', amount: 20, notes: null },
        { id: 'rOut', month: '2026-08', amount: 20, notes: null },
      ],
      palmeirasEntries: [
        { id: 'peIn',  month: '2027-03', type: 'income', description: 'x', amount: 10 },
        { id: 'peOut', month: '2027-04', type: 'income', description: 'x', amount: 10 },
      ],
    }), SEASON)
    expect(d.palmeirasRents.map(r => r.id)).toEqual(['rIn'])
    expect(d.palmeirasEntries.map(e => e.id)).toEqual(['peIn'])
  })

  it('charges a house rental to the season it opens in', () => {
    const d = filterDataToSeason(mkData({
      houseRentals: [
        { id: 'hIn',  accommodation_id: 'accH', start_date: '2026-10-01', end_date: '2027-03-31', total_cost: 100, notes: null },
        { id: 'hOut', accommodation_id: 'accH', start_date: '2026-04-01', end_date: '2026-08-31', total_cost: 100, notes: null },
      ],
    }), SEASON)
    expect(d.houseRentals.map(r => r.id)).toEqual(['hIn'])
  })
})

describe('filterDataToSeason — reference data', () => {
  it('never drops the tables every computation looks rows up in', () => {
    // Filtering these would silently zero out prices and instructor rates.
    const full = mkData({
      ...mkHouseSetup(100),
      instructors: [mkInstructor()],
      priceItems: mkLessonPrices(),
    })
    const d = filterDataToSeason(full, SEASON)
    expect(d.rooms).toEqual(full.rooms)
    expect(d.accommodations).toEqual(full.accommodations)
    expect(d.roomRates).toEqual(full.roomRates)
    expect(d.instructors).toEqual(full.instructors)
    expect(d.priceItems).toEqual(full.priceItems)
    expect(d.eurMznRate).toBe(full.eurMznRate)
  })
})

describe('filterDataToSeason — end to end through computeSeasonTotals', () => {
  /** One booking per season, each with its own room, lesson and payment. */
  const twoSeasonsOfMoney = () => {
    const { acc, roomF, rates } = mkHouseSetup(100)
    return mkData({
      accommodations: [acc], rooms: [roomF], roomRates: rates,
      priceItems: mkLessonPrices(), instructors: [mkInstructor()],
      bookings: [
        mkBooking({ id: 'thisYear', check_in: '2026-11-04', check_out: '2026-11-14' }),  // 10 nights
        mkBooking({ id: 'lastYear', check_in: '2026-06-04', check_out: '2026-06-14' }),
      ],
      bookingRooms: [
        mkBookingRoom({ booking_id: 'thisYear', room_id: 'roomF' }),
        mkBookingRoom({ booking_id: 'lastYear', room_id: 'roomF' }),
      ],
      bookingRoomPrices: [
        mkBookingRoomPrice({ booking_id: 'thisYear', room_id: 'roomF', price_per_night: 60 }),
        mkBookingRoomPrice({ booking_id: 'lastYear', room_id: 'roomF', price_per_night: 60 }),
      ],
      bookingParticipants: [mkParticipant({ id: 'p1', booking_id: 'thisYear' })],
      diningEvents: [mkDiningEvent({ date: '2026-11-05', price_per_person: 12, attendees: [mkAttendee({ person_id: 'p1' })] })],
    })
  }

  it('counts only the season asked for', () => {
    const all = computeSeasonTotals(twoSeasonsOfMoney())
    const one = computeSeasonTotals(filterDataToSeason(twoSeasonsOfMoney(), SEASON))
    expect(all.accomRev).toBe(1200)   // both stays, 10 nights × 60 each
    expect(one.accomRev).toBe(600)    // only this season's
  })

  it('leaves the all-time figures untouched when nothing is filtered out', () => {
    // "All time" in the UI simply skips the filter, so this proves the two paths
    // agree and the feature cannot change today's headline numbers.
    const data = twoSeasonsOfMoney()
    const wideOpen: DateRange = { start_date: '2000-01-01', end_date: '2099-12-31' }
    expect(computeSeasonTotals(filterDataToSeason(data, wideOpen)))
      .toEqual(computeSeasonTotals(data))
  })

  it('splits every euro across the seasons without losing or duplicating one', () => {
    // The invariant the comparison screen rests on: two adjoining seasons that
    // together cover the whole dataset must add up to the all-time figure. A
    // booking counted in both, or in neither, breaks this immediately.
    const data = twoSeasonsOfMoney()
    const early: DateRange = { start_date: '2000-01-01', end_date: '2026-09-14' }
    const late:  DateRange = { start_date: '2026-09-15', end_date: '2099-12-31' }

    const all  = computeSeasonTotals(data)
    const a    = computeSeasonTotals(filterDataToSeason(data, early))
    const b    = computeSeasonTotals(filterDataToSeason(data, late))

    expect(a.totalRevenue + b.totalRevenue).toBeCloseTo(all.totalRevenue, 6)
    expect(a.accomRev     + b.accomRev).toBeCloseTo(all.accomRev, 6)
    expect(a.netResult    + b.netResult).toBeCloseTo(all.netResult, 6)
  })

  it('does not carry a meal from another season into this one', () => {
    const data = twoSeasonsOfMoney()
    expect(computeSeasonTotals(filterDataToSeason(data, SEASON)).eventsRev).toBe(12)
    expect(computeSeasonTotals(filterDataToSeason(data, { start_date: '2026-06-01', end_date: '2026-06-30' })).eventsRev).toBe(0)
  })
})
