import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type {
  Booking, Client, BookingRoom, BookingRoomPrice,
  Room, Accommodation, Payment, Lesson, Instructor,
  LessonRateOverride, EquipmentRental, TaxiTrip,
  DiningEvent, BookingParticipant,
  ExternalAccommodationBooking, ExternalAccommodation,
  ActivityBooking,
} from '../types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingWithClient = Omit<Booking, 'client'> & { client: Client | null }

interface Props {
  bookingNumber: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.max(0, Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)
  ))
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtEur(n: number): string {
  return n.toLocaleString('en-GB', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })
}

function roomLabel(room: Room, accom: Accommodation): string {
  const house = accom.name.replace('Maison ', 'H-')
  const side  = room.name === 'Chambre 1' ? 'F' : room.name === 'Chambre 2' ? 'B' : room.name
  return accom.type === 'house' ? `${house}/${side}` : accom.name
}

function getLessonRate(l: Lesson, instr: Instructor, overrides: LessonRateOverride[]): number {
  const ov = overrides.find(o => o.lesson_id === l.id)
  if (ov) return ov.rate
  return l.type === 'private' ? instr.rate_private
    : l.type === 'group' ? instr.rate_group
    : instr.rate_supervision
}

const METHOD_LABELS: Record<string, string> = {
  cash_eur:        'Cash (€)',
  cash_mzn:        'Cash (MZN)',
  transfer:        'Transfer',
  card_palmeiras:  'Card – Palmeiras',
}

const TAXI_TYPE_LABELS: Record<string, string> = {
  'aero-to-center': 'Airport → Center',
  'center-to-aero': 'Center → Airport',
  'aero-to-spot':   'Airport → Spot',
  'spot-to-aero':   'Spot → Airport',
  'center-to-town': 'Center → Town',
  'town-to-center': 'Town → Center',
  'other':          'Other',
}

