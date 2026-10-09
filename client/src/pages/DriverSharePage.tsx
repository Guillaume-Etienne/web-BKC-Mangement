import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { TaxiDriver, TaxiTrip } from '../types/database'
import {
  tr, TAXI_LANGS, tripTypeLabel,
  fmt, mzn, formatTripDate, formatMonth, bagsLabel,
  type TaxiLang, type DateMode, type ViewMode,
} from '../data/taxiShareI18n'
import { usePref, Segmented } from './taxiShareUI'
import { todayISO } from '../utils/dates'

interface Props { driverId: string }

type Tab = 'trips' | 'money'

// The shape anon is actually served (column-level GRANT — see security-rls.md).
// `price_driver_mzn` is what this page is about; the client price and the
// manager's commission are not granted to a driver token any more, so leaving
// them out of the type is what keeps a future edit from reaching for them.
type TripWithClient = Pick<TaxiTrip,
  'id' | 'date' | 'start_time' | 'type' | 'status' | 'taxi_driver_id' | 'booking_id' |
  'nb_persons' | 'nb_luggage' | 'nb_boardbags' | 'notes' | 'price_driver_mzn'> & {
  booking?: { client?: { first_name: string; last_name: string } | null } | null
}

function clientName(t: TripWithClient): string {
  const c = t.booking?.client
  return c ? `${c.first_name} ${c.last_name}` : '–'
}

/** "Clientes: Name" — null when the trip has no client, so no dangling label. */
function clientLine(t: TripWithClient, lang: TaxiLang): string | null {
  const c = t.booking?.client
  return c ? `${tr.clients_prefix[lang]}: ${c.first_name} ${c.last_name}` : null
}

