// The EUR/MZN rate over time (eur_mzn_rates, 2026-11-01b): updating the rate must
// not change what was applied in the past, so a conversion takes the rate of ITS
// date. `eurMznRate` elsewhere is the latest one, for what is settled today.
import { palmeirasCostMzn } from './palmeirasTerms'

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

/** What a bungalow costs BKC per night in euros on a date. When the Palmeiras'
 *  price in meticals is known (2026-11-08), it is the reference: our cost is that
 *  price minus our share, at the rate of the date. Otherwise the amount in euros
 *  stays the reference. */
export function bungalowCostPerNight(
  acc: { cost_per_night: number | null; palmeiras_price_mzn?: number | null } | null | undefined,
  date: string,
  rates: readonly EurMznRatePoint[] | null | undefined,
  fallbackRate: number,
): number {
  const price = Number(acc?.palmeiras_price_mzn ?? 0)
  const rate = rateOn(rates, date, fallbackRate)
  if (price > 0 && rate > 0) return Math.round(palmeirasCostMzn(price) / rate * 100) / 100
  return acc?.cost_per_night ?? 0
}
