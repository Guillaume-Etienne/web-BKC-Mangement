import type { SharedAccountingData } from './types'
import {
  computeBookingTotal, computeBookingPaid, computeBookingDiscounts,
  computeAccommodationRevenue, computeLessonsRevenue,
  computeRentalsRevenue,
  computeDiningRevenue, computeCenterAccessRevenue,
  computeInstructorBalance, fmtEur, countNights,
} from './utils'

interface Props { data: SharedAccountingData; onOpenBooking?: (id: string) => void }

// ── Helpers ────────────────────────────────────────────────────────────────

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────

export default function AccountingDashboard({ data, onOpenBooking }: Props) {
  const {
    bookings, payments,
    diningEvents, houseRentals,
    lessons, instructors, lessonRateOverrides,
    taxiTrips, activityBookings, expenses,
    palmeirasRents, palmeirasReversals, palmeirasEntries,
  } = data

  const activeBookings = bookings.filter(b => b.status !== 'cancelled')
  const activeIds = new Set(activeBookings.map(b => b.id))

  // ── Revenue (gross — what the center bills/earns) ──────────────────────
  // Taxi trips & activity bookings attached to a cancelled booking are excluded
  // from both the revenue AND the cost side (standalone ones are kept).
  const accomRev        = activeBookings.reduce((s, b) => s + computeAccommodationRevenue(b, data), 0)
  const lessonsRev      = activeBookings.reduce((s, b) => s + computeLessonsRevenue(b, data), 0)
  const rentalsRev      = activeBookings.reduce((s, b) => s + computeRentalsRevenue(b, data), 0)
  const activeTrips     = taxiTrips.filter(t => t.booking_id === null || activeIds.has(t.booking_id))
  const standaloneTrips = activeTrips.filter(t => t.booking_id === null)
  const taxisRev        = activeTrips.reduce((s, t) => s + t.price_eur, 0)
  const activeActs      = activityBookings.filter(a => a.booking_id === null || activeIds.has(a.booking_id))
  // we_pay_provider → client pays us price_client ; provider_pays_us → provider reverses price_provider
  const activitiesRev   = activeActs.reduce((s, a) => s + (a.payment_flow === 'we_pay_provider' ? a.price_client : a.price_provider), 0)
  const eventsRev       = computeDiningRevenue(diningEvents)
  const centerAccessRev = activeBookings.reduce((s, b) => s + computeCenterAccessRevenue(b), 0)
  const totalRevenue    = accomRev + lessonsRev + rentalsRev + taxisRev + eventsRev + activitiesRev + centerAccessRev

  // ── Collections (billed on active bookings vs collected) ───────────────
  const bookingFinances = activeBookings.map(b => {
    const total     = computeBookingTotal(b, data)
    const discounts = computeBookingDiscounts(b.id, payments)
    const paid      = computeBookingPaid(b.id, payments)
    return { ...b, total, discounts, paid, due: total - discounts - paid }
  })
  const billedNet = bookingFinances.reduce((s, b) => s + b.total - b.discounts, 0)
  const totalPaid = bookingFinances.reduce((s, b) => s + b.paid, 0)
  const totalDue  = billedNet - totalPaid

  // ── Instructor costs ───────────────────────────────────────────────────
  const instructorCosts = lessons.reduce((sum, l) => {
    const instr = instructors.find(i => i.id === l.instructor_id)
    if (!instr) return sum
    const override = lessonRateOverrides.find(o => o.lesson_id === l.id)
    const rate = override ? override.rate
      : l.type === 'private' ? instr.rate_private
      : l.type === 'group'   ? instr.rate_group
      : instr.rate_supervision
    return sum + rate * l.duration_hours
  }, 0)

  // ── Taxi costs (driver + manager MZN → EUR at the global rate) ─────────
  // Not entered anywhere else (no Expense rows), so they are subtracted here.
  const taxiCosts  = Math.round(activeTrips.reduce((s, t) => s + t.price_driver_mzn + t.margin_manager_mzn, 0) / (data.eurMznRate || 1))
  const taxiMargin = taxisRev - taxiCosts

  // ── Activity provider costs (we_pay_provider flow only) ────────────────
  const activityCosts = activeActs.reduce((s, a) => s + (a.payment_flow === 'we_pay_provider' ? a.price_provider : 0), 0)

  // ── Expenses ───────────────────────────────────────────────────────────
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)

  // ── Palmeiras (cash flows: reversals + free entries − rent) ────────────
  // Bungalow sell price is already inside accommodation revenue; only the cost
  // paid to the owners is subtracted below. The bungalow margin detail lives
  // in the Palmeiras tab.
  const palmRent      = palmeirasRents.reduce((s, r) => s + r.amount, 0)
  const palmReversals = palmeirasReversals.reduce((s, r) => s + r.net_amount, 0)
  const palmFreeInc   = palmeirasEntries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0)
  const palmFreeExp   = palmeirasEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0)
  const palmeirasNet  = palmReversals + palmFreeInc - palmRent - palmFreeExp

  // ── Bungalow owner costs (cost_per_night × nights, non-cancelled) ──────
  const bungalows = data.accommodations.filter(a => a.type === 'bungalow')
  const bungalowRoomIds = new Set(
    data.rooms.filter(r => bungalows.some(b => b.id === r.accommodation_id)).map(r => r.id)
  )
  const bungalowCosts = data.bookingRooms.reduce((sum, br) => {
    if (!bungalowRoomIds.has(br.room_id)) return sum
    const bk = data.bookings.find(b => b.id === br.booking_id)
    if (!bk || bk.status === 'cancelled') return sum
    const room = data.rooms.find(r => r.id === br.room_id)
    const acc = bungalows.find(b => b.id === room?.accommodation_id)
    return sum + (acc?.cost_per_night ?? 0) * countNights(bk.check_in, bk.check_out)
  }, 0)

  // ── House rental costs ──────────────────────────────────────────────────
  const houseRentalCosts = houseRentals.reduce((s, r) => s + r.total_cost, 0)

  // ── Net result ─────────────────────────────────────────────────────────
  const netResult = totalRevenue + palmeirasNet
    - instructorCosts - houseRentalCosts - bungalowCosts
    - taxiCosts - activityCosts - totalExpenses

  // ── Instructor balances ────────────────────────────────────────────────
  const instrBalances = instructors.map(i => ({
    ...i,
    balance: computeInstructorBalance(i.id, data),
  })).filter(i => Math.abs(i.balance) > 0.5)
    .sort((a, b) => b.balance - a.balance)

  // ── Unpaid bookings ────────────────────────────────────────────────────
  const unpaidBookings = bookingFinances
    .filter(b => b.due > 0.5)
    .sort((a, b) => b.due - a.due)
  const topUnpaid = unpaidBookings.slice(0, 6)

  // ── Booking counts ─────────────────────────────────────────────────────
  const confirmed   = bookings.filter(b => b.status === 'confirmed').length
  const provisional = bookings.filter(b => b.status === 'provisional').length
  const cancelled   = bookings.filter(b => b.status === 'cancelled').length

  const fmt = (n: number) => fmtEur(n)
  const sign = (n: number) => `${n >= 0 ? '+' : ''}${fmt(n)}`

  return (
    <div className="space-y-8">

      {/* ── Row 1: main KPIs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-1">Total revenue</p>
          <p className="text-3xl font-bold text-emerald-800">{fmt(totalRevenue)}</p>
          <p className="text-xs text-emerald-600 mt-1">{activeBookings.length} active booking{activeBookings.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-1">Collected</p>
          <p className="text-3xl font-bold text-blue-800">{fmt(totalPaid)}</p>
          <div className="mt-2 bg-blue-100 rounded-full h-2 overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${billedNet > 0 ? Math.min(100, (totalPaid / billedNet) * 100) : 0}%` }} />
          </div>
          <p className="text-xs text-blue-500 mt-1">{billedNet > 0 ? Math.round((totalPaid / billedNet) * 100) : 0}% of {fmt(billedNet)} billed</p>
        </div>
        <div className={`border rounded-xl p-5 ${totalDue > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${totalDue > 0 ? 'text-amber-600' : 'text-gray-500'}`}>Outstanding</p>
          <p className={`text-3xl font-bold ${totalDue > 0 ? 'text-amber-800' : 'text-gray-500'}`}>{fmt(totalDue)}</p>
          <p className={`text-xs mt-1 ${totalDue > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{unpaidBookings.length} booking{unpaidBookings.length !== 1 ? 's' : ''} with balance due</p>
        </div>
      </div>

      {/* ── Row 2: cost / margin KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-500 mb-1">Instructor costs</p>
          <p className="text-2xl font-bold text-red-800">−{fmt(instructorCosts)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-500 mb-1">House rentals</p>
          <p className="text-2xl font-bold text-red-800">−{fmt(houseRentalCosts)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-500 mb-1">Bungalow owners</p>
          <p className="text-2xl font-bold text-red-800">−{fmt(bungalowCosts)}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-500 mb-1">Taxi costs</p>
          <p className="text-2xl font-bold text-purple-800">−{fmt(taxiCosts)}</p>
          <p className="text-xs text-purple-500 mt-1">margin {sign(taxiMargin)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-500 mb-1">Activity providers</p>
          <p className="text-2xl font-bold text-red-800">−{fmt(activityCosts)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-500 mb-1">Expenses</p>
          <p className="text-2xl font-bold text-red-800">−{fmt(totalExpenses)}</p>
        </div>
        <div className={`border rounded-xl p-4 ${palmeirasNet >= 0 ? 'bg-teal-50 border-teal-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${palmeirasNet >= 0 ? 'text-teal-600' : 'text-red-500'}`}>Palmeiras net</p>
          <p className={`text-2xl font-bold ${palmeirasNet >= 0 ? 'text-teal-800' : 'text-red-800'}`}>{sign(palmeirasNet)}</p>
          <p className={`text-xs mt-1 ${palmeirasNet >= 0 ? 'text-teal-600' : 'text-red-400'}`}>reversals + entries − rent</p>
        </div>
      </div>

      {/* ── Net result banner ── */}
      <div className={`rounded-xl border-2 p-5 flex items-center justify-between ${netResult >= 0 ? 'bg-emerald-50 border-emerald-400' : 'bg-red-50 border-red-400'}`}>
        <div>
          <p className={`text-sm font-semibold uppercase tracking-wide ${netResult >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>Net result (season)</p>
          <p className="text-xs text-gray-500 mt-0.5">Revenue + palmeiras − instructors − houses − bungalows − taxi costs − activity providers − expenses</p>
        </div>
        <p className={`text-4xl font-bold ${netResult >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{sign(netResult)}</p>
      </div>

      {/* ── Two columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Revenue breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-bold text-gray-800 mb-4">Revenue breakdown</h2>
          <div className="space-y-3">
            {[
              { label: 'Accommodation', value: accomRev,      color: 'bg-blue-500' },
              { label: 'Lessons',       value: lessonsRev,   color: 'bg-emerald-500' },
              { label: 'Equipment',     value: rentalsRev,   color: 'bg-purple-500' },
              { label: 'Taxis',         value: taxisRev,     color: 'bg-amber-500' },
              { label: 'Activities',    value: activitiesRev,color: 'bg-teal-500' },
              { label: 'Events',        value: eventsRev,    color: 'bg-rose-400' },
              { label: 'Center access', value: centerAccessRev, color: 'bg-cyan-500' },
            ].map(c => (
              <div key={c.label} className="flex items-center gap-3">
                <div className="w-28 shrink-0">
                  <p className="text-sm text-gray-600">{c.label}</p>
                  {c.label === 'Taxis' && standaloneTrips.length > 0 && (
                    <p className="text-xs text-amber-500">incl. {standaloneTrips.length} unlinked</p>
                  )}
                </div>
                <Bar value={c.value} max={totalRevenue} color={c.color} />
                <p className="w-24 text-right text-sm font-semibold text-gray-700">{fmt(c.value)}</p>
              </div>
            ))}
            <div className="pt-2 border-t flex justify-between text-sm font-bold text-gray-800">
              <span>Total</span>
              <span>{fmt(totalRevenue)}</span>
            </div>
          </div>
        </div>

        {/* Bookings status */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-bold text-gray-800 mb-4">Bookings</h2>
          <div className="grid grid-cols-3 gap-3 text-center mb-6">
            <div className="bg-emerald-100 text-emerald-800 rounded-lg py-3">
              <p className="text-2xl font-bold">{confirmed}</p>
              <p className="text-xs font-medium mt-0.5">Confirmed</p>
            </div>
            <div className="bg-amber-100 text-amber-800 rounded-lg py-3">
              <p className="text-2xl font-bold">{provisional}</p>
              <p className="text-xs font-medium mt-0.5">Provisional</p>
            </div>
            <div className="bg-gray-100 text-gray-500 rounded-lg py-3">
              <p className="text-2xl font-bold">{cancelled}</p>
              <p className="text-xs font-medium mt-0.5">Cancelled</p>
            </div>
          </div>

          {/* Collection progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Collection progress</span>
              <span>{fmt(totalPaid)} / {fmt(billedNet)} billed</span>
            </div>
            <div className="bg-gray-100 rounded-full h-4 overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${billedNet > 0 ? Math.min(100, (totalPaid / billedNet) * 100) : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Instructor balances ── */}
      {instrBalances.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-bold text-gray-800 mb-1">Instructor balances</h2>
          <p className="text-xs text-gray-400 mb-4">Earned − debts − already paid</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {instrBalances.map(i => (
              <div key={i.id} className={`rounded-lg border px-4 py-3 flex items-center justify-between ${
                i.balance > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'
              }`}>
                <div>
                  <p className="font-semibold text-sm text-gray-800">{i.first_name} {i.last_name}</p>
                  <p className={`text-xs mt-0.5 ${i.balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    {i.balance > 0 ? 'To pay' : 'Credit'}
                  </p>
                </div>
                <p className={`text-lg font-bold ${i.balance > 0 ? 'text-orange-700' : 'text-green-700'}`}>
                  {fmt(Math.abs(i.balance))}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Unpaid bookings ── */}
      {topUnpaid.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-bold text-gray-800 mb-1">Outstanding payments</h2>
          <p className="text-xs text-gray-400 mb-4">Top {topUnpaid.length} of {unpaidBookings.length} booking{unpaidBookings.length !== 1 ? 's' : ''} with balance due</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-gray-500">
                  <th className="pb-2 font-medium">Guest</th>
                  <th className="pb-2 font-medium">Check-in</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium text-right">Total</th>
                  <th className="pb-2 font-medium text-right">Paid</th>
                  <th className="pb-2 font-medium text-right">Due</th>
                </tr>
              </thead>
              <tbody>
                {topUnpaid.map(b => {
                  const client = b.client
                  const statusColors = {
                    confirmed:   'bg-emerald-100 text-emerald-700',
                    provisional: 'bg-amber-100 text-amber-700',
                    cancelled:   'bg-gray-100 text-gray-500',
                  }
                  return (
                    <tr
                      key={b.id}
                      onClick={onOpenBooking ? () => onOpenBooking(b.id) : undefined}
                      className={`border-b last:border-0 hover:bg-gray-50 ${onOpenBooking ? 'cursor-pointer' : ''}`}
                    >
                      <td className="py-2 font-medium text-gray-800">
                        {onOpenBooking && <span className="text-gray-300 mr-1">↗</span>}
                        {client ? `${client.first_name} ${client.last_name}` : b.id}
                      </td>
                      <td className="py-2 text-gray-500">{b.check_in}</td>
                      <td className="py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[b.status]}`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="py-2 text-right text-gray-700">{fmt(b.total)}</td>
                      <td className="py-2 text-right text-blue-700">{fmt(b.paid)}</td>
                      <td className="py-2 text-right font-bold text-amber-700">{fmt(b.due)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}
