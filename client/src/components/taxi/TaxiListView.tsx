import { useState } from 'react'
import type { TaxiTrip, TaxiDriver } from '../../types/database'
import { mockTaxiDrivers, mockBookings } from '../../data/mock'

function guestName(bookingId: string | null): string {
  if (!bookingId) return '—'
  const b = mockBookings.find(b => b.id === bookingId)
  return b?.client ? `${b.client.first_name} ${b.client.last_name}` : '—'
}

const TRIP_TYPE_LABELS: Record<string, string> = {
  'aero-to-center': '✈️ Aéro → Centre',
  'center-to-aero': '🏠 Centre → Aéro',
  'aero-to-spot': '✈️ Aéro → Spot',
  'spot-to-aero': '🏄 Spot → Aéro',
  'center-to-town': '🏠 Centre → Ville',
  'town-to-center': '🏢 Ville → Centre',
  'other': '❓ Autre',
}

const TRIP_TYPE_VALUES = Object.keys(TRIP_TYPE_LABELS)

function newId(prefix: string): string {
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 6)}`
}

interface EditingCell {
  tripId: string
  field: string
}

interface TaxiListViewProps {
  trips: TaxiTrip[]
  drivers: TaxiDriver[]
  onTripsChange: (fn: (prev: TaxiTrip[]) => TaxiTrip[]) => void
}

export default function TaxiListView({ trips, drivers, onTripsChange }: TaxiListViewProps) {
  const [sortBy, setSortBy] = useState<'date' | 'driver' | 'type'>('date')
  const [filterDriver, setFilterDriver] = useState<string>('all')
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [editValue, setEditValue] = useState<string>('')

  // Sorting & filtering
  const sortedTrips = [...trips]
    .filter(t => filterDriver === 'all' || t.taxi_driver_id === filterDriver || (filterDriver === 'unassigned' && !t.taxi_driver_id))
    .sort((a, b) => {
      if (sortBy === 'date') {
        return `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`)
      } else if (sortBy === 'driver') {
        const driverA = a.taxi_driver_id ? drivers.find(d => d.id === a.taxi_driver_id)?.name : 'zzz_unassigned'
        const driverB = b.taxi_driver_id ? drivers.find(d => d.id === b.taxi_driver_id)?.name : 'zzz_unassigned'
        return (driverA || '').localeCompare(driverB || '')
      } else {
        return a.type.localeCompare(b.type)
      }
    })

  function deleteTrip(id: string) {
    if (confirm('Supprimer ce trajet ?')) {
      onTripsChange(prev => prev.filter(t => t.id !== id))
    }
  }

  function addNewTrip() {
    const newTrip: TaxiTrip = {
      id: newId('trp'),
      date: new Date().toISOString().slice(0, 10),
      start_time: '10:00',
      type: 'aero-to-center',
      taxi_driver_id: null,
      booking_id: null,
      nb_persons: 1,
      nb_luggage: 0,
      nb_boardbags: 0,
      notes: null,
      price_paid_by_client: 50,
      price_cost_to_driver: 35,
      taxi_manager_margin: 5,
      center_margin: 10,
    }
    onTripsChange(prev => [...prev, newTrip])
  }

  function startEditing(tripId: string, field: string, currentValue: any) {
    setEditingCell({ tripId, field })
    setEditValue(String(currentValue))
  }

  function saveEdit(tripId: string) {
    const trip = trips.find(t => t.id === tripId)
    if (!trip || !editingCell) return

    const field = editingCell.field as keyof TaxiTrip
    let newValue: any = editValue

    // Type coercion
    if (['nb_persons', 'nb_luggage', 'nb_boardbags', 'price_paid_by_client', 'price_cost_to_driver', 'taxi_manager_margin'].includes(field)) {
      newValue = parseFloat(newValue) || 0
    }

    onTripsChange(prev => prev.map(t =>
      t.id === tripId
        ? {
            ...t,
            [field]: newValue,
            // Auto-recalculate center_margin
            center_margin: field === 'price_paid_by_client' || field === 'price_cost_to_driver' || field === 'taxi_manager_margin'
              ? (field === 'price_paid_by_client' ? parseFloat(newValue) : trip.price_paid_by_client) -
                (field === 'price_cost_to_driver' ? parseFloat(newValue) : trip.price_cost_to_driver) -
                (field === 'taxi_manager_margin' ? parseFloat(newValue) : trip.taxi_manager_margin)
              : trip.center_margin,
          }
        : t
    ))
    setEditingCell(null)
    setEditValue('')
  }

  // Totals
  const totalClientPrice = sortedTrips.reduce((sum, t) => sum + t.price_paid_by_client, 0)
  const totalCenterMargin = sortedTrips.reduce((sum, t) => sum + t.center_margin, 0)
  const totalDriverCost = sortedTrips.reduce((sum, t) => sum + t.price_cost_to_driver, 0)
  const totalManagerMargin = sortedTrips.reduce((sum, t) => sum + t.taxi_manager_margin, 0)


  return (
    <>
      {/* Summary */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <p className="text-sm text-blue-600 font-medium">CA Total</p>
          <p className="text-2xl font-bold text-blue-900">{totalClientPrice}€</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
          <p className="text-sm text-amber-600 font-medium">Coût Drivers</p>
          <p className="text-2xl font-bold text-amber-900">{totalDriverCost}€</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <p className="text-sm text-purple-600 font-medium">Marge Responsable</p>
          <p className="text-2xl font-bold text-purple-900">{totalManagerMargin}€</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <p className="text-sm text-green-600 font-medium">Marge Centre</p>
          <p className="text-2xl font-bold text-green-900">{totalCenterMargin}€</p>
        </div>
        <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
          <p className="text-sm text-indigo-600 font-medium">Total Trajets</p>
          <p className="text-2xl font-bold text-indigo-900">{sortedTrips.length}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 items-start md:items-center">
        <div className="flex gap-2">
          <label className="text-sm font-medium text-gray-700">Trier par :</label>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="text-sm border rounded px-3 py-1.5 bg-white"
          >
            <option value="date">Date/Heure</option>
            <option value="driver">Chauffeur</option>
            <option value="type">Type de trajet</option>
          </select>
        </div>

        <div className="flex gap-2">
          <label className="text-sm font-medium text-gray-700">Filtrer :</label>
          <select
            value={filterDriver}
            onChange={e => setFilterDriver(e.target.value)}
            className="text-sm border rounded px-3 py-1.5 bg-white"
          >
            <option value="all">Tous</option>
            <option value="unassigned">À assigner</option>
            {mockTaxiDrivers.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div className="ml-auto">
          <button
            onClick={addNewTrip}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm transition-colors"
          >
            + Ajouter trajet
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Date</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Heure</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Type</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Taxi</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Booking</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Guest</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">Pers</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">Bag</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">BB</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">Client €</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">Driver €</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">Manager €</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">Centre €</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 max-w-[120px]">Notes</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedTrips.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-4 py-8 text-center text-gray-500 italic">
                    Aucun trajet
                  </td>
                </tr>
              ) : (
                sortedTrips.map(trip => (
                  <tr key={trip.id} className="border-b hover:bg-blue-50 transition-colors">
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={trip.date}
                        onChange={e => {
                          startEditing(trip.id, 'date', trip.date)
                          setEditValue(e.target.value)
                          setTimeout(() => saveEdit(trip.id), 0)
                        }}
                        className="px-2 py-1 text-xs border border-transparent hover:border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="time"
                        value={trip.start_time}
                        onChange={e => {
                          startEditing(trip.id, 'start_time', trip.start_time)
                          setEditValue(e.target.value)
                          setTimeout(() => saveEdit(trip.id), 0)
                        }}
                        className="px-2 py-1 text-xs border border-transparent hover:border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={trip.type}
                        onChange={e => {
                          startEditing(trip.id, 'type', trip.type)
                          setEditValue(e.target.value)
                          setTimeout(() => saveEdit(trip.id), 0)
                        }}
                        className="px-2 py-1 text-xs border border-transparent hover:border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      >
                        {TRIP_TYPE_VALUES.map(t => (
                          <option key={t} value={t}>{TRIP_TYPE_LABELS[t]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={trip.taxi_driver_id || ''}
                        onChange={e => {
                          startEditing(trip.id, 'taxi_driver_id', trip.taxi_driver_id)
                          setEditValue(e.target.value || '')
                          setTimeout(() => saveEdit(trip.id), 0)
                        }}
                        className="px-2 py-1 text-xs border border-transparent hover:border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value="">Non assigné</option>
                        {drivers.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={trip.booking_id || ''}
                        onChange={e => {
                          startEditing(trip.id, 'booking_id', trip.booking_id)
                          setEditValue(e.target.value || '')
                          setTimeout(() => saveEdit(trip.id), 0)
                        }}
                        placeholder="—"
                        className="px-2 py-1 text-xs border border-transparent hover:border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer w-full"
                      />
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap">
                      {guestName(trip.booking_id)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min="1"
                        value={trip.nb_persons}
                        onChange={e => {
                          startEditing(trip.id, 'nb_persons', trip.nb_persons)
                          setEditValue(e.target.value)
                          setTimeout(() => saveEdit(trip.id), 0)
                        }}
                        className="px-2 py-1 text-xs border border-transparent hover:border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer w-full text-center"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min="0"
                        value={trip.nb_luggage}
                        onChange={e => {
                          startEditing(trip.id, 'nb_luggage', trip.nb_luggage)
                          setEditValue(e.target.value)
                          setTimeout(() => saveEdit(trip.id), 0)
                        }}
                        className="px-2 py-1 text-xs border border-transparent hover:border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer w-full text-center"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min="0"
                        value={trip.nb_boardbags}
                        onChange={e => {
                          startEditing(trip.id, 'nb_boardbags', trip.nb_boardbags)
                          setEditValue(e.target.value)
                          setTimeout(() => saveEdit(trip.id), 0)
                        }}
                        className="px-2 py-1 text-xs border border-transparent hover:border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer w-full text-center"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={trip.price_paid_by_client}
                        onChange={e => {
                          startEditing(trip.id, 'price_paid_by_client', trip.price_paid_by_client)
                          setEditValue(e.target.value)
                          setTimeout(() => saveEdit(trip.id), 0)
                        }}
                        className="px-2 py-1 text-xs border border-transparent hover:border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer w-full text-right font-semibold text-blue-900"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={trip.price_cost_to_driver}
                        onChange={e => {
                          startEditing(trip.id, 'price_cost_to_driver', trip.price_cost_to_driver)
                          setEditValue(e.target.value)
                          setTimeout(() => saveEdit(trip.id), 0)
                        }}
                        className="px-2 py-1 text-xs border border-transparent hover:border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer w-full text-right font-semibold text-amber-900"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={trip.taxi_manager_margin}
                        onChange={e => {
                          startEditing(trip.id, 'taxi_manager_margin', trip.taxi_manager_margin)
                          setEditValue(e.target.value)
                          setTimeout(() => saveEdit(trip.id), 0)
                        }}
                        className="px-2 py-1 text-xs border border-transparent hover:border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer w-full text-right font-semibold text-purple-900"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-green-900">
                      {trip.center_margin}€
                    </td>
                    <td className="px-3 py-2 max-w-[120px] truncate">
                      <input
                        type="text"
                        value={trip.notes || ''}
                        onChange={e => {
                          startEditing(trip.id, 'notes', trip.notes)
                          setEditValue(e.target.value || '')
                          setTimeout(() => saveEdit(trip.id), 0)
                        }}
                        placeholder="—"
                        className="px-2 py-1 text-xs border border-transparent hover:border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer w-full"
                      />
                    </td>
                    <td className="px-3 py-2 text-center space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => deleteTrip(trip.id)}
                        className="text-red-600 hover:text-red-800 font-medium text-sm"
                        title="Supprimer"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
