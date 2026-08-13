/** Which stretch of days the planning grid draws.
 *
 *  A "season" was defined in three different places in this app: the accounting
 *  screens read the `seasons` table, `filterDataToSeason` slices data with it,
 *  and the planning grid carried its own hardcoded September 1 → March 31. Same
 *  word, three answers — so the planning could show a booking that accounting
 *  had already put in another season, and nobody could tell which was right.
 *  The table wins: it is the one a human can edit (Options → Seasons).
 *
 *  The fallback matters as much as the rule. Until gui enters his real dates the
 *  table is empty, and a planning that renders nothing is worse than one built
 *  on a guess — so with no rows we keep exactly the previous behaviour, year
 *  offsets included. That is why `configured` is part of the returned shape:
 *  the caller shows the season's own label when there is one, and the derived
 *  `2026/27` when there is not. */
import type { Season } from '../types/database'
import { fromISODate, toISODate } from './dates'

export interface SeasonWindow {
  /** What the selector shows: the season's own label, or a derived `2026/27`. */
  label: string
  /** Same, abbreviated for the mobile selector. */
  shortLabel: string
  start: Date
  end: Date
  /** true when this window comes from the `seasons` table. */
  configured: boolean
}

/** September of the kitesurf season containing `today` — the legacy rule, kept
 *  only for the no-seasons-configured fallback. April→August belongs to no
 *  season, and there we show the one about to start. */
export function legacySeasonYear(today: Date): number {
  const m = today.getMonth()
  const y = today.getFullYear()
  if (m >= 8) return y       // Sep–Dec: season starts this year
  if (m <= 3) return y - 1   // Jan–Mar: season started last Sep
  return y                   // Apr–Aug: show the upcoming season
}

/** The season to open on: the one containing today, else the next one to start,
 *  else the last one on record.
 *
 *  The middle branch is the one that matters here. A season runs September to
 *  mid-March, so from April to August today sits in a gap that belongs to no
 *  season at all — and in that gap the useful view is the season being filled,
 *  not the one that just ended. */
export function currentSeasonIndex(seasons: Season[], today: Date): number {
  if (seasons.length === 0) return 0
  const iso = toISODate(today)
  const inside = seasons.findIndex(s => iso >= s.start_date && iso <= s.end_date)
  if (inside >= 0) return inside
  const upcoming = seasons.findIndex(s => s.start_date > iso)
  return upcoming >= 0 ? upcoming : seasons.length - 1
}

/** `"2026-2027"` → `"26/27"` for the cramped mobile selector. A label that isn't
 *  two years — gui is free to type anything — is left alone rather than mangled. */
function shortSeasonLabel(label: string): string {
  const years = label.match(/\d{4}/g)
  return years && years.length >= 2 ? `${years[0].slice(2)}/${years[1].slice(2)}` : label
}

/** The window to draw, `offset` seasons away from the current one.
 *
 *  Configured: the offset walks the table and stops at both ends — there is no
 *  season before the first one, and inventing one would draw an empty grid.
 *  Not configured: the offset is a year delta, so the arrows keep browsing any
 *  year exactly as they did before the table existed. */
export function seasonWindowAt(seasons: Season[], today: Date, offset: number): SeasonWindow {
  if (seasons.length > 0) {
    const i = Math.min(seasons.length - 1, Math.max(0, currentSeasonIndex(seasons, today) + offset))
    const s = seasons[i]
    return {
      label: s.label,
      shortLabel: shortSeasonLabel(s.label),
      start: fromISODate(s.start_date),
      end: fromISODate(s.end_date),
      configured: true,
    }
  }
  const y = legacySeasonYear(today) + offset
  return {
    label: `${y}/${String(y + 1).slice(2)}`,
    shortLabel: `${String(y).slice(2)}/${String(y + 1).slice(2)}`,
    start: new Date(y, 8, 1),
    end: new Date(y + 1, 2, 31),
    configured: false,
  }
}

/** How far the arrows may still go, so they can be greyed out at the ends.
 *  Unbounded without a table: the legacy year offset has no last year. */
export function seasonOffsetBounds(seasons: Season[], today: Date): { min: number; max: number } {
  if (seasons.length === 0) return { min: -Infinity, max: Infinity }
  const i = currentSeasonIndex(seasons, today)
  // `-i` yields -0 when i is 0: it compares equal to 0 everywhere it is used,
  // but prints oddly and fails strict deep-equality. Not worth the puzzle.
  return { min: i === 0 ? 0 : -i, max: seasons.length - 1 - i }
}

/** The month columns of the grid header, clipped to the window.
 *
 *  The hardcoded season started on the 1st and ended on a month's last day, so
 *  whole months were safe. A season typed by a human ends "mid-March": counting
 *  March as 31 days would push every booking bar a fortnight to the left of its
 *  header. First and last months are therefore counted from the real bounds. */
export function monthColumns(start: Date, end: Date, monthNames: string[], monthShort: string[]) {
  const groups: { label: string; shortLabel: string; days: number; colStart: number }[] = []
  let col = 0
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  while (cursor <= end) {
    const y = cursor.getFullYear()
    const m = cursor.getMonth()
    const isFirst = y === start.getFullYear() && m === start.getMonth()
    const isLast  = y === end.getFullYear()   && m === end.getMonth()
    const from = isFirst ? start.getDate() : 1
    const to   = isLast  ? end.getDate()   : new Date(y, m + 1, 0).getDate()
    groups.push({ label: `${monthNames[m]} ${y}`, shortLabel: monthShort[m], days: to - from + 1, colStart: col })
    col += to - from + 1
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return groups
}