// ── Trip list — cards (mobile-first) or table ─────────────────────────────────
function TripList({ trips, lang, dateMode, view }: {
  trips: TripWithClient[]; lang: TaxiLang; dateMode: DateMode; view: ViewMode
}) {
  if (trips.length === 0) {
    return <p className="text-sm md:text-base text-gray-400 dark:text-gray-400 italic py-4 text-center">{tr.no_trips[lang]}</p>
  }
  const total = trips.reduce((s, t) => s + t.price_driver_mzn, 0)

  if (view === 'cards') {
    return (
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {trips.map(t => (
          <div key={t.id} className="px-4 md:px-6 py-3 md:py-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-bold text-gray-900 dark:text-gray-100 md:text-xl">{formatTripDate(t.date, lang, dateMode)}</span>
              <span className="text-gray-500 dark:text-gray-400 text-sm md:text-lg">{t.start_time}</span>
            </div>
            <div className="mt-0.5 text-sm md:text-lg font-medium text-gray-800 dark:text-gray-200">{tripTypeLabel(t.type, lang)}</div>
            {clientLine(t, lang) && (
              <div className="text-sm md:text-base text-gray-600 dark:text-gray-400">👤 {clientLine(t, lang)}</div>
            )}
            <div className="mt-1 text-xs md:text-base text-gray-500 dark:text-gray-400">
              👥 {t.nb_persons} {tr.unit_pax[lang]} · 🧳 {bagsLabel(t.nb_luggage, t.nb_boardbags, lang)}
            </div>
            {t.notes && <div className="mt-1 text-xs md:text-sm text-gray-400 dark:text-gray-400 italic">💬 {t.notes}</div>}
            <div className="mt-1.5 text-right font-bold md:text-xl text-amber-800 dark:text-amber-400">{mzn(t.price_driver_mzn)}</div>
          </div>
        ))}
        <div className="px-4 md:px-6 py-3 md:py-4 bg-gray-100 dark:bg-gray-800 flex justify-between font-bold md:text-lg">
          <span className="text-gray-700 dark:text-gray-300">{tr.total[lang]}</span>
          <span className="text-amber-900 dark:text-amber-400">{mzn(total)}</span>
        </div>
      </div>
    )
  }

  // Table. On a phone nine columns means sideways scrolling, so below `md` the
  // row collapses to four: date+time, route (+ client, load, notes underneath),
  // and the amount. From `md` up every field has its own column.
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm md:text-base">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800 border-b text-gray-500 dark:text-gray-400 text-xs md:text-sm text-left">
            <th className="px-3 md:px-4 py-2 font-medium">{tr.col_date[lang]}</th>
            <th className="px-4 py-2 font-medium hidden md:table-cell">{tr.col_time[lang]}</th>
            <th className="px-3 md:px-4 py-2 font-medium">{tr.col_route[lang]}</th>
            <th className="px-4 py-2 font-medium hidden md:table-cell">{tr.col_client[lang]}</th>
            <th className="px-4 py-2 font-medium text-center hidden md:table-cell">{tr.col_pax[lang]}</th>
            <th className="px-4 py-2 font-medium hidden md:table-cell">{tr.bags_title[lang]}</th>
            <th className="px-4 py-2 font-medium hidden md:table-cell">{tr.col_notes[lang]}</th>
            <th className="px-3 md:px-4 py-2 font-medium text-right">
              <span className="md:hidden">MZN</span><span className="hidden md:inline">{tr.col_amount[lang]}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {trips.map(t => (
            <tr key={t.id} className="border-b align-top hover:bg-gray-50 dark:hover:bg-gray-800">
              <td className="px-3 md:px-4 py-2 md:py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap font-medium">
                {formatTripDate(t.date, lang, dateMode)}
                <div className="md:hidden text-xs font-normal text-gray-500 dark:text-gray-400">{t.start_time}</div>
              </td>
              <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap hidden md:table-cell">{t.start_time}</td>
              <td className="px-3 md:px-4 py-2 md:py-3 text-gray-700 dark:text-gray-300">
                <div className="md:whitespace-nowrap">{tripTypeLabel(t.type, lang)}</div>
                <div className="md:hidden mt-0.5 space-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {clientLine(t, lang) && <div>👤 {clientLine(t, lang)}</div>}
                  <div>👥 {t.nb_persons} · 🧳 {bagsLabel(t.nb_luggage, t.nb_boardbags, lang)}</div>
                  {t.notes && <div className="italic">💬 {t.notes}</div>}
                </div>
              </td>
              <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-medium hidden md:table-cell">{clientName(t)}</td>
              <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400 hidden md:table-cell">{t.nb_persons}</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden md:table-cell">
                {bagsLabel(t.nb_luggage, t.nb_boardbags, lang).replace(`${tr.bags_title[lang]}: `, '')}
              </td>
              <td className="px-4 py-3 text-gray-400 dark:text-gray-400 italic text-sm hidden md:table-cell">{t.notes ?? ''}</td>
              <td className="px-3 md:px-4 py-2 md:py-3 text-right font-semibold text-amber-800 dark:text-amber-400 whitespace-nowrap">
                <span className="md:hidden">{t.price_driver_mzn.toLocaleString('pt-PT')}</span>
                <span className="hidden md:inline">{mzn(t.price_driver_mzn)}</span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-700 font-bold">
            <td colSpan={2} className="px-3 py-2 text-right text-gray-700 dark:text-gray-300 text-sm md:hidden">{tr.total[lang]}</td>
            <td colSpan={6} className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 hidden md:table-cell">{tr.total[lang]}</td>
            <td className="px-3 md:px-4 py-2 md:py-3 text-right text-amber-900 dark:text-amber-400 whitespace-nowrap">{mzn(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── Money tab ─────────────────────────────────────────────────────────────────
function MoneyTab({ past, upcoming, lang, dateMode }: {
  past: TripWithClient[]; upcoming: TripWithClient[]; lang: TaxiLang; dateMode: DateMode
}) {
  const sum = (ts: TripWithClient[]) => ts.reduce((s, t) => s + t.price_driver_mzn, 0)
  const earned = sum(past)
  const toEarn = sum(upcoming)
  const total  = earned + toEarn
  const pct    = total > 0 ? Math.round((earned / total) * 100) : 0

  const lastDone = past[0]                    // `past` is sorted newest first
  const next     = upcoming[0]                // `upcoming` is sorted oldest first
  const firstEver = [...past, ...upcoming].map(t => t.date).sort()[0]

  // Month by month: what is already earned vs still to come.
  const months = new Map<string, { earned: number; upcoming: number; count: number }>()
  for (const t of past)     { const m = months.get(t.date.slice(0, 7)) ?? { earned: 0, upcoming: 0, count: 0 }; m.earned   += t.price_driver_mzn; m.count++; months.set(t.date.slice(0, 7), m) }
  for (const t of upcoming) { const m = months.get(t.date.slice(0, 7)) ?? { earned: 0, upcoming: 0, count: 0 }; m.upcoming += t.price_driver_mzn; m.count++; months.set(t.date.slice(0, 7), m) }
  const monthRows = [...months.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const maxMonth = Math.max(1, ...monthRows.map(([, m]) => m.earned + m.upcoming))

  const list = (title: string, ts: TripWithClient[], tone: 'done' | 'up') => (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className={`px-5 py-3 border-b ${tone === 'done' ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-blue-50 dark:bg-blue-950/40'}`}>
        <h2 className={`text-sm md:text-base font-bold ${tone === 'done' ? 'text-emerald-800 dark:text-emerald-400' : 'text-blue-800 dark:text-blue-400'}`}>
          {title} ({ts.length})
        </h2>
      </div>
      {ts.length === 0 ? (
        <p className="text-sm md:text-base text-gray-400 italic py-4 text-center">{tr.no_trips[lang]}</p>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {ts.map(t => (
            <div key={t.id} className="px-4 md:px-6 py-2.5 md:py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm md:text-base font-medium text-gray-800 dark:text-gray-200">
                  {formatTripDate(t.date, lang, dateMode)} <span className="text-gray-400 font-normal">{t.start_time}</span>
                </div>
                <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400 truncate">
                  {tripTypeLabel(t.type, lang)}{clientLine(t, lang) ? ` · ${clientLine(t, lang)}` : ''}
                </div>
              </div>
              <div className="font-semibold md:text-lg whitespace-nowrap text-amber-800 dark:text-amber-400">{mzn(t.price_driver_mzn)}</div>
            </div>
          ))}
          <div className="px-4 md:px-6 py-3 bg-gray-50 dark:bg-gray-800 flex justify-between font-bold md:text-lg">
            <span className="text-gray-700 dark:text-gray-300">{tr.total[lang]}</span>
            <span className="text-amber-900 dark:text-amber-400">{mzn(sum(ts))}</span>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* The three numbers that matter */}
      <div className="grid gap-3 md:gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-5 py-4">
          <p className="text-xs md:text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">✅ {tr.money_earned[lang]}</p>
          <p className="mt-1 text-2xl md:text-3xl font-bold text-emerald-900 dark:text-emerald-300">{mzn(earned)}</p>
          <p className="text-sm text-emerald-700 dark:text-emerald-400">{fmt(tr.trips_done[lang], { count: past.length })}</p>
        </div>
        <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 px-5 py-4">
          <p className="text-xs md:text-sm font-medium uppercase tracking-wide text-blue-700 dark:text-blue-400">📅 {tr.money_upcoming[lang]}</p>
          <p className="mt-1 text-2xl md:text-3xl font-bold text-blue-900 dark:text-blue-300">{mzn(toEarn)}</p>
          <p className="text-sm text-blue-700 dark:text-blue-400">{fmt(tr.trips_upcoming[lang], { count: upcoming.length })}</p>
        </div>
        <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-5 py-4">
          <p className="text-xs md:text-sm font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">💰 {tr.money_total[lang]}</p>
          <p className="mt-1 text-2xl md:text-3xl font-bold text-amber-900 dark:text-amber-300">{mzn(total)}</p>
          <p className="text-sm text-amber-700 dark:text-amber-400">{fmt(tr.trips_all[lang], { count: past.length + upcoming.length })}</p>
        </div>
      </div>

      {/* Progress + key dates */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-5 py-4 space-y-3">
        <div>
          <div className="flex justify-between text-sm md:text-base text-gray-600 dark:text-gray-400 mb-1">
            <span>{fmt(tr.money_progress[lang], { pct })}</span>
            <span>{mzn(earned)} / {mzn(total)}</span>
          </div>
          <div className="h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm md:text-base">
          {[
            [tr.money_first[lang], firstEver ? formatTripDate(firstEver, lang, dateMode) : '–'],
            [tr.money_last[lang],  lastDone   ? formatTripDate(lastDone.date, lang, dateMode) : '–'],
            [tr.money_next[lang],  next       ? formatTripDate(next.date, lang, dateMode) : '–'],
          ].map(([k, v]) => (
            <div key={k} className="flex sm:block justify-between gap-2">
              <dt className="text-gray-500 dark:text-gray-400">{k}</dt>
              <dd className="font-semibold text-gray-900 dark:text-gray-100">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* By month */}
      {monthRows.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50 dark:bg-gray-800">
            <h2 className="text-sm md:text-base font-bold text-gray-700 dark:text-gray-300">{tr.money_by_month[lang]}</h2>
          </div>
          <div className="px-5 py-4 space-y-4">
            {monthRows.map(([key, m]) => (
              <div key={key}>
                <div className="flex justify-between gap-3 text-sm md:text-base">
                  <span className="font-medium capitalize text-gray-800 dark:text-gray-200">{formatMonth(`${key}-01`, lang)}</span>
                  <span className="font-semibold text-amber-800 dark:text-amber-400">{mzn(m.earned + m.upcoming)}</span>
                </div>
                <div className="mt-1 h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden flex">
                  <div className="h-full bg-emerald-500" style={{ width: `${(m.earned / maxMonth) * 100}%` }} />
                  <div className="h-full bg-blue-400"    style={{ width: `${(m.upcoming / maxMonth) * 100}%` }} />
                </div>
                <div className="mt-0.5 text-xs md:text-sm text-gray-500 dark:text-gray-400">
                  {fmt(tr.trips_all[lang], { count: m.count })}
                  {m.earned   > 0 && ` · ✅ ${mzn(m.earned)}`}
                  {m.upcoming > 0 && ` · 📅 ${mzn(m.upcoming)}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {list(tr.money_up_list[lang],   upcoming, 'up')}
      {list(tr.money_done_list[lang], past,     'done')}
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
  const [tab,      setTab]      = usePref<Tab>('taxi_share_tab', 'trips')

  useEffect(() => {
    async function load() {
      const [driverRes, tripsRes] = await Promise.all([
        // Column-restricted for anon (see security-rls.md, Lot C)
        supabase.from('taxi_drivers').select('id, name, phone, vehicle, seats').eq('id', driverId).single(),
        // Column-restricted for anon since 2026-08-18c (`*` → 42501). The driver
        // needs his own fee; the client price is none of his business and is no
        // longer served to a driver token at all.
        supabase
          .from('taxi_trips')
          .select('id, date, start_time, type, status, taxi_driver_id, booking_id, nb_persons, nb_luggage, nb_boardbags, notes, price_driver_mzn, booking:bookings(client:clients(first_name, last_name))')
          .eq('taxi_driver_id', driverId)
          .order('date', { ascending: false }),
      ])
      setDriver((driverRes.data ?? null) as TaxiDriver | null)
      setTrips((tripsRes.data ?? []) as TripWithClient[])
      setLoading(false)
    }
    load()
  }, [driverId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 dark:text-gray-400">{tr.loading[lang]}</p>
      </div>
    )
  }

  if (!driver) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">{tr.not_found[lang]}</p>
      </div>
    )
  }

  const today    = todayISO()
  const past     = trips.filter(t => t.date <  today).sort((a, b) => b.date.localeCompare(a.date))
  const upcoming = trips.filter(t => t.date >= today).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl lg:max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* Header + options */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl text-white px-6 py-5 md:px-8 md:py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-blue-200 dark:text-blue-300 text-sm md:text-base font-medium uppercase tracking-wide mb-1">{tr.driver_statement[lang]}</p>
              <h1 className="text-2xl md:text-4xl font-bold">{driver.name}</h1>
              {driver.vehicle && <p className="text-blue-200 dark:text-blue-300 text-sm md:text-lg mt-1">{driver.vehicle}</p>}
              {driver.phone   && <p className="text-blue-200 dark:text-blue-300 text-sm md:text-lg">{driver.phone}</p>}
            </div>
            <Segmented value={lang} onChange={setLang}
              options={TAXI_LANGS.map(l => ({ v: l.code, label: `${l.flag} ${l.code.toUpperCase()}` }))} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {tab === 'trips' && (
              <Segmented value={view} onChange={setView}
                options={[{ v: 'cards', label: `🗂️ ${tr.opt_view_cards[lang]}` }, { v: 'table', label: `📋 ${tr.opt_view_table[lang]}` }]} />
            )}
            <Segmented value={dateMode} onChange={setDateMode}
              options={[{ v: 'readable', label: '📅 Seg 30/06' }, { v: 'iso', label: '2026-06-30' }]} />
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-gray-200/70 dark:bg-gray-800">
          {([['trips', tr.tab_trips[lang]], ['money', tr.tab_money[lang]]] as [Tab, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`py-2.5 md:py-3 rounded-lg text-sm md:text-lg font-semibold transition-colors ${
                tab === k
                  ? 'bg-white dark:bg-gray-900 text-blue-700 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'money' ? (
          <MoneyTab past={past} upcoming={upcoming} lang={lang} dateMode={dateMode} />
        ) : (
          <>
            {/* Upcoming trips */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="px-5 py-3 border-b bg-blue-50 dark:bg-blue-950/40">
                <h2 className="text-sm md:text-lg font-bold text-blue-800 dark:text-blue-400">{tr.upcoming_trips[lang]} ({upcoming.length})</h2>
              </div>
              <TripList trips={upcoming} lang={lang} dateMode={dateMode} view={view} />
            </div>

            {/* Past trips */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="px-5 py-3 border-b bg-gray-50 dark:bg-gray-800">
                <h2 className="text-sm md:text-lg font-bold text-gray-700 dark:text-gray-300">{tr.completed_trips[lang]} ({past.length})</h2>
              </div>
              <TripList trips={past} lang={lang} dateMode={dateMode} view={view} />
            </div>
          </>
        )}

        <p className="text-center text-xs text-gray-300 dark:text-gray-500">
          Bilene Kite Center · {tr.footer_updated[lang]} {new Date().toLocaleDateString(lang === 'pt' ? 'pt-PT' : 'en-GB')}
        </p>

      </div>
    </div>
  )
}
