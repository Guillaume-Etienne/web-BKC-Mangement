import { useState } from 'react'
import { useTable } from '../hooks/useSupabase'
import type { Booking, BookingStatus, Client } from '../types/database'
import { TAXI_LANGS, type TaxiLang } from '../data/taxiShareI18n'
import { usePref, Segmented } from './taxiShareUI'

// Public read-only stay planning for the hotel restaurant manager:
// one timeline row per booking (guest name + arrival/departure), so she knows
// who leaves when and can collect restaurant bills before departure.
// Only reads bookings (dates/status) + clients identity columns — both already
// anon-readable (see security-rls.md). Cancelled bookings are excluded.

const CELL_W = 32 // px per day, same as the admin planning grid

type BookingRow = Booking & { client: Client | null }

const L = {
  title:          { pt: 'Estadias dos Hóspedes', en: 'Guest Stays' },
  subtitle:       { pt: 'Chegadas e partidas dos hóspedes do centro', en: 'Guest arrivals & departures' },
  departures:     { pt: 'Próximas partidas', en: 'Upcoming departures' },
  no_departures:  { pt: 'Nenhuma partida nos próximos dias', en: 'No departures in the next few days' },
  today:          { pt: 'Hoje', en: 'Today' },
  tomorrow:       { pt: 'Amanhã', en: 'Tomorrow' },
  no_bookings:    { pt: 'Sem estadias neste mês', en: 'No stays this month' },
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

const isoToday = () => new Date().toISOString().slice(0, 10)
const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
const fmtDay = (iso: string, lang: TaxiLang) =>
  new Date(iso + 'T00:00:00').toLocaleDateString(LOCALE[lang], { weekday: 'short', day: 'numeric', month: 'short' })

const guestName = (b: BookingRow) =>
  b.client ? `${b.client.first_name} ${b.client.last_name}` : `#${b.booking_number}`

export default function RestaurantSharePage() {
  const today = isoToday()
  const [lang, setLang] = usePref<TaxiLang>('restaurant_share_lang', 'pt')
  const [month, setMonth] = useState(() => today.slice(0, 7)) // 'YYYY-MM'

  const { data: allBookings, loading } = useTable<BookingRow>('bookings', {
    select: 'id, booking_number, check_in, check_out, status, client:clients(id, first_name, last_name)',
    order: 'check_in',
  })
  const bookings = allBookings.filter(b => b.status !== 'cancelled')

  const [year, mon] = month.split('-').map(Number)
  const daysInMonth = new Date(year, mon, 0).getDate()
  const monthStart = `${month}-01`
  const monthEnd = `${month}-${String(daysInMonth).padStart(2, '0')}`
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const rows = bookings
    .filter(b => b.check_in <= monthEnd && b.check_out >= monthStart)
    .sort((a, b) => a.check_in.localeCompare(b.check_in) || a.check_out.localeCompare(b.check_out))

  const shiftMonth = (delta: number) => {
    const d = new Date(year, mon - 1 + delta, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const monthLabel = new Date(year, mon - 1, 1).toLocaleDateString(LOCALE[lang], { month: 'long', year: 'numeric' })

  // Departures within the next 3 days, grouped by date
  const soonEnd = addDays(today, 3)
  const departuresSoon = bookings
    .filter(b => b.check_out >= today && b.check_out <= soonEnd)
    .sort((a, b) => a.check_out.localeCompare(b.check_out))
  const departuresByDate: Record<string, BookingRow[]> = {}
  for (const b of departuresSoon) (departuresByDate[b.check_out] ??= []).push(b)

  const dateLabel = (iso: string) =>
    iso === today ? L.today[lang] : iso === addDays(today, 1) ? L.tomorrow[lang] : fmtDay(iso, lang)

  const isWeekend = (day: number) => {
    const dow = new Date(year, mon - 1, day).getDay()
    return dow === 0 || dow === 6
  }
  const todayDay = today.slice(0, 7) === month ? parseInt(today.slice(8)) : null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🍽️</span>
            <div>
              <h1 className="text-2xl font-bold">{L.title[lang]}</h1>
              <p className="text-sm text-blue-200">{L.subtitle[lang]}</p>
            </div>
          </div>
          <Segmented value={lang} onChange={setLang}
            options={TAXI_LANGS.map(l => ({ v: l.code, label: `${l.flag} ${l.code.toUpperCase()}` }))} />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Upcoming departures */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-gray-800 mb-2">🧳 {L.departures[lang]}</h2>
          {departuresSoon.length === 0 ? (
            <p className="text-sm text-gray-400">{L.no_departures[lang]}</p>
          ) : (
            <div className="space-y-1">
              {Object.entries(departuresByDate).map(([date, list]) => (
                <div key={date} className="flex flex-wrap items-baseline gap-2 text-sm">
                  <span className={`font-semibold ${date === today ? 'text-red-600' : 'text-gray-700'}`}>
                    {dateLabel(date)}:
                  </span>
                  <span className="text-gray-600">{list.map(guestName).join(', ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => shiftMonth(-1)}
              className="px-3 py-1.5 bg-white border rounded-lg shadow-sm text-sm hover:bg-gray-50">‹</button>
            <span className="font-semibold text-gray-800 capitalize min-w-40 text-center">{monthLabel}</span>
            <button onClick={() => shiftMonth(1)}
              className="px-3 py-1.5 bg-white border rounded-lg shadow-sm text-sm hover:bg-gray-50">›</button>
          </div>
          <button onClick={() => setMonth(today.slice(0, 7))}
            className="px-3 py-1.5 bg-white border rounded-lg shadow-sm text-sm hover:bg-gray-50">
            {L.today[lang]}
          </button>
        </div>

        {/* Timeline */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">{L.loading[lang]}</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🛏️</p>
            <p className="text-lg font-medium">{L.no_bookings[lang]}</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <div style={{ width: 176 + daysInMonth * CELL_W }}>
              {/* Day header */}
              <div className="flex border-b border-gray-200">
                <div className="w-44 shrink-0 sticky left-0 bg-white z-10 border-r border-gray-200" />
                {days.map(d => (
                  <div key={d}
                    className={`w-8 shrink-0 text-center py-1 border-r border-gray-100 ${
                      d === todayDay ? 'bg-blue-100' : isWeekend(d) ? 'bg-gray-50' : ''}`}>
                    <div className="text-[10px] text-gray-400 leading-none">
                      {new Date(year, mon - 1, d).toLocaleDateString(LOCALE[lang], { weekday: 'narrow' })}
                    </div>
                    <div className={`text-xs font-medium ${d === todayDay ? 'text-blue-700' : 'text-gray-600'}`}>{d}</div>
                  </div>
                ))}
              </div>

              {/* Booking rows */}
              {rows.map(b => {
                const clippedStart = b.check_in < monthStart
                const clippedEnd = b.check_out > monthEnd
                const startDay = clippedStart ? 1 : parseInt(b.check_in.slice(8))
                const endDay = clippedEnd ? daysInMonth : parseInt(b.check_out.slice(8))
                const color = BAR_COLOR[b.status as Exclude<BookingStatus, 'cancelled'>]
                const tooltip = `${guestName(b)} — ${L.arrival[lang]} ${fmtDay(b.check_in, lang)} · ${L.departure[lang]} ${fmtDay(b.check_out, lang)} (${b.status === 'confirmed' ? L.confirmed[lang] : L.provisional[lang]})`
                return (
                  <div key={b.id} className="flex border-b border-gray-100 last:border-b-0">
                    <div className="w-44 shrink-0 sticky left-0 bg-white z-10 border-r border-gray-200 px-3 py-1.5">
                      <div className="text-sm font-medium text-gray-800 truncate" title={tooltip}>{guestName(b)}</div>
                      <div className="text-[11px] text-gray-400">
                        {fmtDay(b.check_in, lang)} → {fmtDay(b.check_out, lang)}
                      </div>
                    </div>
                    <div className="relative h-11 shrink-0" style={{ width: daysInMonth * CELL_W }}>
                      {/* day grid background */}
                      <div className="absolute inset-0 flex">
                        {days.map(d => (
                          <div key={d} className={`w-8 shrink-0 border-r border-gray-100 ${
                            d === todayDay ? 'bg-blue-50' : isWeekend(d) ? 'bg-gray-50' : ''}`} />
                        ))}
                      </div>
                      {/* stay bar */}
                      <div title={tooltip}
                        className={`absolute top-2 bottom-2 flex items-center overflow-hidden ${color.bar} ${
                          clippedStart ? '' : 'rounded-l-md'} ${clippedEnd ? '' : 'rounded-r-md'}`}
                        style={{ left: (startDay - 1) * CELL_W, width: (endDay - startDay + 1) * CELL_W }}>
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
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
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
      </div>
    </div>
  )
}
