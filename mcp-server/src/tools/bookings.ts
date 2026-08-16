import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { supabase } from '../supabaseClient.js'
import { fetchAccountingBundle } from '../data/fetchAccountingBundle.js'
import type { Booking, BookingStatus, Client, BookingParticipant, Room } from '../../../client/src/types/database.js'
import {
  computeBookingTotal, computeBookingPaid, computeBookingUnverifiedPaid, computeBookingDiscounts,
} from '../../../client/src/components/accounting/utils.js'
import { jsonResult, errorResult } from '../result.js'

const BOOKING_STATUSES = ['confirmed', 'provisional', 'cancelled'] as const satisfies readonly BookingStatus[]

export function registerBookingTools(server: McpServer) {
  server.registerTool(
    'list_bookings',
    {
      title: 'List bookings',
      description: 'List bookings with client name, dates, status. Filter by status, check-in range, or search.',
      inputSchema: {
        status: z.enum(BOOKING_STATUSES).optional(),
        check_in_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        check_in_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        search: z.string().optional().describe('Matches client first/last name (case-insensitive)'),
      },
    },
    async ({ status, check_in_from, check_in_to, search }) => {
      const { data: bookingsData, error } = await supabase.from('bookings').select('*').order('check_in', { ascending: false })
      if (error) return errorResult(`Listing bookings: ${error.message}`)
      let bookings = (bookingsData ?? []) as Booking[]

      if (status) bookings = bookings.filter(b => b.status === status)
      if (check_in_from) bookings = bookings.filter(b => b.check_in >= check_in_from)
      if (check_in_to) bookings = bookings.filter(b => b.check_in <= check_in_to)

      const clientIds = [...new Set(bookings.map(b => b.client_id))]
      const { data: clientsData, error: clientsErr } = await supabase.from('clients').select('*').in('id', clientIds)
      if (clientsErr) return errorResult(`Loading clients: ${clientsErr.message}`)
      const clientById = new Map(((clientsData ?? []) as Client[]).map(c => [c.id, c]))

      let summary = bookings.map(b => {
        const client = clientById.get(b.client_id)
        return {
          id: b.id,
          booking_number: b.booking_number,
          client_name: client ? `${client.first_name} ${client.last_name}`.trim() : '(unknown client)',
          check_in: b.check_in,
          check_out: b.check_out,
          status: b.status,
          amount_paid: b.amount_paid,
        }
      })

      if (search) {
        const q = search.toLowerCase()
        summary = summary.filter(s => s.client_name.toLowerCase().includes(q))
      }

      return jsonResult({ count: summary.length, bookings: summary })
    }
  )

  server.registerTool(
    'get_booking',
    {
      title: 'Get booking detail',
      description: 'Full detail of one booking: client, participants, rooms, and a payment summary (billed/paid/due).',
      inputSchema: { booking_id: z.string().uuid() },
    },
    async ({ booking_id }) => {
      const { data: bookingRow, error } = await supabase.from('bookings').select('*').eq('id', booking_id).single()
      if (error || !bookingRow) return errorResult(`Booking not found: ${error?.message ?? booking_id}`)
      const booking = bookingRow as Booking

      const [{ data: client }, { data: participants }, { data: bookingRooms }] = await Promise.all([
        supabase.from('clients').select('*').eq('id', booking.client_id).single(),
        supabase.from('booking_participants').select('*').eq('booking_id', booking_id),
        supabase.from('booking_rooms').select('*').eq('booking_id', booking_id),
      ])

      const roomIds = ((bookingRooms ?? []) as { room_id: string }[]).map(r => r.room_id)
      let rooms: Room[] = []
      if (roomIds.length) {
        const { data } = await supabase.from('rooms').select('*').in('id', roomIds)
        rooms = (data ?? []) as Room[]
      }

      const bundle = await fetchAccountingBundle()
      const billed = computeBookingTotal(booking, bundle)
      const paid = computeBookingPaid(booking_id, bundle.payments)
      const unverifiedPaid = computeBookingUnverifiedPaid(booking_id, bundle.payments)
      const discounts = computeBookingDiscounts(booking_id, bundle.payments)

      return jsonResult({
        ...booking,
        client,
        participants: (participants ?? []) as BookingParticipant[],
        rooms: rooms.map(r => r.name),
        payment_summary: { billed, paid, unverified_paid: unverifiedPaid, discounts, due: billed - paid - discounts },
      })
    }
  )

  server.registerTool(
    'update_booking_status',
    {
      title: 'Change a booking status',
      description: 'Set a booking status (confirmed / provisional / cancelled).',
      inputSchema: { booking_id: z.string().uuid(), status: z.enum(BOOKING_STATUSES) },
    },
    async ({ booking_id, status }) => {
      const { error } = await supabase.from('bookings').update({ status }).eq('id', booking_id)
      if (error) return errorResult(`Updating status: ${error.message}`)
      return jsonResult({ ok: true, booking_id, status })
    }
  )

  server.registerTool(
    'update_booking_notes',
    {
      title: 'Replace a booking\'s internal notes',
      description:
        "Overwrite bookings.notes with the given text — this field holds a single block of text " +
        "(unlike enquiry notes, which are a dated list), so this replaces the whole thing rather " +
        "than appending.",
      inputSchema: { booking_id: z.string().uuid(), notes: z.string() },
    },
    async ({ booking_id, notes }) => {
      const { error } = await supabase.from('bookings').update({ notes }).eq('id', booking_id)
      if (error) return errorResult(`Updating notes: ${error.message}`)
      return jsonResult({ ok: true, booking_id })
    }
  )
}
