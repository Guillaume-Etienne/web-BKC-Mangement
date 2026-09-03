import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  ActivityBooking, ActivityProvider, Booking, ClientNote, EmailLog, Enquiry, EnquiryNote,
  FormSubmission, Payment, TaxiTrip,
} from '../types/database'
import { buildDossier, type DossierEvent, type DossierInput } from '../utils/dossier'
import { isMissingTable } from '../utils/supabaseErrors'

/** Everything that ever happened to one person, fetched only when their file is
 *  opened.
 *
 *  Scoped queries rather than page-wide hooks on purpose: Clients is a list
 *  screen, and pulling payments, emails, transfers and activities for everyone
 *  at mount would pay the whole cost for the one row gui actually clicks. Same
 *  reasoning as the July 31 startup audit (−58 %).
 *
 *  The bookings are passed in — the page already has them for the list. */

export interface ClientDossier {
  events: DossierEvent[]
  payments: Payment[]
  bookings: Booking[]
  loading: boolean
  /** Something did not load. The screen must say so: a file that silently
   *  shows half a history reads as "nothing else ever happened". */
  error: string | null
  /** True when `client_notes` does not exist yet — the migration of
   *  2026-09-03 has not been applied to this database. Distinguished from a
   *  real error because it has a different answer: gui runs the SQL. */
  notesTableMissing: boolean
  /** Writes a dated note on this person's file. Resolves to an error message,
   *  or null on success. */
  addNote: (body: string) => Promise<string | null>
  refresh: () => void
}

const EMPTY_INPUT: DossierInput = {
  enquiries: [], enquiryNotes: [], submissions: [], bookings: [],
  payments: [], emails: [], taxiTrips: [], activities: [],
}

