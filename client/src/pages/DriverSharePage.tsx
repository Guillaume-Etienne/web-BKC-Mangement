import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { TaxiDriver, TaxiTrip } from '../types/database'
import {
  tr, TAXI_LANGS, tripTypeLabel,
  fmt, mzn, formatTripDate,
  type TaxiLang, type DateMode, type ViewMode,
} from '../data/taxiShareI18n'
import { usePref, Segmented } from './taxiShareUI'

interface Props { driverId: string }

type TripWithClient = TaxiTrip & {
  booking?: { client?: { first_name: string; last_name: string } | null } | null
}

function clientName(t: TripWithClient): string {
  const c = t.booking?.client
  return c ? `${c.first_name} ${c.last_name}` : '–'
}

// ── Trip list — cards (mobile-first) or table ─────────────────────────────────
function TripList({ trips, lang, dateMode, view }: {
  trips: TripWithClient[]; lang: TaxiLang; dateMode: DateMode; view: ViewMode
}) {
  if (trips.length === 0) {
    return <p className="text-sm text-gray-400 italic py-4 text-center">{tr.no_trips[lang]}</p>
  }
  const total = trips.reduce((s, t) => s + t.price_driver_mzn, 0)

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
            <div className="text-sm text-gray-600">{clientName(t)}</div>
            <div className="mt-1 text-xs text-gray-500">
              {t.nb_persons} {tr.unit_pax[lang]} · {t.nb_luggage} {tr.unit_bags[lang]} · {t.nb_boardbags} {tr.unit_boards[lang]}
            </div>
            {t.notes && <div className="mt-1 text-xs text-gray-400 italic">💬 {t.notes}</div>}
            <div className="mt-1.5 text-right font-bold text-amber-800">{mzn(t.price_driver_mzn)}</div>
          </div>
        ))}
        <div className="px-4 py-3 bg-gray-100 flex justify-between font-bold">
          <span className="text-gray-700">{tr.total[lang]}</span>
          <span className="text-amber-900">{mzn(total)}</span>
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
            <th className="px-4 py-2 font-medium">{tr.col_route[lang]}</th>
            <th className="px-4 py-2 font-medium">{tr.col_client[lang]}</th>
            <th className="px-4 py-2 font-medium text-center">{tr.col_pax[lang]}</th>
            <th className="px-4 py-2 font-medium text-center">{tr.col_bags[lang]}</th>
            <th className="px-4 py-2 font-medium text-center">{tr.col_boards[lang]}</th>
            <th className="px-4 py-2 font-medium">{tr.col_notes[lang]}</th>
            <th className="px-4 py-2 font-medium text-right">{tr.col_amount[lang]}</th>
          </tr>
        </thead>
        <tbody>
          {trips.map(t => (
            <tr key={t.id} className="border-b hover:bg-gray-50">
              <td className="px-4 py-2 text-gray-700 whitespace-nowrap font-medium">{formatTripDate(t.date, lang, dateMode)}</td>
              <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{t.start_time}</td>
              <td className="px-4 py-2 text-gray-700 whitespace-nowrap">{tripTypeLabel(t.type, lang)}</td>
              <td className="px-4 py-2 text-gray-700 font-medium">{clientName(t)}</td>
              <td className="px-4 py-2 text-center text-gray-600">{t.nb_persons}</td>
              <td className="px-4 py-2 text-center text-gray-500">{t.nb_luggage}</td>
              <td className="px-4 py-2 text-center text-gray-500">{t.nb_boardbags}</td>
              <td className="px-4 py-2 text-gray-400 italic text-xs">{t.notes ?? ''}</td>
              <td className="px-4 py-2 text-right font-semibold text-amber-800 whitespace-nowrap">{mzn(t.price_driver_mzn)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold">
            <td colSpan={8} className="px-4 py-2 text-right text-gray-700 text-sm">{tr.total[lang]}</td>
            <td className="px-4 py-2 text-right text-amber-900">{mzn(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export default function DriverSharePage({ driverId }: Props) {
  const [driver,  setDriver]  = useState<TaxiDriver | null>(null)
  const [trips,   setTrips]   = useState<TripWithClient[]>([])
  const [loading, setLoading] = useState(true)

  const [lang,     setLang]     = usePref<TaxiLang>('taxi_share_lang', 'pt')
  const [view,     setView]     = usePref<ViewMode>('taxi_share_view', 'cards')
  const [dateMode, setDateMode] = usePref<DateMode>('taxi_share_datemode', 'readable')

  useEffect(() => {
    async function load() {
      const [driverRes, tripsRes] = await Promise.all([
        supabase.from('taxi_drivers').select('*').eq('id', driverId).single(),
        supabase
          .from('taxi_trips')
          .select('*, booking:bookings(client:clients(first_name, last_name))')
          .eq('taxi_driver_id', driverId)
          .order('date', { ascending: false }),
      ])
      setDriver(driverRes.data ?? null)
      setTrips((tripsRes.data ?? []) as TripWithClient[])
      setLoading(false)
    }
    load()
  }, [driverId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">{tr.loading[lang]}</p>
      </div>
    )
  }

  if (!driver) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">{tr.not_found[lang]}</p>
      </div>
    )
  }

  const today    = new Date().toISOString().slice(0, 10)
  const past     = trips.filter(t => t.date <  today).sort((a, b) => b.date.localeCompare(a.date))
  const upcoming = trips.filter(t => t.date >= today).sort((a, b) => a.date.localeCompare(b.date))

  const earnedMzn   = past.reduce((s, t) => s + t.price_driver_mzn, 0)
  const upcomingMzn = upcoming.reduce((s, t) => s + t.price_driver_mzn, 0)
  const totalMzn    = earnedMzn + upcomingMzn

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Header + options */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl text-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-blue-200 text-sm font-medium uppercase tracking-wide mb-1">{tr.driver_statement[lang]}</p>
              <h1 className="text-2xl font-bold">{driver.name}</h1>
              {driver.vehicle && <p className="text-blue-200 text-sm mt-1">{driver.vehicle}</p>}
              {driver.phone   && <p className="text-blue-200 text-sm">{driver.phone}</p>}
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

        {/* Money block — "O meu dinheiro" */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b bg-amber-50">
            <h2 className="text-sm font-bold text-amber-800">{tr.my_money[lang]}</h2>
          </div>
          <div className="px-5 py-4 space-y-2 text-gray-700">
            <p>✅ {fmt(tr.earned_line[lang], { amount: mzn(earnedMzn), count: fmt(tr.trips_done[lang], { count: past.length }) })}</p>
            <p>📅 {fmt(tr.upcoming_line[lang], { amount: mzn(upcomingMzn), count: fmt(tr.trips_upcoming[lang], { count: upcoming.length }) })}</p>
            <p className="pt-2 border-t font-bold text-gray-900">
              💰 {fmt(tr.total_line[lang], { amount: mzn(totalMzn), count: fmt(tr.trips_all[lang], { count: trips.length }) })}
            </p>
          </div>
        </div>

        {/* Upcoming trips */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b bg-blue-50">
            <h2 className="text-sm font-bold text-blue-800">{tr.upcoming_trips[lang]} ({upcoming.length})</h2>
          </div>
          <TripList trips={upcoming} lang={lang} dateMode={dateMode} view={view} />
        </div>

        {/* Past trips */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50">
            <h2 className="text-sm font-bold text-gray-700">{tr.completed_trips[lang]} ({past.length})</h2>
          </div>
          <TripList trips={past} lang={lang} dateMode={dateMode} view={view} />
        </div>

        <p className="text-center text-xs text-gray-300">
          Bilene Kite Center · {tr.footer_updated[lang]} {new Date().toLocaleDateString(lang === 'pt' ? 'pt-PT' : 'en-GB')}
        </p>

      </div>
    </div>
  )
}
