// The EUR/MZN rate over time (eur_mzn_rates, 2026-11-01b): updating the rate must
// not change what was applied in the past, so a conversion takes the rate of ITS
// date. `eurMznRate` elsewhere is the latest one, for what is settled today.

export interface EurMznRatePoint {
  valid_from: string   // YYYY-MM-DD
  rate: number
}

/** The rate in force on a date: the latest row that had started by then. Before
 *  the first row, that first row; no history at all, the fallback. */
export function rateOn(rates: readonly EurMznRatePoint[] | null | undefined, date: string, fallback: number): number {
  let current: EurMznRatePoint | null = null
  let first: EurMznRatePoint | null = null
  for (const r of rates ?? []) {
    if (!first || r.valid_from < first.valid_from) first = r
    if (r.valid_from <= date && (!current || r.valid_from > current.valid_from)) current = r
  }
  const found = current ?? first
  return found ? Number(found.rate) : fallback
}

/** What a bungalow costs per night in euros on a date. The tariff is agreed in
 *  meticals when it is known; otherwise the amount in euros stays the reference. */
export function bungalowCostPerNight(
  acc: { cost_per_night: number | null; cost_per_night_mzn?: number | null } | null | undefined,
  date: string,
  rates: readonly EurMznRatePoint[] | null | undefined,
  fallbackRate: number,
): number {
  const mzn = Number(acc?.cost_per_night_mzn ?? 0)
  const rate = rateOn(rates, date, fallbackRate)
  if (mzn > 0 && rate > 0) return Math.round(mzn / rate * 100) / 100
  return acc?.cost_per_night ?? 0
}
