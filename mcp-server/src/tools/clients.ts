import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { supabase } from '../supabaseClient.js'
import type {
  ActivityBooking, Client, Booking, BookingParticipant, ClientNote, EmailLog, Enquiry,
  EnquiryNote, FormSubmission, Lesson, Payment, TaxiTrip,
} from '../../../client/src/types/database.js'
import { clientParticipantIds, cumulativeHoursBefore } from '../../../client/src/components/accounting/utils.js'
import { buildDossier, dossierMoney, daysSinceLastTouch } from '../../../client/src/utils/dossier.js'
import { searchEverything, type SearchIndex } from '../../../client/src/utils/globalSearch.js'
import { isMissingTable } from '../../../client/src/utils/supabaseErrors.js'
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
        hint: 'For the full history — messages, notes, payments, documents sent, transfers — use get_client_dossier.',
      })
    }
  )

  server.registerTool(
    'get_client_dossier',
    {
      title: "Get a client's whole file",
      description:
        'Everything that ever happened with one person, newest first: the enquiry they first ' +
        'wrote, the dated notes, the booking forms, the bookings and stays, the payments (read ' +
        'from `payments`, never from the stale bookings.amount_paid cache), the documents emailed, ' +
        'the transfers and the activities. This is the tool that answers "where are we with X?" ' +
        'without opening six screens. Also returns `silence_days`: how long since anything ' +
        'happened, ignoring future-dated stays.',
      inputSchema: { client_id: z.string().uuid() },
    },
    async ({ client_id }) => {
      const { data: clientRow, error } = await supabase.from('clients').select('*').eq('id', client_id).single()
      if (error || !clientRow) return errorResult(`Client not found: ${error?.message ?? client_id}`)
      const client = clientRow as Client

      const { data: bookingRows, error: bErr } = await supabase.from('bookings').select('*').eq('client_id', client_id)
      if (bErr) return errorResult(`Loading bookings: ${bErr.message}`)
      const bookings = (bookingRows ?? []) as Booking[]
      const ids = bookings.map(b => b.id)

      const { data: enquiryRows, error: eErr } = await supabase.from('enquiries').select('*').eq('client_id', client_id)
      if (eErr) return errorResult(`Loading enquiries: ${eErr.message}`)
      const enquiries = (enquiryRows ?? []) as Enquiry[]
      const enquiryIds = enquiries.map(e => e.id)
      const submissionIds = enquiries.map(e => e.form_submission_id).filter((v): v is string => !!v)

      const none = { data: [] as unknown[], error: null }
      const [notesRes, clientNotesRes, subsRes, paysRes, mailsRes, taxiRes, actRes] = await Promise.all([
        enquiryIds.length ? supabase.from('enquiry_notes').select('*').in('enquiry_id', enquiryIds) : none,
        supabase.from('client_notes').select('*').eq('client_id', client_id),
        ids.length ? supabase.from('form_submissions').select('*').in('created_booking_id', ids) : none,
        ids.length ? supabase.from('payments').select('*').in('booking_id', ids) : none,
        ids.length ? supabase.from('email_logs').select('*').in('booking_id', ids) : none,
        ids.length ? supabase.from('taxi_trips').select('*').in('booking_id', ids) : none,
        ids.length ? supabase.from('activity_bookings').select('*').in('booking_id', ids) : none,
      ])

      // The client_notes migration has not been applied here yet. Not a failure:
      // the rest of the file is still true, and saying so is better than an empty
      // history that looks complete. (The code is PGRST205, not 42P01 — see
      // utils/supabaseErrors.ts.)
      const notesTableMissing = isMissingTable(clientNotesRes.error)

      const extraSubs = submissionIds.length
        ? ((await supabase.from('form_submissions').select('*').in('id', submissionIds)).data ?? [])
        : []
      const submissions = [
        ...((subsRes.data ?? []) as FormSubmission[]),
        ...(extraSubs as FormSubmission[]),
      ].filter((s, i, all) => all.findIndex(o => o.id === s.id) === i)

      const activities = (actRes.data ?? []) as ActivityBooking[]
      let providerNames: Record<string, string> = {}
      if (activities.length) {
        const { data: provs } = await supabase.from('activity_providers').select('id, name')
          .in('id', [...new Set(activities.map(a => a.provider_id))])
        providerNames = Object.fromEntries(((provs ?? []) as { id: string; name: string }[]).map(p => [p.id, p.name]))
      }

      const payments = (paysRes.data ?? []) as Payment[]
      const events = buildDossier({
        enquiries,
        enquiryNotes: (notesRes.data ?? []) as EnquiryNote[],
        clientNotes: notesTableMissing ? [] : ((clientNotesRes.data ?? []) as ClientNote[]),
        submissions,
        bookings,
        payments,
        emails: (mailsRes.data ?? []) as EmailLog[],
        taxiTrips: (taxiRes.data ?? []) as TaxiTrip[],
        activities,
        providerNames,
      })

      return jsonResult({
        client: { id: client.id, name: `${client.first_name} ${client.last_name}`.trim(), email: client.email, phone: client.phone },
        silence_days: daysSinceLastTouch(events),
        money: dossierMoney(payments),
        timeline: events,
        ...(notesTableMissing ? { warning: 'client_notes does not exist on this database — the 2026-09-03 migration is pending. Notes written on a client file are missing from this timeline.' } : {}),
      })
    }
  )

  server.registerTool(
    'search_everything',
    {
      title: 'Search clients, bookings and enquiries at once',
      description:
        'One search over people, bookings and enquiries — including what is written inside ' +
        'enquiry messages and notes. Use it when you have a name, an email, a booking number ' +
        '(#023) or just a remembered word, and do not know which of the three it belongs to. ' +
        'Ranked: a name first, then contact details, then body text. Accent-insensitive.',
      inputSchema: {
        query: z.string().min(2).describe('At least two characters'),
        limit: z.number().int().min(1).max(50).optional(),
      },
    },
    async ({ query, limit }) => {
      const [cl, bk, en, nt, cn] = await Promise.all([
        supabase.from('clients').select('id, first_name, last_name, email, phone, passport_number, notes'),
        supabase.from('bookings').select('id, booking_number, client_id, check_in, check_out, status, notes'),
        supabase.from('enquiries').select('id, name, email, phone, message, status, arrival_month'),
        supabase.from('enquiry_notes').select('enquiry_id, body'),
        supabase.from('client_notes').select('client_id, body'),
      ])
      // A client_notes table that does not exist yet is a pending migration,
      // not a reason to refuse the search.
      const failed = [cl.error, bk.error, en.error, nt.error, isMissingTable(cn.error) ? null : cn.error].filter(Boolean)
      // Half an index answers "not found" for someone who is right there.
      if (failed.length) return errorResult(`Could not search: ${failed.map(f => f!.message).join(', ')}`)

      const notesByEnquiry: Record<string, string[]> = {}
      for (const n of (nt.data ?? []) as { enquiry_id: string; body: string }[]) {
        (notesByEnquiry[n.enquiry_id] ??= []).push(n.body)
      }
      const notesByClient: Record<string, string[]> = {}
      for (const n of (cn.data ?? []) as { client_id: string; body: string }[]) {
        (notesByClient[n.client_id] ??= []).push(n.body)
      }
      const index: SearchIndex = {
        clients: (cl.data ?? []) as SearchIndex['clients'],
        bookings: (bk.data ?? []) as SearchIndex['bookings'],
        enquiries: (en.data ?? []) as SearchIndex['enquiries'],
        notesByEnquiry,
        notesByClient,
      }
      const hits = searchEverything(index, query, limit ?? 20)
      return jsonResult({ count: hits.length, hits })
    }
  )
}