const STATUS_CFG = {
  confirmed:   { label: 'Confirmed',   cls: 'bg-green-100 text-green-700'  },
  provisional: { label: 'Provisional', cls: 'bg-amber-100 text-amber-700'  },
  cancelled:   { label: 'Cancelled',   cls: 'bg-red-100 text-red-600'      },
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ClientSharePage({ bookingNumber }: Props) {
  const [booking,        setBooking]        = useState<BookingWithClient | 'not_found' | undefined>(undefined)
  const [bkgRooms,       setBkgRooms]       = useState<BookingRoom[]>([])
  const [roomPrices,     setRoomPrices]     = useState<BookingRoomPrice[]>([])
  const [rooms,          setRooms]          = useState<Room[]>([])
  const [accoms,         setAccoms]         = useState<Accommodation[]>([])
  const [payments,       setPayments]       = useState<Payment[]>([])
  const [lessons,        setLessons]        = useState<Lesson[]>([])
  const [instructors,    setInstructors]    = useState<Instructor[]>([])
  const [lessonOverrides,setLessonOverrides]= useState<LessonRateOverride[]>([])
  const [rentals,        setRentals]        = useState<EquipmentRental[]>([])
  const [taxis,          setTaxis]          = useState<TaxiTrip[]>([])
  const [diningEvents,   setDiningEvents]   = useState<DiningEvent[]>([])
  const [participants,   setParticipants]   = useState<BookingParticipant[]>([])
  const [extAccomBkgs,   setExtAccomBkgs]   = useState<ExternalAccommodationBooking[]>([])
  const [extAccoms,      setExtAccoms]      = useState<ExternalAccommodation[]>([])
  const [activityBkgs,   setActivityBkgs]   = useState<ActivityBooking[]>([])
  const [loading,        setLoading]        = useState(true)

  // Step 1 — fetch booking by number
  useEffect(() => {
    if (!bookingNumber) { setBooking('not_found'); setLoading(false); return }

    supabase
      .from('bookings')
      // Only identity columns from clients are exposed to anon (no email/phone/passport/etc — see security-rls.md)
      .select('*, client:clients(id, first_name, last_name)')
      .eq('booking_number', bookingNumber)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setBooking('not_found'); setLoading(false); return }
        setBooking(data as BookingWithClient)
      })
  }, [bookingNumber])

  // Step 2 — once booking is loaded, fetch all related data in parallel
  useEffect(() => {
    if (!booking || booking === 'not_found') return
    const id = booking.id

    Promise.all([
      supabase.from('booking_rooms').select('*').eq('booking_id', id),
      supabase.from('booking_room_prices').select('*').eq('booking_id', id),
      supabase.from('rooms').select('*'),
      supabase.from('accommodations').select('*'),
      supabase.from('payments').select('*').eq('booking_id', id).order('date'),
      supabase.from('lessons').select('*').eq('booking_id', id).order('date'),
      supabase.from('instructors').select('*'),
      supabase.from('lesson_rate_overrides').select('*'),
      supabase.from('equipment_rentals').select('*').eq('booking_id', id).order('date'),
      supabase.from('taxi_trips').select('*').eq('booking_id', id).order('date'),
      supabase.from('dining_events').select('*'),
      supabase.from('booking_participants').select('id, booking_id, first_name, last_name').eq('booking_id', id),
      supabase.from('external_accommodation_bookings').select('*').eq('booking_id', id),
      supabase.from('external_accommodations').select('*'),
      supabase.from('activity_bookings').select('*').eq('booking_id', id).order('date'),
    ]).then(([
      bkgRoomsRes, pricesRes, roomsRes, acomsRes, paymentsRes,
      lessonsRes, instrRes, overridesRes, rentalsRes, taxisRes,
      diningRes, partRes, extBkgRes, extAccomRes, actBkgRes,
    ]) => {
      setBkgRooms(bkgRoomsRes.data ?? [])
      setRoomPrices(pricesRes.data ?? [])
      setRooms(roomsRes.data ?? [])
      setAccoms(acomsRes.data ?? [])
      setPayments(paymentsRes.data ?? [])
      setLessons(lessonsRes.data ?? [])
      setInstructors(instrRes.data ?? [])
      setLessonOverrides(overridesRes.data ?? [])
      setRentals(rentalsRes.data ?? [])
      setTaxis(taxisRes.data ?? [])
      setDiningEvents(diningRes.data ?? [])
      // anon only receives id/first_name/last_name (column-restricted); the page uses only those
      setParticipants((partRes.data ?? []) as unknown as BookingParticipant[])
      setExtAccomBkgs(extBkgRes.data ?? [])
      setExtAccoms(extAccomRes.data ?? [])
      setActivityBkgs(actBkgRes.data ?? [])
      setLoading(false)
    })
  }, [booking])

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading || booking === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-lg">Loading…</div>
      </div>
    )
  }

  if (booking === 'not_found') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl text-gray-400 mb-2">Booking not found</p>
          <p className="text-sm text-gray-400">This link may be invalid or expired.</p>
        </div>
      </div>
    )
  }

  // ── Calculations ───────────────────────────────────────────────────────────

  const nights = nightsBetween(booking.check_in, booking.check_out)
  const statusCfg = STATUS_CFG[booking.status] ?? STATUS_CFG.confirmed

  // Accommodation rows (own rooms)
  const accomRows = bkgRooms.map(br => {
    const room  = rooms.find(r => r.id === br.room_id)
    const accom = room ? accoms.find(a => a.id === room.accommodation_id) : null
    const priceRow = roomPrices.find(p => p.room_id === br.room_id)
    const pricePerNight = priceRow?.price_per_night ?? 0
    return {
      label: room && accom ? roomLabel(room, accom) : br.room_id,
      nights,
      pricePerNight,
      total: nights * pricePerNight,
      note: priceRow?.override_note ?? null,
    }
  })

  // External accommodation rows
  const extAccomRows = extAccomBkgs.map(e => {
    const acc = extAccoms.find(a => a.id === e.external_accommodation_id)
    const n = nightsBetween(e.check_in, e.check_out)
    return {
      label: acc?.name ?? 'External',
      nights: n,
      pricePerNight: e.sell_price_per_night,
      total: e.sell_price_per_night * n,
    }
  })

  const accomTotal = accomRows.reduce((s, r) => s + r.total, 0)
    + extAccomRows.reduce((s, r) => s + r.total, 0)

  // Participant name helpers
  const partName = (id: string) => participants.find(p => p.id === id)?.first_name ?? null
  const partNames = (ids: string[]) => ids.map(partName).filter(Boolean).join(', ')

  // Lessons
  const lessonRows = lessons.map(l => {
    const instr = instructors.find(i => i.id === l.instructor_id)
    const rate = instr ? getLessonRate(l, instr, lessonOverrides) : 0
    return {
      id: l.id,
      date: l.date,
      type: l.type,
      duration: l.duration_hours,
      instructor: instr ? instr.first_name : '?',
      guests: partNames(l.participant_ids),
      total: rate * l.duration_hours * (l.type === 'group' ? l.participant_ids.length : 1),
    }
  })
  const lessonsTotal = lessonRows.reduce((s, r) => s + r.total, 0)

  // Equipment rentals
  const rentalsTotal = rentals.reduce((s, r) => s + r.price, 0)

  // Taxis
  const taxiTotal = taxis.reduce((s, t) => s + t.price_eur, 0)

  // Dining events (match participants to attendees)
  const partIds = new Set(participants.map(p => p.id))
  const diningRows: { id: string; date: string; name: string; count: number; pricePerPerson: number; guests: string; total: number }[] = []
  for (const ev of diningEvents) {
    if (ev.price_per_person === 0) continue
    const attending = (ev.attendees ?? [])
      .filter(a => a.is_attending && a.person_type === 'participant' && partIds.has(a.person_id))
    if (attending.length === 0) continue
    const total = attending.reduce((s, a) => s + (a.price_override ?? ev.price_per_person), 0)
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
  const totalCharges = accomTotal + lessonsTotal + rentalsTotal + taxiTotal + diningTotal + activityTotal + centerAccessTotal
  const balance = totalCharges - totalDiscounts - totalPaid

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <span className="text-xl font-bold text-blue-600">Kitesurf Center</span>
        <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
          Your stay — Read-only
        </span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Booking summary card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-blue-200 text-sm font-medium">Booking #{String(booking.booking_number).padStart(3, '0')}</p>
                <h1 className="text-2xl font-bold mt-0.5">
                  {booking.client?.first_name} {booking.client?.last_name}
                </h1>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusCfg.cls}`}>
                {statusCfg.label}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-blue-100">
              <span>{formatDate(booking.check_in)}</span>
              <span>→</span>
              <span>{formatDate(booking.check_out)}</span>
              <span className="ml-2 bg-blue-500/40 px-2 py-0.5 rounded-full text-white font-medium">
                {nights} night{nights !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Accommodation */}
        {(accomRows.length > 0 || extAccomRows.length > 0) && (
          <Section title="Accommodation" icon="🛏️">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium text-gray-500">Room</th>
                  <th className="px-5 py-2.5 text-right font-medium text-gray-500">Nights</th>
                  <th className="px-5 py-2.5 text-right font-medium text-gray-500">Per night</th>
                  <th className="px-5 py-2.5 text-right font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {accomRows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-800">
                      {row.label}
                      {row.note && <span className="ml-2 text-xs text-gray-400 italic">{row.note}</span>}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">{row.nights}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{fmtEur(row.pricePerNight)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-800">{fmtEur(row.total)}</td>
                  </tr>
                ))}
                {extAccomRows.map((row, i) => (
                  <tr key={`ext-${i}`} className="border-b border-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-800">{row.label}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{row.nights}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{fmtEur(row.pricePerNight)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-800">{fmtEur(row.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={3} className="px-5 py-3 text-sm font-semibold text-gray-600">Subtotal accommodation</td>
                  <td className="px-5 py-3 text-right font-bold text-gray-800">{fmtEur(accomTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </Section>
        )}

        {/* Lessons */}
        {lessonRows.length > 0 && (
          <Section title="Kite lessons" icon="🏄">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium text-gray-500">Date</th>
                  <th className="px-5 py-2.5 text-left font-medium text-gray-500">Type</th>
                  <th className="px-5 py-2.5 text-left font-medium text-gray-500">Guest</th>
                  <th className="px-5 py-2.5 text-right font-medium text-gray-500">Duration</th>
                  <th className="px-5 py-2.5 text-left font-medium text-gray-500">Instructor</th>
                  <th className="px-5 py-2.5 text-right font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {lessonRows.map(r => (
                  <tr key={r.id} className="border-b border-gray-50">
                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="px-5 py-3 text-gray-600 capitalize">{r.type}</td>
                    <td className="px-5 py-3 text-blue-500 text-xs">{r.guests}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{r.duration}h</td>
                    <td className="px-5 py-3 text-gray-600">{r.instructor}</td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-800">{fmtEur(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={5} className="px-5 py-3 text-sm font-semibold text-gray-600">Subtotal lessons</td>
                  <td className="px-5 py-3 text-right font-bold text-gray-800">{fmtEur(lessonsTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </Section>
        )}

        {/* Equipment rentals */}
        {rentals.length > 0 && (
          <Section title="Equipment rentals" icon="🎿">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium text-gray-500">Date</th>
                  <th className="px-5 py-2.5 text-left font-medium text-gray-500">Guest</th>
                  <th className="px-5 py-2.5 text-left font-medium text-gray-500">Slot</th>
                  <th className="px-5 py-2.5 text-right font-medium text-gray-500">Price</th>
                </tr>
              </thead>
              <tbody>
                {rentals.map(r => (
                  <tr key={r.id} className="border-b border-gray-50">
                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="px-5 py-3 text-blue-500 text-xs">{r.participant_id ? partName(r.participant_id) ?? '' : ''}</td>
                    <td className="px-5 py-3 text-gray-600 capitalize">{r.slot.replace('_', ' ')}</td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-800">{fmtEur(r.price)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={3} className="px-5 py-3 text-sm font-semibold text-gray-600">Subtotal rentals</td>
                  <td className="px-5 py-3 text-right font-bold text-gray-800">{fmtEur(rentalsTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </Section>
        )}

        {/* Taxis */}
        {taxis.length > 0 && (
          <Section title="Taxi transfers" icon="🚕">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium text-gray-500">Date</th>
                  <th className="px-5 py-2.5 text-left font-medium text-gray-500">Route</th>
                  <th className="px-5 py-2.5 text-right font-medium text-gray-500">Pax</th>
                  <th className="px-5 py-2.5 text-right font-medium text-gray-500">Price</th>
                </tr>
              </thead>
              <tbody>
                {taxis.map(t => (
                  <tr key={t.id} className="border-b border-gray-50">
                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{formatDate(t.date)}</td>
                    <td className="px-5 py-3 text-gray-600">{TAXI_TYPE_LABELS[t.type] ?? t.type}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{t.nb_persons}</td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-800">{fmtEur(t.price_eur)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={3} className="px-5 py-3 text-sm font-semibold text-gray-600">Subtotal taxis</td>
                  <td className="px-5 py-3 text-right font-bold text-gray-800">{fmtEur(taxiTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </Section>
        )}

        {/* Dining events */}
        {diningRows.length > 0 && (
          <Section title="Dining" icon="🍽️">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium text-gray-500">Date</th>
                  <th className="px-5 py-2.5 text-left font-medium text-gray-500">Event</th>
                  <th className="px-5 py-2.5 text-right font-medium text-gray-500">Detail</th>
                  <th className="px-5 py-2.5 text-right font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {diningRows.map(r => (
                  <tr key={r.id} className="border-b border-gray-50">
                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="px-5 py-3 text-gray-600">{r.name}</td>
                    <td className="px-5 py-3 text-right text-gray-500">
                      {r.count}p @ {fmtEur(r.pricePerPerson)}
                      {r.guests && <span className="ml-1 text-blue-400 text-xs">({r.guests})</span>}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-800">{fmtEur(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={3} className="px-5 py-3 text-sm font-semibold text-gray-600">Subtotal dining</td>
                  <td className="px-5 py-3 text-right font-bold text-gray-800">{fmtEur(diningTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </Section>
        )}

        {/* Activities */}
        {activityRows.length > 0 && (
          <Section title="Activities" icon="🎯">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium text-gray-500">Date</th>
                  <th className="px-5 py-2.5 text-left font-medium text-gray-500">Activity</th>
                  <th className="px-5 py-2.5 text-left font-medium text-gray-500">Guests</th>
                  <th className="px-5 py-2.5 text-right font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {activityRows.map(r => (
                  <tr key={r.id} className="border-b border-gray-50">
                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="px-5 py-3 text-gray-600">{r.label}</td>
                    <td className="px-5 py-3 text-blue-500 text-xs">{r.guests}</td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-800">{fmtEur(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={3} className="px-5 py-3 text-sm font-semibold text-gray-600">Subtotal activities</td>
                  <td className="px-5 py-3 text-right font-bold text-gray-800">{fmtEur(activityTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </Section>
        )}

        {/* Center access */}
        {centerAccessTotal > 0 && (
          <Section title="Center access" icon="🏖️">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-gray-50">
                  <td className="px-5 py-3 text-gray-600">
                    {booking.num_center_access} person{booking.num_center_access > 1 ? 's' : ''} × {nights} night{nights !== 1 ? 's' : ''} @ {fmtEur(booking.center_access_rate ?? 0)}/day
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-800">{fmtEur(centerAccessTotal)}</td>
                </tr>
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td className="px-5 py-3 text-sm font-semibold text-gray-600">Subtotal center access</td>
                  <td className="px-5 py-3 text-right font-bold text-gray-800">{fmtEur(centerAccessTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </Section>
        )}

        {/* Per-guest breakdown (collapsible) */}
        {(() => {
          if (participants.length === 0) return null

          type Line = { date: string; label: string; amount: number }
          const guestData = participants.map(part => {
            const lines: Line[] = []

            for (const l of lessons) {
              if (!l.participant_ids.includes(part.id)) continue
              const instr = instructors.find(i => i.id === l.instructor_id)
              if (!instr) continue
              const rate = getLessonRate(l, instr, lessonOverrides)
              lines.push({ date: l.date, label: `${l.type} lesson ${l.duration_hours}h (${instr.first_name})`, amount: rate * l.duration_hours })
            }

            for (const r of rentals) {
              if (r.participant_id !== part.id) continue
              lines.push({ date: r.date, label: `rental · ${r.slot}`, amount: r.price })
            }

            for (const ev of diningEvents) {
              if (ev.price_per_person === 0) continue
              const att = (ev.attendees ?? []).find(a => a.is_attending && a.person_type === 'participant' && a.person_id === part.id)
              if (!att) continue
              lines.push({ date: ev.date, label: ev.name || 'dining', amount: att.price_override ?? ev.price_per_person })
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
            <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <details className="group">
                <summary className="cursor-pointer select-none px-5 py-4 flex items-center gap-2 font-semibold text-gray-500 hover:text-gray-700 transition-colors">
                  <span className="transition-transform group-open:rotate-90">▶</span>
                  Per-guest breakdown
                </summary>
                <div className="px-5 pb-4 space-y-3">
                  {guestData.map(({ participant: p, lines, total }) => (
                    <div key={p.id} className="rounded-lg border border-gray-100 overflow-hidden">
                      <div className="flex justify-between items-center px-4 py-2 bg-blue-50">
                        <span className="text-sm font-medium text-blue-800">{p.first_name} {p.last_name ?? ''}</span>
                        <span className="text-sm font-semibold text-blue-800">{fmtEur(total)}</span>
                      </div>
                      <div className="px-4 py-2 space-y-1">
                        {lines.map((l, i) => (
                          <div key={i} className="flex justify-between text-xs text-gray-500">
                            <span>{formatDate(l.date)} · {l.label}</span>
                            <span>{fmtEur(l.amount)}</span>
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
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">💳 Payments</h2>
          </div>
          {payments.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400 italic">No payments recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-2.5 text-left font-medium text-gray-500">Date</th>
                    <th className="px-5 py-2.5 text-left font-medium text-gray-500">Method</th>
                    <th className="px-5 py-2.5 text-left font-medium text-gray-500">Note</th>
                    <th className="px-5 py-2.5 text-right font-medium text-gray-500">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id} className={`border-b border-gray-50 ${p.is_discount ? 'bg-purple-50' : ''}`}>
                      <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{formatDate(p.date)}</td>
                      <td className="px-5 py-3 text-gray-600 whitespace-nowrap">
                        {p.is_discount ? (
                          <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">Discount</span>
                        ) : (
                          <>
                            {METHOD_LABELS[p.method] ?? p.method}
                            {p.is_deposit && <span className="ml-1.5 text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full">Deposit</span>}
                          </>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-xs italic">{p.notes ?? ''}</td>
                      <td className={`px-5 py-3 text-right font-semibold ${p.is_discount ? 'text-purple-700' : 'text-green-700'}`}>
                        {p.is_discount ? '-' : ''}{fmtEur(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  {totalDiscounts > 0 && (
                    <tr>
                      <td colSpan={3} className="px-5 py-2 text-sm font-semibold text-purple-600">Total discounts</td>
                      <td className="px-5 py-2 text-right font-bold text-purple-700">-{fmtEur(totalDiscounts)}</td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={3} className="px-5 py-3 text-sm font-semibold text-gray-600">Total paid</td>
                    <td className="px-5 py-3 text-right font-bold text-green-700">{fmtEur(totalPaid)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* Balance */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">💰 Balance</h2>
          </div>
          <div className="px-5 py-4 space-y-2 text-sm">
            {totalCharges > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Total charges</span>
                <span className="font-medium text-gray-800">{fmtEur(totalCharges)}</span>
              </div>
            )}
            {totalDiscounts > 0 && (
              <div className="flex justify-between text-purple-600">
                <span>Discounts</span>
                <span className="font-medium">-{fmtEur(totalDiscounts)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600">
              <span>Total paid</span>
              <span className="font-medium text-green-700">{fmtEur(totalPaid)}</span>
            </div>
            <div className="border-t border-gray-100 pt-3 mt-3 flex justify-between items-center">
              <span className="font-semibold text-gray-800 text-base">Balance</span>
              {balance === 0 ? (
                <span className="font-bold text-green-600 text-lg">€0 ✓</span>
              ) : balance > 0 ? (
                <span className="font-bold text-red-600 text-lg">{fmtEur(balance)} due</span>
              ) : (
                <span className="font-bold text-blue-600 text-lg">{fmtEur(Math.abs(balance))} credit</span>
              )}
            </div>
          </div>
        </section>

        <p className="text-center text-xs text-gray-300 pb-4">Read-only view · Kitesurf Center Management</p>
      </div>
    </div>
  )
}

// ─── Reusable section wrapper ─────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800">{icon} {title}</h2>
      </div>
      <div className="overflow-x-auto">
        {children}
      </div>
    </section>
  )
}
