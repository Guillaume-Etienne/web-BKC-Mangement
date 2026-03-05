import type { SharedAccountingData } from './types'
import {
  computeBookingTotal, computeBookingPaid,
  computeAccommodationRevenue, computeLessonsRevenue,
  computeRentalsRevenue, computeTaxiRevenue,
  computeInstructorBalance, fmtEur,
} from './utils'

interface Props { data: SharedAccountingData }

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

export default function AccountingDashboard({ data }: Props) {
  const {
    bookings, payments,
    lessons, instructors, lessonRateOverrides,
    taxiTrips, expenses,
    palmeirasRents, palmeirasReversals, palmeirasSubLets, palmeirasEntries,
  } = data

  const activeBookings = bookings.filter(b => b.status !== 'cancelled')

  // ── Revenue ────────────────────────────────────────────────────────────
  const accomRev   = activeBookings.reduce((s, b) => s + computeAccommodationRevenue(b, data), 0)
  const lessonsRev = activeBookings.reduce((s, b) => s + computeLessonsRevenue(b, data), 0)
  const rentalsRev = activeBookings.reduce((s, b) => s + computeRentalsRevenue(b, data), 0)
  const taxisRev   = activeBookings.reduce((s, b) => s + computeTaxiRevenue(b, data), 0)
  const totalRevenue = accomRev + lessonsRev + rentalsRev + taxisRev

  // ── Collections ────────────────────────────────────────────────────────
  const totalPaid = bookings.reduce((s, b) => s + computeBookingPaid(b.id, payments), 0)
  const totalDue  = totalRevenue - totalPaid

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

  // ── Taxi net (centre margin only) ──────────────────────────────────────
  const taxiNetMargin = taxiTrips.reduce((s, t) => s + Math.round(t.margin_centre_mzn / t.exchange_rate), 0)

  // ── Expenses ───────────────────────────────────────────────────────────
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)

  // ── Palmeiras (rent + reversals + sub-lets + free entries) ────────────
  const palmRent      = palmeirasRents.reduce((s, r) => s + r.amount, 0)
  const palmReversals = palmeirasReversals.reduce((s, r) => s + r.net_amount, 0)
  const palmSubLets   = palmeirasSubLets.reduce((s, sl) => s + (sl.sell_per_night - sl.cost_per_night) * sl.nights, 0)
  const palmFreeInc   = palmeirasEntries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0)
  const palmFreeExp   = palmeirasEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0)
  const palmeirasNet  = palmReversals + palmSubLets + palmFreeInc - palmRent - palmFreeExp

  // ── Net result ─────────────────────────────────────────────────────────
  const netResult = totalRevenue + taxiNetMargin + palmeirasNet - instructorCosts - totalExpenses

  // ── Instructor balances ────────────────────────────────────────────────
  const instrBalances = instructors.map(i => ({
    ...i,
    balance: computeInstructorBalance(i.id, data),
  })).filter(i => Math.abs(i.balance) > 0.5)
    .sort((a, b) => b.balance - a.balance)

  // ── Unpaid bookings ────────────────────────────────────────────────────
  const unpaidBookings = activeBookings
    .map(b => {
      const total = computeBookingTotal(b, data)
      const paid  = computeBookingPaid(b.id, payments)
      return { ...b, total, paid, due: total - paid }
    })
    .filter(b => b.due > 0.5)
    .sort((a, b) => b.due - a.due)
    .slice(0, 6)

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
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${totalRevenue > 0 ? Math.min(100, (totalPaid / totalRevenue) * 100) : 0}%` }} />
          </div>
          <p className="text-xs text-blue-500 mt-1">{totalRevenue > 0 ? Math.round((totalPaid / totalRevenue) * 100) : 0}% of revenue</p>
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
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-500 mb-1">Taxi margin</p>
          <p className="text-2xl font-bold text-purple-800">+{fmt(taxiNetMargin)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-500 mb-1">Expenses</p>
          <p className="text-2xl font-bold text-red-800">−{fmt(totalExpenses)}</p>
        </div>
        <div className={`border rounded-xl p-4 ${palmeirasNet >= 0 ? 'bg-teal-50 border-teal-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${palmeirasNet >= 0 ? 'text-teal-600' : 'text-red-500'}`}>Palmeiras net</p>
          <p className={`text-2xl font-bold ${palmeirasNet >= 0 ? 'text-teal-800' : 'text-red-800'}`}>{sign(palmeirasNet)}</p>
        </div>
      </div>

      {/* ── Net result banner ── */}
      <div className={`rounded-xl border-2 p-5 flex items-center justify-between ${netResult >= 0 ? 'bg-emerald-50 border-emerald-400' : 'bg-red-50 border-red-400'}`}>
        <div>
          <p className={`text-sm font-semibold uppercase tracking-wide ${netResult >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>Net result (season)</p>
          <p className="text-xs text-gray-500 mt-0.5">Revenue + taxi + palmeiras − instructor costs − expenses</p>
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
              { label: 'Accommodation', value: accomRev,   color: 'bg-blue-500' },
              { label: 'Lessons',       value: lessonsRev, color: 'bg-emerald-500' },
              { label: 'Equipment',     value: rentalsRev, color: 'bg-purple-500' },
              { label: 'Taxis',         value: taxisRev,   color: 'bg-amber-500' },
            ].map(c => (
              <div key={c.label} className="flex items-center gap-3">
                <p className="w-28 text-sm text-gray-600 shrink-0">{c.label}</p>
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
              <span>{fmt(totalPaid)} / {fmt(totalRevenue)}</span>
            </div>
            <div className="bg-gray-100 rounded-full h-4 overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${totalRevenue > 0 ? Math.min(100, (totalPaid / totalRevenue) * 100) : 0}%` }}
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
      {unpaidBookings.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-bold text-gray-800 mb-1">Outstanding payments</h2>
          <p className="text-xs text-gray-400 mb-4">Top {unpaidBookings.length} bookings with balance due</p>
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
                {unpaidBookings.map(b => {
                  const client = b.client
                  const statusColors = {
                    confirmed:   'bg-emerald-100 text-emerald-700',
                    provisional: 'bg-amber-100 text-amber-700',
                    cancelled:   'bg-gray-100 text-gray-500',
                  }
                  return (
                    <tr key={b.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 font-medium text-gray-800">
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
