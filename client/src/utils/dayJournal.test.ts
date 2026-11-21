import { describe, it, expect } from 'vitest'
import { buildDayJournal, countPerPerson } from './dayJournal'
import type { SplitItem } from './perPersonSplit'

const item = (over: Partial<SplitItem>): SplitItem => ({
  category: 'extras', date: '2026-11-10', label: 'x', amount: 0, beneficiaries: [], ...over,
})

describe('buildDayJournal', () => {
  it('lays out every day from arrival to today, empty ones included', () => {
    const j = buildDayJournal([item({ date: '2026-11-11', amount: 10 })], ['a', 'b'], '2026-11-10', '2026-11-20', '2026-11-13')
    expect(j.days.map(d => d.date)).toEqual(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'])
    expect(j.days[0].groups).toEqual([])
    expect(j.days[1].total).toBe(10)
  })

  it('stops at check-out when the stay is over', () => {
    const j = buildDayJournal([], ['a'], '2026-11-10', '2026-11-12', '2026-11-30')
    expect(j.days.map(d => d.date)).toEqual(['2026-11-10', '2026-11-11', '2026-11-12'])
  })

  it('counts what is booked after today instead of showing it', () => {
    const j = buildDayJournal([
      item({ date: '2026-11-12', amount: 50 }),
      item({ date: '2026-11-15', amount: 120 }),
      item({ date: '2026-11-18', amount: 30 }),
    ], ['a'], '2026-11-10', '2026-11-20', '2026-11-12')
    expect(j.days.at(-1)!.date).toBe('2026-11-12')
    expect(j.later).toEqual({ count: 2, total: 150 })
  })

  it('shows nothing day by day before arrival, and counts everything as later', () => {
    const j = buildDayJournal([item({ date: '2026-12-02', amount: 60 })], ['a'], '2026-12-01', '2026-12-08', '2026-11-21')
    expect(j.days).toEqual([])
    expect(j.later.count).toBe(1)
  })

  it('keeps a day before arrival when an item carries it (pick-up the night before)', () => {
    const j = buildDayJournal([item({ date: '2026-11-09', category: 'taxis', amount: 40 })], ['a'], '2026-11-10', '2026-11-11', '2026-11-30')
    expect(j.days[0].date).toBe('2026-11-09')
  })

  it('puts undated items apart, as the whole stay', () => {
    const j = buildDayJournal([
      item({ date: null, category: 'accommodation', amount: 700 }),
      item({ date: null, category: 'center_access', amount: 49 }),
    ], ['a'], '2026-11-10', '2026-11-11', '2026-11-30')
    expect(j.stay.map(i => i.category)).toEqual(['accommodation', 'center_access'])
    expect(j.stayTotal).toBe(749)
  })

  it('groups a day by traveller: singles in booking order, then pairs, the whole group last', () => {
    const j = buildDayJournal([
      item({ label: 'group', beneficiaries: [] }),
      item({ label: 'pair', beneficiaries: ['b', 'a'] }),
      item({ label: 'b', beneficiaries: ['b'] }),
      item({ label: 'a', beneficiaries: ['a'] }),
    ], ['a', 'b', 'c'], '2026-11-10', '2026-11-10', '2026-11-30')
    expect(j.days[0].groups.map(g => g.who)).toEqual([['a'], ['b'], ['a', 'b'], []])
  })

  it('reads an item naming everybody, or only strangers, as the whole group', () => {
    const j = buildDayJournal([
      item({ label: 'all', beneficiaries: ['a', 'b'] }),
      item({ label: 'stranger', beneficiaries: ['zz'] }),
    ], ['a', 'b'], '2026-11-10', '2026-11-10', '2026-11-30')
    expect(j.days[0].groups).toHaveLength(1)
    expect(j.days[0].groups[0].who).toEqual([])
  })

  it('gives an unassigned item to the only traveller of a booking of one', () => {
    const j = buildDayJournal([item({ category: 'rentals' })], ['a'], '2026-11-10', '2026-11-10', '2026-11-30')
    expect(j.days[0].groups[0].who).toEqual(['a'])
  })

  it('sorts a group by category and totals the day to the cent', () => {
    const j = buildDayJournal([
      item({ category: 'rentals', amount: 0.1, beneficiaries: ['a'] }),
      item({ category: 'lessons', amount: 0.2, beneficiaries: ['a'] }),
    ], ['a', 'b'], '2026-11-10', '2026-11-10', '2026-11-30')
    expect(j.days[0].groups[0].items.map(i => i.category)).toEqual(['lessons', 'rentals'])
    expect(j.days[0].total).toBe(0.3)
  })
})

describe('countPerPerson', () => {
  it('adds lesson hours and rental days up to today', () => {
    const c = countPerPerson([
      item({ date: '2026-11-10', hours: 2, beneficiaries: ['a'] }),
      item({ date: '2026-11-11', hours: 1.5, beneficiaries: ['a', 'b'] }),
      item({ date: '2026-11-11', days: 0.5, beneficiaries: ['b'] }),
      item({ date: '2026-11-25', hours: 2, beneficiaries: ['a'] }),
    ], ['a', 'b', 'c'], '2026-11-21')
    expect(c).toEqual([
      { participantId: 'a', hours: 3.5, days: 0 },
      { participantId: 'b', hours: 1.5, days: 0.5 },
    ])
  })

  it('counts a lesson naming every traveller for each of them', () => {
    const c = countPerPerson([item({ hours: 2, beneficiaries: ['a', 'b'] })], ['a', 'b'], '2026-11-21')
    expect(c.map(x => x.hours)).toEqual([2, 2])
  })

  it('counts an unassigned rental for nobody — unless the booking has one traveller', () => {
    const r = item({ date: '2026-11-10', days: 1 })
    expect(countPerPerson([r], ['a', 'b'], '2026-11-21')).toEqual([])
    expect(countPerPerson([r], ['a'], '2026-11-21')).toEqual([{ participantId: 'a', hours: 0, days: 1 }])
  })
})
