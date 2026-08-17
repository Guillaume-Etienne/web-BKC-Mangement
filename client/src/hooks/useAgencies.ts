import { useTable } from './useSupabase'
import type { Agency, AgencyRateItem, AgencyBillingLine } from '../types/database'

export function useAgencies() {
  return useTable<Agency>('agencies', { order: 'name' })
}

export function useAgencyRateItems() {
  return useTable<AgencyRateItem>('agency_rate_items')
}

/** Invoice lines owed by agencies rather than by guests — read by the accounting
 *  screens, which must skip the services they cover when totalling what a client
 *  owes (see isAgencyBilled). */
export function useAgencyBillingLines() {
  return useTable<AgencyBillingLine>('agency_billing_lines')
}
