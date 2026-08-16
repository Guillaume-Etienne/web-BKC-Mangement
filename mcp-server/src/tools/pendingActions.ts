import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { supabase } from '../supabaseClient.js'
import type { Booking, Payment, Enquiry } from '../../../client/src/types/database.js'
import { computePendingActions } from '../../../client/src/components/pending/pendingActions.js'
import { isQualified, isSettled, silenceDays, SILENCE_WARN_DAYS } from '../../../client/src/utils/enquiries.js'
import { jsonResult, errorResult } from '../result.js'

export function registerPendingActionsTools(server: McpServer) {
  server.registerTool(
    'get_pending_actions',
    {
      title: 'Get pending actions',
      description:
        'Same "what needs attention" list as the app Home screen: urgent / this week / to ' +
        'monitor. Covers unverified payments, upcoming check-ins without confirmation or payment, ' +
        'visa deadlines, pending form submissions, unlinked taxi trips, and stale enquiries.',
      inputSchema: {},
    },
    async () => {
      const [
        { data: bookingsData, error: bErr },
        { data: paymentsData, error: pErr },
        { count: taxiTripUnlinkedCount, error: tErr },
        { count: pendingFormSubmissionsCount, error: fErr },
        { data: enquiriesData, error: eErr },
      ] = await Promise.all([
        supabase.from('bookings').select('*'),
        supabase.from('payments').select('*'),
        supabase.from('taxi_trips').select('id', { count: 'exact', head: true }).is('booking_id', null),
        supabase.from('form_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('enquiries').select('*'),
      ])
      const firstError = bErr || pErr || tErr || fErr || eErr
      if (firstError) return errorResult(`Loading pending actions data: ${firstError.message}`)

      const enquiries = (enquiriesData ?? []) as Enquiry[]
      const working = enquiries.filter(e => !isSettled(e.status))

      const actions = computePendingActions({
        bookings: (bookingsData ?? []) as Booking[],
        payments: (paymentsData ?? []) as Payment[],
        taxiTripUnlinkedCount: taxiTripUnlinkedCount ?? 0,
        pendingFormSubmissionsCount: pendingFormSubmissionsCount ?? 0,
        unqualifiedEnquiriesCount: working.filter(e => !isQualified(e)).length,
        silentEnquiriesCount: working.filter(e => silenceDays(e.last_contact_at) >= SILENCE_WARN_DAYS).length,
        crmFailedCount: working.filter(e => !!e.crm_error).length,
      })

      return jsonResult({
        urgent: actions.filter(a => a.priority === 'urgent').map(a => ({ message: a.message, bookingRef: a.bookingRef })),
        week: actions.filter(a => a.priority === 'week').map(a => ({ message: a.message, bookingRef: a.bookingRef })),
        monitor: actions.filter(a => a.priority === 'monitor').map(a => ({ message: a.message, bookingRef: a.bookingRef })),
      })
    }
  )
}
