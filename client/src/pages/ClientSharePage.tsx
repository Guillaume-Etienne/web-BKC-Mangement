import { shareT, type ShareKey } from '../data/i18n/clientShare'
import { detectAdminLang } from '../data/i18n'
import { localeTag } from '../utils/dates'
import { lessonGearText, rentalGearText, inParens, type GearLike } from '../utils/gearLabel'
import { displayFirstName } from '../utils/names'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type {
  Booking, Client, BookingRoom, BookingRoomPrice,
  Room, Accommodation, Payment, Lesson, Instructor,
  EquipmentRental, TaxiTrip,
  DiningEvent, BookingParticipant,
  ExternalAccommodationBooking,
  ActivityBooking, RoomRate, BookingCharge, Lang,
} from '../types/database'
import { getBaseNightlyRate } from '../utils/roomPricing'
import { agencyHoursPool } from '../components/accounting/utils'
import AgencyHoursGauge from '../components/common/AgencyHoursGauge'

// ─── Types ────────────────────────────────────────────────────────────────────

// anon may only read these bookings columns (column-level GRANT — see security-rls.md);
// selecting more (or '*') would fail with 42501 for public visitors.
type BookingWithClient = Pick<Booking,
  'id' | 'booking_number' | 'check_in' | 'check_out' | 'status' |
  'num_center_access' | 'center_access_rate'
> & { client: Pick<Client, 'id' | 'first_name' | 'last_name'> | null }

// Same rule for external stays: `total_cost` is our purchase price and `notes`
// are internal, so neither is granted to anon. Typing the narrowed shape keeps
// the compiler on the side of the GRANT — reaching for a hidden column no
// longer compiles.
type SharedExternalStay = Pick<ExternalAccommodationBooking,
  'id' | 'booking_id' | 'accommodation_id' | 'check_in' | 'check_out' | 'total_sell_price'>

// Extras: everything but the internal `notes` (not granted to anon).
type SharedExtra = Pick<BookingCharge, 'id' | 'date' | 'label' | 'category' | 'quantity' | 'unit_price'>

// The four sources of a guest's bill, Phase 4 (2026-08-18c). `anon` no longer
// reads the raw client price at all — only the generated `share_price*` mirror,
// which the database nulls out when the line is billed to a partner agency. The
// select aliases it back to the familiar field name, so the page's arithmetic is
// unchanged; what changes is that a covered service now has NO price to leak,
// instead of one drawn over with "—".
//
// That is why every price below is `| null` where the table says NOT NULL: the
// nullability IS the redaction, and typing it keeps the compiler on the side of
// the GRANT — reading a hidden column no longer compiles.
type SharedRoomPrice = Pick<BookingRoomPrice, 'booking_id' | 'room_id' | 'override_note' | 'agency_billing_line_id'>
  & { price_per_night: number | null }

// (`price_per_hour` is already nullable on Lesson — a lesson without a snapshot
//  falls back to the current rate — so the alias needs no widening here.)
type SharedLesson = Pick<Lesson,
  'id' | 'booking_id' | 'instructor_id' | 'participant_ids' | 'date' | 'start_time' |
  'duration_hours' | 'type' | 'notes' | 'price_per_hour' | 'agency_billing_line_id'>

type SharedRental = Pick<EquipmentRental,
  'id' | 'equipment_id' | 'booking_id' | 'participant_id' | 'date' | 'slot' | 'agency_billing_line_id'
  | 'rental_type' | 'list_price' | 'client_note'>
  & { price: number | null }

/** Key of what the guest reads for a rental. Rows from before 2026-10-18 carry no type. */
const rentalKey = (r: Pick<SharedRental, 'rental_type'>): ShareKey =>
  r.rental_type
    ? (r.rental_type === 'full' ? 'rent_full' : r.rental_type === 'kite' ? 'rent_kite' : `rent_${r.rental_type}`) as ShareKey
    : 'rent_generic'

/** Kite and board of one lesson, read through their own query (see below). */
type GearIds = { kite_id: string | null; board_id: string | null }

type SharedTaxi = Pick<TaxiTrip, 'id' | 'date' | 'type' | 'nb_persons' | 'agency_billing_line_id'>
  & { price_eur: number | null }

/** What `share_agency_package()` returns for this booking's token: the agency's
 *  name and the hours its lesson packages add up to — no price (2026-10-24). */
interface AgencyPackage { agency_name: string; hours_included: number }

interface Props {
  bookingNumber: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.max(0, Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)
  ))
}

function roomLabel(room: Room, accom: Accommodation): string {
  const house = accom.name.replace('Maison ', 'H-')
  const side  = room.name === 'Chambre 1' ? 'F' : room.name === 'Chambre 2' ? 'B' : room.name
  return accom.type === 'house' ? `${house}/${side}` : accom.name
}

/** Client price €/h for a lesson — the snapshot taken when the lesson was booked,
 *  read through the redacted `share_price_per_hour` mirror. Instructor payout
 *  rates are deliberately NOT readable from a share link (and since 2026-08-18c
 *  `lessons.instructor_rate` is revoked from anon, not merely left unread). */
function getLessonRate(l: SharedLesson): number {
  return l.price_per_hour ?? 0
}

/** A service billed to the partner agency that sent this guest. It stays on the
 *  page — they still want to see the lessons they took — but shows no price and
 *  adds nothing to the subtotal, because they owe nothing for it.
 *
 *  Since Phase 4 (2026-08-18c) this is no longer only a display rule: the price
 *  of a covered line does not reach the browser at all — the database serves
 *  NULL through the `share_price*` columns. This flag is what lets the page tell
 *  "covered by the agency" apart from "genuinely free", which a bare NULL could
 *  not, and it drives the "—" and the note explaining it. */
const coveredByAgency = (row: { agency_billing_line_id?: string | null }) =>
  row.agency_billing_line_id != null

const SHARE_TAXI_KEYS = { taxi_aero_to_center: 1, taxi_center_to_aero: 1, taxi_center_to_town: 1, taxi_town_to_center: 1, taxi_other: 1 }
const SHARE_PAY_KEYS = { pay_cash_eur: 1, pay_cash_mzn: 1, pay_transfer: 1, pay_card_palmeiras: 1 }

