import { describe, it, expect } from 'vitest'
import { buildDayGrid, GROUP_ROW, type DayGrid } from './dayGrid'
import {
  mkBooking, mkParticipant, mkLesson, mkLessonPrices, mkRental, mkCharge, mkAttendee, mkDiningEvent,
  mkActivityBooking, mkInstructor, mkData,
} from './utils.fixtures'

const opts = { mealsAndActivities: false, groupName: 'Whole group' }
const row = (g: DayGrid, id: string) => g.rows.find(r => r.id === id)!
const shorts = (g: DayGrid, id: string, date: string) => (row(g, id).cells[date] ?? []).map(c => c.short)

// 01/11 → 08/11 = 7 nights.
const booking = mkBooking({ num_center_access: 1, center_access_rate: 7 })
const alice = mkParticipant({ id: 'p1', first_name: 'Alice', brings_own_gear: true })
const bob   = mkParticipant({ id: 'p2', first_name: 'Bob' })

describe('buildDayGrid', () => {
  it('lays out every day of the stay, check-out day included', () => {
    const g = buildDayGrid(booking, mkData({ bookingParticipants: [alice, bob] }), opts)
    expect(g.dates[0]).toBe('2026-11-01')
    expect(g.dates[g.dates.length - 1]).toBe('2026-11-08')
    expect(g.dates).toHaveLength(8)
  })

  it('puts center access on each night of the own-gear traveller only', () => {
    const g = buildDayGrid(booking, mkData({ bookingParticipants: [alice, bob] }), opts)
    expect(row(g, 'p1').totals.centerAccessDays).toBe(7)
    expect(row(g, 'p1').totals.amount).toBe(49)
    expect(shorts(g, 'p1', '2026-11-08')).toEqual([]) // check-out day: not a night
    expect(row(g, 'p2').totals.centerAccessDays).toBe(0)
    expect(g.warnings).toEqual([])
  })

  it('counts rental days per kind, half days as 0.5', () => {
    const data = mkData({
      bookingParticipants: [alice, bob],
      equipmentRentals: [
        mkRental({ id: 'r1', participant_id: 'p2', rental_type: 'board', date: '2026-11-02', slot: 'full_day' }),
        mkRental({ id: 'r2', participant_id: 'p2', rental_type: 'board', date: '2026-11-03', slot: 'morning' }),
        mkRental({ id: 'r3', participant_id: 'p2', rental_type: 'kite', date: '2026-11-03', slot: 'afternoon' }),
      ],
    })
    const g = buildDayGrid(booking, data, opts)
    expect(shorts(g, 'p2', '2026-11-02')).toEqual(['B'])
    expect(shorts(g, 'p2', '2026-11-03')).toEqual(['B ½', 'K ½'])
    expect(row(g, 'p2').totals.rentalDays).toEqual({ board: 1.5, kite: 0.5 })
  })

  it('sends a rental naming nobody to the whole group, and says so', () => {
    const data = mkData({
      bookingParticipants: [alice, bob],
      equipmentRentals: [mkRental({ participant_id: null, rental_type: 'board' })],
    })
    const g = buildDayGrid(booking, data, opts)
    expect(shorts(g, GROUP_ROW, '2026-11-02')).toEqual(['B'])
    expect(g.rows[g.rows.length - 1].id).toBe(GROUP_ROW)
    expect(g.warnings).toContainEqual({ kind: 'unassigned', count: 1 })
  })

  it('gives an unnamed line to the only traveller of a booking of one, without warning', () => {
    const data = mkData({
      bookingParticipants: [bob],
      equipmentRentals: [mkRental({ participant_id: null, rental_type: 'board' })],
    })
    const g = buildDayGrid(mkBooking(), data, opts)
    expect(g.rows.map(r => r.id)).toEqual(['p2'])
    expect(shorts(g, 'p2', '2026-11-02')).toEqual(['B'])
    expect(g.warnings).toEqual([])
  })

  it('flags a kite rental on a center-access day, not a board one', () => {
    const data = mkData({
      bookingParticipants: [alice, bob],
      equipmentRentals: [
        mkRental({ id: 'r1', participant_id: 'p1', rental_type: 'kite', date: '2026-11-02' }),
        mkRental({ id: 'r2', participant_id: 'p1', rental_type: 'board', date: '2026-11-03' }),
      ],
    })
    const g = buildDayGrid(booking, data, opts)
    expect(g.warnings).toEqual([{ kind: 'rental_and_center_access', rowId: 'p1', date: '2026-11-02' }])
  })

  it('warns when the billed center-access count differs from the own-gear ticks', () => {
    const data = mkData({ bookingParticipants: [alice, mkParticipant({ id: 'p2', first_name: 'Bob', brings_own_gear: true })] })
    const g = buildDayGrid(booking, data, opts) // billed 1, ticked 2
    expect(g.warnings).toContainEqual({ kind: 'center_access_count', billed: 1, flagged: 2 })
  })

  it('puts billed center access on the group row when nobody is ticked', () => {
    const data = mkData({ bookingParticipants: [mkParticipant({ id: 'p1' }), bob] })
    const g = buildDayGrid(mkBooking({ num_center_access: 2, center_access_rate: 7 }), data, opts)
    expect(shorts(g, GROUP_ROW, '2026-11-01')).toEqual(['C ×2'])
    expect(row(g, GROUP_ROW).totals.amount).toBe(98)
  })

  it('charges a group lesson per head, a private one once', () => {
    const data = mkData({
      bookingParticipants: [alice, bob],
      instructors: [mkInstructor()],
      priceItems: mkLessonPrices(),
      lessons: [
        mkLesson({ id: 'l1', type: 'group', participant_ids: ['p1', 'p2'], price_per_hour: 36 }),
        mkLesson({ id: 'l2', participant_ids: ['p2'], date: '2026-11-03', price_per_hour: 60 }),
      ],
    })
    const g = buildDayGrid(mkBooking(), data, opts)
    expect(shorts(g, 'p1', '2026-11-02')).toEqual(['L 2h'])
    expect(row(g, 'p1').totals).toMatchObject({ lessonHours: 2, amount: 72 })
    expect(row(g, 'p2').totals).toMatchObject({ lessonHours: 4, amount: 192 })
  })

  it('shows agency-covered lines at 0', () => {
    const data = mkData({
      bookingParticipants: [alice, bob],
      equipmentRentals: [mkRental({ participant_id: 'p2', rental_type: 'board', agency_billing_line_id: 'line1' })],
    })
    const chip = row(buildDayGrid(booking, data, opts), 'p2').cells['2026-11-02'][0]
    expect(chip).toMatchObject({ covered: true, amount: 0 })
  })

  it('places extras on their traveller and date', () => {
    const data = mkData({
      bookingParticipants: [alice, bob],
      bookingCharges: [
        mkCharge({ id: 'c1', label: 'Drinks at the bar', unit_price: 3, quantity: 2, participant_id: 'p2' }),
        mkCharge({ id: 'c2', label: 'Drinks', unit_price: 4, date: '2026-11-04' }), // nobody → group
      ],
    })
    const g = buildDayGrid(booking, data, opts)
    expect(shorts(g, 'p2', '2026-11-03')).toEqual(['+ Drinks at…'])
    expect(row(g, 'p2').totals.amount).toBe(6)
    expect(shorts(g, GROUP_ROW, '2026-11-04')).toEqual(['+ Drinks'])
  })

  it('reads a "center access" extra as an added day of it', () => {
    const data = mkData({
      bookingParticipants: [alice, bob],
      bookingCharges: [mkCharge({ label: 'Center Access', unit_price: 7, participant_id: 'p2' })],
    })
    const g = buildDayGrid(booking, data, opts)
    expect(shorts(g, 'p2', '2026-11-03')).toEqual(['C+'])
    expect(row(g, 'p2').totals).toMatchObject({ centerAccessDays: 1, amount: 7 })
  })

  it('adds meals and activities only behind the switch, a safari on each of its days', () => {
    const data = mkData({
      bookingParticipants: [alice, bob],
      diningEvents: [mkDiningEvent({ attendees: [mkAttendee({ person_id: 'p2' })] })],
      activityBookings: [mkActivityBooking({ participant_ids: ['p2'], date: '2026-11-04', end_date: '2026-11-05', price_client: 100 })],
    })
    expect(Object.keys(row(buildDayGrid(booking, data, opts), 'p2').cells)).toEqual([])
    const g = buildDayGrid(booking, data, { ...opts, mealsAndActivities: true })
    expect(shorts(g, 'p2', '2026-11-03')).toEqual(['🍽'])
    expect(shorts(g, 'p2', '2026-11-05')).toEqual(['🎯'])
    expect(row(g, 'p2').totals.amount).toBe(112) // 12 meal + 100 safari, charged once
  })

  it('extends the days to a line outside the stay', () => {
    const data = mkData({
      bookingParticipants: [alice, bob],
      equipmentRentals: [mkRental({ participant_id: 'p2', date: '2026-10-30' })],
    })
    const g = buildDayGrid(booking, data, opts)
    expect(g.dates[0]).toBe('2026-10-30')
    expect(g.dates).toContain('2026-10-31')
  })
})
