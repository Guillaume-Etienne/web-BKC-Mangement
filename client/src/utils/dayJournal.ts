// ── Day by day (2026-11-21, decided with gui) ───────────────────────────────
//
// The guest's bill told as a diary: one card per day of the stay, and inside
// it who did what. Built from the very SplitItem list the per-person split is
// built from, so the diary cannot say anything the bill does not.
//   · it stops at TODAY (gui): later days are mostly empty — lessons are
//     entered the day before — so what is already booked after today is only
//     counted, not laid out;
//   · days with nothing on them are kept: a windless day is part of the story;
//   · an item naming nobody of this booking (a taxi, an unassigned rental) goes
//     to "the whole group" — the same reading as the split, which shares it out
//     equally;
//   · undated items (the room, center access) sit apart, as "whole stay".

import { addDaysISO } from './dates'
import { SPLIT_CATEGORY_ORDER, type SplitItem } from './perPersonSplit'

export interface JournalGroup {
  /** Travellers of this booking the lines are for, in booking order. [] = the whole group. */
  who: string[]
  items: SplitItem[]
}

export interface JournalDay {
  date: string
  groups: JournalGroup[]
  total: number
}

export interface DayJournal {
  /** Undated items: the room, center access. */
  stay: SplitItem[]
  stayTotal: number
  /** One entry per day, oldest first, empty days included. */
  days: JournalDay[]
  /** What is booked after the last day shown. */
  later: { count: number; total: number }
}

export interface PersonCount {
  participantId: string
  hours: number
  days: number
}

/** Who an item is for, read like the split does. A booking of one: always that person. */
function whoOf(item: SplitItem, people: readonly string[]): string[] {
  const named = new Set(item.beneficiaries)
  const who = people.filter(id => named.has(id))
  if (who.length === 0 || who.length === people.length) return people.length === 1 ? [...people] : []
  return who
}

export function buildDayJournal(
  items: readonly SplitItem[],
  participantIds: readonly string[],
  checkIn: string,
  checkOut: string,
  today: string,
): DayJournal {
  const people = [...new Set(participantIds)]
  const last = checkOut < today ? checkOut : today

  const stay = sortItems(items.filter(i => i.date == null))
  const dated = items.filter((i): i is SplitItem & { date: string } => i.date != null)
  const shown = dated.filter(i => i.date <= last)
  const after = dated.filter(i => i.date > last)

  // Every day from arrival to the last one shown, plus any earlier date an
  // item carries (an airport pick-up the night before arrival).
  const dates = new Set(shown.map(i => i.date))
  for (let d = checkIn; d && d <= last; d = addDaysISO(d, 1)) dates.add(d)

  const days = [...dates].sort().map(date => {
    const own = shown.filter(i => i.date === date)
    const byWho = new Map<string, JournalGroup>()
    for (const item of own) {
      const who = whoOf(item, people)
      const key = who.join('|')
      if (!byWho.has(key)) byWho.set(key, { who, items: [] })
      byWho.get(key)!.items.push(item)
    }
    const groups = [...byWho.values()]
      .map(g => ({ ...g, items: sortItems(g.items) }))
      .sort((a, b) => groupRank(a.who, people) - groupRank(b.who, people))
    return { date, groups, total: sumCents(own.map(i => i.amount)) }
  })

  return {
    stay,
    stayTotal: sumCents(stay.map(i => i.amount)),
    days,
    later: { count: after.length, total: sumCents(after.map(i => i.amount)) },
  }
}

/** Lesson hours and rental days each traveller has had up to `today`. An item
 *  for the whole group counts for nobody in particular — except in a booking of one. */
export function countPerPerson(
  items: readonly SplitItem[],
  participantIds: readonly string[],
  today: string,
): PersonCount[] {
  const people = [...new Set(participantIds)]
  const counts = new Map(people.map(id => [id, { participantId: id, hours: 0, days: 0 }]))
  for (const item of items) {
    if (item.date == null || item.date > today || (!item.hours && !item.days)) continue
    // Not whoOf: a lesson naming everybody is everybody's hours, not nobody's.
    const named = new Set(item.beneficiaries)
    const who = people.length === 1 ? people : people.filter(id => named.has(id))
    for (const id of who) {
      const c = counts.get(id)!
      c.hours += item.hours ?? 0
      c.days += item.days ?? 0
    }
  }
  return [...counts.values()].filter(c => c.hours > 0 || c.days > 0)
}

/** Single travellers first (booking order), then pairs and more, the whole group last. */
function groupRank(who: readonly string[], people: readonly string[]): number {
  if (who.length === 0) return 1e6
  if (who.length === 1) return people.indexOf(who[0])
  return 1e3 + who.length * 100 + people.indexOf(who[0])
}

function sortItems(items: readonly SplitItem[]): SplitItem[] {
  const rank = (i: SplitItem) => SPLIT_CATEGORY_ORDER.indexOf(i.category)
  return [...items].sort((a, b) => rank(a) - rank(b))
}

function sumCents(amounts: readonly number[]): number {
  return amounts.reduce((s, a) => s + Math.round(a * 100), 0) / 100
}