const STATUS_CFG = {
  confirmed:   { label: 'status_confirmed' as ShareKey,   cls: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'  },
  provisional: { label: 'status_provisional' as ShareKey, cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'  },
  cancelled:   { label: 'status_cancelled' as ShareKey,   cls: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'      },
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ClientSharePage({ bookingNumber }: Props) {
  const [booking,        setBooking]        = useState<BookingWithClient | 'not_found' | undefined>(undefined)
  const [bkgRooms,       setBkgRooms]       = useState<BookingRoom[]>([])
  const [roomPrices,     setRoomPrices]     = useState<SharedRoomPrice[]>([])
  const [paidToOwnerIds, setPaidToOwnerIds] = useState<Set<string>>(new Set())
  const [roomRates,      setRoomRates]      = useState<RoomRate[]>([])
  const [rooms,          setRooms]          = useState<Room[]>([])
  const [accoms,         setAccoms]         = useState<Accommodation[]>([])
  const [payments,       setPayments]       = useState<Payment[]>([])
  const [lessons,        setLessons]        = useState<SharedLesson[]>([])
  const [instructors,    setInstructors]    = useState<Instructor[]>([])
  const [rentals,        setRentals]        = useState<SharedRental[]>([])
  const [taxis,          setTaxis]          = useState<SharedTaxi[]>([])
  const [diningEvents,   setDiningEvents]   = useState<DiningEvent[]>([])
  const [participants,   setParticipants]   = useState<BookingParticipant[]>([])
  const [extras,         setExtras]         = useState<SharedExtra[]>([])
  const [extAccomBkgs,   setExtAccomBkgs]   = useState<SharedExternalStay[]>([])
  const [activityBkgs,   setActivityBkgs]   = useState<ActivityBooking[]>([])
  const [agencyPkg,      setAgencyPkg]      = useState<AgencyPackage | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [lessonGear,     setLessonGear]     = useState<Record<string, GearIds>>({})
  const [rentalBoard,    setRentalBoard]    = useState<Record<string, string | null>>({})
  const [equipment,      setEquipment]      = useState<GearLike[]>([])
  // The guest's language: what they last picked here, else their browser's.
  const [lang, setLangState] = useState<Lang>(() => {
    try { const s = localStorage.getItem('share_lang'); if (s === 'fr' || s === 'en' || s === 'es') return s } catch { /* private mode */ }
    return detectAdminLang()
  })
  const setLang = (l: Lang) => { setLangState(l); try { localStorage.setItem('share_lang', l) } catch { /* private mode */ } }
  // Gear in parentheses: shown by default on a wide screen, opt-in on a phone.
  const [showGear, setShowGear] = useState(() => {
    try { return window.matchMedia('(min-width: 768px)').matches } catch { return true }
  })
  const t = (k: ShareKey) => shareT(lang, k)
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(localeTag(lang), { day: 'numeric', month: 'short', year: 'numeric' })
  const fmtEur = (n: number) =>
    n.toLocaleString(localeTag(lang), { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })

  // Step 1 — fetch booking by number
  useEffect(() => {
    if (!bookingNumber) { setBooking('not_found'); setLoading(false); return }

    supabase
      .from('bookings')
      // Column-restricted for anon on BOTH tables (no emergency contacts, notes,
      // amount_paid, visa dates… and no email/phone/passport on clients) — see security-rls.md
      .select('id, booking_number, check_in, check_out, status, num_center_access, center_access_rate, client:clients(id, first_name, last_name)')
      .eq('booking_number', bookingNumber)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setBooking('not_found'); setLoading(false); return }
        // supabase types the FK embed as an array; at runtime .single() returns an object
        setBooking(data as unknown as BookingWithClient)
      })
  }, [bookingNumber])

  // Step 2 — once booking is loaded, fetch all related data in parallel
  useEffect(() => {
    if (!booking || booking === 'not_found') return
    const id = booking.id

    Promise.all([
      supabase.from('booking_rooms').select('*').eq('booking_id', id),
      // Phase 4: the price comes from the redacted `share_price*` column, aliased
      // back to its usual name. Asking for the raw one — or for `*` — returns
      // 42501 and blanks the page, which is the point: the value a guest must not
      // see is not sent to the browser at all.
      supabase.from('booking_room_prices')
        .select('booking_id, room_id, override_note, agency_billing_line_id, price_per_night:share_price_per_night')
        .eq('booking_id', id),
      supabase.from('rooms').select('*'),
      supabase.from('accommodations').select('*'),
      // Explicit columns: the guest's page has no business asking which associate
      // received a payment (`received_by_associate_id`).
      supabase.from('payments')
        .select('id, booking_id, date, amount, method, is_deposit, is_verified, is_discount, notes')
        .eq('booking_id', id).order('date'),
      supabase.from('lessons')
        .select('id, booking_id, instructor_id, participant_ids, date, start_time, duration_hours, type, notes, agency_billing_line_id, price_per_hour:share_price_per_hour')
        .eq('booking_id', id).order('date'),
      // Column-restricted for anon: identity ONLY. The rate_* columns are the
      // instructor payout scale and are no longer readable from a share link.
      supabase.from('instructors').select('id, first_name, last_name'),
      supabase.from('equipment_rentals')
        .select('id, equipment_id, booking_id, participant_id, date, slot, agency_billing_line_id, rental_type, list_price, client_note, price:share_price')
        .eq('booking_id', id).order('date'),
      supabase.from('taxi_trips')
        .select('id, date, type, nb_persons, agency_billing_line_id, price_eur:share_price_eur')
        .eq('booking_id', id).order('date'),
      supabase.from('dining_events').select('*'),
      supabase.from('booking_participants').select('id, booking_id, first_name, last_name').eq('booking_id', id),
      // Column-restricted for anon: the guest sees what THEY pay, never what we
      // pay the hotel (`total_cost`) nor internal `notes`. A `select('*')` here
      // returns 42501 and blanks the whole page — list the columns explicitly.
      supabase.from('external_accommodation_bookings')
        .select('id, booking_id, accommodation_id, check_in, check_out, total_sell_price')
        .eq('booking_id', id),
      supabase.from('activity_bookings').select('*').eq('booking_id', id).order('date'),
      // Base rates, used only when this booking has no price snapshot. Column-restricted
      // for anon (no `notes`), and RLS only returns the rooms of this very booking.
      supabase.from('room_rates').select('room_id, price_per_night'),
      // Bungalows the guest paid Palmeiras for directly — not owed to us. Its own
      // query on purpose: before the 2026-09-28 migration grants this column to
      // anon it errors, and folded into the prices query above that error would
      // blank the whole page. Alone, a failure just means "none".
      supabase.from('booking_room_prices').select('room_id, paid_to_owner').eq('booking_id', id),
    ]).then(async ([
      bkgRoomsRes, pricesRes, roomsRes, acomsRes, paymentsRes,
      lessonsRes, instrRes, rentalsRes, taxisRes,
      diningRes, partRes, extBkgRes, actBkgRes, roomRatesRes, paidToOwnerRes,
    ]) => {
      // Group lessons booked on ANOTHER reservation where one of our riders sits: we owe
      // our share of them. Its own query on purpose: before the 2026-10-16b policy lets
      // anon read them, it simply returns nothing, and the page keeps working.
      const myPartIds = (partRes.data ?? []).map(p => p.id)
      const sharedRes = myPartIds.length === 0 ? null : await supabase.from('lessons')
        .select('id, booking_id, instructor_id, participant_ids, date, start_time, duration_hours, type, notes, agency_billing_line_id, price_per_hour:share_price_per_hour')
        .eq('type', 'group').neq('booking_id', id).overlaps('participant_ids', myPartIds).order('date')
      // Extras (2026-10-18). Its own query for the same reason: before the migration
      // the table does not exist, and a failure here must only mean "no extras".
      const extrasRes = await supabase.from('booking_charges')
        .select('id, date, label, category, quantity, unit_price')
        .eq('booking_id', id).order('date')
      setExtras(extrasRes.error ? [] : (extrasRes.data ?? []) as SharedExtra[])
      // Gear (2026-10-27): kite/board of each lesson, board of each "Full" rental, then
      // the models behind those ids. Own queries for the same reason: before the
      // migration anon cannot read these columns, and that must only mean "no gear".
      const lessonIds = [...(lessonsRes.data ?? []), ...(sharedRes?.data ?? [])].map(l => l.id)
      const [lGearRes, rGearRes] = await Promise.all([
        lessonIds.length === 0 ? null : supabase.from('lessons').select('id, kite_id, board_id').in('id', lessonIds),
        supabase.from('equipment_rentals').select('id, board_equipment_id').eq('booking_id', id),
      ])
      const lGear = lGearRes?.error ? [] : (lGearRes?.data ?? [])
      const rBoards = rGearRes.error ? [] : (rGearRes.data ?? [])
      const gearIds = new Set<string>()
      for (const g of lGear) { if (g.kite_id) gearIds.add(g.kite_id); if (g.board_id) gearIds.add(g.board_id) }
      for (const r of rentalsRes.data ?? []) if (r.equipment_id) gearIds.add(r.equipment_id)
      for (const r of rBoards) if (r.board_equipment_id) gearIds.add(r.board_equipment_id)
      const eqRes = gearIds.size === 0 ? null
        : await supabase.from('equipment').select('id, name, brand, size').in('id', [...gearIds])
      setEquipment(eqRes?.error ? [] : (eqRes?.data ?? []) as GearLike[])
      setLessonGear(Object.fromEntries(lGear.map(g => [g.id, { kite_id: g.kite_id, board_id: g.board_id }])))
      setRentalBoard(Object.fromEntries(rBoards.map(r => [r.id, r.board_equipment_id])))
      // Agency package (2026-10-24): the agency's name and the hours its lesson
      // packages add up to — never a price. Own call for the same reason: before
      // the migration the function does not exist, and that must only mean "none".
      const pkgRes = await supabase.rpc('share_agency_package')
      const pkg = pkgRes.error ? null : ((pkgRes.data ?? []) as AgencyPackage[])[0] ?? null
      setAgencyPkg(pkg)
      setPaidToOwnerIds(new Set((paidToOwnerRes.data ?? []).filter(p => p.paid_to_owner === true).map(p => p.room_id)))
      setBkgRooms(bkgRoomsRes.data ?? [])
      setRoomPrices(pricesRes.data ?? [])
      setRooms(roomsRes.data ?? [])
      setAccoms(acomsRes.data ?? [])
      setPayments(paymentsRes.data ?? [])
      setLessons([...(lessonsRes.data ?? []), ...(sharedRes?.data ?? [])].sort((a, b) => a.date.localeCompare(b.date)))
      // anon only receives id/first_name/last_name (column-restricted); the page uses only those
      setInstructors((instrRes.data ?? []) as unknown as Instructor[])
      setRentals(rentalsRes.data ?? [])
      setTaxis(taxisRes.data ?? [])
      setDiningEvents(diningRes.data ?? [])
      // anon only receives id/first_name/last_name (column-restricted); the page uses only those
      setParticipants((partRes.data ?? []) as unknown as BookingParticipant[])
      setExtAccomBkgs(extBkgRes.data ?? [])
      setActivityBkgs(actBkgRes.data ?? [])
      // anon only receives room_id/price_per_night (column-restricted); the page uses only those
      setRoomRates((roomRatesRes.data ?? []) as unknown as RoomRate[])
      setLoading(false)
    })
  }, [booking])

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading || booking === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 dark:text-gray-400 text-lg">{t('loading')}</div>
      </div>
    )
  }

  if (booking === 'not_found') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl text-gray-400 dark:text-gray-400 mb-2">{t('not_found_title')}</p>
          <p className="text-sm text-gray-400 dark:text-gray-400">{t('not_found_msg')}</p>
        </div>
      </div>
    )
  }

  // ── Calculations ───────────────────────────────────────────────────────────

  const nights = nightsBetween(booking.check_in, booking.check_out)
  const taxiLabel = (type: string): string => {
    const k = `taxi_${type.replace(/-/g, '_')}`
    return k in SHARE_TAXI_KEYS ? t(k as ShareKey) : type
  }
  const payLabel = (method: string): string => {
    const k = `pay_${method}`
    return k in SHARE_PAY_KEYS ? t(k as ShareKey) : method
  }
  const rentalGear = (r: SharedRental): string => showGear
    ? rentalGearText({ equipment_id: r.equipment_id, board_equipment_id: rentalBoard[r.id] ?? null }, equipment) : ''
  const lessonGear_ = (id: string): string => showGear
    ? lessonGearText({ kite_id: lessonGear[id]?.kite_id ?? null, board_id: lessonGear[id]?.board_id ?? null }, null, equipment) : ''
  const statusCfg = STATUS_CFG[booking.status] ?? STATUS_CFG.confirmed

  // Accommodation rows (own rooms)
  const accomRows = bkgRooms.map(br => {
    const room  = rooms.find(r => r.id === br.room_id)
    const accom = room ? accoms.find(a => a.id === room.accommodation_id) : null
    const priceRow = roomPrices.find(p => p.room_id === br.room_id)
    // No snapshot on this booking (older ones, or a room added without a price):
    // fall back to the base rate rather than show the client 0 €/night. Same rule
    // as the admin side, full-house aware — see utils/roomPricing.ts.
    const pricePerNight = priceRow?.price_per_night
      ?? getBaseNightlyRate(br.room_id, bkgRooms.map(r => r.room_id), rooms, accoms, roomRates)
    return {
      label: room && accom ? roomLabel(room, accom) : br.room_id,
      nights,
      pricePerNight,
      // A room picked up by the agency comes out at 0, which the filter below
      // drops — same treatment as any other room the guest is not charged for.
      // Same for a bungalow the guest paid Palmeiras for directly.
      total: (priceRow && coveredByAgency(priceRow)) || paidToOwnerIds.has(br.room_id) ? 0 : nights * pricePerNight,
      note: priceRow?.override_note ?? null,
    }
  })
  // A room that still comes out at 0 after the fallback is not something to show
  // a client — this link travels (WhatsApp, forwarded mail) and "H1/F · 11 nights
  // · €0" reads like a mistake or a freebie. It is also the normal shape of a
  // full house, where the whole price sits on one line and the other rooms are 0.
  // Dropping it changes no figure: a 0 line adds nothing to the subtotal, and if
  // every room is 0 the section hides itself.
  const billedAccomRows = accomRows.filter(row => row.total > 0)

  // External accommodation rows. Priced as a flat rate for the whole stay, so
  // there is no per-night figure to show — the column stays empty rather than
  // displaying a division the guest never agreed to.
  // Zero-priced stays are hidden for the same reason as own rooms billed 0 €
  // (2026-08-02): a self-managed stay is not a line item on the guest's bill.
  const extAccomRows = extAccomBkgs
    .filter(e => e.total_sell_price > 0)
    .map(e => {
      const acc = accoms.find(a => a.id === e.accommodation_id)
      return {
        label: acc?.name ?? t('external'),
        nights: nightsBetween(e.check_in, e.check_out),
        pricePerNight: null as number | null,
        total: e.total_sell_price,
      }
    })

  const accomTotal = billedAccomRows.reduce((s, r) => s + r.total, 0)
    + extAccomRows.reduce((s, r) => s + r.total, 0)

  // Participant name helpers
  const partName = (id: string) => { const f = participants.find(p => p.id === id)?.first_name; return f ? displayFirstName(f) : null }
  const partNames = (ids: string[]) => ids.map(partName).filter(Boolean).join(', ')

  // Lessons
  const partIdSet = new Set(participants.map(p => p.id))
  const lessonRows = lessons.map(l => {
    const instr = instructors.find(i => i.id === l.instructor_id)
    const rate = getLessonRate(l)
    return {
      id: l.id,
      date: l.date,
      type: l.type,
      duration: l.duration_hours,
      instructor: instr ? instr.first_name : '?',
      guests: partNames(l.participant_ids),
      gear: lessonGear_(l.id),
      // Group: only the heads sitting on THIS booking (a lesson shared with another one is split)
      total: coveredByAgency(l) ? null : rate * l.duration_hours * (l.type === 'group' ? l.participant_ids.filter(pid => partIdSet.has(pid)).length : 1),
    }
  })
  const lessonsTotal = lessonRows.reduce((s, r) => s + (r.total ?? 0), 0)

  // Equipment rentals
  const rentalsTotal = rentals.reduce((s, r) => s + (coveredByAgency(r) ? 0 : r.price ?? 0), 0)

  // Taxis
  const taxiTotal = taxis.reduce((s, t) => s + (coveredByAgency(t) ? 0 : t.price_eur ?? 0), 0)

  // Anything the agency picked up, so the page can explain the blank prices
  // instead of leaving the guest wondering what "—" means.
  const hasAgencyCovered =
    lessons.some(coveredByAgency) || rentals.some(coveredByAgency) || taxis.some(coveredByAgency)
  // The agency's lesson packages as one pool of hours — same count as accounting
  const pool = agencyPkg ? agencyHoursPool(booking.id, Number(agencyPkg.hours_included), lessons) : null
  const agencyName = agencyPkg?.agency_name ?? t('agency_default')

  // Dining events (match participants to attendees)
  const partIds = new Set(participants.map(p => p.id))
  const diningRows: { id: string; date: string; name: string; count: number; pricePerPerson: number; guests: string; total: number }[] = []
  for (const ev of diningEvents) {
    const attending = (ev.attendees ?? [])
      .filter(a => a.is_attending && a.person_type === 'participant' && partIds.has(a.person_id))
    if (attending.length === 0) continue
    const total = attending.reduce((s, a) => s + (a.price_override ?? ev.price_per_person), 0)
    if (total === 0) continue
    const guests = attending.map(a => partName(a.person_id) ?? a.person_name).join(', ')
    diningRows.push({ id: ev.id, date: ev.date, name: ev.name, count: attending.length, pricePerPerson: ev.price_per_person, guests, total })
  }
  const diningTotal = diningRows.reduce((s, r) => s + r.total, 0)

  // Activities (only we_pay_provider — client pays the center)
  const activityRows = activityBkgs
    .filter(a => a.payment_flow === 'we_pay_provider')
    .map(a => ({ id: a.id, date: a.date, label: a.label, nb_persons: a.nb_persons, guests: partNames(a.participant_ids), total: a.price_client }))
  const activityTotal = activityRows.reduce((s, r) => s + r.total, 0)

  // Center access (persons × nights × per-day rate)
  const centerAccessTotal = booking.num_center_access * nights * (booking.center_access_rate ?? 0)

  // Payments (exclude discounts from paid amount)
  const totalDiscounts = payments.filter(p => p.is_discount).reduce((s, p) => s + p.amount, 0)
  const totalPaid = payments.filter(p => !p.is_discount).reduce((s, p) => s + p.amount, 0)

  // Grand totals
  // Extras — quantity × unit price, rounded to the cent like utils.chargeAmount
  const extraRows = extras.map(c => ({ ...c, total: Math.round(c.quantity * c.unit_price * 100) / 100 }))
  const extrasTotal = extraRows.reduce((s, r) => s + r.total, 0)

  const totalCharges = accomTotal + lessonsTotal + rentalsTotal + taxiTotal + diningTotal + activityTotal + centerAccessTotal
    + extrasTotal
  const balance = totalCharges - totalDiscounts - totalPaid

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between">
        <span className="text-xl font-bold text-blue-600 dark:text-blue-400">Kitesurf Center</span>
        <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full font-medium">
          {t('header_readonly')}
        </span>
      </div>

      {/* Guest controls: language, and the gear shown in parentheses */}
      <div className="max-w-2xl mx-auto px-4 pt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-400">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={showGear} onChange={e => setShowGear(e.target.checked)} className="rounded" />
          {t('show_equipment')}
        </label>
        <div className="flex items-center gap-1" role="group" aria-label={t('language')}>
          {(['fr', 'en', 'es'] as Lang[]).map(l => (
            <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase transition-colors ${lang === l
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Booking summary card */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-blue-200 dark:text-blue-300 text-sm font-medium">{t('booking')} #{String(booking.booking_number).padStart(3, '0')}</p>
                <h1 className="text-2xl font-bold mt-0.5">
                  {displayFirstName(booking.client?.first_name)} {booking.client?.last_name}
                </h1>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusCfg.cls}`}>
                {t(statusCfg.label)}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-blue-100 dark:text-blue-300">
              <span>{formatDate(booking.check_in)}</span>
              <span>→</span>
              <span>{formatDate(booking.check_out)}</span>
              <span className="ml-2 bg-blue-500/40 px-2 py-0.5 rounded-full text-white font-medium">
                {nights} {t(nights !== 1 ? 'nights' : 'night')}
              </span>
            </div>
          </div>
        </div>

        {/* Agency package (2026-10-24) */}
        {agencyPkg && (
          <section className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-indigo-200 dark:border-indigo-900 px-5 py-4 space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              🤝 {t('agency_arranged')} <span className="font-semibold text-gray-800 dark:text-gray-200">{agencyPkg.agency_name}</span>.
              {t('agency_not_charged')}
            </p>
            {pool && <AgencyHoursGauge pool={pool} agencyName={agencyPkg.agency_name} />}
          </section>
        )}

        {/* Accommodation */}
        {(billedAccomRows.length > 0 || extAccomRows.length > 0) && (
          <Section title={t('sec_accommodation')} icon="🛏️">
            <div className="overflow-x-auto"><table className="w-full text-sm stack-mobile">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-2.5 sm:px-5 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">{t('col_room')}</th>
                  <th className="px-2.5 sm:px-5 py-2.5 text-right font-medium text-gray-500 dark:text-gray-400">{t('col_nights')}</th>
                  <th className="px-2.5 sm:px-5 py-2.5 text-right font-medium text-gray-500 dark:text-gray-400">{t('col_per_night')}</th>
                  <th className="px-2.5 sm:px-5 py-2.5 text-right font-medium text-gray-500 dark:text-gray-400">{t('col_total')}</th>
                </tr>
              </thead>
              <tbody>
                {billedAccomRows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 dark:border-gray-800">
                    <td data-label={t('col_room')} className="px-2.5 sm:px-5 py-3 font-medium text-gray-800 dark:text-gray-200">
                      {row.label}
                      {row.note && <span className="ml-2 text-xs text-gray-400 dark:text-gray-400 italic">{row.note}</span>}
                    </td>
                    <td data-label={t('col_nights')} className="px-2.5 sm:px-5 py-3 text-right text-gray-600 dark:text-gray-400">{row.nights}</td>
                    <td data-label={t('col_per_night')} className="px-2.5 sm:px-5 py-3 text-right text-gray-600 dark:text-gray-400">{fmtEur(row.pricePerNight)}</td>
                    <td data-label={t('col_total')} className="px-2.5 sm:px-5 py-3 text-right font-semibold text-gray-800 dark:text-gray-200">{fmtEur(row.total)}</td>
                  </tr>
                ))}
                {extAccomRows.map((row, i) => (
                  <tr key={`ext-${i}`} className="border-b border-gray-50 dark:border-gray-800">
                    <td data-label={t('col_room')} className="px-2.5 sm:px-5 py-3 font-medium text-gray-800 dark:text-gray-200">{row.label}</td>
                    <td data-label={t('col_nights')} className="px-2.5 sm:px-5 py-3 text-right text-gray-600 dark:text-gray-400">{row.nights}</td>
                    <td data-label={t('col_per_night')} className="px-2.5 sm:px-5 py-3 text-right text-gray-600 dark:text-gray-400">
                      {row.pricePerNight != null ? fmtEur(row.pricePerNight) : '—'}
                    </td>
                    <td data-label={t('col_total')} className="px-2.5 sm:px-5 py-3 text-right font-semibold text-gray-800 dark:text-gray-200">{fmtEur(row.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-800">
                <tr>
                  <td colSpan={3} className="px-2.5 sm:px-5 py-3 text-sm font-semibold text-gray-600 dark:text-gray-400">{t('sub_accommodation')}</td>
                  <td className="px-2.5 sm:px-5 py-3 text-right font-bold text-gray-800 dark:text-gray-200">{fmtEur(accomTotal)}</td>
                </tr>
              </tfoot>
            </table></div>
          </Section>
        )}

        {/* Lessons */}
        {lessonRows.length > 0 && (
          <Section title={t('sec_lessons')} icon="🏄">
            <div className="overflow-x-auto"><table className="w-full text-sm stack-mobile">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-2.5 sm:px-5 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">{t('col_date')}</th>
                  <th className="px-2.5 sm:px-5 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">{t('col_type')}</th>
                  <th className="px-2.5 sm:px-5 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">{t('col_guest')}</th>
                  <th className="px-2.5 sm:px-5 py-2.5 text-right font-medium text-gray-500 dark:text-gray-400">{t('col_duration')}</th>
                  <th className="px-2.5 sm:px-5 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">{t('col_instructor')}</th>
                  <th className="px-2.5 sm:px-5 py-2.5 text-right font-medium text-gray-500 dark:text-gray-400">{t('col_total')}</th>
                </tr>
              </thead>
              <tbody>
                {lessonRows.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 dark:border-gray-800">
                    <td data-label={t('col_date')} className="px-2.5 sm:px-5 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td data-label={t('col_type')} className="px-2.5 sm:px-5 py-3 text-gray-600 dark:text-gray-400 ">{t(`lesson_${r.type}` as ShareKey)}{inParens(r.gear)}</td>
                    <td data-label={t('col_guest')} className="px-2.5 sm:px-5 py-3 text-blue-500 dark:text-blue-400 text-xs">{r.guests}</td>
                    <td data-label={t('col_duration')} className="px-2.5 sm:px-5 py-3 text-right text-gray-600 dark:text-gray-400">{r.duration}h</td>
                    <td data-label={t('col_instructor')} className="px-2.5 sm:px-5 py-3 text-gray-600 dark:text-gray-400">{r.instructor}</td>
                    <td data-label={t('col_total')} className="px-2.5 sm:px-5 py-3 text-right font-semibold text-gray-800 dark:text-gray-200">
                      {r.total == null
                        ? <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 whitespace-nowrap">{t('in_package')}</span>
                        : fmtEur(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-800">
                <tr>
                  <td colSpan={5} className="px-2.5 sm:px-5 py-3 text-sm font-semibold text-gray-600 dark:text-gray-400">{t('sub_lessons')}</td>
                  <td className="px-2.5 sm:px-5 py-3 text-right font-bold text-gray-800 dark:text-gray-200">{fmtEur(lessonsTotal)}</td>
                </tr>
              </tfoot>
            </table></div>
          </Section>
        )}

        {/* Equipment rentals */}
        {rentals.length > 0 && (
          <Section title={t('sec_rentals')} icon="🎿">
            <div className="overflow-x-auto"><table className="w-full text-sm stack-mobile">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-2.5 sm:px-5 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">{t('col_date')}</th>
                  <th className="px-2.5 sm:px-5 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">{t('col_guest')}</th>
                  <th className="px-2.5 sm:px-5 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">{t('col_item')}</th>
                  <th className="px-2.5 sm:px-5 py-2.5 text-right font-medium text-gray-500 dark:text-gray-400">{t('col_price')}</th>
                </tr>
              </thead>
              <tbody>
                {rentals.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 dark:border-gray-800">
                    <td data-label={t('col_date')} className="px-2.5 sm:px-5 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td data-label={t('col_guest')} className="px-2.5 sm:px-5 py-3 text-blue-500 dark:text-blue-400 text-xs">{r.participant_id ? partName(r.participant_id) ?? '' : ''}</td>
                    <td data-label={t('col_item')} className="px-2.5 sm:px-5 py-3 text-gray-600 dark:text-gray-400">
                      {t(rentalKey(r))}{inParens(rentalGear(r))} · {t(`slot_${r.slot}` as ShareKey)}
                      {r.client_note && <div className="text-xs text-gray-400 dark:text-gray-500">{r.client_note}</div>}
                    </td>
                    <td data-label={t('col_price')} className="px-2.5 sm:px-5 py-3 text-right font-semibold text-gray-800 dark:text-gray-200">
                      {coveredByAgency(r) ? <span className="text-gray-400 dark:text-gray-500 font-normal">—</span> : (
                        <>
                          {r.list_price != null && r.price != null && r.list_price > r.price && (
                            <span className="mr-1.5 font-normal text-gray-400 dark:text-gray-500 line-through">{fmtEur(r.list_price)}</span>
                          )}
                          {fmtEur(r.price ?? 0)}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-800">
                <tr>
                  <td colSpan={3} className="px-2.5 sm:px-5 py-3 text-sm font-semibold text-gray-600 dark:text-gray-400">{t('sub_rentals')}</td>
                  <td className="px-2.5 sm:px-5 py-3 text-right font-bold text-gray-800 dark:text-gray-200">{fmtEur(rentalsTotal)}</td>
                </tr>
              </tfoot>
            </table></div>
          </Section>
        )}

        {/* Taxis */}
        {taxis.length > 0 && (
          <Section title={t('sec_taxis')} icon="🚕">
            <div className="overflow-x-auto"><table className="w-full text-sm stack-mobile">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-2.5 sm:px-5 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">{t('col_date')}</th>
                  <th className="px-2.5 sm:px-5 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">{t('col_route')}</th>
                  <th className="px-2.5 sm:px-5 py-2.5 text-right font-medium text-gray-500 dark:text-gray-400">{t('col_pax')}</th>
                  <th className="px-2.5 sm:px-5 py-2.5 text-right font-medium text-gray-500 dark:text-gray-400">{t('col_price')}</th>
                </tr>
              </thead>
              <tbody>
                {taxis.map(trip => (
                  <tr key={trip.id} className="border-b border-gray-50 dark:border-gray-800">
                    <td data-label={t('col_date')} className="px-2.5 sm:px-5 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDate(trip.date)}</td>
                    <td data-label={t('col_route')} className="px-2.5 sm:px-5 py-3 text-gray-600 dark:text-gray-400">{taxiLabel(trip.type)}</td>
                    <td data-label={t('col_pax')} className="px-2.5 sm:px-5 py-3 text-right text-gray-600 dark:text-gray-400">{trip.nb_persons}</td>
                    <td data-label={t('col_price')} className="px-2.5 sm:px-5 py-3 text-right font-semibold text-gray-800 dark:text-gray-200">
                      {coveredByAgency(trip) ? <span className="text-gray-400 dark:text-gray-500 font-normal">—</span> : fmtEur(trip.price_eur ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-800">
                <tr>
                  <td colSpan={3} className="px-2.5 sm:px-5 py-3 text-sm font-semibold text-gray-600 dark:text-gray-400">{t('sub_taxis')}</td>
                  <td className="px-2.5 sm:px-5 py-3 text-right font-bold text-gray-800 dark:text-gray-200">{fmtEur(taxiTotal)}</td>
                </tr>
              </tfoot>
            </table></div>
          </Section>
        )}

        {/* Dining events */}
        {diningRows.length > 0 && (
          <Section title={t('sec_dining')} icon="🍽️">
            <div className="overflow-x-auto"><table className="w-full text-sm stack-mobile">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-2.5 sm:px-5 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">{t('col_date')}</th>
                  <th className="px-2.5 sm:px-5 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">{t('col_event')}</th>
                  <th className="px-2.5 sm:px-5 py-2.5 text-right font-medium text-gray-500 dark:text-gray-400">{t('col_detail')}</th>
                  <th className="px-2.5 sm:px-5 py-2.5 text-right font-medium text-gray-500 dark:text-gray-400">{t('col_total')}</th>
                </tr>
              </thead>
              <tbody>
                {diningRows.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 dark:border-gray-800">
                    <td data-label={t('col_date')} className="px-2.5 sm:px-5 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td data-label={t('col_event')} className="px-2.5 sm:px-5 py-3 text-gray-600 dark:text-gray-400">{r.name}</td>
                    <td data-label={t('col_detail')} className="px-2.5 sm:px-5 py-3 text-right text-gray-500 dark:text-gray-400">
                      {r.count}p @ {fmtEur(r.pricePerPerson)}
                      {r.guests && <span className="ml-1 text-blue-400 dark:text-blue-300 text-xs">({r.guests})</span>}
                    </td>
                    <td data-label={t('col_total')} className="px-2.5 sm:px-5 py-3 text-right font-semibold text-gray-800 dark:text-gray-200">{fmtEur(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-800">
                <tr>
                  <td colSpan={3} className="px-2.5 sm:px-5 py-3 text-sm font-semibold text-gray-600 dark:text-gray-400">{t('sub_dining')}</td>
                  <td className="px-2.5 sm:px-5 py-3 text-right font-bold text-gray-800 dark:text-gray-200">{fmtEur(diningTotal)}</td>
                </tr>
              </tfoot>
            </table></div>
          </Section>
        )}

        {/* Activities */}
        {activityRows.length > 0 && (
          <Section title={t('sec_activities')} icon="🎯">
            <div className="overflow-x-auto"><table className="w-full text-sm stack-mobile">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-2.5 sm:px-5 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">{t('col_date')}</th>
                  <th className="px-2.5 sm:px-5 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">{t('col_activity')}</th>
                  <th className="px-2.5 sm:px-5 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">{t('col_guests')}</th>
                  <th className="px-2.5 sm:px-5 py-2.5 text-right font-medium text-gray-500 dark:text-gray-400">{t('col_total')}</th>
                </tr>
              </thead>
              <tbody>
                {activityRows.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 dark:border-gray-800">
                    <td data-label={t('col_date')} className="px-2.5 sm:px-5 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td data-label={t('col_activity')} className="px-2.5 sm:px-5 py-3 text-gray-600 dark:text-gray-400">{r.label}</td>
                    <td data-label={t('col_guests')} className="px-2.5 sm:px-5 py-3 text-blue-500 dark:text-blue-400 text-xs">{r.guests}</td>
                    <td data-label={t('col_total')} className="px-2.5 sm:px-5 py-3 text-right font-semibold text-gray-800 dark:text-gray-200">{fmtEur(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-800">
                <tr>
                  <td colSpan={3} className="px-2.5 sm:px-5 py-3 text-sm font-semibold text-gray-600 dark:text-gray-400">{t('sub_activities')}</td>
                  <td className="px-2.5 sm:px-5 py-3 text-right font-bold text-gray-800 dark:text-gray-200">{fmtEur(activityTotal)}</td>
                </tr>
              </tfoot>
            </table></div>
          </Section>
        )}

        {/* Center access */}
        {centerAccessTotal > 0 && (
          <Section title={t('sec_center_access')} icon="🏖️">
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-gray-50 dark:border-gray-800">
                  <td className="px-2.5 sm:px-5 py-3 text-gray-600 dark:text-gray-400">
                    {booking.num_center_access} {t(booking.num_center_access > 1 ? 'persons' : 'person')} × {nights} {t(nights !== 1 ? 'nights' : 'night')} @ {fmtEur(booking.center_access_rate ?? 0)}/{t('per_day')}
                  </td>
                  <td className="px-2.5 sm:px-5 py-3 text-right font-semibold text-gray-800 dark:text-gray-200">{fmtEur(centerAccessTotal)}</td>
                </tr>
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-800">
                <tr>
                  <td className="px-2.5 sm:px-5 py-3 text-sm font-semibold text-gray-600 dark:text-gray-400">{t('sub_center_access')}</td>
                  <td className="px-2.5 sm:px-5 py-3 text-right font-bold text-gray-800 dark:text-gray-200">{fmtEur(centerAccessTotal)}</td>
                </tr>
              </tfoot>
            </table></div>
          </Section>
        )}

        {/* Extras */}
        {extraRows.length > 0 && (
          <Section title={t('sec_extras')} icon="➕">
            <div className="overflow-x-auto"><table className="w-full text-sm stack-mobile">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-2.5 sm:px-5 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">{t('col_date')}</th>
                  <th className="px-2.5 sm:px-5 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">{t('col_item')}</th>
                  <th className="px-2.5 sm:px-5 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">{t('col_qty')}</th>
                  <th className="px-2.5 sm:px-5 py-2.5 text-right font-medium text-gray-500 dark:text-gray-400">{t('col_total')}</th>
                </tr>
              </thead>
              <tbody>
                {extraRows.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 dark:border-gray-800">
                    <td data-label={t('col_date')} className="px-2.5 sm:px-5 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td data-label={t('col_item')} className="px-2.5 sm:px-5 py-3 text-gray-600 dark:text-gray-400">{r.label}</td>
                    <td data-label={t('col_qty')} className="px-2.5 sm:px-5 py-3 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">{r.quantity} × {fmtEur(r.unit_price)}</td>
                    <td data-label={t('col_total')} className="px-2.5 sm:px-5 py-3 text-right font-semibold text-gray-800 dark:text-gray-200">{fmtEur(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-800">
                <tr>
                  <td colSpan={3} className="px-2.5 sm:px-5 py-3 text-sm font-semibold text-gray-600 dark:text-gray-400">{t('sub_extras')}</td>
                  <td className="px-2.5 sm:px-5 py-3 text-right font-bold text-gray-800 dark:text-gray-200">{fmtEur(extrasTotal)}</td>
                </tr>
              </tfoot>
            </table></div>
          </Section>
        )}

        {/* Per-guest breakdown (collapsible) */}
        {(() => {
          if (participants.length === 0) return null

          type Line = { date: string; label: string; amount: number; covered?: boolean }
          const guestData = participants.map(part => {
            const lines: Line[] = []

            // Agency-covered services are skipped here, as everywhere else on this
            // page. They used to slip through: the subtotals excluded them (Phase 5)
            // while this per-guest breakdown still priced them, so the two did not
            // add up to the same number on an agency booking. Since Phase 4 the
            // price would arrive as NULL anyway and the line would read "0 €",
            // which tells the guest nothing — leaving it out is what the rest of
            // the page does with a service they are not charged for.
            for (const l of lessons) {
              if (!l.participant_ids.includes(part.id)) continue
              const instr = instructors.find(i => i.id === l.instructor_id)
              const lessonName = t('lesson_line').replace('{type}', t(`lesson_${l.type}` as ShareKey).toLowerCase()).replace('{h}', String(l.duration_hours))
              // Covered by the agency: listed, so the guest sees the hours they took,
              // but at no charge — it adds nothing to their total.
              if (coveredByAgency(l)) {
                lines.push({ date: l.date, label: `${lessonName}${instr ? ` (${instr.first_name})` : ''}${inParens(lessonGear_(l.id))} ${t('agency_package_line').replace('{agency}', agencyName)}`, amount: 0, covered: true })
                continue
              }
              const rate = getLessonRate(l)
              lines.push({
                date: l.date,
                label: `${lessonName}${instr ? ` (${instr.first_name})` : ''}${inParens(lessonGear_(l.id))}`,
                amount: rate * l.duration_hours,
              })
            }

            for (const r of rentals) {
              if (r.participant_id !== part.id) continue
              if (coveredByAgency(r)) continue
              lines.push({ date: r.date, label: `${t(rentalKey(r))}${inParens(rentalGear(r))} · ${t(`slot_${r.slot}` as ShareKey)}`, amount: r.price ?? 0 })
            }

            for (const ev of diningEvents) {
              const att = (ev.attendees ?? []).find(a => a.is_attending && a.person_type === 'participant' && a.person_id === part.id)
              if (!att) continue
              const amount = att.price_override ?? ev.price_per_person
              if (amount === 0) continue
              lines.push({ date: ev.date, label: ev.name || t('dining_default'), amount })
            }

            for (const a of activityBkgs.filter(a => a.payment_flow === 'we_pay_provider')) {
              if (!a.participant_ids.includes(part.id)) continue
              lines.push({ date: a.date, label: a.label, amount: a.price_client / a.nb_persons })
            }

            lines.sort((a, b) => a.date.localeCompare(b.date))
            const total = lines.reduce((s, l) => s + l.amount, 0)
            return { participant: part, lines, total }
          }).filter(g => g.lines.length > 0)

          if (guestData.length === 0) return null

          return (
            <section className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
              <details className="group">
                <summary className="cursor-pointer select-none px-5 py-4 flex items-center gap-2 font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                  <span className="transition-transform group-open:rotate-90">▶</span>
                  {t('sec_per_guest')}
                </summary>
                <div className="px-5 pb-4 space-y-3">
                  {guestData.map(({ participant: p, lines, total }) => (
                    <div key={p.id} className="rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
                      <div className="flex justify-between items-center px-4 py-2 bg-blue-50 dark:bg-blue-950/40">
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-400">{displayFirstName(p.first_name)} {p.last_name ?? ''}</span>
                        <span className="text-sm font-semibold text-blue-800 dark:text-blue-400">{fmtEur(total)}</span>
                      </div>
                      <div className="px-4 py-2 space-y-1">
                        {lines.map((l, i) => (
                          <div key={i} className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span>{formatDate(l.date)} · {l.label}</span>
                            <span>{l.covered ? t('included') : fmtEur(l.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </section>
          )
        })()}

        {/* Payments */}
        <section className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-semibold text-gray-800 dark:text-gray-200">💳 {t('sec_payments')}</h2>
          </div>
          {payments.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400 dark:text-gray-400 italic">{t('no_payments')}</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="overflow-x-auto"><table className="w-full text-sm stack-mobile">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    <th className="px-2.5 sm:px-5 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">{t('col_date')}</th>
                    <th className="px-2.5 sm:px-5 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">{t('col_method')}</th>
                    <th className="px-2.5 sm:px-5 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">{t('col_note')}</th>
                    <th className="px-2.5 sm:px-5 py-2.5 text-right font-medium text-gray-500 dark:text-gray-400">{t('col_amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id} className={`border-b border-gray-50 dark:border-gray-800 ${p.is_discount ? 'bg-purple-50 dark:bg-purple-950/40' : ''}`}>
                      <td data-label={t('col_date')} className="px-2.5 sm:px-5 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDate(p.date)}</td>
                      <td data-label={t('col_method')} className="px-2.5 sm:px-5 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {p.is_discount ? (
                          <span className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full font-medium">{t('discount')}</span>
                        ) : (
                          <>
                            {payLabel(p.method)}
                            {p.is_deposit && <span className="ml-1.5 text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">{t('deposit')}</span>}
                          </>
                        )}
                      </td>
                      <td data-label={t('col_note')} className="px-2.5 sm:px-5 py-3 text-gray-400 dark:text-gray-400 text-xs italic">{p.notes ?? ''}</td>
                      <td data-label={t('col_amount')} className={`px-2.5 sm:px-5 py-3 text-right font-semibold ${p.is_discount ? 'text-purple-700 dark:text-purple-400' : 'text-green-700 dark:text-green-400'}`}>
                        {p.is_discount ? '-' : ''}{fmtEur(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-800">
                  {totalDiscounts > 0 && (
                    <tr>
                      <td colSpan={3} className="px-2.5 sm:px-5 py-2 text-sm font-semibold text-purple-600 dark:text-purple-400">{t('total_discounts')}</td>
                      <td className="px-2.5 sm:px-5 py-2 text-right font-bold text-purple-700 dark:text-purple-400">-{fmtEur(totalDiscounts)}</td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={3} className="px-2.5 sm:px-5 py-3 text-sm font-semibold text-gray-600 dark:text-gray-400">{t('total_paid')}</td>
                    <td className="px-2.5 sm:px-5 py-3 text-right font-bold text-green-700 dark:text-green-400">{fmtEur(totalPaid)}</td>
                  </tr>
                </tfoot>
              </table></div>
            </div>
          )}
        </section>

        {/* Balance */}
        <section className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-semibold text-gray-800 dark:text-gray-200">💰 {t('sec_balance')}</h2>
          </div>
          <div className="px-5 py-4 space-y-2 text-sm">
            {totalCharges > 0 && (
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>{t('total_charges')}</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{fmtEur(totalCharges)}</span>
              </div>
            )}
            {totalDiscounts > 0 && (
              <div className="flex justify-between text-purple-600 dark:text-purple-400">
                <span>{t('discounts')}</span>
                <span className="font-medium">-{fmtEur(totalDiscounts)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>{t('total_paid')}</span>
              <span className="font-medium text-green-700 dark:text-green-400">{fmtEur(totalPaid)}</span>
            </div>
            <div className="border-t border-gray-100 dark:border-gray-800 pt-3 mt-3 flex justify-between items-center">
              <span className="font-semibold text-gray-800 dark:text-gray-200 text-base">{t('balance')}</span>
              {balance === 0 ? (
                <span className="font-bold text-green-600 dark:text-green-400 text-lg">€0 ✓</span>
              ) : balance > 0 ? (
                <span className="font-bold text-red-600 dark:text-red-400 text-lg">{fmtEur(balance)} {t('due')}</span>
              ) : (
                <span className="font-bold text-blue-600 dark:text-blue-400 text-lg">{fmtEur(Math.abs(balance))} {t('credit')}</span>
              )}
            </div>
            {hasAgencyCovered && (
              <p className="text-xs text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-800">
                {t('agency_note').replace('{agency}', agencyName)}
              </p>
            )}
          </div>
        </section>

      </div>
    </div>
  )
}

// ─── Reusable section wrapper ─────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200">{icon} {title}</h2>
      </div>
      <div className="overflow-x-auto">
        {children}
      </div>
    </section>
  )
}
