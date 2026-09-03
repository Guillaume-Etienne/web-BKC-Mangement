import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useTable } from '../hooks/useSupabase'
import { useBookings } from '../hooks/useBookings'
import { useClients } from '../hooks/useClients'
import { useTaxiTrips } from '../hooks/useTaxis'
import type { Booking, Client, Enquiry, FormSubmission, FormSubmissionStatus, Lang, TaxiPricingDefaults, TaxiTrip } from '../types/database'
import { activityCountColumns } from '../utils/bookingActivity'
import { blanksToFill, findExistingClient } from '../utils/clientIdentity'
import { addDaysISO as addDays, fmtDate } from '../utils/dates'
import { findCandidateEnquiries, fmtArrivalMonth } from '../utils/enquiries'
import { splitName } from '../utils/names'
import { FALLBACK_TAXI_PRICING } from '../utils/taxiPricing'

// Admin review queue for public booking-form submissions.
// English UI (admin chrome). Approving turns a submission into a real
// client + booking (provisional) + booking_participants — unless the
// submission carries payload.target_booking_id (sent from Documents →
// Overview → Update Form on an EXISTING booking), in which case it updates
// that booking instead of creating a second one.

const LANG_FLAG: Record<Lang, string> = { fr: '🇫🇷', en: '🇬🇧', es: '🇪🇸' }

const STATUS_BADGE: Record<FormSubmissionStatus, string> = {
  pending:  'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  approved: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  rejected: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
}


