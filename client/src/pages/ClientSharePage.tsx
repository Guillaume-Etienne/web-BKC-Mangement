import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type {
  Booking, Client, BookingRoom, BookingRoomPrice,
  Room, Accommodation, Payment, ParticipantConsumption,
} from '../types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingWithClient = Omit<Booking, 'client'> & { client: Client | null }

interface Props {
  bookingNumber: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)
  )
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

const METHOD_LABELS: Record<string, string> = {
  cash_eur:        'Cash (€)',
  cash_mzn:        'Cash (MZN)',
  transfer:        'Transfer',
  card_palmeiras:  'Card – Palmeiras',
}

const CONSUMPTION_LABELS: Record<string, string> = {
  lesson:        'Kite lesson',
  rental:        'Equipment rental',
  activity:      'Activity',
  center_access: 'Center access',
}

const STATUS_CFG = {
  confirmed:   { label: 'Confirmed',   cls: 'bg-green-100 text-green-700'  },
  provisional: { label: 'Provisional', cls: 'bg-amber-100 text-amber-700'  },
  cancelled:   { label: 'Cancelled',   cls: 'bg-red-100 text-red-600'      },
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ClientSharePage({ bookingNumber }: Props) {
  const [booking,      setBooking]      = useState<BookingWithClient | 'not_found' | undefined>(undefined)
  const [bkgRooms,     setBkgRooms]     = useState<BookingRoom[]>([])
  const [roomPrices,   setRoomPrices]   = useState<BookingRoomPrice[]>([])
  const [rooms,        setRooms]        = useState<Room[]>([])
  const [accoms,       setAccoms]       = useState<Accommodation[]>([])
  const [payments,     setPayments]     = useState<Payment[]>([])
  const [consumptions, setConsumptions] = useState<ParticipantConsumption[]>([])
  const [loading,      setLoading]      = useState(true)

  // Step 1 — fetch booking by number
  useEffect(() => {
    if (!bookingNumber) { setBooking('not_found'); setLoading(false); return }

    supabase
      .from('bookings')
      .select('*, client:clients(*)')
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
      supabase.from('participant_consumptions').select('*').eq('booking_id', id),
    ]).then(([bkgRoomsRes, pricesRes, roomsRes, acomsRes, paymentsRes, consRes]) => {
      setBkgRooms(bkgRoomsRes.data ?? [])
      setRoomPrices(pricesRes.data ?? [])
      setRooms(roomsRes.data ?? [])
      setAccoms(acomsRes.data ?? [])
      setPayments(paymentsRes.data ?? [])
      setConsumptions(consRes.data ?? [])
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

  // Accommodation rows
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
  const accomTotal = accomRows.reduce((s, r) => s + r.total, 0)

  // Consumption rows
  const consTotal = consumptions.reduce((s, c) => s + c.unit_price * c.quantity, 0)

  // Payments
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0)

  // Grand totals
  const totalCharges = accomTotal + consTotal
  const balance = totalCharges - totalPaid

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <span className="text-xl font-bold text-blue-600">🏄 Kitesurf Center</span>
        <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
          👤 Your stay — Read-only
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
        {accomRows.length > 0 && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">🛏️ Accommodation</h2>
            </div>
            <div className="overflow-x-auto">
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
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={3} className="px-5 py-3 text-sm font-semibold text-gray-600">Subtotal accommodation</td>
                    <td className="px-5 py-3 text-right font-bold text-gray-800">{fmtEur(accomTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        {/* Services / consumptions */}
        {consumptions.length > 0 && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">🎯 Services</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-2.5 text-left font-medium text-gray-500">Service</th>
                    <th className="px-5 py-2.5 text-right font-medium text-gray-500">Qty</th>
                    <th className="px-5 py-2.5 text-right font-medium text-gray-500">Unit price</th>
                    <th className="px-5 py-2.5 text-right font-medium text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {consumptions.map(c => (
                    <tr key={c.id} className="border-b border-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-800">
                        {CONSUMPTION_LABELS[c.type] ?? c.type}
                        {c.notes && <span className="ml-2 text-xs text-gray-400 italic">{c.notes}</span>}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">{c.quantity}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{fmtEur(c.unit_price)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-800">{fmtEur(c.unit_price * c.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={3} className="px-5 py-3 text-sm font-semibold text-gray-600">Subtotal services</td>
                    <td className="px-5 py-3 text-right font-bold text-gray-800">{fmtEur(consTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

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
                    <tr key={p.id} className="border-b border-gray-50">
                      <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{formatDate(p.date)}</td>
                      <td className="px-5 py-3 text-gray-600 whitespace-nowrap">
                        {METHOD_LABELS[p.method] ?? p.method}
                        {p.is_deposit && <span className="ml-1.5 text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full">Deposit</span>}
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-xs italic">{p.notes ?? ''}</td>
                      <td className="px-5 py-3 text-right font-semibold text-green-700">{fmtEur(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
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
