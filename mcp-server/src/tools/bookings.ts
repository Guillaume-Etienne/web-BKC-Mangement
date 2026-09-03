import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { supabase } from '../supabaseClient.js'
import { fetchAccountingBundle } from '../data/fetchAccountingBundle.js'
import type { Booking, BookingStatus, Client, BookingParticipant, Enquiry, EnquiryNote, Room } from '../../../client/src/types/database.js'
import {
  computeBookingTotal, computeBookingPaid, computeBookingUnverifiedPaid, computeBookingDiscounts,
} from '../../../client/src/components/accounting/utils.js'
import { activityCountColumns } from '../../../client/src/utils/bookingActivity.js'
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
      description:
        'Full detail of one booking: client, participants, rooms, a payment summary (billed/paid/due), ' +
        'and — when the booking came from an enquiry — that enquiry with its original message and ' +
        'dated notes, so the conversation that led to the booking is not lost once it is converted.',
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

      // Where this booking came from. The link already existed in the database
      // (enquiries.booking_id) but nothing ever read it back, so everything
      // said before the booking existed was effectively lost on conversion.
      const { data: originRows } = await supabase.from('enquiries').select('*').eq('booking_id', booking_id)
      const origin = ((originRows ?? []) as Enquiry[])[0] ?? null
      let originNotes: EnquiryNote[] = []
      if (origin) {
        const { data } = await supabase.from('enquiry_notes').select('*')
          .eq('enquiry_id', origin.id).order('created_at', { ascending: true })
        originNotes = (data ?? []) as EnquiryNote[]
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
        /** null when the booking was created straight from the wizard. */
        origin_enquiry: origin && {
          id: origin.id,
          name: origin.name,
          channel: origin.channel,
          created_at: origin.created_at,
          message: origin.message,
          party_size: origin.party_size,
          arrival_month: origin.arrival_month,
          wants_lessons: origin.wants_lessons,
          wants_rental: origin.wants_rental,
          wants_accommodation: origin.wants_accommodation,
          budget_eur: origin.budget_eur,
          notes: originNotes,
        },
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
  server.registerTool(
    'create_booking',
    {
      title: 'Create a booking with its travellers and rooms',
      description:
        'Create a client (or reuse an existing one), a booking, its named travellers and its rooms, ' +
        'in one call. This is what `create_booking_from_enquiry` cannot do: that one only exists for ' +
        'converting an enquiry, and deliberately leaves rooms and travellers to the app. ' +
        'The booking\'s num_* counters are DERIVED from the travellers\' flags — never passed in — ' +
        'so the cache cannot drift from its source. Rooms are checked for conflicts before anything ' +
        'is written: a clash aborts the whole call rather than producing a double-booked room.',
      inputSchema: {
        // Either an existing client, or the details to create one.
        client_id: z.string().uuid().optional().describe('Reuse this client instead of creating one'),
        client: z.object({
          first_name: z.string(),
          last_name: z.string(),
          email: z.string().optional(),
          phone: z.string().optional(),
          birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        }).optional().describe('Create a new client (ignored when client_id is given)'),

        check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
        check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
        status: z.enum(BOOKING_STATUSES).optional().describe('Default: provisional'),
        agency_id: z.string().uuid().optional().describe('Partner agency that sent this booking'),
        notes: z.string().optional(),
        arrival_time: z.string().optional().describe('HH:MM — the flight landing time, not the transfer'),
        departure_time: z.string().optional(),
        taxi_arrival: z.boolean().optional(),
        taxi_departure: z.boolean().optional(),
        center_access_rate: z.number().optional()
          .describe('€/day per own-gear traveller. Set 0 when an agency covers it, or it is billed twice.'),

        travellers: z.array(z.object({
          first_name: z.string(),
          last_name: z.string().optional(),
          notes: z.string().optional().describe('Free text — birth dates and phones have no column of their own'),
          does_kite: z.boolean().optional(),
          brings_own_gear: z.boolean().optional(),
          needs_storage: z.boolean().optional(),
          wants_kite_lessons: z.boolean().optional(),
          wants_kite_rental: z.boolean().optional(),
          wants_wing_lessons: z.boolean().optional(),
        })).optional().describe('Named travellers. The booking counters are derived from these.'),

        room_ids: z.array(z.string().uuid()).optional()
          .describe('Rooms to assign. Checked for conflicts first; a clash aborts the call.'),
      },
    },
    async (input) => {
      const {
        client_id, client, check_in, check_out, status, agency_id, notes,
        arrival_time, departure_time, taxi_arrival, taxi_departure,
        center_access_rate, travellers = [], room_ids = [],
      } = input

      if (check_out <= check_in) return errorResult(`check_out (${check_out}) must be after check_in (${check_in}).`)
      if (!client_id && !client) return errorResult('Give either client_id or client details.')

      // ── Room conflicts, BEFORE writing anything ───────────────────────────
      // Half-day convention, same as the wizard and check_accommodation_availability:
      // someone leaving on the day another arrives is not a clash.
      if (room_ids.length > 0) {
        const { data: taken, error: rErr } = await supabase
          .from('booking_rooms')
          .select('room_id, booking:bookings(booking_number, check_in, check_out, status)')
          .in('room_id', room_ids)
        if (rErr) return errorResult(`Checking room availability: ${rErr.message}`)

        const clashes = (taken ?? []).filter((row: any) => {
          const b = row.booking
          return b && b.status !== 'cancelled' && b.check_in < check_out && b.check_out > check_in
        })
        if (clashes.length > 0) {
          return errorResult(
            'Room conflict — nothing was created. ' +
            clashes.map((c: any) =>
              `room ${c.room_id} is taken by #${c.booking.booking_number} (${c.booking.check_in} → ${c.booking.check_out})`
            ).join('; ')
          )
        }
      }

      // ── Client ────────────────────────────────────────────────────────────
      let clientId = client_id
      if (!clientId && client) {
        const { data: created, error: cErr } = await supabase.from('clients').insert({
          first_name: client.first_name,
          last_name: client.last_name,
          email: client.email ?? null,
          phone: client.phone ?? null,
          birth_date: client.birth_date ?? null,
          notes: null, nationality: null, passport_number: null, kite_level: null,
          import_id: null,
          emergency_contact_name: null, emergency_contact_phone: null,
          emergency_contact_email: null, emergency_contact_relation: null,
        }).select('id').single()
        if (cErr || !created) return errorResult(`Creating client: ${cErr?.message}`)
        clientId = created.id
      }

      // ── Booking ───────────────────────────────────────────────────────────
      const { data: booking, error: bErr } = await supabase.from('bookings').insert({
        client_id: clientId,
        check_in,
        check_out,
        // Derived, never taken from the caller: the num_* columns are a cache of
        // the travellers' flags, and the app recomputes them the same way.
        ...activityCountColumns(travellers),
        center_access_rate: center_access_rate ?? 5,
        visa_entry_date: null, visa_exit_date: null,
        status: status ?? 'provisional',
        notes: notes ?? null,
        arrival_time: arrival_time ?? null,
        departure_time: departure_time ?? null,
        luggage_count: 0, boardbag_count: 0,
        taxi_arrival: taxi_arrival ?? false,
        taxi_departure: taxi_departure ?? false,
        couples_count: 0, children_count: 0,
        amount_paid: 0,
        has_travel_insurance: false,
        waiver_accepted_at: null, waiver_version: null,
        referral_source: null,
        import_id: null,
        agency_id: agency_id ?? null,
        emergency_contact_name: null, emergency_contact_phone: null, emergency_contact_email: null,
      }).select('id, booking_number').single()
      if (bErr || !booking) return errorResult(`Creating booking (client ${clientId} exists): ${bErr?.message}`)

      const warnings: string[] = []

      // ── Travellers ────────────────────────────────────────────────────────
      if (travellers.length > 0) {
        const { error: pErr } = await supabase.from('booking_participants').insert(
          travellers.map(t => ({
            booking_id: booking.id,
            first_name: t.first_name,
            last_name: t.last_name ?? null,
            notes: t.notes ?? null,
            passport_number: null, client_id: null, kite_level: null,
            does_kite: t.does_kite ?? false,
            brings_own_gear: t.brings_own_gear ?? false,
            needs_storage: t.needs_storage ?? false,
            wants_kite_lessons: t.wants_kite_lessons ?? false,
            wants_kite_rental: t.wants_kite_rental ?? false,
            wants_wing_lessons: t.wants_wing_lessons ?? false,
          }))
        )
        if (pErr) warnings.push(`Booking created, but travellers failed: ${pErr.message}`)
      }

      // ── Rooms ─────────────────────────────────────────────────────────────
      if (room_ids.length > 0) {
        const { error: rmErr } = await supabase.from('booking_rooms').insert(
          room_ids.map(room_id => ({ booking_id: booking.id, room_id }))
        )
        if (rmErr) warnings.push(`Booking created, but rooms failed: ${rmErr.message}`)
      }

      return jsonResult({
        ok: true,
        client_id: clientId,
        booking_id: booking.id,
        booking_number: booking.booking_number,
        travellers: travellers.length,
        rooms: room_ids.length,
        ...(warnings.length ? { warnings } : {}),
        note:
          'No room PRICE was set (booking_room_prices): the nightly rate falls back to the base ' +
          'rate until one is entered in Accounting. Lessons and transfers are separate — use ' +
          'create_taxi_trip for transfers.',
      })
    }
  )
}
