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

/** What the visitor said they want, in a fixed order so the eye reads presence
 *  and absence at the same speed. */
export function wantsLabels(e: Pick<Enquiry, 'wants_lessons' | 'wants_rental' | 'wants_accommodation'>): string[] {
  const out: string[] = []
  if (e.wants_lessons) out.push('🪁 lessons')
  if (e.wants_rental) out.push('🎿 rental')
  if (e.wants_accommodation) out.push('🛏 stay')
  return out
}

/** A fiche nobody has read yet: the message is still the only real content.
 *  These are shown differently in the list — a row of empty columns looks like
 *  a broken tool, whereas "not qualified yet" is the day's to-do. */
export function isQualified(e: Enquiry): boolean {
  return e.party_size != null || e.arrival_month != null
    || e.wants_lessons || e.wants_rental || e.wants_accommodation
}