export function useClientDossier(clientId: string | null, bookings: Booking[]): ClientDossier {
  const [input, setInput] = useState<DossierInput>(EMPTY_INPUT)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notesTableMissing, setNotesTableMissing] = useState(false)
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick(t => t + 1), [])

  // Join on ids, not on the array identity: `bookings` is a fresh array on
  // every parent render, and depending on it would refetch the whole file in a
  // loop.
  const clientBookings = clientId ? bookings.filter(b => b.client_id === clientId) : []
  const bookingIds = clientBookings.map(b => b.id).sort()
  const bookingKey = bookingIds.join(',')

  useEffect(() => {
    if (!clientId) { setInput(EMPTY_INPUT); setPayments([]); setError(null); return }
    let cancelled = false
    setLoading(true)
    setError(null)

    const run = async () => {
      const ids = bookingKey ? bookingKey.split(',') : []
      const problems: string[] = []

      // Enquiries first: their notes and their submission hang off them.
      const { data: enquiryRows, error: eErr } = await supabase
        .from('enquiries').select('*').eq('client_id', clientId)
      if (eErr) problems.push(`enquiries (${eErr.message})`)
      const enquiries = (enquiryRows ?? []) as Enquiry[]
      const enquiryIds = enquiries.map(e => e.id)

      const submissionIds = enquiries.map(e => e.form_submission_id).filter((v): v is string => !!v)

      const [clientNotesRes, notesRes, subsRes, paysRes, mailsRes, taxiRes, actRes] = await Promise.all([
        supabase.from('client_notes').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
        enquiryIds.length
          ? supabase.from('enquiry_notes').select('*').in('enquiry_id', enquiryIds)
          : Promise.resolve({ data: [], error: null }),
        // Forms that produced one of this client's bookings, plus any the
        // enquiry was matched to before a booking existed.
        ids.length || submissionIds.length
          ? supabase.from('form_submissions').select('*')
              .or([
                ids.length ? `created_booking_id.in.(${ids.join(',')})` : null,
                submissionIds.length ? `id.in.(${submissionIds.join(',')})` : null,
              ].filter(Boolean).join(','))
          : Promise.resolve({ data: [], error: null }),
        ids.length ? supabase.from('payments').select('*').in('booking_id', ids) : Promise.resolve({ data: [], error: null }),
        ids.length ? supabase.from('email_logs').select('*').in('booking_id', ids) : Promise.resolve({ data: [], error: null }),
        ids.length ? supabase.from('taxi_trips').select('*').in('booking_id', ids) : Promise.resolve({ data: [], error: null }),
        ids.length ? supabase.from('activity_bookings').select('*').in('booking_id', ids) : Promise.resolve({ data: [], error: null }),
      ])

      // A missing client_notes table is a pending migration, not a fault: it
      // is said in its own words rather than pushed at gui as an error code.
      const notesMissing = isMissingTable(clientNotesRes.error)
      if (clientNotesRes.error && !notesMissing) problems.push(`client notes (${clientNotesRes.error.message})`)
      if (notesRes.error) problems.push(`notes (${notesRes.error.message})`)
      if (subsRes.error) problems.push(`booking forms (${subsRes.error.message})`)
      if (paysRes.error) problems.push(`payments (${paysRes.error.message})`)
      if (mailsRes.error) problems.push(`emails (${mailsRes.error.message})`)
      if (taxiRes.error) problems.push(`transfers (${taxiRes.error.message})`)
      if (actRes.error) problems.push(`activities (${actRes.error.message})`)

      const activities = (actRes.data ?? []) as ActivityBooking[]
      let providerNames: Record<string, string> = {}
      if (activities.length) {
        const providerIds = [...new Set(activities.map(a => a.provider_id))]
        const { data: provs } = await supabase.from('activity_providers').select('id, name').in('id', providerIds)
        providerNames = Object.fromEntries(((provs ?? []) as Pick<ActivityProvider, 'id' | 'name'>[]).map(p => [p.id, p.name]))
      }

      if (cancelled) return
      const nextPayments = (paysRes.data ?? []) as Payment[]
      setPayments(nextPayments)
      setNotesTableMissing(notesMissing)
      setInput({
        enquiries,
        enquiryNotes: (notesRes.data ?? []) as EnquiryNote[],
        clientNotes: (clientNotesRes.data ?? []) as ClientNote[],
        submissions: (subsRes.data ?? []) as FormSubmission[],
        // Left empty: the bookings are merged in at build time below, so a
        // status changed elsewhere shows here without a refetch.
        bookings: [],
        payments: nextPayments,
        emails: (mailsRes.data ?? []) as EmailLog[],
        taxiTrips: (taxiRes.data ?? []) as TaxiTrip[],
        activities,
        providerNames,
      })
      setError(problems.length ? `Part of this file could not be loaded: ${problems.join(', ')}.` : null)
      setLoading(false)
    }

    run()
    return () => { cancelled = true }
    // `bookings` is intentionally absent: bookingKey carries the only part of
    // it this effect depends on.
  }, [clientId, bookingKey, tick]) // eslint-disable-line react-hooks/exhaustive-deps

  const addNote = useCallback(async (body: string): Promise<string | null> => {
    const text = body.trim()
    if (!clientId || !text) return null
    const { data, error: err } = await supabase.from('client_notes')
      .insert({ client_id: clientId, body: text }).select().single()
    if (err) {
      if (isMissingTable(err)) {
        setNotesTableMissing(true)
        return 'Notes are not stored yet — the 2026-09-03 migration has not been applied to this database.'
      }
      return `The note was NOT saved: ${err.message}`
    }
    // Shown at once rather than waiting for a refetch: a note that vanishes for
    // a second reads as a note that was lost.
    setInput(prev => ({ ...prev, clientNotes: [data as ClientNote, ...(prev.clientNotes ?? [])] }))
    return null
  }, [clientId])

  return {
    events: buildDossier({ ...input, bookings: clientBookings }),
    payments,
    bookings: clientBookings,
    loading,
    error,
    notesTableMissing,
    addNote,
    refresh,
  }
}
