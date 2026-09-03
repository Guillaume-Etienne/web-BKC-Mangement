/** One person's whole file, in one column, oldest at the bottom.
 *
 *  Why: the app has objects — a client, an enquiry, a booking, a document, a
 *  payment — but nothing that represents *the person over time*. Answering
 *  "who wanted what, and where are we with them?" meant opening Clients,
 *  Requests, Bookings, Documents, Accounting and Taxis in turn, and hoping the
 *  relevant sentence had been written down somewhere findable.
 *
 *  Assembled at read time from the tables that already exist — no new table, no
 *  migration, nothing to keep in sync. A stored feed would be a second copy of
 *  facts that live elsewhere, and second copies drift.
 *
 *  This module is pure on purpose: the fetching lives in hooks/useClientDossier,
 *  so the assembly rules can be tested without a database.
 */
import type {
  ActivityBooking, Booking, ClientNote, EmailLog, EmailLogType, Enquiry, EnquiryNote,
  FormSubmission, Payment, TaxiTrip,
} from '../types/database'

export type DossierEventKind =
  | 'enquiry' | 'note' | 'submission' | 'booking' | 'stay'
  | 'payment' | 'email' | 'taxi' | 'activity'

export interface DossierEvent {
  /** Unique within a dossier — `${kind}:${row id}`, so React keys are stable. */
  id: string
  /** ISO date or timestamp. Sorted as a string: the YYYY-MM-DD prefix rules,
   *  so a plain date and a timestamp on the same day stay next to each other. */
  at: string
  kind: DossierEventKind
  icon: string
  title: string
  detail?: string | null
  /** EUR, when the line is about money. */
  amount?: number | null
  bookingId?: string | null
  /** `warn` = something is not finished or not verified. */
  tone?: 'normal' | 'warn'
}

export interface DossierInput {
  enquiries: Enquiry[]
  enquiryNotes: EnquiryNote[]
  /** Notes written on the person's own file. Optional so every existing caller
   *  and test keeps working while the table is being rolled out. */
  clientNotes?: ClientNote[]
  submissions: FormSubmission[]
  bookings: Booking[]
  payments: Payment[]
  emails: EmailLog[]
  taxiTrips: TaxiTrip[]
  activities: ActivityBooking[]
  /** id → display name, for the rooms/providers we can name. Optional. */
  providerNames?: Record<string, string>
}

const EMAIL_LABEL: Record<EmailLogType, string> = {
  booking_confirmation: 'Booking confirmation',
  visa_letter: 'Visa letter',
  travel_guide: 'Travel guide',
  welcome_guide: 'Welcome guide',
  client_account: 'Client account',
  update_form: 'Update form',
}

const TAXI_LABEL: Record<string, string> = {
  'aero-to-center': 'Airport → center',
  'center-to-aero': 'Center → airport',
  'aero-to-spot': 'Airport → spot',
  'spot-to-aero': 'Spot → airport',
  'center-to-town': 'Center → town',
  'town-to-center': 'Town → center',
  other: 'Transfer',
}

const PAYMENT_METHOD: Record<string, string> = {
  cash_eur: 'cash €',
  cash_mzn: 'cash MZN',
  transfer: 'transfer',
  card_palmeiras: 'card (Palmeiras)',
}

function bookingLabel(b: Booking): string {
  return `#${String(b.booking_number).padStart(3, '0')}`
}

function nights(b: Booking): number {
  const ms = new Date(b.check_out).getTime() - new Date(b.check_in).getTime()
  return Math.max(0, Math.round(ms / 86_400_000))
}

/** Everything known about this person, newest first.
 *
 *  Callers pass rows already scoped to the client — this function does not
 *  filter by client id, it only turns rows into lines. */
