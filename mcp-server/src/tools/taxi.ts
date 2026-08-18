import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { supabase } from '../supabaseClient.js'
import type { TaxiTrip, TaxiTripType, TaxiTripStatus, TaxiDriver, TaxiPricingDefaults, Booking, Client } from '../../../client/src/types/database.js'
import { FALLBACK_TAXI_PRICING } from '../../../client/src/utils/taxiPricing.js'
import { jsonResult, errorResult } from '../result.js'

const TAXI_TRIP_STATUSES = ['confirmed', 'needs_details', 'done'] as const satisfies readonly TaxiTripStatus[]
const TAXI_TRIP_TYPES = [
  'aero-to-center', 'center-to-aero', 'aero-to-spot', 'spot-to-aero', 'center-to-town', 'town-to-center', 'other',
] as const satisfies readonly TaxiTripType[]

export function registerTaxiTools(server: McpServer) {
  server.registerTool(
    'list_taxi_trips',
    {
      title: 'List taxi trips',
      description:
        'List taxi trips with driver name and linked booking (if any). Filter by date range, ' +
        'status, driver, or unassigned (no driver yet). Trips with margin_manager_mzn === 0 are ' +
        '"private" (hired outside the manager, per taxi-and-shares.md convention).',
      inputSchema: {
        date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        status: z.enum(TAXI_TRIP_STATUSES).optional(),
        driver_id: z.string().uuid().optional(),
        unassigned: z.boolean().optional().describe('Only trips with no taxi_driver_id'),
      },
    },
    async ({ date_from, date_to, status, driver_id, unassigned }) => {
      const { data: tripsData, error } = await supabase.from('taxi_trips').select('*').order('date', { ascending: true })
      if (error) return errorResult(`Listing taxi trips: ${error.message}`)
      let trips = (tripsData ?? []) as TaxiTrip[]

      if (date_from) trips = trips.filter(t => t.date >= date_from)
      if (date_to) trips = trips.filter(t => t.date <= date_to)
      if (status) trips = trips.filter(t => t.status === status)
      if (driver_id) trips = trips.filter(t => t.taxi_driver_id === driver_id)
      if (unassigned) trips = trips.filter(t => !t.taxi_driver_id)

      const driverIds = [...new Set(trips.map(t => t.taxi_driver_id).filter((id): id is string => !!id))]
      const bookingIds = [...new Set(trips.map(t => t.booking_id).filter((id): id is string => !!id))]
      const [{ data: driversData, error: dErr }, { data: bookingsData, error: bErr }] = await Promise.all([
        driverIds.length ? supabase.from('taxi_drivers').select('id, name').in('id', driverIds) : Promise.resolve({ data: [], error: null }),
        bookingIds.length ? supabase.from('bookings').select('id, booking_number, client_id').in('id', bookingIds) : Promise.resolve({ data: [], error: null }),
      ])
      if (dErr) return errorResult(`Loading drivers: ${dErr.message}`)
      if (bErr) return errorResult(`Loading bookings: ${bErr.message}`)
      const driverNameById = new Map(((driversData ?? []) as { id: string; name: string }[]).map(d => [d.id, d.name]))
      const bookingById = new Map(((bookingsData ?? []) as Pick<Booking, 'id' | 'booking_number' | 'client_id'>[]).map(b => [b.id, b]))

      const clientIds = [...new Set([...bookingById.values()].map(b => b.client_id))]
      const { data: clientsData, error: cErr } = clientIds.length
        ? await supabase.from('clients').select('id, first_name, last_name').in('id', clientIds)
        : { data: [], error: null }
      if (cErr) return errorResult(`Loading clients: ${cErr.message}`)
      const clientById = new Map(((clientsData ?? []) as Pick<Client, 'id' | 'first_name' | 'last_name'>[]).map(c => [c.id, c]))

      const summary = trips.map(t => {
        const booking = t.booking_id ? bookingById.get(t.booking_id) : undefined
        const client = booking ? clientById.get(booking.client_id) : undefined
        return {
          id: t.id,
          date: t.date,
          start_time: t.start_time,
          type: t.type,
          status: t.status,
          driver_name: t.taxi_driver_id ? (driverNameById.get(t.taxi_driver_id) ?? '(unknown driver)') : null,
          booking_ref: booking
            ? { booking_id: booking.id, booking_number: booking.booking_number, client_name: client ? `${client.first_name} ${client.last_name}`.trim() : '(unknown client)' }
            : null,
          nb_persons: t.nb_persons,
          price_eur: t.price_eur,
          private: t.margin_manager_mzn === 0,
        }
      })

      return jsonResult({ count: summary.length, trips: summary })
    }
  )

  server.registerTool(
    'get_taxi_trip',
    {
      title: 'Get taxi trip detail',
      description: 'Full detail of one taxi trip: driver, linked booking/client, and all financial fields (EUR client price, MZN driver pay, MZN manager commission).',
      inputSchema: { taxi_trip_id: z.string().uuid() },
    },
    async ({ taxi_trip_id }) => {
      const { data: tripRow, error } = await supabase.from('taxi_trips').select('*').eq('id', taxi_trip_id).single()
      if (error || !tripRow) return errorResult(`Taxi trip not found: ${error?.message ?? taxi_trip_id}`)
      const trip = tripRow as TaxiTrip

      const [{ data: driver }, { data: bookingRow }] = await Promise.all([
        trip.taxi_driver_id
          ? supabase.from('taxi_drivers').select('*').eq('id', trip.taxi_driver_id).single()
          : Promise.resolve({ data: null }),
        trip.booking_id
          ? supabase.from('bookings').select('id, booking_number, client_id, check_in, check_out').eq('id', trip.booking_id).single()
          : Promise.resolve({ data: null }),
      ])

      let client: Pick<Client, 'id' | 'first_name' | 'last_name'> | null = null
      if (bookingRow) {
        const { data } = await supabase.from('clients').select('id, first_name, last_name').eq('id', (bookingRow as { client_id: string }).client_id).single()
        client = data as Pick<Client, 'id' | 'first_name' | 'last_name'> | null
      }

      return jsonResult({
        ...trip,
        private: trip.margin_manager_mzn === 0,
        driver: driver ?? null,
        booking: bookingRow ? { ...bookingRow, client } : null,
      })
    }
  )

  server.registerTool(
    'update_taxi_trip',
    {
      title: 'Update a taxi trip',
      description:
        'Assign/change a driver, change status, or adjust the financial fields of a taxi trip. ' +
        'Only the fields provided are changed. Setting margin_manager_mzn to 0 makes the trip ' +
        '"private" (outside the manager) — see taxi-and-shares.md before doing that.',
      inputSchema: {
        taxi_trip_id: z.string().uuid(),
        taxi_driver_id: z.string().uuid().nullable().optional(),
        status: z.enum(TAXI_TRIP_STATUSES).optional(),
        price_eur: z.number().nonnegative().optional(),
        price_driver_mzn: z.number().nonnegative().optional(),
        margin_manager_mzn: z.number().nonnegative().optional(),
        notes: z.string().nullable().optional(),
      },
    },
    async ({ taxi_trip_id, ...fields }) => {
      const patch: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(fields)) if (v !== undefined) patch[k] = v
      if (Object.keys(patch).length === 0) return errorResult('No fields to update were provided.')

      const { error } = await supabase.from('taxi_trips').update(patch).eq('id', taxi_trip_id)
      if (error) return errorResult(`Updating taxi trip: ${error.message}`)
      return jsonResult({ ok: true, taxi_trip_id, updated: patch })
    }
  )

  server.registerTool(
    'create_taxi_trip',
    {
      title: 'Create a taxi trip',
      description:
        'Create a new taxi trip. Price fields (price_eur, price_driver_mzn, margin_manager_mzn) ' +
        'default to the current taxi_pricing_defaults row, same as the "+" button in the app — pass ' +
        'them explicitly to override. taxi_driver_id and booking_id are optional (null = unassigned/' +
        'not linked to a booking).',
      inputSchema: {
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
        start_time: z.string().regex(/^\d{2}:\d{2}$/, 'HH:MM'),
        type: z.enum(TAXI_TRIP_TYPES),
        status: z.enum(TAXI_TRIP_STATUSES).optional().describe('Default: confirmed'),
        taxi_driver_id: z.string().uuid().nullable().optional(),
        booking_id: z.string().uuid().nullable().optional(),
        nb_persons: z.number().int().min(1).optional().describe('Default: 1'),
        nb_luggage: z.number().int().min(0).optional().describe('Default: 0'),
        nb_boardbags: z.number().int().min(0).optional().describe('Default: 0'),
        notes: z.string().nullable().optional(),
        price_eur: z.number().nonnegative().optional(),
        price_driver_mzn: z.number().nonnegative().optional(),
        margin_manager_mzn: z.number().nonnegative().optional(),
      },
    },
    async ({ date, start_time, type, status, taxi_driver_id, booking_id, nb_persons, nb_luggage, nb_boardbags, notes, price_eur, price_driver_mzn, margin_manager_mzn }) => {
      const { data: defaultsRows, error: dErr } = await supabase
        .from('taxi_pricing_defaults').select('*').order('updated_at', { ascending: false }).limit(1)
      if (dErr) return errorResult(`Loading pricing defaults: ${dErr.message}`)
      const defaults = ((defaultsRows ?? [])[0] as TaxiPricingDefaults | undefined) ?? FALLBACK_TAXI_PRICING

      const trip = {
        date,
        start_time,
        type,
        status: status ?? 'confirmed',
        taxi_driver_id: taxi_driver_id ?? null,
        booking_id: booking_id ?? null,
        nb_persons: nb_persons ?? 1,
        nb_luggage: nb_luggage ?? 0,
        nb_boardbags: nb_boardbags ?? 0,
        notes: notes ?? null,
        price_eur: price_eur ?? defaults.default_price_eur,
        price_driver_mzn: price_driver_mzn ?? defaults.default_driver_mzn,
        margin_manager_mzn: margin_manager_mzn ?? defaults.default_manager_mzn,
      }

      const { data, error } = await supabase.from('taxi_trips').insert(trip).select('*').single()
      if (error) return errorResult(`Creating taxi trip: ${error.message}`)
      return jsonResult({ ok: true, trip: data as TaxiTrip })
    }
  )

  server.registerTool(
    'list_taxi_drivers',
    {
      title: 'List taxi drivers',
      description: 'List taxi drivers with vehicle, seat capacity, margin percent, and default rates applied to new trips.',
      inputSchema: {},
    },
    async () => {
      const { data, error } = await supabase.from('taxi_drivers').select('*').order('name')
      if (error) return errorResult(`Listing taxi drivers: ${error.message}`)
      return jsonResult({ count: (data ?? []).length, drivers: (data ?? []) as TaxiDriver[] })
    }
  )
}