// ─── Detail / review panel (module scope = focus-safe inputs) ─────────────────
interface DetailProps { s: FormSubmission; onDone: () => void; enquiries: Enquiry[]; bookings: Booking[]; clients: Client[]; taxiTrips: TaxiTrip[] }
function SubmissionDetail({ s, onDone, enquiries, bookings, clients, taxiTrips }: DetailProps) {
  const p = s.payload
  const targetBooking = p.target_booking_id ? bookings.find(b => b.id === p.target_booking_id) : null
  const candidates = useMemo(
    () => findCandidateEnquiries({ email: p.email, name: p.reference_name }, enquiries),
    [p.email, p.reference_name, enquiries])

  /** The enquiry this submission came from, when it rode a personalised link. */
  const linkedEnquiry = p.enquiry_id ? enquiries.find(e => e.id === p.enquiry_id) : undefined

  /** Who this submission will be filed under — computed here rather than inside
   *  the click handler so the panel can *say* it before gui presses the button.
   *  Finding out afterwards that a second "Michel Rulliat" was created is how
   *  the client list rots. */
  const clientMatch = useMemo(
    () => findExistingClient(clients, { linkedClientId: linkedEnquiry?.client_id, email: p.email }),
    [clients, linkedEnquiry?.client_id, p.email])
  const [checkIn, setCheckIn] = useState(p.country_entry_date || '')
  const [checkOut, setCheckOut] = useState(
    p.country_entry_date ? addDays(p.country_entry_date, p.nights_bilene || 0) : ''
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<'reject' | 'reopen' | null>(null)
  // Most recently edited row wins, same guard as TaxiPage (stale duplicate rows → wrong default price)
  const { data: pricingDefaultsData } = useTable<TaxiPricingDefaults>('taxi_pricing_defaults', { order: 'updated_at', ascending: false })
  const pricingDefaults = pricingDefaultsData[0] ?? FALLBACK_TAXI_PRICING

  const alreadyCreated = !!s.created_booking_id
  const datesValid = !!(checkIn && checkOut && checkOut > checkIn)

  /** gui says it is the same person. We only record the link — the enquiry is
   *  not marked won here: no booking exists yet, and "won" must keep meaning
   *  "they are coming". */
  async function linkEnquiry(enquiryId: string) {
    setBusy(true)
    const { error } = await supabase.from('enquiries')
      .update({ form_submission_id: s.id, last_contact_at: new Date().toISOString() })
      .eq('id', enquiryId)
    setBusy(false)
    if (error) { setError('Enquiry link: ' + error.message); return }
    onDone()
  }

  async function createBooking() {
    if (!datesValid || alreadyCreated) return
    setBusy(true)
    setError(null)

    // 1. Client — reuse before creating.
    //    This used to insert unconditionally, even when the enquiry already
    //    carried a client_id that gui had attached by hand. The second row
    //    splits a returning guest's history in two and silently kills the
    //    "already been here" signal. Matching rule (explicit link, then exact
    //    email, never a name): utils/clientIdentity.ts.
    const { first, last } = splitName(p.reference_name)
    const contact = {
      email: p.email || null,
      phone: p.phone || null,
      emergency_contact_name: p.emergency_contact_name || null,
      emergency_contact_phone: p.emergency_contact_phone || null,
      emergency_contact_email: p.emergency_contact_email || null,
      emergency_contact_relation: p.emergency_contact_relation || null,
    }
    let clientId: string
    if (clientMatch) {
      clientId = clientMatch.client.id
      // Complete what the existing record leaves empty, overwrite nothing:
      // a number gui fixed by hand outranks whatever the guest retyped today.
      const patch = blanksToFill(clientMatch.client, contact)
      if (Object.keys(patch).length > 0) {
        const { error: fillErr } = await supabase.from('clients').update(patch).eq('id', clientId)
        // Not fatal — the booking still belongs to the right person — but said
        // out loud, so gui does not trust a phone number that was never saved.
        if (fillErr) setError(`Client reused, but the missing contact details were not filled in: ${fillErr.message}`)
      }
    } else {
      const { data: created, error: cErr } = await supabase.from('clients').insert({
        first_name: first || p.reference_name || 'Unknown',
        last_name: last || '',
        ...contact,
        notes: null, nationality: null, passport_number: null, birth_date: null, kite_level: null,
        import_id: s.id,
      }).select('id').single()
      if (cErr || !created) { setError('Client: ' + (cErr?.message ?? 'unknown')); setBusy(false); return }
      clientId = created.id
    }

    // 2. Booking (provisional)
    //
    // `notes` is gui's own field. It used to be filled with four lines of
    // machine chatter — "Created from public booking form.", the transfer
    // date/time, "Heard about us: …", the whole original message — so finding
    // his own sentence meant reading past the noise first. Each of those now
    // has a real home, and only one bit is left with nowhere else to live:
    //   • came from the form   → the 📣 marker and the client timeline
    //   • transfer date/time   → the taxi trips created below, where it belongs
    //   • heard about us       → bookings.referral_source, a real column
    //   • original message     → read back from the enquiry (EnquiryOriginPanel)
    //   • single beds          → no column anywhere, so it stays here
    // The enquiry's dated notes are likewise never copied: two copies of the
    // same sentence end up disagreeing.
    const noteBits: string[] = []
    if (p.single_beds) noteBits.push(`Single beds requested: ${p.single_beds}.`)
    // Activity counters derived from the per-traveler form flags (kept in sync on the participants below)
    const formTravelers = (p.travelers ?? []).filter(t => t.first_name.trim())
    const { data: booking, error: bErr } = await supabase.from('bookings').insert({
      client_id: clientId,
      check_in: checkIn,
      check_out: checkOut,
      ...activityCountColumns(formTravelers),
      visa_entry_date: p.country_entry_date || null,
      visa_exit_date: p.country_exit_date || null,
      status: 'provisional',
      notes: noteBits.join(' ') || null,
      arrival_time: p.arrival_time || null,
      departure_time: p.departure_time || null,
      luggage_count: p.luggage_count || 0,
      boardbag_count: p.boardbag_count || 0,
      taxi_arrival: !!p.taxi_arrival,
      taxi_departure: !!p.taxi_departure,
      couples_count: p.double_beds || 0,
      children_count: 0,
      amount_paid: 0,
      has_travel_insurance: !!p.has_travel_insurance,
      waiver_accepted_at: p.waiver_accepted ? s.submitted_at : null,
      waiver_version: p.waiver_accepted ? p.waiver_version : null,
      referral_source: p.referral_source || null,
      import_id: s.id,
      emergency_contact_name: p.emergency_contact_name || null,
      emergency_contact_phone: p.emergency_contact_phone || null,
      emergency_contact_email: p.emergency_contact_email || null,
    }).select('id').single()
    if (bErr || !booking) { setError('Booking: ' + (bErr?.message ?? 'unknown')); setBusy(false); return }

    // 3. Participants — keep the per-traveler activity flags (source of truth for the counters above)
    const travelers = formTravelers
    if (travelers.length > 0) {
      const { error: pErr } = await supabase.from('booking_participants').insert(
        travelers.map(t => ({
          booking_id: booking.id,
          first_name: t.first_name.trim(),
          last_name: t.last_name.trim() || null,
          passport_number: t.passport_number.trim() || null,
          kite_level: t.does_kite ? (t.kite_level ?? null) : null,
          does_kite: !!t.does_kite,
          brings_own_gear: !!t.brings_own_gear,
          needs_storage: !!t.needs_storage,
          wants_kite_lessons: !!t.wants_kite_lessons,
          wants_kite_rental: !!t.wants_kite_rental,
          wants_wing_lessons: !!t.wants_wing_lessons,
          client_id: null,
          notes: null,
        }))
      )
      if (pErr) { setError('Participants: ' + pErr.message); setBusy(false); return }
    }

    // 3.5 Taxi trips — same auto-create as the manual booking wizard, minus the
    // driver (the guest never picks one). Below 4 people it is safely a small
    // taxi, so the standard defaults are pre-filled; above that the vehicle
    // changes and so does the price, so it is left at 0 for gui to fill in.
    const nbPersons = travelers.length || 1
    const smallTaxi = nbPersons <= 3
    const taxiBase = {
      booking_id:         booking.id,
      taxi_driver_id:     null,
      status:             'needs_details' as const,
      nb_persons:         nbPersons,
      nb_luggage:         p.luggage_count || 0,
      nb_boardbags:       p.boardbag_count || 0,
      notes:              null,
      price_eur:          smallTaxi ? pricingDefaults.default_price_eur : 0,
      price_driver_mzn:   smallTaxi ? pricingDefaults.default_driver_mzn : 0,
      margin_manager_mzn: smallTaxi ? pricingDefaults.default_manager_mzn : 0,
    }
    // The guest is asked for a pickup date and time *distinct from the flight*
    // (payload.transfer_to_*), and until now that answer only ever landed in the
    // booking notes as a sentence — the trip itself was created on the check-in
    // date at the flight time, so gui had to read the note and fix the row by
    // hand. The answer now goes where it belongs; the stay dates and flight
    // times remain the fallback when the guest left it empty.
    if (p.taxi_arrival) {
      const { error: taxiInErr } = await supabase.from('taxi_trips').insert({
        ...taxiBase,
        date: p.transfer_to_bilene_date || checkIn,
        start_time: p.transfer_to_bilene_time || p.arrival_time || '00:00',
        type: 'aero-to-center',
      })
      if (taxiInErr) setError(`Booking created, but the arrival transfer was not (${taxiInErr.message}). Add it in Taxis.`)
    }
    if (p.taxi_departure) {
      const { error: taxiOutErr } = await supabase.from('taxi_trips').insert({
        ...taxiBase,
        date: p.transfer_to_airport_date || checkOut,
        start_time: p.transfer_to_airport_time || p.departure_time || '00:00',
        type: 'center-to-aero',
      })
      if (taxiOutErr) setError(`Booking created, but the departure transfer was not (${taxiOutErr.message}). Add it in Taxis.`)
    }

    // 4. Mark submission approved
    const { error: uErr } = await supabase.from('form_submissions')
      .update({ status: 'approved', reviewed_at: new Date().toISOString(), created_booking_id: booking.id })
      .eq('id', s.id)
    if (uErr) { setError('Submission update: ' + uErr.message); setBusy(false); return }

    // 5. Close the loop on the enquiry this came from, when there was one.
    //    Reported rather than swallowed: a booking that exists while its
    //    enquiry still sits in the working list is how the same person gets
    //    chased for an answer they already gave.
    const enquiryId = (p as { enquiry_id?: string }).enquiry_id
    if (enquiryId) {
      const { error: eErr } = await supabase.from('enquiries').update({
        status: 'won',
        booking_id: booking.id,
        client_id: clientId,
        form_submission_id: s.id,
        last_contact_at: new Date().toISOString(),
      }).eq('id', enquiryId)
      if (eErr) setError(`Booking created, but the enquiry was not marked won: ${eErr.message}`)
    }

    setBusy(false)
    onDone()
  }

  // Update-form path: the submission carries payload.target_booking_id — this
  // is a client filling in what was missing on a booking that already exists,
  // not a new one. Overwrites the relevant fields outright (gui's call: no
  // diff screen), and never touches check_in/check_out or rooms — those are
  // fixed by the room booking, this form only ever asked about visa/travel
  // dates and personal details.
  async function applyToBooking() {
    if (!targetBooking || alreadyCreated) return
    setBusy(true)
    setError(null)

    // 1. Client — same person, update in place rather than creating a new row.
    const { first, last } = splitName(p.reference_name)
    const { error: cErr } = await supabase.from('clients').update({
      first_name: first || p.reference_name || 'Unknown',
      last_name: last || '',
      email: p.email || null,
      phone: p.phone || null,
      emergency_contact_name: p.emergency_contact_name || null,
      emergency_contact_phone: p.emergency_contact_phone || null,
      emergency_contact_email: p.emergency_contact_email || null,
      emergency_contact_relation: p.emergency_contact_relation || null,
    }).eq('id', targetBooking.client_id)
    if (cErr) { setError('Client: ' + cErr.message); setBusy(false); return }

    // 2. Booking — only the fields this form actually asks about.
    const formTravelers = (p.travelers ?? []).filter(t => t.first_name.trim())
    const { error: bErr } = await supabase.from('bookings').update({
      ...activityCountColumns(formTravelers),
      visa_entry_date: p.country_entry_date || null,
      visa_exit_date: p.country_exit_date || null,
      arrival_time: p.arrival_time || null,
      departure_time: p.departure_time || null,
      luggage_count: p.luggage_count || 0,
      boardbag_count: p.boardbag_count || 0,
      taxi_arrival: !!p.taxi_arrival,
      taxi_departure: !!p.taxi_departure,
      couples_count: p.double_beds || 0,
      has_travel_insurance: !!p.has_travel_insurance,
      waiver_accepted_at: p.waiver_accepted ? s.submitted_at : null,
      waiver_version: p.waiver_accepted ? p.waiver_version : null,
      referral_source: p.referral_source || null,
      emergency_contact_name: p.emergency_contact_name || null,
      emergency_contact_phone: p.emergency_contact_phone || null,
      emergency_contact_email: p.emergency_contact_email || null,
    }).eq('id', targetBooking.id)
    if (bErr) { setError('Booking: ' + bErr.message); setBusy(false); return }

    // 3. Participants — delete-all-then-reinsert, same idiom the wizard already
    //    uses for external stays: the form is the new source of truth for the
    //    crew list, not something to reconcile row by row against the old one.
    const { error: delErr } = await supabase.from('booking_participants').delete().eq('booking_id', targetBooking.id)
    if (delErr) { setError('Participants: ' + delErr.message); setBusy(false); return }
    if (formTravelers.length > 0) {
      const { error: pErr } = await supabase.from('booking_participants').insert(
        formTravelers.map(t => ({
          booking_id: targetBooking.id,
          first_name: t.first_name.trim(),
          last_name: t.last_name.trim() || null,
          passport_number: t.passport_number.trim() || null,
          kite_level: t.does_kite ? (t.kite_level ?? null) : null,
          does_kite: !!t.does_kite,
          brings_own_gear: !!t.brings_own_gear,
          needs_storage: !!t.needs_storage,
          wants_kite_lessons: !!t.wants_kite_lessons,
          wants_kite_rental: !!t.wants_kite_rental,
          wants_wing_lessons: !!t.wants_wing_lessons,
          client_id: null,
          notes: null,
        }))
      )
      if (pErr) { setError('Participants: ' + pErr.message); setBusy(false); return }
    }

    // 4. Taxi trips — same existence guard as the booking wizard (BookingsPage,
    //    "checkbox creates a trip on edit too"): only create a leg that is both
    //    requested and not already covered, so re-applying never duplicates.
    const existingTripTypes = new Set(taxiTrips.filter(t => t.booking_id === targetBooking.id).map(t => t.type))
    const nbPersons = formTravelers.length || 1
    const smallTaxi = nbPersons <= 3
    const taxiBase = {
      booking_id:         targetBooking.id,
      taxi_driver_id:     null,
      status:             'needs_details' as const,
      nb_persons:         nbPersons,
      nb_luggage:         p.luggage_count || 0,
      nb_boardbags:       p.boardbag_count || 0,
      notes:              null,
      price_eur:          smallTaxi ? pricingDefaults.default_price_eur : 0,
      price_driver_mzn:   smallTaxi ? pricingDefaults.default_driver_mzn : 0,
      margin_manager_mzn: smallTaxi ? pricingDefaults.default_manager_mzn : 0,
    }
    if (p.taxi_arrival && !existingTripTypes.has('aero-to-center')) {
      const { error: taxiInErr } = await supabase.from('taxi_trips').insert({
        ...taxiBase, date: targetBooking.check_in, start_time: p.arrival_time || '00:00', type: 'aero-to-center',
      })
      if (taxiInErr) setError(`Booking updated, but the arrival transfer was not (${taxiInErr.message}). Add it in Taxis.`)
    }
    if (p.taxi_departure && !existingTripTypes.has('center-to-aero')) {
      const { error: taxiOutErr } = await supabase.from('taxi_trips').insert({
        ...taxiBase, date: targetBooking.check_out, start_time: p.departure_time || '00:00', type: 'center-to-aero',
      })
      if (taxiOutErr) setError(`Booking updated, but the departure transfer was not (${taxiOutErr.message}). Add it in Taxis.`)
    }

    // 5. Mark submission approved — created_booking_id now reads as "the
    //    booking this submission produced", new or pre-existing, so the same
    //    alreadyCreated guard above works for both paths without a new column.
    const { error: uErr } = await supabase.from('form_submissions')
      .update({ status: 'approved', reviewed_at: new Date().toISOString(), created_booking_id: targetBooking.id })
      .eq('id', s.id)
    if (uErr) { setError('Submission update: ' + uErr.message); setBusy(false); return }

    setBusy(false)
    onDone()
  }

  async function reject() {
    setBusy(true)
    setError(null)
    const { error: uErr } = await supabase.from('form_submissions')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', s.id)
    setBusy(false)
    if (uErr) { setError(uErr.message); return }
    onDone()
  }

  async function reopen() {
    setBusy(true)
    setError(null)
    const { error: uErr } = await supabase.from('form_submissions')
      .update({ status: 'pending', reviewed_at: null })
      .eq('id', s.id)
    setBusy(false)
    if (uErr) { setError(uErr.message); return }
    onDone()
  }

  const rowCls = 'flex justify-between gap-4 py-1.5 border-b border-gray-50 dark:border-gray-800 text-sm'

  return (
    <div className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-800 px-5 py-4 space-y-5">
      {/* Trip */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-400 mb-2">Trip</h4>
        <div className={rowCls}><span className="text-gray-500 dark:text-gray-400">Country entry (visa)</span><span className="font-medium">{fmtDate(p.country_entry_date)} {p.arrival_time && `· ${p.arrival_time}`}</span></div>
        <div className={rowCls}><span className="text-gray-500 dark:text-gray-400">Country exit (visa)</span><span className="font-medium">{fmtDate(p.country_exit_date)} {p.departure_time && `· ${p.departure_time}`}</span></div>
        <div className={rowCls}><span className="text-gray-500 dark:text-gray-400">Nights in Bilene</span><span className="font-medium">{p.nights_bilene}</span></div>
        <div className={rowCls}>
          <span className="text-gray-500 dark:text-gray-400">Transfer to Bilene</span>
          <span className="font-medium">{p.taxi_arrival ? `🚕 ${fmtDate(p.transfer_to_bilene_date)}${p.transfer_to_bilene_time ? ` · ${p.transfer_to_bilene_time}` : ''}` : 'No'}</span>
        </div>
        <div className={rowCls}>
          <span className="text-gray-500 dark:text-gray-400">Transfer to airport</span>
          <span className="font-medium">{p.taxi_departure ? `🚕 ${fmtDate(p.transfer_to_airport_date)}${p.transfer_to_airport_time ? ` · ${p.transfer_to_airport_time}` : ''}` : 'No'}</span>
        </div>
      </div>

      {/* Logistics */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-400 mb-2">Logistics</h4>
        <div className={rowCls}><span className="text-gray-500 dark:text-gray-400">Bags / Kite bags</span><span className="font-medium">{p.luggage_count} / {p.boardbag_count}</span></div>
        <div className={rowCls}><span className="text-gray-500 dark:text-gray-400">Double beds / Single beds</span><span className="font-medium">{p.double_beds} / {p.single_beds}</span></div>
        <div className={rowCls}><span className="text-gray-500 dark:text-gray-400">Travel insurance</span><span className="font-medium">{p.has_travel_insurance ? 'Yes' : 'No'}</span></div>
      </div>

      {/* Crew */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-400 mb-2">Crew ({p.travelers?.length ?? 0})</h4>
        <div className="space-y-1">
          {(p.travelers ?? []).map((t, i) => {
            const kiteFlags = t.does_kite ? [
              t.kite_level,
              t.brings_own_gear ? (t.needs_storage ? 'own gear + storage' : 'own gear') : null,
              t.wants_kite_lessons ? 'lessons' : null,
              t.wants_kite_rental ? 'rental' : null,
              t.wants_wing_lessons ? 'wing' : null,
            ].filter(Boolean).join(' · ') : null
            return (
              <div key={i} className="py-1.5 border-b border-gray-50 dark:border-gray-800 space-y-0.5">
                <div className="text-sm flex justify-between gap-4">
                  <span className="font-medium">{t.first_name} {t.last_name}</span>
                  <span className="text-gray-500 dark:text-gray-400">{t.passport_number || '— no passport —'}</span>
                </div>
                {t.does_kite
                  ? <p className="text-xs text-sky-600 dark:text-sky-400">🪁 {kiteFlags || 'kiter'}</p>
                  : <p className="text-xs text-gray-400 dark:text-gray-400">— no kite</p>
                }
              </div>
            )
          })}
        </div>
      </div>

      {/* Emergency + waiver */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-400 mb-2">Emergency contact</h4>
        <div className={rowCls}><span className="text-gray-500 dark:text-gray-400">Name</span><span className="font-medium">{p.emergency_contact_name || '—'}</span></div>
        <div className={rowCls}><span className="text-gray-500 dark:text-gray-400">Phone / Email</span><span className="font-medium">{p.emergency_contact_phone || '—'} · {p.emergency_contact_email || '—'}</span></div>
        <div className={rowCls}><span className="text-gray-500 dark:text-gray-400">Relationship</span><span className="font-medium">{p.emergency_contact_relation || '—'}</span></div>
        <div className={rowCls}><span className="text-gray-500 dark:text-gray-400">Waiver accepted</span><span className="font-medium">{p.waiver_accepted ? `✅ ${p.waiver_version}` : '❌'}</span></div>
      </div>

      {/* Which enquiry is this person? Attached by construction when they came
          through a personalised link; otherwise suggested, never merged on our
          own — a wrong merge mixes two people's passports and payments, and
          that is neither noticed nor undone easily. */}
      {s.status === 'pending' && !p.enquiry_id && candidates.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
            Is this someone you were already talking to?
          </p>
          {candidates.map(c => (
            <div key={c.enquiry.id} className="flex items-center justify-between gap-3 flex-wrap text-sm">
              <span className="text-gray-700 dark:text-gray-300">
                <strong>{c.enquiry.name}</strong>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                  {c.reason === 'email' ? 'same email' : 'similar name'}
                  {c.enquiry.arrival_month && ` · ${fmtArrivalMonth(c.enquiry.arrival_month)}`}
                </span>
              </span>
              <button onClick={() => linkEnquiry(c.enquiry.id)} disabled={busy}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded text-xs font-semibold">
                It's the same person
              </button>
            </div>
          ))}
          <p className="text-xs text-amber-800 dark:text-amber-400">
            Ignore this if it is someone new — nothing happens until you say so.
          </p>
        </div>
      )}

      {/* Update-form path: target_booking_id set, and it still resolves to a real booking */}
      {s.status === 'pending' && p.target_booking_id && targetBooking && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Sent from an existing booking — applying updates <strong>#{String(targetBooking.booking_number).padStart(3, '0')}</strong> in
            place (visa dates, transfer times, passport numbers, emergency contact). Room dates and price are never touched.
          </p>
          {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
          {confirmAction === 'reject' ? (
            <div className="flex items-center gap-3 pt-1">
              <span className="text-sm text-gray-600 dark:text-gray-400">Reject this submission?</span>
              <button type="button" onClick={() => { setConfirmAction(null); reject() }} disabled={busy}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 transition">
                Yes, reject
              </button>
              <button type="button" onClick={() => setConfirmAction(null)}
                className="px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={applyToBooking} disabled={busy || alreadyCreated}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition ${!busy && !alreadyCreated ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-400 cursor-not-allowed'}`}>
                {busy ? 'Working…' : alreadyCreated ? 'Already applied' : `Apply to booking #${String(targetBooking.booking_number).padStart(3, '0')}`}
              </button>
              <button type="button" onClick={() => setConfirmAction('reject')} disabled={busy}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                Reject
              </button>
            </div>
          )}
        </div>
      )}
      {/* Update-form path, but the booking it targeted is gone — surface it instead of silently falling through to "create a new booking" */}
      {s.status === 'pending' && p.target_booking_id && !targetBooking && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-rose-200 dark:border-rose-900 p-4 space-y-2">
          <p className="text-sm text-rose-600 dark:text-rose-400">⚠ This was sent from a booking that no longer exists — nothing to apply it to. Reject it, or handle it by hand.</p>
          <button type="button" onClick={() => setConfirmAction('reject')} disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            Reject
          </button>
          {confirmAction === 'reject' && (
            <div className="flex items-center gap-3 pt-1">
              <span className="text-sm text-gray-600 dark:text-gray-400">Reject this submission?</span>
              <button type="button" onClick={() => { setConfirmAction(null); reject() }} disabled={busy}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 transition">
                Yes, reject
              </button>
              <button type="button" onClick={() => setConfirmAction(null)}
                className="px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
      {/* Bilene dates + actions — a fresh public submission, not tied to an existing booking */}
      {s.status === 'pending' && !p.target_booking_id && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Confirm the Bilene check-in / check-out before creating the booking (defaulted from country entry + nights).</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Check-in (Bilene)</label>
              <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Check-out (Bilene)</label>
              <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {!datesValid && <p className="text-xs text-rose-500 dark:text-rose-400">Check-out must be after check-in.</p>}
          {/* Said before the click, not after: which file this booking lands in
              is the one thing that cannot be undone from this screen. */}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {clientMatch ? (
              <>
                Files under the existing client{' '}
                <strong className="text-gray-700 dark:text-gray-300">
                  {clientMatch.client.first_name} {clientMatch.client.last_name}
                </strong>{' '}
                <span className="text-gray-400 dark:text-gray-500">
                  ({clientMatch.reason === 'linked' ? 'linked to the enquiry' : 'same email'})
                </span>{' '}
                — missing contact details will be filled in, nothing overwritten.
              </>
            ) : (
              <>Creates a <strong className="text-gray-700 dark:text-gray-300">new client</strong> — no existing record matches this email.</>
            )}
          </p>
          {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
          {confirmAction === 'reject' ? (
            <div className="flex items-center gap-3 pt-1">
              <span className="text-sm text-gray-600 dark:text-gray-400">Reject this submission?</span>
              <button type="button" onClick={() => { setConfirmAction(null); reject() }} disabled={busy}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 transition">
                Yes, reject
              </button>
              <button type="button" onClick={() => setConfirmAction(null)}
                className="px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={createBooking} disabled={!datesValid || busy || alreadyCreated}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition ${datesValid && !busy && !alreadyCreated ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-400 cursor-not-allowed'}`}>
                {busy ? 'Working…' : alreadyCreated ? 'Already created' : 'Create booking'}
              </button>
              <button type="button" onClick={() => setConfirmAction('reject')} disabled={busy}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                Reject
              </button>
            </div>
          )}
        </div>
      )}
      {s.status === 'approved' && s.created_booking_id && (
        <p className="text-sm text-green-700 dark:text-green-400">
          ✅ Approved — {p.target_booking_id ? 'booking updated.' : 'booking created.'}
        </p>
      )}
      {s.status === 'rejected' && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">This submission was rejected.</p>
          {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
          {confirmAction === 'reopen' ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 dark:text-gray-400">Move back to pending?</span>
              <button type="button" onClick={() => { setConfirmAction(null); reopen() }} disabled={busy}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 transition">
                Yes, reconsider
              </button>
              <button type="button" onClick={() => setConfirmAction(null)}
                className="px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmAction('reopen')} disabled={busy}
              className="px-4 py-2 rounded-lg text-sm font-medium text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition">
              ↩ Reconsider (move back to pending)
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SubmissionsPage() {
  const { data: submissions, loading, refresh } = useTable<FormSubmission>('form_submissions', { order: 'submitted_at', ascending: false })
  // For the "is this someone you were already talking to?" suggestion.
  const { data: enquiries } = useTable<Enquiry>('enquiries', { order: 'last_contact_at' })
  // Only read when a submission targets an existing booking (Update Form).
  const { data: bookings } = useBookings()
  const { data: taxiTrips } = useTaxiTrips()
  // So approving can reuse an existing client instead of minting a duplicate.
  const { data: clients } = useClients()
  const [tab, setTab] = useState<FormSubmissionStatus>('pending')
  const [openId, setOpenId] = useState<string | null>(null)

  const filtered = submissions.filter(s => s.status === tab)
  const counts: Record<FormSubmissionStatus, number> = {
    pending: submissions.filter(s => s.status === 'pending').length,
    approved: submissions.filter(s => s.status === 'approved').length,
    rejected: submissions.filter(s => s.status === 'rejected').length,
  }

  const tabs: FormSubmissionStatus[] = ['pending', 'approved', 'rejected']

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">📝 Booking form submissions</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Review public form submissions and turn them into bookings.</p>
        </div>
      </div>

      {/* Reminder: notification emails are hardcoded, not editable in the app */}
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/40 px-3 py-2 text-sm text-sky-800 dark:text-sky-400">
        <span aria-hidden>✉️</span>
        <p>
          When a client submits this form, two emails go out automatically: an acknowledgment to the
          client and a notification to <span className="font-medium">contact@bilenekite.com</span>.
          Their wording is hardcoded in the <code className="rounded bg-sky-100 dark:bg-sky-900/30 px-1">notify-submission</code> function —
          <span className="font-medium"> ask Claude to edit them</span>.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {tabs.map(t => (
          <button key={t} onClick={() => { setTab(t); setOpenId(null) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
            {t} <span className="opacity-70">({counts[t]})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 dark:text-gray-400 text-center py-12">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 dark:text-gray-400 text-center py-12">No {tab} submissions.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => {
            const open = openId === s.id
            return (
              <div key={s.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <button onClick={() => setOpenId(open ? null : s.id)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg shrink-0">{LANG_FLAG[s.language]}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">{s.reference_name || '—'}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-400">
                        {s.num_travelers ?? '?'} traveler(s) · arrival {fmtDate(s.arrival_date)} · {s.submitted_at.slice(0, 10)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[s.status]}`}>{s.status}</span>
                    <span className="text-gray-300 dark:text-gray-500 text-sm">{open ? '▲' : '▼'}</span>
                  </div>
                </button>
                {open && <SubmissionDetail s={s} enquiries={enquiries} bookings={bookings} clients={clients} taxiTrips={taxiTrips} onDone={() => { setOpenId(null); refresh() }} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
