import { useCallback } from 'react'
import { useTable } from './useSupabase'
import { rateOn } from '../utils/exchangeRates'
import type { EurMznRateRow } from '../types/database'

/** The dated EUR/MZN rates (admin only: anon cannot read the table). */
export function useEurMznRates() {
  return useTable<EurMznRateRow>('eur_mzn_rates', { order: 'valid_from', ascending: false })
}

/** The rate in force on a date; `fallback` until the history has loaded. */
export function useEurMznRateFor(fallback: number): (date: string) => number {
  const { data } = useEurMznRates()
  return useCallback((date: string) => rateOn(data, date, fallback), [data, fallback])
}
