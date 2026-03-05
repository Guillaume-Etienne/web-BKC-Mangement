import { useState } from 'react'
import { useTable } from '../hooks/useSupabase'
import type { TaxiTrip, TaxiDriver, Booking, Client } from '../types/database'

const TRIP_TYPE_LABELS: Record<string, string> = {
  'aero-to-center': '✈️ Aéro → Centre',
  'center-to-aero': '🏠 Centre → Aéro',
  'aero-to-spot':   '✈️ Aéro → Spot',
  'spot-to-aero':   '🏄 Spot → Aéro',
  'center-to-town': '🏠 Centre → Ville',
  'town-to-center': '🏢 Ville → Centre',
  'other':          '❓ Autre',
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export default function TaxiSharePage() {
  const today = new Date().toISOString().slice(0, 10)
  const [showPast, setShowPast] = useState(false)
  const [filterDriver, setFilterDriver] = useState<string>('all')

  const { data: allTrips,   loading: tripsLoading   } = useTable<TaxiTrip>('taxi_trips',   { order: 'date' })
  const { data: allDrivers                           } = useTable<TaxiDriver>('taxi_drivers', { order: 'name' })
  const { data: allBookings                          } = useTable<Booking & { client: Client | null }>('bookings', { select: 'id, client_id, client:clients(first_name, last_name)' })

  function guestName(bookingId: string | null): string {
    if (!bookingId) return ''
    const b = allBookings.find(b => b.id === bookingId)
    return b?.client ? `${b.client.first_name} ${b.client.last_name}` : ''
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
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center gap-3">
          <span className="text-3xl">🚕</span>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Planning Taxis</h1>
            <p className="text-sm text-gray-500">Mis à jour en temps réel · Aucune information financière</p>
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
            <option value="all">Tous les chauffeurs</option>
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
            Afficher les trajets passés
          </label>

          <span className="text-sm text-gray-400 ml-auto">
            {filtered.length} trajet{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Trip list by date */}
        {tripsLoading ? (
          <div className="text-center py-16 text-gray-400">Chargement…</div>
        ) : Object.keys(byDate).length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🚕</p>
            <p className="text-lg font-medium">Aucun trajet à venir</p>
            {!showPast && (
              <p className="text-sm mt-1">
                <button onClick={() => setShowPast(true)} className="text-blue-500 underline">
                  Afficher les trajets passés
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
                  {date === today ? '📍 Aujourd\'hui' : fmtDate(date)}
                </div>
                <div className="flex-1 border-t border-gray-200" />
                <span className="text-xs text-gray-400">{trips.length} trajet{trips.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Trip cards */}
              <div className="space-y-2">
                {trips.map(trip => {
                  const driver = allDrivers.find(d => d.id === trip.taxi_driver_id)
                  const guest  = guestName(trip.booking_id)

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
                              {TRIP_TYPE_LABELS[trip.type] ?? trip.type}
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
                            <div className="text-sm font-semibold text-red-500 italic">Non assigné</div>
                          )}
                          <div className="text-xs text-gray-500 mt-0.5">
                            👥 {trip.nb_persons} pers.
                            {trip.nb_luggage > 0 && ` · 🧳 ${trip.nb_luggage}`}
                            {trip.nb_boardbags > 0 && ` · 🏄 ${trip.nb_boardbags} bb`}
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
