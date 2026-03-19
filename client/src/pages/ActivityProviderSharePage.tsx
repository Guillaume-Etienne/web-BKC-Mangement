import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { ActivityProvider, ActivityBooking, ActivityPayment } from '../types/database'

interface Props { providerId: string }

type FilterOption = 'all' | string  // 'all' or a year like '2026'

const today = () => new Date().toISOString().slice(0, 10)

function getYears(dates: string[]): string[] {
  const set = new Set(dates.map(d => d.slice(0, 4)))
  return Array.from(set).sort((a, b) => b.localeCompare(a))
}

// ── Planning tab ───────────────────────────────────────────────────────────────

function PlanningTab({
  bookings,
  showPrices,
}: {
  bookings:   ActivityBooking[]
  showPrices: boolean
}) {
  const [filter, setFilter] = useState<FilterOption>('all')
  const years = useMemo(() => getYears(bookings.map(b => b.date)), [bookings])
  const now   = today()

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.date.startsWith(filter))
  const upcoming = filtered.filter(b => b.date >= now).sort((a, b) => a.date.localeCompare(b.date))
  const past     = filtered.filter(b => b.date <  now).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === 'all' ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-emerald-400'}`}>
          All time
        </button>
        {years.map(y => (
          <button key={y}
            onClick={() => setFilter(y)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === y ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-emerald-400'}`}>
            {y}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-gray-400 italic text-center py-8">No bookings for this period.</p>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b bg-blue-50">
            <h2 className="text-sm font-bold text-blue-800">Upcoming ({upcoming.length})</h2>
          </div>
          <BookingTable bookings={upcoming} showPrices={showPrices} />
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50">
            <h2 className="text-sm font-bold text-gray-700">Past ({past.length})</h2>
          </div>
          <BookingTable bookings={past} showPrices={showPrices} />
        </div>
      )}
    </div>
  )
}

