import { displayFirstName } from '../utils/names'
import { useState, useRef, useEffect } from 'react'
import { useTable } from '../hooks/useSupabase'
import type { Booking, BookingStatus, Client } from '../types/database'
import { TAXI_LANGS, type TaxiLang } from '../data/taxiShareI18n'
import { usePref, Segmented } from './taxiShareUI'
import { todayISO as isoToday, addDaysISO as addDays, daysBetween } from '../utils/dates'
import { stayBookings } from '../utils/dayVisitor'

// Public read-only stay planning for the hotel restaurant manager:
// one timeline row per booking (guest name + arrival/departure), so she knows
// who leaves when and can collect restaurant bills before departure.
// Only reads bookings (dates/status/kind) + clients identity columns — all
// already anon-readable (see security-rls.md). Cancelled bookings and
// walk-ins (day visitors, WALK_INS.md) are excluded — gui only wants actual
// guest stays here, not a local who dropped in for a lesson.
//
// The grid shows 3 months back-to-back (previous / current / next) so the
// full width of the page is put to use and she can see what's coming without
// clicking through — the "current" month (nav arrows + Today) just picks
// which one sits in the middle.

const CELL_W = 32 // px per day, same as the admin planning grid
const NAME_COL_W = 208 // px, keep in sync with the w-52 sticky name column below

type Tab = 'departures' | 'inhouse' | 'arrivals' | 'overview'
const DEPARTURES_DAYS = 14 // how far ahead the Departures tab looks
const ARRIVALS_DAYS = 30   // same, for Arrivals

type BookingRow = Booking & { client: Client | null }

const L = {
  title:          { pt: 'Estadias dos Hóspedes', en: 'Guest Stays' },
  subtitle:       { pt: 'Chegadas e partidas dos hóspedes do centro', en: 'Guest arrivals & departures' },
  no_departures:  { pt: 'Nenhuma partida nos próximos dias', en: 'No departures in the next few days' },
  no_arrivals:    { pt: 'Nenhuma chegada nos próximos dias', en: 'No arrivals in the next few days' },
  no_inhouse:     { pt: 'Nenhum hóspede no centro', en: 'No guests at the center' },
  tab_departures: { pt: 'Partidas', en: 'Departures' },
  tab_inhouse:    { pt: 'No hotel', en: 'In house' },
  tab_arrivals:   { pt: 'Chegadas', en: 'Arrivals' },
  tab_overview:   { pt: 'Visão geral', en: 'Overview' },
  stays_count:    { pt: 'estadias', en: 'stays' },
  nights:         { pt: 'noites', en: 'nights' },
  night:          { pt: 'noite', en: 'night' },
  nights_left:    { pt: 'noites restantes', en: 'nights left' },
  night_left:     { pt: 'noite restante', en: 'night left' },
  leaves_today:   { pt: 'Parte hoje', en: 'Leaves today' },
  leaves_tomorrow:{ pt: 'Parte amanhã', en: 'Leaves tomorrow' },
  arrives_today:  { pt: 'Chega hoje', en: 'Arrives today' },
  arrives_in:     { pt: 'Chega em {n} dias', en: 'Arrives in {n} days' },
  today:          { pt: 'Hoje', en: 'Today' },
  tomorrow:       { pt: 'Amanhã', en: 'Tomorrow' },
  no_bookings:    { pt: 'Sem estadias neste período', en: 'No stays in this period' },
  loading:        { pt: 'A carregar…', en: 'Loading…' },
  confirmed:      { pt: 'Confirmada', en: 'Confirmed' },
  provisional:    { pt: 'Provisória', en: 'Provisional' },
  departure_day:  { pt: 'Dia de partida', en: 'Departure day' },
  arrival:        { pt: 'Chegada', en: 'Arrival' },
  departure:      { pt: 'Partida', en: 'Departure' },
} as const

const LOCALE: Record<TaxiLang, string> = { pt: 'pt-PT', en: 'en-GB' }

const BAR_COLOR: Record<Exclude<BookingStatus, 'cancelled'>, { bar: string; cap: string }> = {
  confirmed:   { bar: 'bg-emerald-500', cap: 'bg-emerald-700' },
  provisional: { bar: 'bg-amber-400',   cap: 'bg-amber-600' },
}

