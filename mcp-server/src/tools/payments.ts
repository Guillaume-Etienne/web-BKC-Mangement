import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { supabase } from '../supabaseClient.js'
import type { Payment, Booking, Client } from '../../../client/src/types/database.js'
import { jsonResult, errorResult } from '../result.js'

export function registerPaymentTools(server: McpServer) {
  server.registerTool(
    'list_payments',
    {
      title: 'List payments',
      description:
        'List payments with the booking/client they belong to. Filter by booking, verified status, ' +
        'or date range. Note: bookings.amount_paid is NOT the source of truth — this table is.',
      inputSchema: {
        booking_id: z.string().uuid().optional(),
        is_verified: z.boolean().optional().describe('Filter to only verified or only unverified payments'),
        date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      },
    },
    async ({ booking_id, is_verified, date_from, date_to }) => {
      const { data: paymentsData, error } = await supabase.from('payments').select('*').order('date', { ascending: false })
      if (error) return errorResult(`Listing payments: ${error.message}`)
      let payments = (paymentsData ?? []) as Payment[]

      if (booking_id) payments = payments.filter(p => p.booking_id === booking_id)
      if (is_verified !== undefined) payments = payments.filter(p => p.is_verified === is_verified)
      if (date_from) payments = payments.filter(p => p.date >= date_from)
      if (date_to) payments = payments.filter(p => p.date <= date_to)

      const bookingIds = [...new Set(payments.map(p => p.booking_id))]
      const { data: bookingsData, error: bErr } = bookingIds.length
        ? await supabase.from('bookings').select('id, booking_number, client_id').in('id', bookingIds)
        : { data: [], error: null }
      if (bErr) return errorResult(`Loading bookings: ${bErr.message}`)
      const bookingById = new Map(((bookingsData ?? []) as Pick<Booking, 'id' | 'booking_number' | 'client_id'>[]).map(b => [b.id, b]))

      const clientIds = [...new Set([...bookingById.values()].map(b => b.client_id))]
      const { data: clientsData, error: cErr } = clientIds.length
        ? await supabase.from('clients').select('id, first_name, last_name').in('id', clientIds)
        : { data: [], error: null }
      if (cErr) return errorResult(`Loading clients: ${cErr.message}`)
      const clientById = new Map(((clientsData ?? []) as Pick<Client, 'id' | 'first_name' | 'last_name'>[]).map(c => [c.id, c]))

      const summary = payments.map(p => {
        const booking = bookingById.get(p.booking_id)
        const client = booking ? clientById.get(booking.client_id) : undefined
        return {
          id: p.id,
          booking_id: p.booking_id,
          booking_number: booking?.booking_number ?? null,
          client_name: client ? `${client.first_name} ${client.last_name}`.trim() : '(unknown client)',
          date: p.date,
          amount: p.amount,
          method: p.method,
          is_deposit: p.is_deposit,
          is_verified: p.is_verified,
          is_discount: p.is_discount,
          notes: p.notes,
        }
      })

      return jsonResult({ count: summary.length, payments: summary })
    }
  )

  server.registerTool(
    'verify_payment',
    {
      title: 'Verify a payment',
      description: 'Mark a payment as verified (is_verified = true) — resolves an "unverified payment" pending action.',
      inputSchema: { payment_id: z.string().uuid() },
    },
    async ({ payment_id }) => {
      const { error } = await supabase.from('payments').update({ is_verified: true }).eq('id', payment_id)
      if (error) return errorResult(`Verifying payment: ${error.message}`)
      return jsonResult({ ok: true, payment_id, is_verified: true })
    }
  )
}
