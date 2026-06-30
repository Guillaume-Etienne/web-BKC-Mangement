import { useState } from 'react'
import { useTable } from '../hooks/useSupabase'
import type { TaxiTrip, TaxiDriver, Booking, Client } from '../types/database'
import {
  tr, TAXI_LANGS, tripTypeLabel, fmt, formatTripDate,
  type TaxiLang, type DateMode,
} from '../data/taxiShareI18n'
import { usePref, Segmented } from './taxiShareUI'

export default function TaxiSharePage() {
  const today = new Date().toISOString().slice(0, 10)
  const [showPast, setShowPast] = useState(false)
  const [filterDriver, setFilterDriver] = useState<string>('all')

  const [lang,     setLang]     = usePref<TaxiLang>('taxi_share_lang', 'pt')
  const [dateMode, setDateMode] = usePref<DateMode>('taxi_share_datemode', 'readable')

  const { data: allTrips,   loading: tripsLoading   } = useTable<TaxiTrip>('taxi_trips',   { order: 'date' })
  const { data: allDrivers                           } = useTable<TaxiDriver>('taxi_drivers', { order: 'name' })
  const { data: allBookings                          } = useTable<Booking & { client: Client | null }>('bookings', { select: 'id, client_id, client:clients(first_name, last_name)' })

  function guestName(bookingId: string | null): string {
    if (!bookingId) return ''
    const b = allBookings.find(b => b.id === bookingId)
    return b?.client ? `${b.client.first_name} ${b.client.last_name}` : ''
  }

  /** Free seats for a trip: vehicle capacity − occupants. null if no driver assigned yet. */
  function freeSeatsLabel(trip: TaxiTrip): string | null {
    const driver = allDrivers.find(d => d.id === trip.taxi_driver_id)
    if (!driver) return null
    const free = driver.seats - trip.nb_persons
    return free > 0 ? fmt(tr.seats_free[lang], { n: free }) : tr.seats_full[lang]
  }

  const filtered = allTrips
    .filter(t => showPast || t.date >= today)
    .filter(t => filterDriver === 'all' || t.taxi_driver_id === filterDriver)
    .sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`))

  // Group by date
  const byDate: Record<string, typeof filtered> = {}
  for (const t of filtered) {
    if (!byDate[t.date]) byDate[t.date] = []
    byDate[t.date].push(t)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🚕</span>
            <div>
              <h1 className="text-2xl font-bold">{tr.public_title[lang]}</h1>
              <p className="text-sm text-blue-200">{tr.public_sub[lang]}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Segmented value={lang} onChange={setLang}
              options={TAXI_LANGS.map(l => ({ v: l.code, label: `${l.flag} ${l.code.toUpperCase()}` }))} />
            <Segmented value={dateMode} onChange={setDateMode}
              options={[{ v: 'readable', label: '📅 Seg 30/06' }, { v: 'iso', label: '2026-06-30' }]} />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={filterDriver}
            onChange={e => setFilterDriver(e.target.value)}
            className="text-sm border rounded-lg px-3 py-2 bg-white shadow-sm"
          >
            <option value="all">{tr.filter_all_drivers[lang]}</option>
            {allDrivers.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showPast}
              onChange={e => setShowPast(e.target.checked)}
              className="rounded"
            />
            {tr.show_past[lang]}
          </label>

          <span className="text-sm text-gray-400 ml-auto">
            {fmt(tr.trips_all[lang], { count: filtered.length })}
          </span>
        </div>

        {/* Trip list by date */}
        {tripsLoading ? (
          <div className="text-center py-16 text-gray-400">{tr.loading[lang]}</div>
        ) : Object.keys(byDate).length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🚕</p>
            <p className="text-lg font-medium">{tr.no_upcoming[lang]}</p>
            {!showPast && (
              <p className="text-sm mt-1">
                <button onClick={() => setShowPast(true)} className="text-blue-500 underline">
                  {tr.show_past[lang]}
                </button>
              </p>
            )}
          </div>
        ) : (
          Object.entries(byDate).map(([date, trips]) => (
            <div key={date}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  date === today
                    ? 'bg-blue-600 text-white'
                    : date < today
                    ? 'bg-gray-200 text-gray-500'
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {date === today ? `📍 ${tr.today[lang]}` : formatTripDate(date, lang, dateMode)}
                </div>
                <div className="flex-1 border-t border-gray-200" />
                <span className="text-xs text-gray-400">{fmt(tr.trips_all[lang], { count: trips.length })}</span>
              </div>

              {/* Trip cards */}
              <div className="space-y-2">
                {trips.map(trip => {
                  const driver = allDrivers.find(d => d.id === trip.taxi_driver_id)
                  const guest  = guestName(trip.booking_id)
                  const seats  = freeSeatsLabel(trip)

                  return (
                    <div key={trip.id}
                      className={`bg-white rounded-lg border shadow-sm p-4 ${
                        date < today ? 'opacity-60' : ''
                      }`}>
                      <div className="flex items-start justify-between gap-4">
                        {/* Left: time + type */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="text-xl font-bold text-gray-800 whitespace-nowrap">
                            {trip.start_time}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 text-sm">
                              {tripTypeLabel(trip.type, lang)}
                            </div>
                            {guest && (
                              <div className="text-xs text-gray-600 mt-0.5">👤 {guest}</div>
                            )}
                          </div>
                        </div>

                        {/* Right: driver + logistics */}
                        <div className="text-right shrink-0">
                          {driver ? (
                            <div className="text-sm font-semibold text-blue-700">🚕 {driver.name}</div>
                          ) : (
                            <div className="text-sm font-semibold text-red-500 italic">{tr.unassigned[lang]}</div>
                          )}
                          <div className="text-xs text-gray-500 mt-0.5">
                            👥 {trip.nb_persons} {tr.unit_pax[lang]}
                            {trip.nb_luggage > 0 && ` · 🧳 ${trip.nb_luggage}`}
                            {trip.nb_boardbags > 0 && ` · 🏄 ${trip.nb_boardbags}`}
                          </div>
                          {/* Free seats (— until a driver is assigned) */}
                          <div className="text-xs font-medium mt-0.5 text-emerald-700">
                            🪑 {seats ?? '—'}
                          </div>
                        </div>
                      </div>

                      {trip.notes && (
                        <div className="mt-2 pt-2 border-t text-xs text-gray-500 italic">
                          💬 {trip.notes}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
