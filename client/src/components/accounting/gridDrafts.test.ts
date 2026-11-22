import { describe, it, expect } from 'vitest'
import { daysBetweenInclusive, newRentalDraft, newLessonDraft, rentalsForDates, chargesForDates } from './gridDrafts'
import { GROUP_ROW } from './dayGrid'
import { mkBooking, mkInstructor, mkLesson, mkCharge } from './utils.fixtures'
import type { PriceItem } from '../../types/database'

const board = { id: 'pi1', billable_type: 'rental_board_day', price: 30, category: 'rental', name: 'Board', is_active: true } as unknown as PriceItem

describe('gridDrafts', () => {
  it('lists the days of a range in order, whichever way it was dragged', () => {
    expect(daysBetweenInclusive('2026-11-03', '2026-11-01')).toEqual(['2026-11-01', '2026-11-02', '2026-11-03'])
    expect(daysBetweenInclusive('2026-11-30', '2026-12-01')).toEqual(['2026-11-30', '2026-12-01'])
  })

  it('pre-fills a full-day board at the grid price, for the row clicked', () => {
    const r = newRentalDraft(mkBooking(), 'p2', '2026-11-04', [board])
    expect(r).toMatchObject({ booking_id: 'bk1', participant_id: 'p2', date: '2026-11-04', slot: 'full_day', rental_type: 'board', price: 30, list_price: null })
    expect(newRentalDraft(mkBooking(), GROUP_ROW, '2026-11-04', []).participant_id).toBeNull()
  })

  it('pre-fills a lesson with the instructor the booking had last', () => {
    const instructors = [mkInstructor({ id: 'ins1' }), mkInstructor({ id: 'ins2' })]
    const lessons = [mkLesson({ instructor_id: 'ins1', date: '2026-11-02' }), mkLesson({ id: 'l2', instructor_id: 'ins2', date: '2026-11-03' })]
    const l = newLessonDraft(mkBooking(), 'p1', '2026-11-05', instructors, lessons)
    expect(l).toMatchObject({ instructor_id: 'ins2', participant_ids: ['p1'], date: '2026-11-05', price_per_hour: null })
    expect(newLessonDraft(mkBooking(), GROUP_ROW, '2026-11-05', instructors, []).instructor_id).toBe('ins1')
  })

  it('spreads one saved line over the range with fresh ids', () => {
    const days = ['2026-11-02', '2026-11-03', '2026-11-04']
    const rs = rentalsForDates(newRentalDraft(mkBooking(), 'p1', '2026-11-02', [board]), days)
    expect(rs.map(r => r.date)).toEqual(days)
    expect(new Set(rs.map(r => r.id)).size).toBe(3)
    const cs = chargesForDates(mkCharge({ label: 'Center access' }), days)
    expect(cs.map(c => [c.date, c.label])).toEqual(days.map(d => [d, 'Center access']))
    expect(new Set(cs.map(c => c.id)).size).toBe(3)
  })
})
