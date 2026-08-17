import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { supabase } from '../supabaseClient.js'
import type { Client, Booking, BookingParticipant, Lesson } from '../../../client/src/types/database.js'
import { clientParticipantIds, cumulativeHoursBefore } from '../../../client/src/components/accounting/utils.js'
import { jsonResult, errorResult } from '../result.js'

export function registerClientTools(server: McpServer) {
  server.registerTool(
    'list_clients',
    {
      title: 'List / search clients',
      description: 'List clients, optionally filtered by a free-text search over first/last name, email, or phone.',
      inputSchema: {
        search: z.string().optional(),
      },
    },
    async ({ search }) => {
      const { data, error } = await supabase.from('clients').select('*').order('last_name')
      if (error) return errorResult(`Listing clients: ${error.message}`)
      let clients = (data ?? []) as Client[]

      if (search) {
        const q = search.toLowerCase()
        clients = clients.filter(c =>
          `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
          (c.email?.toLowerCase().includes(q) ?? false) ||
          (c.phone?.toLowerCase().includes(q) ?? false)
        )
      }

      const summary = clients.map(c => ({
        id: c.id,
        name: `${c.first_name} ${c.last_name}`.trim(),
        email: c.email,
        phone: c.phone,
        nationality: c.nationality,
        kite_level: c.kite_level,
      }))
      return jsonResult({ count: summary.length, clients: summary })
    }
  )

  server.registerTool(
    'get_client',
    {
      title: 'Get client detail',
      description:
        'Full detail of one client: profile, booking history, and lifetime cumulative kite hours ' +
        '(private and group, counted across every booking this client has ever had — never reset ' +
        'per stay or season, same rule the volume-tier pricing uses).',
      inputSchema: { client_id: z.string().uuid() },
    },
    async ({ client_id }) => {
      const { data: clientRow, error } = await supabase.from('clients').select('*').eq('id', client_id).single()
      if (error || !clientRow) return errorResult(`Client not found: ${error?.message ?? client_id}`)
      const client = clientRow as Client

      const [{ data: bookingsData, error: bErr }, { data: participantsData, error: pErr }, { data: lessonsData, error: lErr }] = await Promise.all([
        supabase.from('bookings').select('id, booking_number, check_in, check_out, status').eq('client_id', client_id),
        supabase.from('booking_participants').select('*'),
        supabase.from('lessons').select('*'),
      ])
      if (bErr) return errorResult(`Loading bookings: ${bErr.message}`)
      if (pErr) return errorResult(`Loading participants: ${pErr.message}`)
      if (lErr) return errorResult(`Loading lessons: ${lErr.message}`)

      const bookings = (bookingsData ?? []) as Pick<Booking, 'id' | 'booking_number' | 'check_in' | 'check_out' | 'status'>[]
      const participants = (participantsData ?? []) as BookingParticipant[]
      const lessons = (lessonsData ?? []) as Lesson[]

      const ids = clientParticipantIds(client_id, participants)
      const lifetimeHours = {
        private: cumulativeHoursBefore(ids, 'private', lessons),
        group: cumulativeHoursBefore(ids, 'group', lessons),
      }

      return jsonResult({
        ...client,
        name: `${client.first_name} ${client.last_name}`.trim(),
        bookings: bookings.sort((a, b) => b.check_in.localeCompare(a.check_in)),
        lifetime_kite_hours: lifetimeHours,
      })
    }
  )
}
