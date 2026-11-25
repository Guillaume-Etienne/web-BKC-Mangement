import type { Lang } from '../../types/database'
import { i18n } from '../../data/i18n'
import { daysBetween, fmtDateShort } from '../../utils/dates'

// ── "From → until" helper of the extra form ─────────────────────────────────
// A night-priced extra (gear storage…) is typed as the day the stuff arrives and
// the day it leaves: the nights are the difference, never counted by hand. That
// counting was the classic slip (22→25 read as 4 nights instead of 3).

/** Nights between the two days; 0 when the range is empty, reversed or incomplete. */
export function extraNights(from: string, until: string): number {
  if (!from || !until) return 0
  const n = daysBetween(from, until)
  return n > 0 ? n : 0
}

/** The label the guest reads: « Gear storage · 3 nights (22/11 → 25/11) ». */
export function extraNightsLabel(label: string, from: string, until: string, lang: Lang): string {
  const n = extraNights(from, until)
  if (n === 0) return label
  const range = i18n.accounting.bf_extra_nights_range[lang]
    .replace('{count}', String(n))
    .replace('{from}', fmtDateShort(from))
    .replace('{to}', fmtDateShort(until))
  const unit = (n === 1 ? i18n.accounting.bf_extra_night_one : i18n.accounting.bf_extra_night_many)[lang]
  return `${label} · ${range.replace('{unit}', unit)}`
}
