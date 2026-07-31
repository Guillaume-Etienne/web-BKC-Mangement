/** Calendar dates, in the centre's own timezone.
 *
 *  Everything the app stores as a date — a lesson, a rental, a payment, an
 *  expense — is a *calendar day*, not an instant. `YYYY-MM-DD`, no time, no
 *  zone. The trap is `new Date().toISOString().slice(0, 10)`, which converts
 *  to UTC first: in Mozambique (UTC+2) that reads back as the *previous* day
 *  for anything between midnight and 02:00, and for any Date parked at local
 *  midnight it is wrong all day long. Both cases were live in this codebase.
 *
 *  So: never `.toISOString()` on a date the user thinks of as a day. Read the
 *  local parts instead, which is what these helpers do. */

/** A calendar day, `YYYY-MM-DD`. Same shape `<input type="date">` speaks. */
export type ISODate = string

/** The local calendar day of a Date — the day a person looking at that clock
 *  would name, whatever UTC thinks. */
export function toISODate(d: Date): ISODate {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Today, locally. The default for every "when did this happen" field. */
export function todayISO(): ISODate {
  return toISODate(new Date())
}

/** The local calendar month of a Date, `YYYY-MM` — the key accounting groups by. */
export function toISOMonth(d: Date): string {
  return toISODate(d).slice(0, 7)
}

/** This month, locally. */
export function thisMonthISO(): string {
  return toISOMonth(new Date())
}

/** Parse a `YYYY-MM-DD` into a Date at *local* midnight.
 *  `new Date('2026-08-05')` alone would parse as UTC midnight and land on the
 *  4th in the Americas; the explicit time forces local. */
export function fromISODate(iso: ISODate): Date {
  return new Date(iso + 'T00:00:00')
}

/** Shift a calendar day by n days (negative to go back), staying on calendar
 *  days — so it steps correctly across months, years and DST. */
export function addDaysISO(iso: ISODate, n: number): ISODate {
  if (!iso) return ''
  const d = fromISODate(iso)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

/** Shift a Date by n days without mutating it. */
export function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

/** Whole days from `from` to `to` (negative if `to` is earlier).
 *  Both ends are read at local midnight, so the result is a count of nights,
 *  never 0.96 of one because the clocks moved. */
export function daysBetween(from: ISODate, to: ISODate): number {
  const ms = fromISODate(to).getTime() - fromISODate(from).getTime()
  return Math.round(ms / 86_400_000)
}
