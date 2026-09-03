import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { supabase } from '../supabaseClient.js'
import type { Client, Enquiry, EnquiryNote, EnquiryStatus } from '../../../client/src/types/database.js'
import { silenceDays, isQualified, isSettled, matchesSearch } from '../../../client/src/utils/enquiries.js'
import { splitName } from '../../../client/src/utils/names.js'
import { findExistingClient, blanksToFill, type ClientMatchReason } from '../../../client/src/utils/clientIdentity.js'
import { activityCountColumns } from '../../../client/src/utils/bookingActivity.js'
import { jsonResult, errorResult } from '../result.js'

const ENQUIRY_STATUSES = ['new', 'talking', 'waiting', 'won', 'lost'] as const satisfies readonly EnquiryStatus[]

export function registerEnquiryTools(server: McpServer) {
  server.registerTool(
    'list_enquiries',
    {
      title: 'List enquiries',
      description:
        'List enquiries (people who wrote in but have not booked). Does not touch planning or ' +
        'accounts. Returns a summary per enquiry including computed silence (days since last contact).',
      inputSchema: {
        status: z.enum(ENQUIRY_STATUSES).optional().describe('Filter to one status'),
        min_silence_days: z.number().int().min(0).optional().describe('Only enquiries silent at least this many days'),
        arrival_month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe('Filter to one arrival month, YYYY-MM'),
        search: z.string().optional().describe('Free-text search over name, message, notes, email, phone'),
        include_settled: z.boolean().optional().describe('Include won/lost enquiries (default: false, working list only)'),
      },
    },
    async ({ status, min_silence_days, arrival_month, search, include_settled }) => {
      const { data, error } = await supabase.from('enquiries').select('*').order('last_contact_at', { ascending: false })
      if (error) return errorResult(`Listing enquiries: ${error.message}`)
      let enquiries = (data ?? []) as Enquiry[]

      if (!include_settled) enquiries = enquiries.filter(e => !isSettled(e.status))
      if (status) enquiries = enquiries.filter(e => e.status === status)
      if (arrival_month) enquiries = enquiries.filter(e => e.arrival_month === arrival_month)
      if (min_silence_days !== undefined) enquiries = enquiries.filter(e => silenceDays(e.last_contact_at) >= min_silence_days)

      if (search) {
        const { data: notesData, error: notesErr } = await supabase.from('enquiry_notes').select('*')
        if (notesErr) return errorResult(`Listing enquiry notes for search: ${notesErr.message}`)
        const notesByEnquiry = new Map<string, string[]>()
        for (const n of (notesData ?? []) as EnquiryNote[]) {
          const arr = notesByEnquiry.get(n.enquiry_id) ?? []
          arr.push(n.body)
          notesByEnquiry.set(n.enquiry_id, arr)
        }
        enquiries = enquiries.filter(e => matchesSearch(e, notesByEnquiry.get(e.id) ?? [], search))
      }

      const summary = enquiries.map(e => ({
        id: e.id,
        name: e.name,
        status: e.status,
        qualified: isQualified(e),
        party_size: e.party_size,
        arrival_month: e.arrival_month,
        wants_lessons: e.wants_lessons,
        wants_rental: e.wants_rental,
        wants_accommodation: e.wants_accommodation,
        budget_eur: e.budget_eur,
        silence_days: silenceDays(e.last_contact_at),
        message_preview: e.message ? e.message.slice(0, 140) : null,
      }))
      return jsonResult({ count: summary.length, enquiries: summary })
    }
  )

  server.registerTool(
    'get_enquiry',
    {
      title: 'Get enquiry detail',
      description: 'Full detail of one enquiry, including its note history (oldest first).',
      inputSchema: { enquiry_id: z.string().uuid() },
    },
    async ({ enquiry_id }) => {
      const { data: enquiry, error } = await supabase.from('enquiries').select('*').eq('id', enquiry_id).single()
      if (error || !enquiry) return errorResult(`Enquiry not found: ${error?.message ?? enquiry_id}`)
      const { data: notes, error: notesErr } = await supabase
        .from('enquiry_notes').select('*').eq('enquiry_id', enquiry_id).order('created_at', { ascending: true })
      if (notesErr) return errorResult(`Loading notes: ${notesErr.message}`)
      return jsonResult({
        ...(enquiry as Enquiry),
        silence_days: silenceDays((enquiry as Enquiry).last_contact_at),
        notes: notes ?? [],
      })
    }
  )

  server.registerTool(
    'update_enquiry_status',
    {
      title: 'Change an enquiry status',
      description:
        "Set an enquiry's status (new / talking / waiting / won / lost). `lost_reason` is only " +
        "kept when status is 'lost' — it is cleared otherwise, matching the app's own rule.",
      inputSchema: {
        enquiry_id: z.string().uuid(),
        status: z.enum(ENQUIRY_STATUSES),
        lost_reason: z.string().optional(),
      },
    },
    async ({ enquiry_id, status, lost_reason }) => {
      const { error } = await supabase.from('enquiries').update({
        status,
        lost_reason: status === 'lost' ? (lost_reason?.trim() || null) : null,
      }).eq('id', enquiry_id)
      if (error) return errorResult(`Updating status: ${error.message}`)
      return jsonResult({ ok: true, enquiry_id, status })
    }
  )

  server.registerTool(
    'add_enquiry_note',
    {
      title: 'Add a note to an enquiry',
      description:
        'Append a dated note to an enquiry. Writing a note is treated as the exchange itself, so ' +
        "it also resets the enquiry's silence counter (last_contact_at) — same behavior as the app.",
      inputSchema: { enquiry_id: z.string().uuid(), body: z.string().min(1) },
    },
    async ({ enquiry_id, body }) => {
      const { data: note, error } = await supabase.from('enquiry_notes')
        .insert({ enquiry_id, body }).select().single()
      if (error || !note) return errorResult(`Saving note: ${error?.message}`)

      const { error: touchErr } = await supabase.from('enquiries')
        .update({ last_contact_at: new Date().toISOString() }).eq('id', enquiry_id)
      if (touchErr) {
        return jsonResult({
          ok: true, note, silence_reset: false,
          warning: `Note saved, but the silence counter was not reset: ${touchErr.message}`,
        })
      }
      return jsonResult({ ok: true, note, silence_reset: true })
    }
  )

  server.registerTool(
    'create_booking_from_enquiry',
    {
      title: 'Create a booking from an enquiry',
      description:
        'Convert an enquiry into a real client + provisional booking. Requires check-in/check-out ' +
        '(an enquiry only ever has an approximate arrival month, never real dates). Creates NO ' +
        "rooms and NO named participants — that stays a manual step in the app, same as the " +
        "wizard's own flow. Reuses the existing client when the enquiry is already linked to one " +
        "or the email matches exactly (never on a name), rather than creating a duplicate; the " +
        "result says which via `client_reused`. Marks the enquiry won and links it to the booking.",
      inputSchema: {
        enquiry_id: z.string().uuid(),
        check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
        check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
      },
    },
    async ({ enquiry_id, check_in, check_out }) => {
      const { data: enquiryRow, error: eFetchErr } = await supabase.from('enquiries').select('*').eq('id', enquiry_id).single()
      if (eFetchErr || !enquiryRow) return errorResult(`Enquiry not found: ${eFetchErr?.message ?? enquiry_id}`)
      const enquiry = enquiryRow as Enquiry

      // Reuse an existing client before minting one — same rule as the app's
      // own conversion path (utils/clientIdentity.ts): the enquiry's own
      // client_id first, then an exact email, never a name. A duplicate row
      // here splits a returning guest's history in two, silently.
      const { data: clientRows, error: clFetchErr } = await supabase.from('clients').select('*')
      if (clFetchErr) return errorResult(`Loading clients: ${clFetchErr.message}`)
      const match = findExistingClient((clientRows ?? []) as Client[], {
        linkedClientId: enquiry.client_id,
        email: enquiry.email,
      })

      const { first, last } = splitName(enquiry.name)
      let clientId: string
      let clientReused: ClientMatchReason | null = null
      if (match) {
        clientId = match.client.id
        clientReused = match.reason
        // Complete blanks only — never overwrite what gui typed by hand.
        const patch = blanksToFill(match.client, { email: enquiry.email, phone: enquiry.phone })
        if (Object.keys(patch).length > 0) {
          const { error: fillErr } = await supabase.from('clients').update(patch).eq('id', clientId)
          if (fillErr) return errorResult(`Filling in the existing client's blanks: ${fillErr.message}`)
        }
      } else {
        const { data: client, error: cErr } = await supabase.from('clients').insert({
          first_name: first || enquiry.name || 'Unknown',
          last_name: last || '',
          email: enquiry.email,
          phone: enquiry.phone,
          notes: null, nationality: null, passport_number: null, birth_date: null, kite_level: null,
          import_id: null,
          emergency_contact_name: null, emergency_contact_phone: null,
          emergency_contact_email: null, emergency_contact_relation: null,
        }).select('id').single()
        if (cErr || !client) return errorResult(`Creating client: ${cErr?.message}`)
        clientId = client.id
      }

      const noteBits: string[] = [`Created from enquiry "${enquiry.name}".`]
      if (enquiry.party_size) noteBits.push(`Party size: ${enquiry.party_size}.`)
      const wants = [
        enquiry.wants_lessons ? 'lessons' : null,
        enquiry.wants_rental ? 'rental' : null,
        enquiry.wants_accommodation ? 'accommodation' : null,
      ].filter(Boolean)
      if (wants.length) noteBits.push(`Interested in: ${wants.join(', ')}.`)
      if (enquiry.budget_eur) noteBits.push(`Budget (whole party): €${enquiry.budget_eur}.`)
      if (enquiry.message) noteBits.push(`Original message: "${enquiry.message}"`)

      const { data: booking, error: bErr } = await supabase.from('bookings').insert({
        client_id: clientId,
        check_in,
        check_out,
        ...activityCountColumns([]),
        visa_entry_date: null,
        visa_exit_date: null,
        status: 'provisional',
        notes: noteBits.join(' '),
        arrival_time: null, departure_time: null,
        luggage_count: 0, boardbag_count: 0,
        taxi_arrival: false, taxi_departure: false,
        couples_count: 0, children_count: 0,
        amount_paid: 0,
        has_travel_insurance: false,
        waiver_accepted_at: null, waiver_version: null,
        referral_source: null,
        import_id: null,
        emergency_contact_name: null, emergency_contact_phone: null, emergency_contact_email: null,
      }).select('id, booking_number').single()
      if (bErr || !booking) return errorResult(`Creating booking (client ${clientId} was ${clientReused ? 'reused' : 'created'}): ${bErr?.message}`)

      const { error: wonErr } = await supabase.from('enquiries').update({
        status: 'won',
        booking_id: booking.id,
        client_id: clientId,
        last_contact_at: new Date().toISOString(),
      }).eq('id', enquiry_id)
      if (wonErr) {
        return jsonResult({
          ok: true, client_id: clientId, client_reused: clientReused, booking_id: booking.id, booking_number: booking.booking_number,
          warning: `Booking created, but the enquiry was NOT marked won: ${wonErr.message}`,
        })
      }

      return jsonResult({
        ok: true,
        client_id: clientId,
        /** null = a new client row was created. 'linked'/'email' = an existing
         *  one was reused, so the guest keeps a single history. */
        client_reused: clientReused,
        booking_id: booking.id,
        booking_number: booking.booking_number,
        note: 'No room and no participant were assigned — finish this booking by hand in the app (rooms, planning, lessons).',
      })
    }
  )
}