export function buildDossier(input: DossierInput): DossierEvent[] {
  const events: DossierEvent[] = []
  const byId = new Map(input.bookings.map(b => [b.id, b]))
  const ref = (id: string | null | undefined) => {
    const b = id ? byId.get(id) : undefined
    return b ? ` · ${bookingLabel(b)}` : ''
  }

  for (const e of input.enquiries) {
    const wants = [
      e.wants_lessons && 'lessons',
      e.wants_rental && 'rental',
      e.wants_accommodation && 'accommodation',
    ].filter(Boolean).join(' · ')
    const bits = [
      e.party_size ? `${e.party_size} ${e.party_size > 1 ? 'people' : 'person'}` : null,
      wants || null,
      e.budget_eur ? `€${e.budget_eur} budget` : null,
    ].filter(Boolean).join(' · ')
    events.push({
      id: `enquiry:${e.id}`,
      at: e.created_at,
      kind: 'enquiry',
      icon: '📣',
      title: e.channel === 'form' ? 'Enquiry received' : 'Enquiry added by hand',
      // The verbatim message is the point of this line: it is what they asked
      // for, in their words, before anyone reformulated it into fields.
      detail: [bits || null, e.message].filter(Boolean).join(' — ') || null,
    })
  }

  // Both note tables land as the same kind of line: the reader gets one
  // stream, whichever screen the sentence was typed on.
  for (const n of input.enquiryNotes) {
    events.push({
      id: `note:${n.id}`,
      at: n.created_at,
      kind: 'note',
      icon: '📝',
      title: 'Note',
      detail: n.body,
    })
  }

  for (const n of input.clientNotes ?? []) {
    events.push({
      id: `clientnote:${n.id}`,
      at: n.created_at,
      kind: 'note',
      icon: '📝',
      title: 'Note',
      detail: n.body,
    })
  }

  for (const s of input.submissions) {
    const travelers = s.payload?.travelers?.length ?? s.num_travelers ?? null
    events.push({
      id: `submission:${s.id}`,
      at: s.submitted_at,
      kind: 'submission',
      icon: '📄',
      title: 'Booking form submitted',
      detail: [
        travelers ? `${travelers} traveller${travelers > 1 ? 's' : ''}` : null,
        s.status === 'pending' ? 'waiting for review' : null,
        s.status === 'rejected' ? 'rejected' : null,
      ].filter(Boolean).join(' · ') || null,
      bookingId: s.created_booking_id,
      tone: s.status === 'pending' ? 'warn' : 'normal',
    })
  }

  for (const b of input.bookings) {
    events.push({
      id: `booking:${b.id}`,
      at: b.created_at ?? b.check_in,
      kind: 'booking',
      icon: '📋',
      title: `Booking ${bookingLabel(b)} created`,
      // `bookings.notes` is shown here because it is shown nowhere else: it has
      // no column in the Bookings list and no read-only screen, so until now
      // the only way to read what gui wrote on a booking was to reopen the
      // edit wizard on it.
      detail: [b.status === 'cancelled' ? 'cancelled since' : b.status, b.notes]
        .filter(Boolean).join(' — '),
      bookingId: b.id,
      tone: b.status === 'provisional' ? 'warn' : 'normal',
    })
    events.push({
      id: `stay:${b.id}`,
      at: b.check_in,
      kind: 'stay',
      icon: '🏠',
      title: `Stay ${bookingLabel(b)}`,
      detail: `${b.check_in} → ${b.check_out} · ${nights(b)} night${nights(b) > 1 ? 's' : ''}`,
      bookingId: b.id,
    })
  }

  for (const p of input.payments) {
    events.push({
      id: `payment:${p.id}`,
      at: p.date,
      kind: 'payment',
      icon: p.is_discount ? '🏷️' : '💰',
      title: p.is_discount ? 'Discount' : p.is_deposit ? 'Deposit' : 'Payment',
      detail: [
        PAYMENT_METHOD[p.method] ?? p.method,
        // Said on the line, not hidden in an accounting tab: an unverified
        // payment is money we are not sure we received.
        p.is_verified ? null : 'not verified',
        p.notes,
      ].filter(Boolean).join(' · ') + ref(p.booking_id),
      amount: p.amount,
      bookingId: p.booking_id,
      tone: p.is_verified || p.is_discount ? 'normal' : 'warn',
    })
  }

  for (const m of input.emails) {
    const failed = m.status === 'failed'
    events.push({
      id: `email:${m.id}`,
      at: m.sent_at ?? m.created_at,
      kind: 'email',
      icon: failed ? '📪' : '📧',
      title: `${EMAIL_LABEL[m.type] ?? m.type} ${failed ? 'failed' : 'sent'}`,
      detail: [m.recipient_email, failed ? m.error : null].filter(Boolean).join(' · ') + ref(m.booking_id),
      bookingId: m.booking_id,
      tone: failed ? 'warn' : 'normal',
    })
  }

  for (const t of input.taxiTrips) {
    events.push({
      id: `taxi:${t.id}`,
      at: t.date,
      kind: 'taxi',
      icon: '🚕',
      title: TAXI_LABEL[t.type] ?? 'Transfer',
      detail: [
        t.start_time,
        `${t.nb_persons} pax`,
        t.status === 'needs_details' ? 'needs details' : null,
      ].filter(Boolean).join(' · ') + ref(t.booking_id),
      amount: t.price_eur || null,
      bookingId: t.booking_id,
      tone: t.status === 'needs_details' ? 'warn' : 'normal',
    })
  }

  for (const a of input.activities) {
    events.push({
      id: `activity:${a.id}`,
      at: a.date,
      kind: 'activity',
      icon: '🏕️',
      title: a.label || 'Activity',
      detail: [
        input.providerNames?.[a.provider_id] ?? null,
        `${a.nb_persons} pax`,
      ].filter(Boolean).join(' · ') + ref(a.booking_id),
      amount: a.price_client || null,
      bookingId: a.booking_id,
    })
  }

  // Newest first. Ties broken by id so the order never flickers between
  // renders — two payments recorded on the same day have the same `at`.
  return events.sort((x, y) => (x.at === y.at ? x.id.localeCompare(y.id) : (x.at < y.at ? 1 : -1)))
}

export interface DossierMoney {
  paid: number
  unverified: number
  discounts: number
}

/** What this person has actually paid us, across every booking.
 *
 *  ⚠️ Reads `payments`, never `bookings.amount_paid` — that column is a stale
 *  cache and has been wrong before. Unverified money is counted apart rather
 *  than added in: showing it as received is how a bank transfer nobody checked
 *  becomes a settled balance on screen. */
export function dossierMoney(payments: Payment[]): DossierMoney {
  let paid = 0, unverified = 0, discounts = 0
  for (const p of payments) {
    if (p.is_discount) discounts += p.amount
    else if (p.is_verified) paid += p.amount
    else unverified += p.amount
  }
  return { paid, unverified, discounts }
}

/** Days since the last thing that happened on this file — the same idea as the
 *  enquiry "silence" column, extended to someone who has already booked.
 *
 *  Future-dated lines are ignored: a stay in November is not a sign of life in
 *  September, and counting it would silence exactly the file that needs
 *  chasing. Returns null when nothing has happened yet. */
export function daysSinceLastTouch(events: DossierEvent[], now: Date = new Date()): number | null {
  const nowMs = now.getTime()
  let latest: number | null = null
  for (const e of events) {
    const t = new Date(e.at).getTime()
    if (Number.isNaN(t) || t > nowMs) continue
    if (latest === null || t > latest) latest = t
  }
  if (latest === null) return null
  return Math.max(0, Math.floor((nowMs - latest) / 86_400_000))
}
