import { useTable } from './useSupabase'
import type { Agency, AgencyRateItem, AgencyBillingLine, AgencyInvoice } from '../types/database'

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

/** The invoices themselves — number, the agency's own reference, and the
 *  invoiced/paid stamps. Those stamps used to sit on each line; since
 *  2026-08-19 they live here, because one settles an invoice, not a line. */
export function useAgencyInvoices() {
  return useTable<AgencyInvoice>('agency_invoices', { order: 'invoice_number' })
}
