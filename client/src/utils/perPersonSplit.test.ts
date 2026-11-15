import { describe, it, expect } from 'vitest'
import {
  splitPerPerson, filterSplit, groupByCategory, splitSum, splitMismatch, shareFraction,
  type SplitItem,
} from './perPersonSplit'

const item = (over: Partial<SplitItem>): SplitItem => ({
  category: 'extras', date: '2026-11-10', label: 'x', amount: 0, beneficiaries: [], ...over,
})
const totalOf = (splits: ReturnType<typeof splitPerPerson>, id: string) =>
  splits.find(s => s.participantId === id)!.total

describe('splitPerPerson', () => {
  it('gives a named item to that person alone', () => {
    const s = splitPerPerson(['a', 'b'], [item({ amount: 300, beneficiaries: ['b'] })])
    expect(totalOf(s, 'a')).toBe(0)
    expect(totalOf(s, 'b')).toBe(300)
    expect(s.find(x => x.participantId === 'b')!.lines[0].sharedBy).toBe(1)
  })

  it('shares an item naming nobody equally, to the cent', () => {
    const s = splitPerPerson(['a', 'b', 'c'], [item({ amount: 100 })])
    expect(s.map(x => x.total).sort()).toEqual([33.33, 33.33, 33.34])
    expect(splitSum(s)).toBe(100)
    expect(s[0].lines[0].sharedBy).toBe(3)
  })

  it('treats people the booking does not know as "nobody named"', () => {
    const s = splitPerPerson(['a', 'b'], [item({ amount: 80, beneficiaries: ['stranger'] })])
    expect(totalOf(s, 'a')).toBe(40)
    expect(totalOf(s, 'b')).toBe(40)
  })

  it('splits between the named people only, ignoring duplicates', () => {
    const s = splitPerPerson(['a', 'b', 'c'], [item({ amount: 90, beneficiaries: ['a', 'c', 'a'] })])
    expect(totalOf(s, 'a')).toBe(45)
    expect(totalOf(s, 'b')).toBe(0)
    expect(totalOf(s, 'c')).toBe(45)
  })

  it('rotates the spare cents so nobody always pays them', () => {
    const items = [item({ amount: 0.01 }), item({ amount: 0.01 }), item({ amount: 0.01 })]
    const s = splitPerPerson(['a', 'b', 'c'], items)
    expect(s.map(x => x.total)).toEqual([0.01, 0.01, 0.01])
  })

  it('never loses a cent, whatever the amounts (sum invariant)', () => {
    let seed = 7
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    const people = ['a', 'b', 'c', 'd', 'e']
    for (let round = 0; round < 50; round++) {
      const items = Array.from({ length: 12 }, () => item({
        amount: Math.round(rnd() * 50000) / 100,
        beneficiaries: people.filter(() => rnd() < 0.3),
      }))
      const expected = items.reduce((s, i) => s + Math.round(i.amount * 100), 0) / 100
      const s = splitPerPerson(people, items)
      expect(splitSum(s)).toBe(expected)
      expect(splitMismatch(s, expected)).toBe(false)
    }
  })

  it('returns nothing when the booking has no travellers', () => {
    expect(splitPerPerson([], [item({ amount: 50 })])).toEqual([])
  })

  it('sorts lines by category, whole-stay lines first, then date', () => {
    const s = splitPerPerson(['a'], [
      item({ category: 'extras', date: '2026-11-02', label: 'z' }),
      item({ category: 'lessons', date: '2026-11-05', label: 'l2' }),
      item({ category: 'lessons', date: '2026-11-03', label: 'l1' }),
      item({ category: 'accommodation', date: null, label: 'room' }),
    ])
    expect(s[0].lines.map(l => l.label)).toEqual(['room', 'l1', 'l2', 'z'])
  })

  it('keeps an agency-covered line at no charge, flagged', () => {
    const s = splitPerPerson(['a'], [item({ category: 'lessons', amount: 0, beneficiaries: ['a'], covered: true })])
    expect(s[0].lines[0]).toMatchObject({ amount: 0, covered: true })
  })
})

describe('#056, PROD 15/11 — two travellers, the board is the 2nd one\'s (gui)', () => {
  const T = 'p1', J = 'p2'
  const items: SplitItem[] = [
    item({ category: 'accommodation', date: null, label: 'H 10/B × 7N', amount: 280 }),
    item({ category: 'lessons', date: '2026-11-09', label: 'group 2h', amount: 90, beneficiaries: [T] }),
    item({ category: 'lessons', date: '2026-11-09', label: 'group 2h', amount: 90, beneficiaries: [J] }),
    item({ category: 'lessons', date: '2026-11-12', label: 'private 2h', amount: 120, beneficiaries: [T] }),
    item({ category: 'lessons', date: '2026-11-12', label: 'private 2h', amount: 120, beneficiaries: [J] }),
    item({ category: 'lessons', date: '2026-11-13', label: 'private 2h', amount: 110, beneficiaries: [T] }),
    item({ category: 'lessons', date: '2026-11-14', label: 'private 2h', amount: 110, beneficiaries: [T] }),
    item({ category: 'lessons', date: '2026-11-14', label: 'private 1h', amount: 55, beneficiaries: [T] }),
    item({ category: 'rentals', date: '2026-11-13', label: 'Full', amount: 55, beneficiaries: [J] }),
    item({ category: 'rentals', date: '2026-11-14', label: 'Full', amount: 55, beneficiaries: [J] }),
    item({ category: 'dining', date: '2026-11-13', label: 'Braai', amount: 12, beneficiaries: [T] }),
    item({ category: 'dining', date: '2026-11-13', label: 'Braai', amount: 12, beneficiaries: [J] }),
    item({ category: 'extras', date: '2026-11-09', label: 'Airport transfer – 2 seats', amount: 80 }),
    item({ category: 'extras', date: '2026-11-15', label: 'Board Crazy Fly', amount: 300, beneficiaries: [J] }),
  ]
  const s = splitPerPerson([T, J], items)

  it('lands on the figures worked out by hand: 677 + 812 = 1 489', () => {
    expect(totalOf(s, T)).toBe(677)
    expect(totalOf(s, J)).toBe(812)
    expect(splitMismatch(s, 1489)).toBe(false)
  })

  it('groups a card into categories with subtotals', () => {
    const groups = groupByCategory(s.find(x => x.participantId === J)!.lines)
    expect(groups.map(g => [g.category, g.total])).toEqual([
      ['accommodation', 140], ['lessons', 210], ['rentals', 110], ['dining', 12], ['extras', 340],
    ])
  })

  it('"Activities only" shows what the old breakdown showed', () => {
    const only = filterSplit(s, true)
    expect(only.map(x => x.total)).toEqual([497, 332]) // lessons + rentals + dining
    expect(only.flatMap(x => x.lines).every(l => ['lessons', 'rentals', 'dining', 'activities'].includes(l.category))).toBe(true)
  })

  it('"Activities only" drops a person left with nothing', () => {
    const only = filterSplit(splitPerPerson(['x', 'y'], [item({ category: 'lessons', amount: 10, beneficiaries: ['x'] }), item({ amount: 50 })]), true)
    expect(only.map(x => x.participantId)).toEqual(['x'])
  })
})

describe('shareFraction', () => {
  it('reads as a fraction for shared lines only', () => {
    expect(shareFraction(1)).toBe('')
    expect(shareFraction(2)).toBe('½')
    expect(shareFraction(3)).toBe('⅓')
    expect(shareFraction(7)).toBe('1/7')
  })
})
