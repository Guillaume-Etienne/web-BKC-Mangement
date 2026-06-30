import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { TaxiDriver, TaxiTrip, TaxiManagerPayment } from '../types/database'
import {
  tr, TAXI_LANGS, tripTypeLabel,
  fmt, mzn, formatTripDate,
  type TaxiLang, type DateMode, type ViewMode,
} from '../data/taxiShareI18n'
import { usePref, Segmented } from './taxiShareUI'

type TripWithClient = TaxiTrip & {
  booking?: { client?: { first_name: string; last_name: string } | null } | null
}

function clientName(t: TripWithClient): string {
  const c = t.booking?.client
  return c ? `${c.first_name} ${c.last_name}` : '–'
}

// ── Managed-trip list (driver column + manager commission) ────────────────────
function TripList({ trips, driverName, lang, dateMode, view }: {
  trips: TripWithClient[]; driverName: (id: string | null) => string
  lang: TaxiLang; dateMode: DateMode; view: ViewMode
}) {
  if (trips.length === 0) {
    return <p className="text-sm text-gray-400 italic py-4 text-center">{tr.no_trips[lang]}</p>
  }
  const total = trips.reduce((s, t) => s + t.margin_manager_mzn, 0)

  if (view === 'cards') {
    return (
      <div className="divide-y divide-gray-100">
        {trips.map(t => (
          <div key={t.id} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-bold text-gray-900">{formatTripDate(t.date, lang, dateMode)}</span>
              <span className="text-gray-500 text-sm">{t.start_time}</span>
            </div>
            <div className="mt-0.5 text-sm font-medium text-gray-800">{tripTypeLabel(t.type, lang)}</div>
            <div className="text-sm text-gray-600">🚗 {driverName(t.taxi_driver_id)} · {clientName(t)}</div>
            {t.notes && <div className="mt-1 text-xs text-gray-400 italic">💬 {t.notes}</div>}
            <div className="mt-1.5 text-right font-bold text-purple-800">{mzn(t.margin_manager_mzn)}</div>
          </div>
        ))}
        <div className="px-4 py-3 bg-gray-100 flex justify-between font-bold">
          <span className="text-gray-700">{tr.total[lang]}</span>
          <span className="text-purple-900">{mzn(total)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b text-gray-500 text-xs text-left">
            <th className="px-4 py-2 font-medium">{tr.col_date[lang]}</th>
            <th className="px-4 py-2 font-medium">{tr.col_time[lang]}</th>
            <th className="px-4 py-2 font-medium">{tr.col_driver[lang]}</th>
            <th className="px-4 py-2 font-medium">{tr.col_route[lang]}</th>
            <th className="px-4 py-2 font-medium">{tr.col_client[lang]}</th>
            <th className="px-4 py-2 font-medium">{tr.col_notes[lang]}</th>
            <th className="px-4 py-2 font-medium text-right">{tr.col_amount[lang]}</th>
          </tr>
        </thead>
        <tbody>
          {trips.map(t => (
            <tr key={t.id} className="border-b hover:bg-gray-50">
              <td className="px-4 py-2 text-gray-700 whitespace-nowrap font-medium">{formatTripDate(t.date, lang, dateMode)}</td>
              <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{t.start_time}</td>
              <td className="px-4 py-2 text-gray-700 whitespace-nowrap">{driverName(t.taxi_driver_id)}</td>
              <td className="px-4 py-2 text-gray-700 whitespace-nowrap">{tripTypeLabel(t.type, lang)}</td>
              <td className="px-4 py-2 text-gray-700">{clientName(t)}</td>
              <td className="px-4 py-2 text-gray-400 italic text-xs">{t.notes ?? ''}</td>
              <td className="px-4 py-2 text-right font-semibold text-purple-800 whitespace-nowrap">{mzn(t.margin_manager_mzn)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold">
            <td colSpan={6} className="px-4 py-2 text-right text-gray-700 text-sm">{tr.total[lang]}</td>
            <td className="px-4 py-2 text-right text-purple-900">{mzn(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export default function TaxiManagerSharePage() {
  const [drivers,  setDrivers]  = useState<TaxiDriver[]>([])
  const [trips,    setTrips]    = useState<TripWithClient[]>([])
  const [payments, setPayments] = useState<TaxiManagerPayment[]>([])
  const [loading,  setLoading]  = useState(true)

  const [lang,     setLang]     = usePref<TaxiLang>('taxi_share_lang', 'pt')
  const [view,     setView]     = usePref<ViewMode>('taxi_share_view', 'cards')
  const [dateMode, setDateMode] = usePref<DateMode>('taxi_share_datemode', 'readable')

  useEffect(() => {
    async function load() {
      const [driversRes, tripsRes, paymentsRes] = await Promise.all([
        supabase.from('taxi_drivers').select('*'),
        supabase
          .from('taxi_trips')
          .select('*, booking:bookings(client:clients(first_name, last_name))')
          .order('date', { ascending: false }),
        supabase.from('taxi_manager_payments').select('*').order('date', { ascending: false }),
      ])
      setDrivers((driversRes.data ?? []) as TaxiDriver[])
      setTrips((tripsRes.data ?? []) as TripWithClient[])
      setPayments((paymentsRes.data ?? []) as TaxiManagerPayment[])
      setLoading(false)
    }
    load()
  }, [])

  const driverName = (id: string | null) => drivers.find(d => d.id === id)?.name ?? '—'

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">{tr.loading[lang]}</p>
      </div>
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  // "Managed" trips only: margin_manager_mzn === 0 means a private taxi, invisible to the manager.
  const managed  = trips.filter(t => t.margin_manager_mzn > 0)
  const upcoming = managed.filter(t => t.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  const past     = managed.filter(t => t.date <  today).sort((a, b) => b.date.localeCompare(a.date))

  const earnedMzn = managed.reduce((s, t) => s + t.margin_manager_mzn, 0)
  const paidMzn   = payments.reduce((s, p) => s + p.amount_mzn, 0)
  const balance   = earnedMzn - paidMzn

  const balanceLabel = balance > 0 ? tr.fin_balance_due[lang] : balance < 0 ? tr.fin_overpaid[lang] : tr.fin_balanced[lang]
  const balanceColor = balance > 0 ? 'bg-orange-50 border-orange-200 text-orange-800'
                     : balance < 0 ? 'bg-green-50 border-green-200 text-green-800'
                     :               'bg-gray-50 border-gray-200 text-gray-700'

  // Per-driver summary (managed trips only)
  const perDriver = drivers
    .map(d => {
      const ts = managed.filter(t => t.taxi_driver_id === d.id)
      return { id: d.id, name: d.name, count: ts.length, commission: ts.reduce((s, t) => s + t.margin_manager_mzn, 0) }
    })
    .filter(r => r.count > 0)
    .sort((a, b) => b.commission - a.commission)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Header + options */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl text-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-blue-200 text-sm font-medium uppercase tracking-wide mb-1">{tr.manager_statement[lang]}</p>
              <h1 className="text-2xl font-bold">Bilene Kite Center · Taxi</h1>
            </div>
            <Segmented value={lang} onChange={setLang}
              options={TAXI_LANGS.map(l => ({ v: l.code, label: `${l.flag} ${l.code.toUpperCase()}` }))} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Segmented value={view} onChange={setView}
              options={[{ v: 'cards', label: `🗂️ ${tr.opt_view_cards[lang]}` }, { v: 'table', label: `📋 ${tr.opt_view_table[lang]}` }]} />
            <Segmented value={dateMode} onChange={setDateMode}
              options={[{ v: 'readable', label: '📅 Seg 30/06' }, { v: 'iso', label: '2026-06-30' }]} />
          </div>
        </div>

        {/* Finances */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b bg-amber-50">
            <h2 className="text-sm font-bold text-amber-800">{tr.fin_title[lang]}</h2>
          </div>
          <div className="p-5 space-y-2 text-sm">
            <div className="flex justify-between items-center py-1 border-b">
              <span className="text-gray-600">{tr.fin_earned[lang]} ({fmt(tr.trips_all[lang], { count: managed.length })})</span>
              <span className="font-bold text-purple-900">{mzn(earnedMzn)}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b">
              <span className="text-gray-600">{tr.fin_paid[lang]}</span>
              <span className="font-bold text-blue-900">{mzn(paidMzn)}</span>
            </div>
            <div className={`flex justify-between items-center p-3 rounded border font-bold ${balanceColor}`}>
              <span>{balanceLabel}</span>
              <span className="text-lg">{mzn(Math.abs(balance))}</span>
            </div>
            <p className="text-xs text-gray-400 pt-1">{tr.fin_explain[lang]}</p>
          </div>
        </div>

        {/* Per-driver summary */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50">
            <h2 className="text-sm font-bold text-gray-700">{tr.mgr_by_driver[lang]}</h2>
          </div>
          {perDriver.length === 0 ? (
            <p className="text-sm text-gray-400 italic py-4 text-center">{tr.no_trips[lang]}</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {perDriver.map(r => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-5 py-2 text-gray-800 font-medium">🚗 {r.name}</td>
                    <td className="px-5 py-2 text-gray-500 text-right">{fmt(tr.trips_all[lang], { count: r.count })}</td>
                    <td className="px-5 py-2 text-right font-semibold text-purple-800">{mzn(r.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Upcoming trips */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b bg-blue-50">
            <h2 className="text-sm font-bold text-blue-800">{tr.upcoming_trips[lang]} ({upcoming.length})</h2>
          </div>
          <TripList trips={upcoming} driverName={driverName} lang={lang} dateMode={dateMode} view={view} />
        </div>

        {/* Completed trips */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50">
            <h2 className="text-sm font-bold text-gray-700">{tr.completed_trips[lang]} ({past.length})</h2>
          </div>
          <TripList trips={past} driverName={driverName} lang={lang} dateMode={dateMode} view={view} />
        </div>

        {/* Payment history */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50">
            <h2 className="text-sm font-bold text-gray-700">{tr.history_title[lang]}</h2>
          </div>
          {payments.length === 0 ? (
            <p className="text-sm text-gray-400 italic py-4 text-center">{tr.no_payments[lang]}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-500 text-xs text-left">
                  <th className="px-4 py-2 font-medium">{tr.col_date[lang]}</th>
                  <th className="px-4 py-2 font-medium">{tr.col_reason[lang]}</th>
                  <th className="px-4 py-2 font-medium text-right">{tr.col_amount[lang]}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700 whitespace-nowrap font-medium">{formatTripDate(p.date, lang, dateMode)}</td>
                    <td className="px-4 py-2 text-gray-500">{p.notes ?? ''}</td>
                    <td className="px-4 py-2 text-right font-semibold text-blue-900 whitespace-nowrap">{mzn(p.amount_mzn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-center text-xs text-gray-300">
          Bilene Kite Center · {tr.footer_updated[lang]} {new Date().toLocaleDateString(lang === 'pt' ? 'pt-PT' : 'en-GB')}
        </p>

      </div>
    </div>
  )
}
