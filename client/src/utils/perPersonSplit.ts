// ── Split per person (2026-11-15, decided with gui) ─────────────────────────
//
// A booking's bill shared out between its travellers, so that the shares add up
// to the booking total to the cent. Each screen (accounting, the guest's share
// page) prices its own items with its own data and hands them over here; this
// module only decides WHO carries each euro:
//   · an item naming one or more of the booking's travellers is theirs (equal
//     shares when several);
//   · an item naming nobody — or only people this booking does not know — is
//     shared equally by everyone (a room, a taxi: no traveller ↔ room or
//     traveller ↔ trip link exists);
//   · cents never get lost: an amount that does not divide evenly gives its
//     spare cents one by one, rotating, so nobody systematically pays them.
// Payments and discounts stay at the booking level (gui: option A) — this is
// each person's share of what was BILLED, not of what is left to pay.

export type SplitCategory =
  | 'accommodation' | 'lessons' | 'rentals' | 'taxis'
  | 'dining' | 'activities' | 'center_access' | 'extras'

/** Display order of the categories inside a person's card. */
export const SPLIT_CATEGORY_ORDER: readonly SplitCategory[] = [
  'accommodation', 'lessons', 'rentals', 'taxis', 'dining', 'activities', 'center_access', 'extras',
]

/** What the per-guest breakdown showed before 2026-11-15 — the switch's
 *  "Activities only" position. */
export const ACTIVITY_CATEGORIES: ReadonlySet<SplitCategory> =
  new Set<SplitCategory>(['lessons', 'rentals', 'dining', 'activities'])

export interface SplitItem {
  category: SplitCategory
  /** null = the whole stay (a room, center access) — listed before dated lines. */
  date: string | null
  label: string
  /** What the BOOKING is charged for this item, in €. */
  amount: number
  /** Travellers it is for. Empty, or none of them on this booking → everyone. */
  beneficiaries: readonly string[]
  gear?: string
  /** Covered by a partner agency: listed, at no charge. */
  covered?: boolean
  /** Lesson hours, for each named traveller — read by the day-by-day counter only. */
  hours?: number
  /** Rental days (half day = 0.5), for each named traveller — same. */
  days?: number
}

export interface SplitLine {
  category: SplitCategory
  date: string | null
  label: string
  /** This person's share, in €, to the cent. */
  amount: number
  /** How many people share the item: 1 = theirs alone. */
  sharedBy: number
  gear?: string
  covered?: boolean
}

export interface PersonSplit {
  participantId: string
  lines: SplitLine[]
  total: number
}

export function splitPerPerson(participantIds: readonly string[], items: readonly SplitItem[]): PersonSplit[] {
  const people = [...new Set(participantIds)]
  if (people.length === 0) return []
  const known = new Set(people)
  const linesOf = new Map<string, SplitLine[]>(people.map(id => [id, []]))
  const centsOf = new Map<string, number>(people.map(id => [id, 0]))

  let rotation = 0
  for (const item of items) {
    const named = [...new Set(item.beneficiaries)].filter(id => known.has(id))
    const who = named.length > 0 ? named : people
    const n = who.length
    const cents = Math.round(item.amount * 100)
    const base = Math.floor(cents / n)
    const spare = cents - base * n // 0 … n-1
    const getsSpare = new Set<number>()
    for (let k = 0; k < spare; k++) getsSpare.add((rotation + k) % n)
    rotation += spare

    who.forEach((id, i) => {
      const share = base + (getsSpare.has(i) ? 1 : 0)
      centsOf.set(id, (centsOf.get(id) ?? 0) + share)
      linesOf.get(id)!.push({
        category: item.category,
        date: item.date,
        label: item.label,
        amount: share / 100,
        sharedBy: n,
        ...(item.gear ? { gear: item.gear } : {}),
        ...(item.covered ? { covered: true } : {}),
      })
    })
  }

  return people.map(id => ({
    participantId: id,
    lines: sortLines(linesOf.get(id)!),
    total: (centsOf.get(id) ?? 0) / 100,
  }))
}

function sortLines(lines: SplitLine[]): SplitLine[] {
  const rank = (c: SplitCategory) => SPLIT_CATEGORY_ORDER.indexOf(c)
  return [...lines].sort((a, b) =>
    rank(a.category) - rank(b.category)
    || (a.date ?? '').localeCompare(b.date ?? '')
    || a.label.localeCompare(b.label))
}

/** The switch: "Whole stay" keeps everything; "Activities only" keeps what the
 *  old breakdown showed and drops the people left with nothing. */
export function filterSplit(splits: readonly PersonSplit[], activitiesOnly: boolean): PersonSplit[] {
  if (!activitiesOnly) return [...splits]
  return splits
    .map(s => {
      const lines = s.lines.filter(l => ACTIVITY_CATEGORIES.has(l.category))
      return { ...s, lines, total: sumCents(lines.map(l => l.amount)) }
    })
    .filter(s => s.lines.length > 0)
}

/** A person's lines grouped by category, in display order, with subtotals. */
export function groupByCategory(lines: readonly SplitLine[]): { category: SplitCategory; total: number; lines: SplitLine[] }[] {
  return SPLIT_CATEGORY_ORDER
    .map(category => {
      const own = lines.filter(l => l.category === category)
      return { category, total: sumCents(own.map(l => l.amount)), lines: own }
    })
    .filter(g => g.lines.length > 0)
}

/** Sum of the shares, to the cent. */
export function splitSum(splits: readonly PersonSplit[]): number {
  return sumCents(splits.map(s => s.total))
}

/** True when the shares do not land on the booking's own total — the screen
 *  says so instead of showing figures that don't add up. */
export function splitMismatch(splits: readonly PersonSplit[], expectedTotal: number): boolean {
  return Math.round(splitSum(splits) * 100) !== Math.round(expectedTotal * 100)
}

/** "½", "⅓"… for a shared line; '' for a line that is the person's alone. */
export function shareFraction(sharedBy: number): string {
  if (sharedBy <= 1) return ''
  return ({ 2: '½', 3: '⅓', 4: '¼', 5: '⅕', 6: '⅙', 8: '⅛' } as Record<number, string>)[sharedBy] ?? `1/${sharedBy}`
}

function sumCents(amounts: readonly number[]): number {
  return amounts.reduce((s, a) => s + Math.round(a * 100), 0) / 100
}
