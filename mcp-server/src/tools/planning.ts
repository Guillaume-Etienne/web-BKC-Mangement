import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { supabase } from '../supabaseClient.js'
import type { Accommodation, Room, BookingRoom, Booking, HouseRental, Client } from '../../../client/src/types/database.js'
import { jsonResult, errorResult } from '../result.js'

export function registerPlanningTools(server: McpServer) {
  server.registerTool(
    'list_accommodations',
    {
      title: 'List accommodations',
      description: 'List accommodations (houses, bungalows, other) with their room count.',
      inputSchema: { active_only: z.boolean().optional() },
    },
    async ({ active_only }) => {
      const { data, error } = await supabase.from('accommodations').select('*').order('name')
      if (error) return errorResult(`Listing accommodations: ${error.message}`)
      let accommodations = (data ?? []) as Accommodation[]
      if (active_only) accommodations = accommodations.filter(a => a.is_active)
      return jsonResult({ count: accommodations.length, accommodations })
    }
  )

  server.registerTool(
    'check_accommodation_availability',
    {
      title: 'Check accommodation availability for a date range',
      description:
        'For one accommodation, list each room as free or booked (with the booking/client) over a ' +
        'date range. Half-day convention: a same-day check-out/check-in is NOT a conflict, matching ' +
        'the booking wizard. For houses, also reports whether the center has rented the house from ' +
        'its owner for the whole period (house_rentals) — a house with no matching rental cannot ' +
        'actually be sold even if its rooms look free.',
      inputSchema: {
        accommodation_id: z.string().uuid(),
        check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
        check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
      },
    },
    async ({ accommodation_id, check_in, check_out }) => {
      if (check_in >= check_out) return errorResult('check_in must be before check_out.')

      const { data: accRow, error: accErr } = await supabase.from('accommodations').select('*').eq('id', accommodation_id).single()
      if (accErr || !accRow) return errorResult(`Accommodation not found: ${accErr?.message ?? accommodation_id}`)
      const accommodation = accRow as Accommodation

      const [{ data: roomsData, error: rErr }, { data: bookingRoomsData, error: brErr }] = await Promise.all([
        supabase.from('rooms').select('*').eq('accommodation_id', accommodation_id),
        supabase.from('booking_rooms').select('*'),
      ])
      if (rErr) return errorResult(`Loading rooms: ${rErr.message}`)
      if (brErr) return errorResult(`Loading booking_rooms: ${brErr.message}`)
      const rooms = (roomsData ?? []) as Room[]
      const bookingRooms = (bookingRoomsData ?? []) as BookingRoom[]

      const bookingIds = [...new Set(bookingRooms.filter(br => rooms.some(r => r.id === br.room_id)).map(br => br.booking_id))]
      const { data: bookingsData, error: bErr } = bookingIds.length
        ? await supabase.from('bookings').select('id, booking_number, client_id, check_in, check_out, status').in('id', bookingIds)
        : { data: [], error: null }
      if (bErr) return errorResult(`Loading bookings: ${bErr.message}`)
      const bookingById = new Map(
        ((bookingsData ?? []) as Pick<Booking, 'id' | 'booking_number' | 'client_id' | 'check_in' | 'check_out' | 'status'>[])
          .map(b => [b.id, b])
      )

      const clientIds = [...new Set([...bookingById.values()].map(b => b.client_id))]
      const { data: clientsData, error: cErr } = clientIds.length
        ? await supabase.from('clients').select('id, first_name, last_name').in('id', clientIds)
        : { data: [], error: null }
      if (cErr) return errorResult(`Loading clients: ${cErr.message}`)
      const clientById = new Map(((clientsData ?? []) as Pick<Client, 'id' | 'first_name' | 'last_name'>[]).map(c => [c.id, c]))

      // Half-day convention: strict comparisons, same-day turnover is not a conflict.
      const overlaps = (b: { check_in: string; check_out: string }) => b.check_in < check_out && b.check_out > check_in

      const roomStatus = rooms.map(room => {
        const conflict = bookingRooms
          .filter(br => br.room_id === room.id)
          .map(br => bookingById.get(br.booking_id))
          .find(b => b && b.status !== 'cancelled' && overlaps(b))
        if (!conflict) return { room_id: room.id, room_name: room.name, capacity: room.capacity, free: true, conflicting_booking: null }
        const client = clientById.get(conflict.client_id)
        return {
          room_id: room.id,
          room_name: room.name,
          capacity: room.capacity,
          free: false,
          conflicting_booking: {
            booking_id: conflict.id,
            booking_number: conflict.booking_number,
            client_name: client ? `${client.first_name} ${client.last_name}`.trim() : '(unknown client)',
            check_in: conflict.check_in,
            check_out: conflict.check_out,
          },
        }
      })

      let houseRentalCovered: boolean | null = null
      if (accommodation.type === 'house') {
        const { data: rentalsData, error: hrErr } = await supabase.from('house_rentals').select('*').eq('accommodation_id', accommodation_id)
        if (hrErr) return errorResult(`Loading house rentals: ${hrErr.message}`)
        const rentals = (rentalsData ?? []) as HouseRental[]
        houseRentalCovered = rentals.some(r => r.start_date <= check_in && r.end_date >= check_out)
      }

      return jsonResult({
        accommodation: { id: accommodation.id, name: accommodation.name, type: accommodation.type },
        check_in, check_out,
        rooms: roomStatus,
        house_rental_covered: houseRentalCovered,
      })
    }
  )
}
