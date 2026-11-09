import { displayFirstName } from '../utils/names'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { TaxiDriver, TaxiTrip, TaxiManagerPayment } from '../types/database'
import {
  tr, TAXI_LANGS, tripTypeLabel, statusLabel,
  fmt, mzn, formatTripDate, formatMonth,
  type TaxiLang, type DateMode, type ViewMode,
} from '../data/taxiShareI18n'
import { taxiTripLabel } from '../data/taxiTripTypes'
import { usePref, Segmented } from './taxiShareUI'
import { todayISO } from '../utils/dates'
import { tripTravel, type TravelFields } from '../utils/travelMode'
import TravelBadge from '../components/common/TravelBadge'
import { groupByDay, withinDays, dayLabel, whatsappUrl, tripMessage, dayMessage, type TripWords } from '../utils/taxiDispatch'

type Tab = 'trips' | 'summary'
type Period = '7d' | 'all'

// The shape anon is actually served (column-level GRANT — see security-rls.md).
// The manager is paid on `margin_manager_mzn`; the client price and the driver's
// fee are not granted to a manager token any more.
type TripWithClient = Pick<TaxiTrip,
  'id' | 'date' | 'start_time' | 'type' | 'status' | 'taxi_driver_id' | 'booking_id' |
  'nb_persons' | 'nb_luggage' | 'nb_boardbags' | 'notes' | 'margin_manager_mzn'> & {
  booking?: { client?: { first_name: string; last_name: string } | null } | null
}

function clientName(t: TripWithClient): string {
  const c = t.booking?.client
  return c ? `${displayFirstName(c.first_name)} ${c.last_name}` : '–'
}

