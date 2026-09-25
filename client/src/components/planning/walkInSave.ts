/** Saving a walk-in: the ONE sequenced handler that turns "Joao, 2h private
 *  with Tino, paid cash" into rows. See `.claude/docs/WALK_INS.md`.
 *
 *  Order matters (each step needs the previous one's id), so it is a single
 *  async function awaited step by step — never a set of fire-and-forget
 *  `persist` calls, which guarantee no ordering between FK-linked writes.
 *
 *  Columns from the 2026-09-25 migration (`bookings.kind`,
 *  `clients.custom_lesson_rate`, `clients.waiver_signed_at`) are written by
 *  separate UPDATEs: on a base without the migration the visit is still saved,
 *  and the result carries a warning instead of the whole thing failing.
 */
import { supabase } from '../../lib/supabase'
import type { Booking, BookingParticipant, Client, EquipmentRental, Lesson, LessonType, Payment, PaymentMethod, RentalSlot } from '../../types/database'
import { findExistingClient } from '../../utils/clientIdentity'
import { findVisitOn, newVisitBookingRow, newVisitParticipantRow } from '../../utils/dayVisitor'
import { isMissingColumn } from '../../utils/supabaseErrors'

export type WalkInClient =
  | { kind: 'existing'; id: string }
  | { kind: 'new'; first_name: string; last_name: string; phone: string; email: string; custom_lesson_rate: number | null }

export interface WalkInLesson {
  type: LessonType
  instructor_id: string
  start_time: string
  duration_hours: number
  price_per_hour: number | null
  instructor_rate: number | null
  notes: string | null
  kite_id: string | null
  board_id: string | null
}

export interface WalkInRental {
  equipment_id: string | null
  slot: RentalSlot
  price: number
  notes: string | null
}

export interface WalkInRequest {
  date: string
  client: WalkInClient
  /** Tick "waiver signed (paper)" — stamped on the client, once for good. */
  waiverSigned: boolean
  lesson?: WalkInLesson
  rental?: WalkInRental
  payment?: { amount: number; method: PaymentMethod }
}

export interface WalkInResult {
  error: string | null
  /** Saved, but something from the pending migration could not be written. */
  warnings: string[]
  reusedVisit: boolean
  client?: Client
  booking?: Booking
  participant?: BookingParticipant
  lesson?: Lesson
  rental?: EquipmentRental
  payment?: Payment
}

const MIGRATION_HINT = 'migration 2026-09-25_walk_ins.sql not applied yet'

export async function saveWalkIn(
  req: WalkInRequest,
  ctx: { clients: Client[]; bookings: Booking[]; participants: BookingParticipant[] },
): Promise<WalkInResult> {
  const warnings: string[] = []
  const fail = (step: string, message: string): WalkInResult =>
    ({ error: `${step}: ${message}`, warnings, reusedVisit: false })

  // ── 1. The client: picked, or created — reusing an exact email match rather
  //       than creating a second file for the same person (utils/clientIdentity).
  let client: Client | undefined
  if (req.client.kind === 'existing') {
    const wanted = req.client.id
    client = ctx.clients.find(c => c.id === wanted)
    if (!client) return fail('Client', 'not found')
  } else {
    const n = req.client
    const match = findExistingClient(ctx.clients, { email: n.email })
    if (match) {
      client = match.client
    } else {
      const { data, error } = await supabase.from('clients').insert([{
        first_name: n.first_name.trim(),
        last_name: n.last_name.trim(),
        phone: n.phone.trim() || null,
        email: n.email.trim() || null,
      }]).select('*').single()
      if (error || !data) return fail('Client', error?.message ?? 'no row returned')
      client = data as Client
      if (n.custom_lesson_rate != null) {
        const { error: rateErr } = await supabase.from('clients')
          .update({ custom_lesson_rate: n.custom_lesson_rate }).eq('id', client.id)
        if (rateErr) warnings.push(`Mate's rate not saved (${isMissingColumn(rateErr) ? MIGRATION_HINT : rateErr.message})`)
        else client = { ...client, custom_lesson_rate: n.custom_lesson_rate }
      }
    }
  }

  // ── 2. Waiver, stamped once on the client.
  if (req.waiverSigned && !client.waiver_signed_at) {
    const now = new Date().toISOString()
    const { error } = await supabase.from('clients').update({ waiver_signed_at: now }).eq('id', client.id)
    if (error) warnings.push(`Waiver not recorded (${isMissingColumn(error) ? MIGRATION_HINT : error.message})`)
    else client = { ...client, waiver_signed_at: now }
  }

  // ── 3. The visit: the one already open today, or a new day-visitor booking.
  let booking: Booking
  let participant: BookingParticipant
  const existing = findVisitOn(ctx.bookings, ctx.participants, client.id, req.date)
  const reusedVisit = !!existing
  if (existing) {
    booking = existing.booking
    participant = existing.participant
  } else {
    const { data: b, error: bErr } = await supabase.from('bookings')
      .insert([newVisitBookingRow(client.id, req.date)]).select('*').single()
    if (bErr || !b) return fail('Visit', bErr?.message ?? 'no row returned')
    booking = { ...(b as Booking), client }

    const { error: kErr } = await supabase.from('bookings').update({ kind: 'day_visitor' }).eq('id', booking.id)
    if (kErr) warnings.push(`Visit saved as an ordinary booking — it will show in the "No room" row (${isMissingColumn(kErr) ? MIGRATION_HINT : kErr.message})`)
    else booking = { ...booking, kind: 'day_visitor' }

    const { data: p, error: pErr } = await supabase.from('booking_participants')
      .insert([newVisitParticipantRow(booking.id, client)]).select('*').single()
    if (pErr || !p) return { ...fail('Participant', pErr?.message ?? 'no row returned'), booking, client }
    participant = p as BookingParticipant
  }

  const result: WalkInResult = { error: null, warnings, reusedVisit, client, booking, participant }

  // ── 4. What they came for.
  if (req.lesson) {
    const lesson: Lesson = {
      id: crypto.randomUUID(),
      booking_id: booking.id,
      participant_ids: [participant.id],
      date: req.date,
      ...req.lesson,
    }
    const { error } = await supabase.from('lessons').insert([lesson])
    if (error) return { ...result, error: `Lesson: ${error.message}` }
    result.lesson = lesson
  }
  if (req.rental) {
    const rental: EquipmentRental = {
      id: crypto.randomUUID(),
      booking_id: booking.id,
      participant_id: participant.id,
      date: req.date,
      ...req.rental,
    }
    const { error } = await supabase.from('equipment_rentals').insert([rental])
    if (error) return { ...result, error: `Rental: ${error.message}` }
    result.rental = rental
  }

  // ── 5. Money in hand. Verified: gui (or whoever types it) is holding it.
  if (req.payment && req.payment.amount > 0) {
    const payment: Payment = {
      id: crypto.randomUUID(),
      booking_id: booking.id,
      date: req.date,
      amount: req.payment.amount,
      method: req.payment.method,
      is_deposit: false,
      is_verified: true,
      is_discount: false,
      notes: 'Walk-in',
    }
    const { error } = await supabase.from('payments').insert([payment])
    if (error) return { ...result, error: `Payment: ${error.message}` }
    result.payment = payment
  }

  return result
}
