import { useTable } from './useSupabase'
import type { PriceTier } from '../types/database'

export function usePriceTiers() {
  return useTable<PriceTier>('price_tiers', { order: 'min_hours' })
}