// ── Managed-trip list (driver column + manager commission) ────────────────────
function TripList({ trips, driverName, lang, dateMode, view }: {
  trips: TripWithClient[]; driverName: (id: string | null) => string
  lang: TaxiLang; dateMode: DateMode; view: ViewMode
}) {
  if (trips.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-400 italic py-4 text-center">{tr.no_trips[lang]}</p>
  }
  const total = trips.reduce((s, t) => s + t.margin_manager_mzn, 0)

  if (view === 'cards') {
    return (
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {trips.map(t => (
          <div key={t.id} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-bold text-gray-900 dark:text-gray-100">{formatTripDate(t.date, lang, dateMode)}</span>
              <span className="text-gray-500 dark:text-gray-400 text-sm">{t.start_time}</span>
            </div>
            <div className="mt-0.5 text-sm font-medium text-gray-800 dark:text-gray-200">{tripTypeLabel(t.type, lang)}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">🚗 {driverName(t.taxi_driver_id)} · {clientName(t)}</div>
            {t.notes && <div className="mt-1 text-xs text-gray-400 dark:text-gray-400 italic">💬 {t.notes}</div>}
            <div className="mt-1.5 text-right font-bold text-purple-800 dark:text-purple-400">{mzn(t.margin_manager_mzn)}</div>
          </div>
        ))}
        <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800 flex justify-between font-bold">
          <span className="text-gray-700 dark:text-gray-300">{tr.total[lang]}</span>
          <span className="text-purple-900 dark:text-purple-400">{mzn(total)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800 border-b text-gray-500 dark:text-gray-400 text-xs text-left">
            <th className="px-2 sm:px-4 py-2 font-medium">{tr.col_date[lang]}</th>
            <th className="px-2 sm:px-4 py-2 font-medium">{tr.col_time[lang]}</th>
            <th className="px-2 sm:px-4 py-2 font-medium">{tr.col_driver[lang]}</th>
            <th className="px-2 sm:px-4 py-2 font-medium">{tr.col_route[lang]}</th>
            <th className="px-2 sm:px-4 py-2 font-medium">{tr.col_client[lang]}</th>
            <th className="px-2 sm:px-4 py-2 font-medium">{tr.col_notes[lang]}</th>
            <th className="px-2 sm:px-4 py-2 font-medium text-right">{tr.col_amount[lang]}</th>
          </tr>
        </thead>
        <tbody>
          {trips.map(t => (
            <tr key={t.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
              <td className="px-2 sm:px-4 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap font-medium">{formatTripDate(t.date, lang, dateMode)}</td>
              <td className="px-2 sm:px-4 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">{t.start_time}</td>
              <td className="px-2 sm:px-4 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{driverName(t.taxi_driver_id)}</td>
              <td className="px-2 sm:px-4 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{tripTypeLabel(t.type, lang)}</td>
              <td className="px-2 sm:px-4 py-2 text-gray-700 dark:text-gray-300">{clientName(t)}</td>
              <td className="px-2 sm:px-4 py-2 text-gray-400 dark:text-gray-400 italic text-xs">{t.notes ?? ''}</td>
              <td className="px-2 sm:px-4 py-2 text-right font-semibold text-purple-800 dark:text-purple-400 whitespace-nowrap">{mzn(t.margin_manager_mzn)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-700 font-bold">
            <td colSpan={6} className="px-2 sm:px-4 py-2 text-right text-gray-700 dark:text-gray-300 text-sm">{tr.total[lang]}</td>
            <td className="px-2 sm:px-4 py-2 text-right text-purple-900 dark:text-purple-400">{mzn(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── "Viagens" tab: the trips to organise, by day (2026-11-09) ─────────────────
// The manager dispatches the drivers by WhatsApp: what he needs is who goes
// where and when, which trips still have no driver, and the message to send.
// No money here — that stays in the Summary tab, unchanged.

/** Light-background toggle (Segmented is white-on-blue, for the header). */
function Chips<T extends string>({ value, options, onChange }: {
  value: T; options: { v: T; label: string }[]; onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden text-sm">
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className={`px-3 py-1.5 whitespace-nowrap font-medium transition-colors ${
            value === o.v
              ? 'bg-blue-600 text-white'
              : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

const WA_BTN = 'shrink-0 inline-flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-600 text-white'

type RowWords = TripWords & { phone: string | null }

function DispatchRow({ t, words, lang, showDate, today }: {
  t: TripWithClient; words: RowWords; lang: TaxiLang; showDate: boolean; today: string
}) {
  return (
    <div className="flex gap-3 px-3 sm:px-4 py-2.5">
      <div className={`${showDate ? 'w-16' : 'w-12'} shrink-0 tabular-nums`}>
        {showDate && <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatTripDate(t.date, lang, 'readable')}</div>}
        <div className="font-bold text-gray-900 dark:text-gray-100">{t.start_time}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{taxiTripLabel(t.type, { icon: true, lang })}</span>
          {words.driver ? (
            <span className="text-sm font-semibold text-blue-700 dark:text-blue-400 whitespace-nowrap">🚗 {words.driver}</span>
          ) : (
            <span className="text-xs font-bold uppercase whitespace-nowrap rounded px-1.5 py-0.5 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400">
              {tr.mgr_no_driver[lang]}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs text-gray-600 dark:text-gray-400">
          {words.client && <span>👤 {words.client}</span>}
          <span>👥 {t.nb_persons}</span>
          {t.nb_luggage   > 0 && <span title={tr.bag_normal[lang]}>🧳 {t.nb_luggage}</span>}
          {t.nb_boardbags > 0 && <span title={tr.bag_long[lang]}>🏄 {t.nb_boardbags}</span>}
          <TravelBadge t={words.travel} />
          {t.status === 'needs_details' && t.date >= today && (
            <span className="text-amber-700 dark:text-amber-400">⏳ {statusLabel(t.status, lang)}</span>
          )}
        </div>
        {t.notes && <div className="mt-0.5 text-xs italic text-gray-500 dark:text-gray-400">💬 {t.notes}</div>}
      </div>
      {!showDate && (
        <a href={whatsappUrl(tripMessage(t, words, lang), words.phone)} target="_blank" rel="noopener noreferrer"
          title={tr.wa_trip[lang]} aria-label={tr.wa_trip[lang]}
          className={`${WA_BTN} self-center w-9 h-9 text-lg`}>
          📲
        </a>
      )}
    </div>
  )
}

function DispatchTab({ upcoming, past, drivers, travel, today, lang }: {
  upcoming: TripWithClient[]; past: TripWithClient[]; drivers: TaxiDriver[]
  travel: Map<string, TravelFields>; today: string; lang: TaxiLang
}) {
  const [period,   setPeriod]   = usePref<Period>('taxi_mgr_period', '7d')
  const [noDriver, setNoDriver] = useState(false)
  const [showDone, setShowDone] = useState(false)

  const words = (t: TripWithClient): RowWords => {
    const d = drivers.find(x => x.id === t.taxi_driver_id)
    return {
      client: t.booking?.client ? clientName(t) : null,
      driver: d?.name ?? null,
      phone:  d?.phone ?? null,
      travel: t.booking_id ? tripTravel(t.type, travel.get(t.booking_id), lang) : null,
    }
  }

  const unassigned = upcoming.filter(t => !t.taxi_driver_id)
  const base       = noDriver ? unassigned : upcoming
  const shown      = period === '7d' ? base.filter(t => withinDays(t.date, today, 7)) : base
  const later      = base.length - shown.length
  const days       = groupByDay(shown)

  // Completed trips, folded by month — newest first.
  const months = new Map<string, TripWithClient[]>()
  const pastSorted = [...past].sort((a, b) => `${b.date}${b.start_time}`.localeCompare(`${a.date}${a.start_time}`))
  for (const t of pastSorted) months.set(t.date.slice(0, 7), [...(months.get(t.date.slice(0, 7)) ?? []), t])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chips value={period} onChange={setPeriod}
          options={[{ v: '7d', label: tr.period_7d[lang] }, { v: 'all', label: tr.period_all[lang] }]} />
        {unassigned.length > 0 && (
          <button onClick={() => setNoDriver(!noDriver)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
              noDriver
                ? 'bg-red-600 border-red-600 text-white'
                : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-400'
            }`}>
            {fmt(tr.mgr_no_driver_n[lang], { n: unassigned.length })}{noDriver ? ' ✕' : ''}
          </button>
        )}
      </div>

      {days.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-400 italic py-6 text-center">
          {period === '7d' ? tr.none_7d[lang] : tr.no_upcoming[lang]}
        </p>
      )}

      {days.map(([date, ts]) => (
        <section key={date} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60">
            <span className={`px-2.5 py-0.5 rounded-full text-sm font-semibold ${
              date === today
                ? 'bg-blue-600 text-white'
                : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400'
            }`}>
              {date === today ? '📍 ' : ''}{dayLabel(date, today, lang)}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-400">{fmt(tr.trips_all[lang], { count: ts.length })}</span>
            <a href={whatsappUrl(dayMessage(date, today, ts, words, lang))} target="_blank" rel="noopener noreferrer"
              title={tr.wa_day[lang]} aria-label={tr.wa_day[lang]}
              className={`${WA_BTN} ml-auto w-8 h-8 text-base`}>
              📲
            </a>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {ts.map(t => <DispatchRow key={t.id} t={t} words={words(t)} lang={lang} showDate={false} today={today} />)}
          </div>
        </section>
      ))}

      {later > 0 && (
        <button onClick={() => setPeriod('all')}
          className="w-full py-2.5 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-sm font-medium text-blue-700 dark:text-blue-400 hover:bg-white dark:hover:bg-gray-900">
          {fmt(tr.more_later[lang], { n: later })}
        </button>
      )}

      {past.length > 0 && (
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <button onClick={() => setShowDone(!showDone)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
            <span>{showDone ? '▾' : '▸'} {tr.completed_trips[lang]} ({past.length})</span>
          </button>
          {showDone && [...months.entries()].map(([m, ts]) => (
            <div key={m}>
              <div className="flex justify-between px-4 py-1.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 text-xs font-semibold text-gray-500 dark:text-gray-400">
                <span className="capitalize">{formatMonth(`${m}-01`, lang)}</span>
                <span>{fmt(tr.trips_all[lang], { count: ts.length })}</span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800 opacity-80">
                {ts.map(t => <DispatchRow key={t.id} t={t} words={words(t)} lang={lang} showDate today={today} />)}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

export default function TaxiManagerSharePage() {
  const [drivers,  setDrivers]  = useState<TaxiDriver[]>([])
  const [trips,    setTrips]    = useState<TripWithClient[]>([])
  const [payments, setPayments] = useState<TaxiManagerPayment[]>([])
  const [travel,   setTravel]   = useState<Map<string, TravelFields>>(new Map())
  const [loading,  setLoading]  = useState(true)

  const [lang,     setLang]     = usePref<TaxiLang>('taxi_share_lang', 'pt')
  const [view,     setView]     = usePref<ViewMode>('taxi_share_view', 'cards')
  const [dateMode, setDateMode] = usePref<DateMode>('taxi_share_datemode', 'readable')
  const [tab,      setTab]      = usePref<Tab>('taxi_mgr_tab', 'trips')

  useEffect(() => {
    async function load() {
      const [driversRes, tripsRes, paymentsRes] = await Promise.all([
        // Column-restricted for anon (see security-rls.md, Lot C)
        supabase.from('taxi_drivers').select('id, name, phone, vehicle, seats'),
        // Column-restricted for anon since 2026-08-18c (`*` → 42501). The manager
        // is paid on his commission, so that is what he gets — not the client
        // price, and not the driver's fee either (he never had a use for it).
        supabase
          .from('taxi_trips')
          .select('id, date, start_time, type, status, taxi_driver_id, booking_id, nb_persons, nb_luggage, nb_boardbags, notes, margin_manager_mzn, booking:bookings(client:clients(first_name, last_name))')
          .order('date', { ascending: false }),
        supabase.from('taxi_manager_payments').select('*').order('date', { ascending: false }),
      ])
      const tripRows = (tripsRes.data ?? []) as TripWithClient[]
      setDrivers((driversRes.data ?? []) as TaxiDriver[])
      setTrips(tripRows)
      setPayments((paymentsRes.data ?? []) as TaxiManagerPayment[])
      setLoading(false)

      // The flight of each upcoming trip, for the Viagens tab — its own read,
      // after the page is shown: before migration 2026-11-08b these columns
      // are not granted (42501) and only the flights are missing, nothing else.
      const today = todayISO()
      const ids = [...new Set(tripRows.filter(t => t.date >= today && t.booking_id).map(t => t.booking_id as string))]
      if (ids.length === 0) return
      const travelRes = await supabase.from('bookings')
        .select('id, arrival_by, arrival_detail, departure_by, departure_detail')
        .in('id', ids)
      if (travelRes.error) return
      setTravel(new Map(((travelRes.data ?? []) as (TravelFields & { id: string })[]).map(r => [r.id, r])))
    }
    load()
  }, [])

  const driverName = (id: string | null) => drivers.find(d => d.id === id)?.name ?? '—'

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 dark:text-gray-400">{tr.loading[lang]}</p>
      </div>
    )
  }

  const today = todayISO()
  // "Managed" trips only: margin_manager_mzn === 0 means a private taxi, invisible to the manager.
  const managed  = trips.filter(t => t.margin_manager_mzn > 0)
  const upcoming = managed.filter(t => t.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  const past     = managed.filter(t => t.date <  today).sort((a, b) => b.date.localeCompare(a.date))

  const earnedMzn = managed.reduce((s, t) => s + t.margin_manager_mzn, 0)
  const paidMzn   = payments.reduce((s, p) => s + p.amount_mzn, 0)
  const balance   = earnedMzn - paidMzn

  const balanceLabel = balance > 0 ? tr.fin_balance_due[lang] : balance < 0 ? tr.fin_overpaid[lang] : tr.fin_balanced[lang]
  const balanceColor = balance > 0 ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900 text-orange-800 dark:text-orange-400'
                     : balance < 0 ? 'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900 text-green-800 dark:text-green-400'
                     :               'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300'

  // Per-driver summary (managed trips only)
  const perDriver = drivers
    .map(d => {
      const ts = managed.filter(t => t.taxi_driver_id === d.id)
      return { id: d.id, name: d.name, count: ts.length, commission: ts.reduce((s, t) => s + t.margin_manager_mzn, 0) }
    })
    .filter(r => r.count > 0)
    .sort((a, b) => b.commission - a.commission)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6">

        {/* Header — compact: the trips are what he opens the page for */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl text-white px-4 py-3 sm:px-6 sm:py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-blue-200 dark:text-blue-300 text-xs sm:text-sm font-medium uppercase tracking-wide">
                {tab === 'summary' ? tr.manager_statement[lang] : tr.mgr_dispatch[lang]}
              </p>
              <h1 className="text-lg sm:text-2xl font-bold truncate">
                <span className="sm:hidden">🚕 BKC · Taxi</span>
                <span className="hidden sm:inline">Bilene Kite Center · Taxi</span>
              </h1>
            </div>
            <Segmented value={lang} onChange={setLang}
              options={TAXI_LANGS.map(l => ({ v: l.code, label: `${l.flag} ${l.code.toUpperCase()}` }))} />
          </div>
          {/* The view/date options only shape the Summary tab */}
          {tab === 'summary' && (
            <div className="mt-3 sm:mt-4 flex flex-wrap gap-2">
              <Segmented value={view} onChange={setView}
                options={[{ v: 'cards', label: `🗂️ ${tr.opt_view_cards[lang]}` }, { v: 'table', label: `📋 ${tr.opt_view_table[lang]}` }]} />
              <Segmented value={dateMode} onChange={setDateMode}
                options={[{ v: 'readable', label: '📅 Seg 30/06' }, { v: 'iso', label: '2026-06-30' }]} />
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-gray-200/70 dark:bg-gray-800">
          {([['trips', tr.tab_trips[lang]], ['summary', tr.tab_summary[lang]]] as [Tab, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`py-2 sm:py-2.5 rounded-lg text-sm sm:text-base font-semibold transition-colors ${
                tab === k
                  ? 'bg-white dark:bg-gray-900 text-blue-700 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'trips' ? (
          <DispatchTab upcoming={upcoming} past={past} drivers={drivers} travel={travel} today={today} lang={lang} />
        ) : (<>
        {/* ── Summary tab: the page as it was, unchanged (balance included) ── */}

        {/* Finances */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b bg-amber-50 dark:bg-amber-950/40">
            <h2 className="text-sm font-bold text-amber-800 dark:text-amber-400">{tr.fin_title[lang]}</h2>
          </div>
          <div className="p-5 space-y-2 text-sm">
            <div className="flex justify-between items-center py-1 border-b">
              <span className="text-gray-600 dark:text-gray-400">{tr.fin_earned[lang]} ({fmt(tr.trips_all[lang], { count: managed.length })})</span>
              <span className="font-bold text-purple-900 dark:text-purple-400">{mzn(earnedMzn)}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b">
              <span className="text-gray-600 dark:text-gray-400">{tr.fin_paid[lang]}</span>
              <span className="font-bold text-blue-900 dark:text-blue-400">{mzn(paidMzn)}</span>
            </div>
            <div className={`flex justify-between items-center p-3 rounded border font-bold ${balanceColor}`}>
              <span>{balanceLabel}</span>
              <span className="text-lg">{mzn(Math.abs(balance))}</span>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-400 pt-1">{tr.fin_explain[lang]}</p>
          </div>
        </div>

        {/* Per-driver summary */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto">
          <div className="px-5 py-3 border-b bg-gray-50 dark:bg-gray-800">
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300">{tr.mgr_by_driver[lang]}</h2>
          </div>
          {perDriver.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-400 italic py-4 text-center">{tr.no_trips[lang]}</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {perDriver.map(r => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-5 py-2 text-gray-800 dark:text-gray-200 font-medium">🚗 {r.name}</td>
                    <td className="px-5 py-2 text-gray-500 dark:text-gray-400 text-right">{fmt(tr.trips_all[lang], { count: r.count })}</td>
                    <td className="px-5 py-2 text-right font-semibold text-purple-800 dark:text-purple-400">{mzn(r.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Upcoming trips */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b bg-blue-50 dark:bg-blue-950/40">
            <h2 className="text-sm font-bold text-blue-800 dark:text-blue-400">{tr.upcoming_trips[lang]} ({upcoming.length})</h2>
          </div>
          <TripList trips={upcoming} driverName={driverName} lang={lang} dateMode={dateMode} view={view} />
        </div>

        {/* Completed trips */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50 dark:bg-gray-800">
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300">{tr.completed_trips[lang]} ({past.length})</h2>
          </div>
          <TripList trips={past} driverName={driverName} lang={lang} dateMode={dateMode} view={view} />
        </div>

        {/* Payment history */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50 dark:bg-gray-800">
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300">{tr.history_title[lang]}</h2>
          </div>
          {payments.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-400 italic py-4 text-center">{tr.no_payments[lang]}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b text-gray-500 dark:text-gray-400 text-xs text-left">
                  <th className="px-2 sm:px-4 py-2 font-medium">{tr.col_date[lang]}</th>
                  <th className="px-2 sm:px-4 py-2 font-medium">{tr.col_reason[lang]}</th>
                  <th className="px-2 sm:px-4 py-2 font-medium text-right">{tr.col_amount[lang]}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-2 sm:px-4 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap font-medium">{formatTripDate(p.date, lang, dateMode)}</td>
                    <td className="px-2 sm:px-4 py-2 text-gray-500 dark:text-gray-400">{p.notes ?? ''}</td>
                    <td className="px-2 sm:px-4 py-2 text-right font-semibold text-blue-900 dark:text-blue-400 whitespace-nowrap">{mzn(p.amount_mzn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        </>)}

        <p className="text-center text-xs text-gray-300 dark:text-gray-500">
          Bilene Kite Center · {tr.footer_updated[lang]} {new Date().toLocaleDateString(lang === 'pt' ? 'pt-PT' : 'en-GB')}
        </p>

      </div>
    </div>
  )
}
