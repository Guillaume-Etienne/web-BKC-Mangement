/** Small shared bits of the enquiries pipeline.
 *  Design and decisions: .claude/docs/ENQUIRIES.md */
import type { Enquiry, EnquiryStatus } from '../types/database'

export const STATUS_META: Record<EnquiryStatus, { label: string; pill: string; dot: string }> = {
  new:     { label: 'New',        pill: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300',       dot: 'bg-blue-500' },
  talking: { label: 'Talking',    pill: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300',   dot: 'bg-amber-500' },
  waiting: { label: 'Their turn', pill: 'bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-300', dot: 'bg-violet-500' },
  won:     { label: 'Won',        pill: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300', dot: 'bg-emerald-500' },
  lost:    { label: 'Lost',       pill: 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300',          dot: 'bg-gray-400' },
}

export const STATUS_ORDER: EnquiryStatus[] = ['new', 'talking', 'waiting', 'won', 'lost']

/** Settled: a won enquiry has become a booking and leaves the working list at
 *  once (gui, 2026-08-14); a lost one has no next action either. */
export function isSettled(s: EnquiryStatus): boolean {
  return s === 'won' || s === 'lost'
}

/** Whole days since the last exchange — the "Silence" column, and the only
 *  thing that turns a list into a to-do list.
 *
 *  A plain millisecond difference is right here, unlike everywhere else in this
 *  codebase: `last_contact_at` is an instant, not a calendar day, so none of the
 *  UTC traps in utils/dates.ts apply. */
export function silenceDays(lastContactAt: string, now: Date = new Date()): number {
  const ms = now.getTime() - new Date(lastContactAt).getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}

/** Above this, the enquiry needs chasing. gui, 2026-08-14: "7 jours pour le
 *  moment, on verra à l'usage." */
export const SILENCE_WARN_DAYS = 7

export function silenceTone(days: number): string {
  if (days >= SILENCE_WARN_DAYS * 2) return 'text-red-600 dark:text-red-400 font-bold'
  if (days >= SILENCE_WARN_DAYS)     return 'text-amber-600 dark:text-amber-400 font-semibold'
  return 'text-gray-400 dark:text-gray-500'
}

/** `2027-02` → `Feb 2027`. Enquiries carry a month, never a day: at first
 *  contact people say "February", and a made-up day would read as a commitment. */
export function fmtArrivalMonth(month: string | null): string {
  if (!month) return '—'
  const [y, m] = month.split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) return month
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${names[m - 1]} ${y}`
}

/** The months the arrival band spans, from the earliest arrival on record to the
 *  latest — the same band on every row, so scanning the column shows the season
 *  filling up and the empty months between.
 *
 *  Built from the data rather than from the `seasons` table on purpose: an
 *  arrival outside the configured season would fall off a season-shaped band,
 *  and someone asking about next December is exactly who must not disappear.
 *  Capped so a stray 2035 enquiry cannot stretch it to a hundred cells. */
export function monthBand(months: (string | null)[], maxCells = 14): string[] {
  const known = months.filter((m): m is string => !!m).sort()
  if (known.length === 0) return []
  const [fy, fm] = known[0].split('-').map(Number)
  const [ly, lm] = known[known.length - 1].split('-').map(Number)
  const span = Math.min((ly - fy) * 12 + (lm - fm) + 1, maxCells)
  return Array.from({ length: span }, (_, i) => {
    const d = new Date(fy, fm - 1 + i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

export interface EnquiryGroup {
  key: string | null          // 'YYYY-MM', or null for "nobody said when"
  items: Enquiry[]
  people: number              // party sizes, for the header line
  won: number
}

/** Rows grouped by arrival month, most recent month last.
 *
 *  The undated group comes FIRST and never collapses: those are the enquiries
 *  nobody has read yet, and they are the day's work. Sorting them to the bottom
 *  with the old months would bury exactly what needs doing. */
export function groupByArrivalMonth(enquiries: Enquiry[]): EnquiryGroup[] {
  const byKey = new Map<string | null, Enquiry[]>()
  for (const e of enquiries) {
    const k = e.arrival_month ?? null
    byKey.set(k, [...(byKey.get(k) ?? []), e])
  }
  const dated = [...byKey.entries()]
    .filter(([k]) => k !== null)
    .sort((a, b) => (a[0] as string).localeCompare(b[0] as string))
  const undated = byKey.has(null) ? [[null, byKey.get(null)!] as const] : []

  return [...undated, ...dated].map(([key, items]) => ({
    key,
    items: [...items].sort((a, b) => a.last_contact_at.localeCompare(b.last_contact_at)),
    people: items.reduce((n, e) => n + (e.party_size ?? 0), 0),
    won: items.filter(e => e.status === 'won').length,
  }))
}

/** One search box over names, contact details, the message and the notes.
 *  Case- and accent-insensitive: gui types "muller", the row says "Müller". */
export function matchesSearch(e: Enquiry, notes: string[], query: string): boolean {
  const q = norm(query.trim())
  if (!q) return true
  const hay = norm([e.name, e.email, e.phone, e.message, e.source_other, ...notes].filter(Boolean).join(' '))
  return hay.includes(q)
}

function norm(s: string): string {
  // Escaped range rather than literal combining marks: those are invisible in an
  // editor and get mangled by the next tool that touches the file.
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** A fiche nobody has read yet: the message is still the only real content.
 *  These are shown differently in the list — a row of empty columns looks like
 *  a broken tool, whereas "not qualified yet" is the day's to-do. */
export function isQualified(e: Enquiry): boolean {
  return e.party_size != null || e.arrival_month != null
    || e.wants_lessons || e.wants_rental || e.wants_accommodation
}
