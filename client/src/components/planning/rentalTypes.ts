import type { RentalType } from '../../types/database'

/** What the rental picker offers: every billable type, plus "Other" which is
 *  free by definition. There is deliberately no fallback price table here — a
 *  rate lives in Options → Pricing or nowhere, so it can never be silently
 *  different from what the screen shows. Shared by the Daily's rental form and
 *  the walk-in form. */
export type RentalKind = RentalType | 'free'

export const RENTAL_TYPES: { key: RentalKind; label: string; icon: string; sub?: string }[] = [
  { key: 'kite',      label: 'Kite',            icon: '🪂' },
  { key: 'board',     label: 'Board',           icon: '🏄' },
  { key: 'full',      label: 'Full',            icon: '🪂🏄', sub: 'Kite + Board' },
  { key: 'surfboard', label: 'Surfboard',       icon: '🌊' },
  { key: 'foilboard', label: 'Foilboard',       icon: '⬆️' },
  { key: 'free',      label: 'Other',           icon: '📦' },
]