// Calendar-day helpers live in utils/dates — never `.toISOString()` on a date
// the user thinks of as a day (it shifts a day back east of Greenwich).
const fmtDay = (iso: string, lang: TaxiLang) =>
  new Date(iso + 'T00:00:00').toLocaleDateString(LOCALE[lang], { weekday: 'short', day: 'numeric', month: 'short' })

const guestName = (b: BookingRow) =>
  b.client ? `${displayFirstName(b.client.first_name)} ${b.client.last_name}` : `#${b.booking_number}`

const shiftYM = (ym: string, delta: number) => {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const isWeekendDate = (d: Date) => d.getDay() === 0 || d.getDay() === 6

export default function RestaurantSharePage() {
  const today = isoToday()
  const [lang, setLang] = usePref<TaxiLang>('restaurant_share_lang', 'pt')
  const [month, setMonth] = useState(() => today.slice(0, 7)) // 'YYYY-MM', the centered month

  const { data: allBookings, loading } = useTable<BookingRow>('bookings', {
    select: 'id, booking_number, check_in, check_out, status, kind, client:clients(id, first_name, last_name)',
    order: 'check_in',
  })
  const bookings = stayBookings(allBookings.filter(b => b.status !== 'cancelled'))

  // 3-month window: previous / current / next, laid out back-to-back with
  // a running column offset (colStart) so bookings position by absolute day.
  let colCursor = 0
  const blocks = [shiftYM(month, -1), month, shiftYM(month, 1)].map(ym => {
    const [y, m] = ym.split('-').map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    const label = new Date(y, m - 1, 1).toLocaleDateString(LOCALE[lang], { month: 'long', year: 'numeric' })
    const colStart = colCursor
    colCursor += daysInMonth
    return { ym, year: y, mon: m, daysInMonth, label, colStart }
  })
  const totalDays = colCursor
  const rangeStart = `${blocks[0].ym}-01`
  const lastBlock = blocks[2]
  const rangeEnd = `${lastBlock.ym}-${String(lastBlock.daysInMonth).padStart(2, '0')}`

  const dayIndex = (iso: string) =>
    Math.round((new Date(iso + 'T00:00:00').getTime() - new Date(rangeStart + 'T00:00:00').getTime()) / 86400000)

  const dayCells = blocks.flatMap(b =>
    Array.from({ length: b.daysInMonth }, (_, i) => {
      const date = new Date(b.year, b.mon - 1, i + 1)
      return { idx: b.colStart + i, dayNum: i + 1, date, isBlockStart: i === 0 }
    })
  )

  // On the current month the timeline starts at today: stays already over only
  // push the people she is looking for further down. Browsing another month
  // still shows everything in the window.
  const rowsFrom = month === today.slice(0, 7) ? today : rangeStart
  const rows = bookings
    .filter(b => b.check_in <= rangeEnd && b.check_out >= rowsFrom)
    .sort((a, b) => a.check_in.localeCompare(b.check_in) || a.check_out.localeCompare(b.check_out))

  const shiftMonth = (delta: number) => setMonth(shiftYM(month, delta))
  const monthLabel = blocks[1].label

  const dateLabel = (iso: string) =>
    iso === today ? L.today[lang] : iso === addDays(today, 1) ? L.tomorrow[lang] : fmtDay(iso, lang)

  // The three list views, each grouped by the day that matters for it.
  const groupByDay = (list: BookingRow[], key: 'check_in' | 'check_out') => {
    const groups: { date: string; items: BookingRow[] }[] = []
    for (const b of list) {
      const last = groups[groups.length - 1]
      if (last && last.date === b[key]) last.items.push(b)
      else groups.push({ date: b[key], items: [b] })
    }
    return groups
  }
  const departures = groupByDay(
    bookings
      .filter(b => b.check_out >= today && b.check_out <= addDays(today, DEPARTURES_DAYS))
      .sort((a, b) => a.check_out.localeCompare(b.check_out) || guestName(a).localeCompare(guestName(b))),
    'check_out')
  const inHouse = bookings
    .filter(b => b.check_in <= today && b.check_out >= today)
    .sort((a, b) => a.check_out.localeCompare(b.check_out) || guestName(a).localeCompare(guestName(b)))
  const arrivals = groupByDay(
    bookings
      .filter(b => b.check_in >= today && b.check_in <= addDays(today, ARRIVALS_DAYS))
      .sort((a, b) => a.check_in.localeCompare(b.check_in) || guestName(a).localeCompare(guestName(b))),
    'check_in')

  const nightsOf = (b: BookingRow) => daysBetween(b.check_in, b.check_out)
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

  // The line that matters on a card, in the colour that matters: red = today.
  const badgeFor = (b: BookingRow, view: 'departures' | 'inhouse' | 'arrivals'): { text: string; tone: string } | null => {
    const red = 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
    const amber = 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
    const grey = 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
    if (view === 'arrivals') {
      const n = daysBetween(today, b.check_in)
      if (n === 0) return { text: L.arrives_today[lang], tone: amber }
      return { text: L.arrives_in[lang].replace('{n}', String(n)), tone: grey }
    }
    const left = daysBetween(today, b.check_out)
    if (left === 0) return { text: L.leaves_today[lang], tone: red }
    if (left === 1) return { text: L.leaves_tomorrow[lang], tone: amber }
    if (view === 'inhouse') return { text: plural(left, L.night_left[lang], L.nights_left[lang]), tone: grey }
    return null
  }

  const [tab, setTab] = usePref<Tab>('restaurant_share_tab', 'departures')
  const tabs: { id: Tab; label: string }[] = [
    { id: 'departures', label: L.tab_departures[lang] },
    { id: 'inhouse',    label: L.tab_inhouse[lang] },
    { id: 'arrivals',   label: L.tab_arrivals[lang] },
    { id: 'overview',   label: L.tab_overview[lang] },
  ]

  const StayCard = ({ b, view }: { b: BookingRow; view: 'departures' | 'inhouse' | 'arrivals' }) => {
    const badge = badgeFor(b, view)
    return (
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
        <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${b.status === 'confirmed' ? 'bg-emerald-500' : 'bg-amber-400'}`}
          title={b.status === 'confirmed' ? L.confirmed[lang] : L.provisional[lang]} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-gray-800 dark:text-gray-200 break-words">{guestName(b)}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {fmtDay(b.check_in, lang)} → {fmtDay(b.check_out, lang)} · {plural(nightsOf(b), L.night[lang], L.nights[lang])}
          </div>
        </div>
        {badge && (
          <span className={`shrink-0 text-xs font-semibold rounded-full px-2.5 py-1 ${badge.tone}`}>{badge.text}</span>
        )}
      </div>
    )
  }

  const DayGroups = ({ groups, view, empty }: { groups: { date: string; items: BookingRow[] }[]; view: 'departures' | 'arrivals'; empty: string }) =>
    groups.length === 0 ? (
      <div className="text-center py-12 text-gray-400 dark:text-gray-400">{empty}</div>
    ) : (
      <div className="space-y-5">
        {groups.map(g => (
          <section key={g.date}>
            <h2 className={`mb-2 text-sm font-bold uppercase tracking-wide ${
              g.date === today ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
              {dateLabel(g.date)}
              {(g.date === today || g.date === addDays(today, 1)) && (
                <span className="ml-2 font-medium normal-case tracking-normal">{fmtDay(g.date, lang)}</span>
              )}
              <span className="ml-2 font-medium normal-case tracking-normal text-gray-400">· {g.items.length}</span>
            </h2>
            <div className="space-y-2">{g.items.map(b => <StayCard key={b.id} b={b} view={view} />)}</div>
          </section>
        ))}
      </div>
    )

  const todayIndex = today >= rangeStart && today <= rangeEnd ? dayIndex(today) : null

  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (todayIndex === null || !scrollRef.current) return
    const container = scrollRef.current
    // The name column stays sticky at left:0, so it permanently covers the
    // first NAME_COL_W px of whatever's visible — center within the rest.
    const visibleDayW = container.clientWidth - NAME_COL_W
    const target = todayIndex * CELL_W + CELL_W / 2 - visibleDayW / 2
    container.scrollTo({ left: Math.max(0, target) })
  }, [todayIndex, loading, tab])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="px-4 md:px-8 py-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🍽️</span>
            <div>
              <h1 className="text-2xl font-bold">{L.title[lang]}</h1>
              <p className="text-sm text-blue-200 dark:text-blue-300">{L.subtitle[lang]}</p>
            </div>
          </div>
          <Segmented value={lang} onChange={setLang}
            options={TAXI_LANGS.map(l => ({ v: l.code, label: `${l.flag} ${l.code.toUpperCase()}` }))} />
        </div>
      </div>

      <div className="px-4 md:px-8 py-4 space-y-4">
        {/* Tabs — the three working lists first, the big picture last */}
        <div className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-blue-600 text-blue-700 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading && tab !== 'overview' && (
          <div className="text-center py-16 text-gray-400 dark:text-gray-400">{L.loading[lang]}</div>
        )}

        {!loading && tab === 'departures' && (
          <div className="max-w-3xl mx-auto">
            <DayGroups groups={departures} view="departures" empty={L.no_departures[lang]} />
          </div>
        )}

        {!loading && tab === 'inhouse' && (
          <div className="max-w-3xl mx-auto">
            {inHouse.length === 0 ? (
              <div className="text-center py-12 text-gray-400 dark:text-gray-400">{L.no_inhouse[lang]}</div>
            ) : (
              <>
                <p className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {inHouse.length} {L.stays_count[lang]}
                </p>
                <div className="space-y-2">{inHouse.map(b => <StayCard key={b.id} b={b} view="inhouse" />)}</div>
              </>
            )}
          </div>
        )}

        {!loading && tab === 'arrivals' && (
          <div className="max-w-3xl mx-auto">
            <DayGroups groups={arrivals} view="arrivals" empty={L.no_arrivals[lang]} />
          </div>
        )}

        {tab === 'overview' && <>
        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => shiftMonth(-1)}
              className="px-3 py-1.5 bg-white dark:bg-gray-900 border rounded-lg shadow-sm text-sm hover:bg-gray-50 dark:hover:bg-gray-800">‹</button>
            <span className="font-semibold text-gray-800 dark:text-gray-200 capitalize min-w-40 text-center">{monthLabel}</span>
            <button onClick={() => shiftMonth(1)}
              className="px-3 py-1.5 bg-white dark:bg-gray-900 border rounded-lg shadow-sm text-sm hover:bg-gray-50 dark:hover:bg-gray-800">›</button>
          </div>
          <button onClick={() => setMonth(today.slice(0, 7))}
            className="px-3 py-1.5 bg-white dark:bg-gray-900 border rounded-lg shadow-sm text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
            {L.today[lang]}
          </button>
        </div>

        {/* Timeline: 3 months, previous ← current → next */}
        {loading ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-400">{L.loading[lang]}</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-400">
            <p className="text-4xl mb-3">🛏️</p>
            <p className="text-lg font-medium">{L.no_bookings[lang]}</p>
          </div>
        ) : (
          <div ref={scrollRef} className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-x-auto">
            <div style={{ width: NAME_COL_W + totalDays * CELL_W }}>
              {/* Month labels */}
              <div className="flex">
                <div className="w-52 shrink-0 sticky left-0 bg-white dark:bg-gray-900 z-10 border-r border-gray-200 dark:border-gray-800" />
                {blocks.map((b, i) => (
                  <div key={b.ym}
                    className={`shrink-0 text-center py-1 text-xs font-semibold capitalize text-gray-500 dark:text-gray-400 ${
                      i > 0 ? 'border-l-2 border-gray-300 dark:border-gray-700' : ''} ${
                      b.ym === month ? 'bg-blue-50 dark:bg-blue-950/20' : ''}`}
                    style={{ width: b.daysInMonth * CELL_W }}>
                    {b.label}
                  </div>
                ))}
              </div>

              {/* Day header */}
              <div className="flex border-b border-gray-200 dark:border-gray-800">
                <div className="w-52 shrink-0 sticky left-0 bg-white dark:bg-gray-900 z-10 border-r border-gray-200 dark:border-gray-800" />
                {dayCells.map(c => (
                  <div key={c.idx}
                    className={`w-8 shrink-0 text-center py-1 border-r border-gray-100 dark:border-gray-800 ${
                      c.isBlockStart ? 'border-l-2 border-l-gray-300 dark:border-l-gray-700' : ''} ${
                      c.idx === todayIndex ? 'bg-blue-600 dark:bg-blue-600 border-x-2 border-blue-700 dark:border-blue-400' :
                      isWeekendDate(c.date) ? 'bg-gray-50 dark:bg-gray-800' : ''}`}>
                    <div className={`text-[10px] leading-none ${c.idx === todayIndex ? 'text-blue-100' : 'text-gray-400 dark:text-gray-400'}`}>
                      {c.date.toLocaleDateString(LOCALE[lang], { weekday: 'narrow' })}
                    </div>
                    <div className={`text-xs font-bold ${c.idx === todayIndex ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>{c.dayNum}</div>
                  </div>
                ))}
              </div>

              {/* Booking rows */}
              {rows.map(b => {
                const clippedStart = b.check_in < rangeStart
                const clippedEnd = b.check_out > rangeEnd
                const startCol = clippedStart ? 0 : dayIndex(b.check_in)
                const endCol = clippedEnd ? totalDays - 1 : dayIndex(b.check_out)
                const color = BAR_COLOR[b.status as Exclude<BookingStatus, 'cancelled'>]
                const tooltip = `${guestName(b)} — ${L.arrival[lang]} ${fmtDay(b.check_in, lang)} · ${L.departure[lang]} ${fmtDay(b.check_out, lang)} (${b.status === 'confirmed' ? L.confirmed[lang] : L.provisional[lang]})`
                return (
                  <div key={b.id} className="flex border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                    <div className="w-52 shrink-0 sticky left-0 bg-white dark:bg-gray-900 z-10 border-r border-gray-200 dark:border-gray-800 px-3 py-1.5">
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate" title={tooltip}>{guestName(b)}</div>
                      <div className="text-[11px] text-gray-400 dark:text-gray-400">
                        {fmtDay(b.check_in, lang)} → {fmtDay(b.check_out, lang)}
                      </div>
                    </div>
                    <div className="relative h-11 shrink-0" style={{ width: totalDays * CELL_W }}>
                      {/* day grid background */}
                      <div className="absolute inset-0 flex">
                        {dayCells.map(c => (
                          <div key={c.idx} className={`w-8 shrink-0 border-r border-gray-100 dark:border-gray-800 ${
                            c.isBlockStart ? 'border-l-2 border-l-gray-200 dark:border-l-gray-700' : ''} ${
                            c.idx === todayIndex ? 'bg-blue-50 dark:bg-blue-950/40 border-x-2 border-blue-400 dark:border-blue-500' :
                            isWeekendDate(c.date) ? 'bg-gray-50 dark:bg-gray-800' : ''}`} />
                        ))}
                      </div>
                      {/* stay bar */}
                      <div title={tooltip}
                        className={`absolute top-2 bottom-2 flex items-center overflow-hidden ${color.bar} ${
                          clippedStart ? '' : 'rounded-l-md'} ${clippedEnd ? '' : 'rounded-r-md'}`}
                        style={{ left: startCol * CELL_W, width: (endCol - startCol + 1) * CELL_W }}>
                        {clippedStart && <span className="text-white text-[10px] pl-0.5">◀</span>}
                        <span className="flex-1" />
                        {/* darker cap on the departure day */}
                        {!clippedEnd && (
                          <span className={`h-full w-8 shrink-0 ${color.cap} flex items-center justify-center rounded-r-md`}>
                            <span className="text-white text-[10px]">🧳</span>
                          </span>
                        )}
                        {clippedEnd && <span className="text-white text-[10px] pr-0.5">▶</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-3 rounded bg-emerald-500 inline-block" /> {L.confirmed[lang]}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-3 rounded bg-amber-400 inline-block" /> {L.provisional[lang]}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-3 rounded bg-emerald-700 inline-flex items-center justify-center text-white text-[8px]">🧳</span>
            {L.departure_day[lang]}
          </span>
        </div>
        </>}
      </div>
    </div>
  )
}