function BookingTable({ bookings, showPrices }: { bookings: ActivityBooking[]; showPrices: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b text-gray-500 text-xs text-left">
            <th className="px-4 py-2 font-medium">Date</th>
            <th className="px-4 py-2 font-medium">Activity</th>
            <th className="px-4 py-2 font-medium text-center">Pax</th>
            {showPrices && <th className="px-4 py-2 font-medium text-right">Amount (€)</th>}
            <th className="px-4 py-2 font-medium">Notes</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map(b => (
            <tr key={b.id} className="border-b hover:bg-gray-50">
              <td className="px-4 py-2 text-gray-700 whitespace-nowrap font-medium">{b.date}</td>
              <td className="px-4 py-2 text-gray-800 font-medium">{b.label}</td>
              <td className="px-4 py-2 text-center text-gray-600">{b.nb_persons}</td>
              {showPrices && (
                <td className="px-4 py-2 text-right font-semibold text-emerald-800 whitespace-nowrap">
                  {b.price_provider > 0 ? `${b.price_provider.toFixed(2)} €` : '–'}
                </td>
              )}
              <td className="px-4 py-2 text-gray-400 italic text-xs">{b.notes ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Accounting tab ─────────────────────────────────────────────────────────────

function AccountingTab({
  bookings,
  payments,
}: {
  bookings: ActivityBooking[]
  payments: ActivityPayment[]
}) {
  const [filter, setFilter] = useState<FilterOption>('all')
  const allDates = [...bookings.map(b => b.date), ...payments.map(p => p.date)]
  const years    = useMemo(() => getYears(allDates), [bookings, payments])

  const filteredBookings = filter === 'all' ? bookings : bookings.filter(b => b.date.startsWith(filter))
  const filteredPayments = filter === 'all' ? payments : payments.filter(p => p.date.startsWith(filter))

  // Financial summary
  const wePayBookings   = filteredBookings.filter(b => b.payment_flow === 'we_pay_provider')
  const theyPayBookings = filteredBookings.filter(b => b.payment_flow === 'provider_pays_us')
  const wePaid          = filteredPayments.filter(p => p.direction === 'to_provider').reduce((s, p) => s + p.amount, 0)
  const theyPaid        = filteredPayments.filter(p => p.direction === 'from_provider').reduce((s, p) => s + p.amount, 0)
  const weOwe           = wePayBookings.reduce((s, b) => s + b.price_provider, 0) - wePaid
  const theyOwe         = theyPayBookings.reduce((s, b) => s + b.price_provider, 0) - theyPaid

  const sortedPayments = [...filteredPayments].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === 'all' ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-emerald-400'}`}>
          All time
        </button>
        {years.map(y => (
          <button key={y}
            onClick={() => setFilter(y)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === y ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-emerald-400'}`}>
            {y}
          </button>
        ))}
      </div>

      {/* Balance summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(wePayBookings.length > 0 || wePaid > 0) && (
          <div className={`rounded-xl border px-5 py-4 ${weOwe > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Center owes you</p>
            <p className={`text-3xl font-bold mt-1 ${weOwe > 0 ? 'text-orange-800' : 'text-green-700'}`}>
              {weOwe > 0 ? `${weOwe.toFixed(2)} €` : '✓ Settled'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {wePayBookings.reduce((s, b) => s + b.price_provider, 0).toFixed(2)} € billed
              &nbsp;−&nbsp;{wePaid.toFixed(2)} € paid
            </p>
          </div>
        )}
        {(theyPayBookings.length > 0 || theyPaid > 0) && (
          <div className={`rounded-xl border px-5 py-4 ${theyOwe > 0 ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">You owe us</p>
            <p className={`text-3xl font-bold mt-1 ${theyOwe > 0 ? 'text-blue-800' : 'text-green-700'}`}>
              {theyOwe > 0 ? `${theyOwe.toFixed(2)} €` : '✓ Settled'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {theyPayBookings.reduce((s, b) => s + b.price_provider, 0).toFixed(2)} € owed
              &nbsp;−&nbsp;{theyPaid.toFixed(2)} € received
            </p>
          </div>
        )}
      </div>

      {/* Booking lines */}
      {filteredBookings.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50">
            <h3 className="text-sm font-bold text-gray-700">Activity bookings ({filteredBookings.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-500 text-xs text-left">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Activity</th>
                  <th className="px-4 py-2 font-medium text-center">Pax</th>
                  <th className="px-4 py-2 font-medium">Flow</th>
                  <th className="px-4 py-2 font-medium text-right">Amount (€)</th>
                  <th className="px-4 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {[...filteredBookings].sort((a, b) => b.date.localeCompare(a.date)).map(b => (
                  <tr key={b.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700 whitespace-nowrap">{b.date}</td>
                    <td className="px-4 py-2 text-gray-800 font-medium">{b.label}</td>
                    <td className="px-4 py-2 text-center text-gray-600">{b.nb_persons}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        b.payment_flow === 'we_pay_provider'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {b.payment_flow === 'we_pay_provider' ? 'Center pays you' : 'You pay center'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-800">
                      {b.price_provider > 0 ? `${b.price_provider.toFixed(2)} €` : '–'}
                    </td>
                    <td className="px-4 py-2 text-gray-400 italic text-xs">{b.notes ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment history */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50">
          <h3 className="text-sm font-bold text-gray-700">Payment history ({sortedPayments.length})</h3>
        </div>
        {sortedPayments.length === 0 ? (
          <p className="text-sm text-gray-400 italic py-6 text-center">No payments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-500 text-xs text-left">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Direction</th>
                  <th className="px-4 py-2 font-medium text-right">Amount (€)</th>
                  <th className="px-4 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {sortedPayments.map(p => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700 whitespace-nowrap font-medium">{p.date}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        p.direction === 'to_provider'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {p.direction === 'to_provider' ? 'Center paid you' : 'You paid center'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-800">
                      {p.amount.toFixed(2)} €
                    </td>
                    <td className="px-4 py-2 text-gray-400 italic text-xs">{p.notes ?? ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 border-t-2 border-gray-300">
                  <td colSpan={2} className="px-4 py-2 text-right text-xs font-bold text-gray-600">
                    Paid to you
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-green-800">
                    {wePaid.toFixed(2)} €
                  </td>
                  <td />
                </tr>
                {theyPaid > 0 && (
                  <tr className="bg-gray-100">
                    <td colSpan={2} className="px-4 py-2 text-right text-xs font-bold text-gray-600">
                      Received from you
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-blue-800">
                      {theyPaid.toFixed(2)} €
                    </td>
                    <td />
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ActivityProviderSharePage({ providerId }: Props) {
  const [provider, setProvider] = useState<ActivityProvider | null>(null)
  const [bookings, setBookings] = useState<ActivityBooking[]>([])
  const [payments, setPayments] = useState<ActivityPayment[]>([])
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState<'planning' | 'accounting'>('planning')

  useEffect(() => {
    async function load() {
      const [provRes, bkgRes, payRes] = await Promise.all([
        supabase.from('activity_providers').select('*').eq('id', providerId).single(),
        supabase.from('activity_bookings').select('*').eq('provider_id', providerId).order('date', { ascending: false }),
        supabase.from('activity_payments').select('*').eq('provider_id', providerId).order('date', { ascending: false }),
      ])
      setProvider(provRes.data ?? null)
      setBookings((bkgRes.data ?? []) as ActivityBooking[])
      setPayments((payRes.data ?? []) as ActivityPayment[])
      setLoading(false)
    }
    load()
  }, [providerId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading…</p>
      </div>
    )
  }

  if (!provider) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Provider not found.</p>
      </div>
    )
  }

  const TYPE_LABEL = provider.type === 'safari' ? 'Safari' : 'Activity'

  const tabs: { key: 'planning' | 'accounting'; label: string }[] = [
    { key: 'planning',   label: 'Planning' },
    ...(provider.show_prices ? [{ key: 'accounting' as const, label: 'Accounting' }] : []),
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-xl text-white px-6 py-5">
          <p className="text-emerald-200 text-sm font-medium uppercase tracking-wide mb-1">{TYPE_LABEL} Provider</p>
          <h1 className="text-2xl font-bold">{provider.name}</h1>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-emerald-200">
            {provider.phone   && <span>{provider.phone}</span>}
            {provider.email   && <span>{provider.email}</span>}
            {provider.website && <span>{provider.website}</span>}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Total bookings</p>
            <p className="text-3xl font-bold text-gray-800 mt-1">{bookings.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Total participants</p>
            <p className="text-3xl font-bold text-gray-800 mt-1">
              {bookings.reduce((s, b) => s + b.nb_persons, 0)}
            </p>
          </div>
        </div>

        {/* Tabs */}
        {tabs.length > 1 && (
          <div className="flex border-b border-gray-200">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-5 py-2.5 font-medium text-sm transition-colors ${
                  tab === t.key
                    ? 'border-b-2 border-emerald-600 text-emerald-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Tab content */}
        {tab === 'planning' && (
          <PlanningTab bookings={bookings} showPrices={provider.show_prices} />
        )}
        {tab === 'accounting' && provider.show_prices && (
          <AccountingTab bookings={bookings} payments={payments} />
        )}

        <p className="text-center text-xs text-gray-300">
          Kitesurf Center Management · Updated {new Date().toLocaleDateString('en-GB')}
        </p>

      </div>
    </div>
  )
}
