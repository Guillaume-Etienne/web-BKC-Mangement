import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { supabase } from '../supabaseClient.js'
import type { Booking, Payment, Enquiry } from '../../../client/src/types/database.js'
import { computePendingActions } from '../../../client/src/components/pending/pendingActions.js'
import { isQualified, isSettled, silenceDays, SILENCE_WARN_DAYS } from '../../../client/src/utils/enquiries.js'
import { computeFollowUps } from '../../../client/src/utils/followUps.js'
import type { EmailLog } from '../../../client/src/types/database.js'
import { jsonResult, errorResult } from '../result.js'

export function registerPendingActionsTools(server: McpServer) {
  server.registerTool(
    'get_pending_actions',
    {
      title: 'Get pending actions',
      description:
        'Same "what needs attention" list as the app Home screen: urgent / this week / to ' +
        'monitor. Covers unverified payments, upcoming check-ins without confirmation or payment, ' +
        'visa deadlines, pending form submissions, unlinked taxi trips, and stale enquiries. ' +
        'Also returns `waiting_on_you`: the people nobody has spoken to in a while — open ' +
        'enquiries AND bookings still provisional — with what each of them wants and how many ' +
        'days of silence. That second list is about silence, not deadlines: it catches the file ' +
        'that went quiet, which no deadline rule ever notices.',
      inputSchema: {},
    },
    async () => {
      const [
        { data: bookingsData, error: bErr },
        { data: paymentsData, error: pErr },
        { count: taxiTripUnlinkedCount, error: tErr },
        { count: pendingFormSubmissionsCount, error: fErr },
        { data: enquiriesData, error: eErr },
        { data: emailLogsData },
      ] = await Promise.all([
        supabase.from('bookings').select('*, client:clients(first_name, last_name)'),
        supabase.from('payments').select('*'),
        supabase.from('taxi_trips').select('id', { count: 'exact', head: true }).is('booking_id', null),
        supabase.from('form_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('enquiries').select('*'),
        supabase.from('email_logs').select('booking_id, sent_at, created_at'),
      ])
      const firstError = bErr || pErr || tErr || fErr || eErr
      if (firstError) return errorResult(`Loading pending actions data: ${firstError.message}`)

      const enquiries = (enquiriesData ?? []) as Enquiry[]
      const bookings = (bookingsData ?? []) as Booking[]
      const payments = (paymentsData ?? []) as Payment[]
      const working = enquiries.filter(e => !isSettled(e.status))

      const actions = computePendingActions({
        bookings,
        payments,
        taxiTripUnlinkedCount: taxiTripUnlinkedCount ?? 0,
        pendingFormSubmissionsCount: pendingFormSubmissionsCount ?? 0,
        unqualifiedEnquiriesCount: working.filter(e => !isQualified(e)).length,
        silentEnquiriesCount: working.filter(e => silenceDays(e.last_contact_at) >= SILENCE_WARN_DAYS).length,
        crmFailedCount: working.filter(e => !!e.crm_error).length,
      })

      const waitingOnYou = computeFollowUps({
        enquiries,
        bookings,
        touch: {
          payments: payments.map(p => ({ booking_id: p.booking_id, date: p.date })),
          emails: (emailLogsData ?? []) as Pick<EmailLog, 'booking_id' | 'sent_at' | 'created_at'>[],
        },
      })

      return jsonResult({
        waiting_on_you: waitingOnYou.map(f => ({
          kind: f.kind, id: f.targetId, name: f.name,
          wants: f.wants, when: f.when, silence_days: f.silenceDays, reason: f.reason,
        })),
        urgent: actions.filter(a => a.priority === 'urgent').map(a => ({ message: a.message, bookingRef: a.bookingRef })),
        week: actions.filter(a => a.priority === 'week').map(a => ({ message: a.message, bookingRef: a.bookingRef })),
        monitor: actions.filter(a => a.priority === 'monitor').map(a => ({ message: a.message, bookingRef: a.bookingRef })),
      })
    }
  )
}
