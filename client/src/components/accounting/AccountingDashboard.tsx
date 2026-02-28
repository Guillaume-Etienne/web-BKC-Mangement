import type { SharedAccountingData } from './types'
import { computeBookingTotal, computeBookingPaid } from './utils'

interface Props { data: SharedAccountingData }

export default function AccountingDashboard({ data }: Props) {
  const { bookings, payments,
          lessons, instructors, lessonRateOverrides,
          taxiTrips, expenses, palmeirasRents, palmeirasReversals } = data

  // ── Revenue ──────────────────────────────────────────────────────────────
  const totalRevenue = bookings
    .filter(b => b.status !== 'cancelled')
    .reduce((sum, b) => sum + computeBookingTotal(b, data), 0)

  const totalPaid = bookings.reduce((sum, b) => sum + computeBookingPaid(b.id, payments), 0)
  const totalDue  = totalRevenue - totalPaid

  // ── Instructor costs ─────────────────────────────────────────────────────
  const instructorCosts = lessons.reduce((sum, l) => {
    const instructor = instructors.find(i => i.id === l.instructor_id)
    if (!instructor) return sum
    const override = lessonRateOverrides.find(o => o.lesson_id === l.id)
    const rate = override
      ? override.rate
      : l.type === 'private' ? instructor.rate_private
      : l.type === 'group'   ? instructor.rate_group
      : instructor.rate_supervision
    return sum + rate * l.duration_hours
  }, 0)

  // ── Taxi margins ─────────────────────────────────────────────────────────
  const taxiMargin = taxiTrips.reduce((sum, t) => sum + t.center_margin, 0)

  // ── Expenses ─────────────────────────────────────────────────────────────
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

  // ── Palmeiras net ─────────────────────────────────────────────────────────
  const palmeirasIn  = palmeirasReversals.reduce((sum, r) => sum + r.net_amount, 0)
  const palmeirasOut = palmeirasRents.reduce((sum, r) => sum + r.amount, 0)
  const palmeirasNet = palmeirasIn - palmeirasOut

  // ── Net result ────────────────────────────────────────────────────────────
  const netResult = totalRevenue + taxiMargin + palmeirasNet - instructorCosts - totalExpenses

  const kpis = [
    { label: 'Total revenue',      value: totalRevenue,    color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
    { label: 'Amount collected',   value: totalPaid,       color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200' },
    { label: 'Outstanding',        value: totalDue,        color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200' },
    { label: 'Instructor costs',   value: -instructorCosts,color: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200' },
    { label: 'Taxi margin',        value: taxiMargin,      color: 'text-purple-700',  bg: 'bg-purple-50',   border: 'border-purple-200' },
    { label: 'Expenses',           value: -totalExpenses,  color: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200' },
    { label: 'Palmeiras net',      value: palmeirasNet,    color: palmeirasNet >= 0 ? 'text-emerald-700' : 'text-red-700', bg: palmeirasNet >= 0 ? 'bg-emerald-50' : 'bg-red-50', border: palmeirasNet >= 0 ? 'border-emerald-200' : 'border-red-200' },
    { label: 'Net result',         value: netResult,       color: netResult >= 0 ? 'text-emerald-700' : 'text-red-700',   bg: netResult >= 0 ? 'bg-emerald-50' : 'bg-red-50',   border: netResult >= 0 ? 'border-emerald-200' : 'border-red-200' },
  ]

  const fmt = (n: number) => `${n >= 0 ? '+' : ''}${Math.round(n).toLocaleString('fr-FR')} €`

  return (
    <div className="space-y-8">
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className={`rounded-xl border ${kpi.border} ${kpi.bg} p-5`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.color}`}>{fmt(kpi.value)}</p>
          </div>
        ))}
      </div>

      {/* Revenue breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Revenue by category</h2>
        <RevenueBreakdown data={data} />
      </div>

      {/* Booking status summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Bookings at a glance</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          {(['confirmed', 'provisional', 'cancelled'] as const).map(status => {
            const count = bookings.filter(b => b.status === status).length
            const colors = {
              confirmed:   'bg-emerald-100 text-emerald-800',
              provisional: 'bg-amber-100 text-amber-800',
              cancelled:   'bg-gray-100 text-gray-500',
            }
            return (
              <div key={status} className={`rounded-lg px-4 py-3 ${colors[status]}`}>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-sm font-medium capitalize">{status}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function RevenueBreakdown({ data }: Props) {
  const { bookings, bookingRoomPrices, bookingRooms,
          externalAccommodationBkgs,
          lessons, equipmentRentals, taxiTrips } = data

  const activeBookings = bookings.filter(b => b.status !== 'cancelled')

  const accommodation = activeBookings.reduce((sum, b) => {
    const bkRooms = bookingRooms.filter(br => br.booking_id === b.id)
    const nights = Math.round((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000)
    const roomRevenue = bkRooms.reduce((s, br) => {
      const price = bookingRoomPrices.find(p => p.booking_id === b.id && p.room_id === br.room_id)
      return s + (price?.price_per_night ?? 0) * nights
    }, 0)
    const extRevenue = externalAccommodationBkgs
      .filter(e => e.booking_id === b.id)
      .reduce((s, e) => {
        const nights2 = Math.round((new Date(e.check_out).getTime() - new Date(e.check_in).getTime()) / 86400000)
        return s + e.sell_price_per_night * nights2
      }, 0)
    return sum + roomRevenue + extRevenue
  }, 0)

  const lessonsRev  = lessons.reduce((s, l) => s + (l.type === 'private' ? 50 : l.type === 'group' ? 35 : 25) * l.duration_hours, 0)
  const rentalsRev  = equipmentRentals.reduce((s, r) => s + r.price, 0)
  const taxisRev    = taxiTrips.reduce((s, t) => s + t.price_paid_by_client, 0)

  const categories = [
    { label: 'Accommodation', value: accommodation, color: 'bg-blue-500' },
    { label: 'Lessons',       value: lessonsRev,    color: 'bg-emerald-500' },
    { label: 'Rentals',       value: rentalsRev,    color: 'bg-purple-500' },
    { label: 'Taxis',         value: taxisRev,      color: 'bg-amber-500' },
  ]
  const total = categories.reduce((s, c) => s + c.value, 0) || 1

  return (
    <div className="space-y-3">
      {categories.map(c => (
        <div key={c.label} className="flex items-center gap-3">
          <p className="w-32 text-sm text-gray-600 flex-shrink-0">{c.label}</p>
          <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
            <div className={`h-full ${c.color} rounded-full`} style={{ width: `${(c.value / total) * 100}%` }} />
          </div>
          <p className="w-24 text-right text-sm font-semibold text-gray-700">{Math.round(c.value).toLocaleString('fr-FR')} €</p>
        </div>
      ))}
      <p className="text-right text-sm text-gray-400 pt-1">Total {Math.round(total).toLocaleString('fr-FR')} €</p>
    </div>
  )
}
