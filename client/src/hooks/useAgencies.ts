import { useTable } from './useSupabase'
import type { Agency, AgencyRateItem } from '../types/database'

export function useAgencies() {
  return useTable<Agency>('agencies', { order: 'name' })
}

export function useAgencyRateItems() {
  return useTable<AgencyRateItem>('agency_rate_items')
}
