import { useState } from 'react'
import type { TaxiTrip, TaxiDriver } from '../../types/database'
import { mockBookings } from '../../data/mock'

function guestName(bookingId: string | null): string {
  if (!bookingId) return '—'
  const b = mockBookings.find(b => b.id === bookingId)
  return b?.client ? `${b.client.first_name} ${b.client.last_name}` : '—'
}

const TRIP_TYPE_LABELS: Record<string, string> = {
  'aero-to-center': '✈️ Aéro → Centre',
  'center-to-aero': '🏠 Centre → Aéro',
  'aero-to-spot':   '✈️ Aéro → Spot',
  'spot-to-aero':   '🏄 Spot → Aéro',
  'center-to-town': '🏠 Centre → Ville',
  'town-to-center': '🏢 Ville → Centre',
  'other':          '❓ Autre',
}

// ── Edit modal — module scope to avoid focus loss on re-render ──────────────
interface EditModalProps {
  trip: TaxiTrip
  drivers: TaxiDriver[]
  onChange: (data: Partial<TaxiTrip>) => void
  onSave: () => void
  onDelete: () => void
  onClose: () => void
}

function EditModal({ trip, drivers, onChange, onSave, onDelete, onClose }: EditModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold text-lg text-gray-800">Modifier trajet taxi</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 font-bold text-xl">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
              <input type="date" value={trip.date}
                onChange={e => onChange({ date: e.target.value })}
                className="w-full text-sm border rounded px-2 py-1.5" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Heure *</label>
              <input type="time" value={trip.start_time}
                onChange={e => onChange({ start_time: e.target.value })}
                className="w-full text-sm border rounded px-2 py-1.5" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
              <select value={trip.type}
                onChange={e => onChange({ type: e.target.value as TaxiTrip['type'] })}
                className="w-full text-sm border rounded px-2 py-1.5">
                {Object.entries(TRIP_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Taxi</label>
              <select value={trip.taxi_driver_id || ''}
                onChange={e => onChange({ taxi_driver_id: e.target.value || null })}
                className="w-full text-sm border rounded px-2 py-1.5">
                <option value="">Non assigné</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Réservation</label>
              <input type="text" placeholder="ex: bk1" value={trip.booking_id || ''}
                onChange={e => onChange({ booking_id: e.target.value || null })}
                className="w-full text-sm border rounded px-2 py-1.5" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Personnes</label>
              <input type="number" min="1" value={trip.nb_persons}
                onChange={e => onChange({ nb_persons: parseInt(e.target.value) || 1 })}
                className="w-full text-sm border rounded px-2 py-1.5" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bagages</label>
              <input type="number" min="0" value={trip.nb_luggage}
                onChange={e => onChange({ nb_luggage: parseInt(e.target.value) || 0 })}
                className="w-full text-sm border rounded px-2 py-1.5" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Boardbags</label>
              <input type="number" min="0" value={trip.nb_boardbags}
                onChange={e => onChange({ nb_boardbags: parseInt(e.target.value) || 0 })}
                className="w-full text-sm border rounded px-2 py-1.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea value={trip.notes || ''}
              onChange={e => onChange({ notes: e.target.value || null })}
              className="w-full text-sm border rounded px-2 py-1.5" rows={2} />
          </div>

          <div className="grid grid-cols-3 gap-4 bg-gray-50 p-3 rounded border border-gray-200">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Prix Client (€)</label>
              <input type="number" min="0" step="0.01" value={trip.price_paid_by_client}
                onChange={e => onChange({ price_paid_by_client: parseFloat(e.target.value) || 0 })}
                className="w-full text-sm border rounded px-2 py-1.5 font-semibold text-blue-900" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Coût Driver (€)</label>
              <input type="number" min="0" step="0.01" value={trip.price_cost_to_driver}
                onChange={e => onChange({ price_cost_to_driver: parseFloat(e.target.value) || 0 })}
                className="w-full text-sm border rounded px-2 py-1.5 font-semibold text-amber-900" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Marge Centre (€)</label>
              <div className="w-full text-sm border rounded px-2 py-1.5 font-semibold text-green-900 bg-white">
                {Math.max(0, trip.price_paid_by_client - trip.price_cost_to_driver - trip.taxi_manager_margin)}€
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 p-4 border-t">
          <button onClick={onDelete}
            className="px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded font-medium text-sm">
            🗑️ Supprimer
          </button>
          <button onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded font-medium text-sm">
            Annuler
          </button>
          <button onClick={onSave}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────

interface TaxiListViewProps {
  trips: TaxiTrip[]
  drivers: TaxiDriver[]
  onAddTrip:    (trip: Omit<TaxiTrip, 'id'>) => Promise<TaxiTrip | null>
  onUpdateTrip: (trip: TaxiTrip) => Promise<void>
  onDeleteTrip: (id: string) => Promise<void>
}

export default function TaxiListView({ trips, drivers, onAddTrip, onUpdateTrip, onDeleteTrip }: TaxiListViewProps) {
  const [sortBy, setSortBy]           = useState<'date' | 'driver' | 'type'>('date')
  const [filterDriver, setFilterDriver] = useState<string>('all')
  const [editTrip, setEditTrip]       = useState<TaxiTrip | null>(null)

  const sortedTrips = [...trips]
    .filter(t => filterDriver === 'all' || t.taxi_driver_id === filterDriver || (filterDriver === 'unassigned' && !t.taxi_driver_id))
    .sort((a, b) => {
      if (sortBy === 'date')   return `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`)
      if (sortBy === 'driver') {
        const dA = a.taxi_driver_id ? drivers.find(d => d.id === a.taxi_driver_id)?.name ?? 'zzz' : 'zzz'
        const dB = b.taxi_driver_id ? drivers.find(d => d.id === b.taxi_driver_id)?.name ?? 'zzz' : 'zzz'
        return dA.localeCompare(dB)
      }
      return a.type.localeCompare(b.type)
    })

  async function addNewTrip() {
    const created = await onAddTrip({
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
    })
    if (created) setEditTrip(created)
  }

  function handleEditChange(data: Partial<TaxiTrip>) {
    if (!editTrip) return
    const updated = { ...editTrip, ...data }
    updated.center_margin = updated.price_paid_by_client - updated.price_cost_to_driver - updated.taxi_manager_margin
    setEditTrip(updated)
  }

  async function handleSave() {
    if (!editTrip) return
    await onUpdateTrip(editTrip)
    setEditTrip(null)
  }

  async function handleDelete() {
    if (!editTrip) return
    if (confirm('Supprimer ce trajet ?')) {
      await onDeleteTrip(editTrip.id)
      setEditTrip(null)
    }
  }

  // Totals
  const totalClientPrice   = sortedTrips.reduce((s, t) => s + t.price_paid_by_client, 0)
  const totalCenterMargin  = sortedTrips.reduce((s, t) => s + t.center_margin, 0)
  const totalDriverCost    = sortedTrips.reduce((s, t) => s + t.price_cost_to_driver, 0)
  const totalManagerMargin = sortedTrips.reduce((s, t) => s + t.taxi_manager_margin, 0)

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
        <div className="flex gap-2 items-center">
          <label className="text-sm font-medium text-gray-700">Trier :</label>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="text-sm border rounded px-3 py-1.5 bg-white">
            <option value="date">Date/Heure</option>
            <option value="driver">Chauffeur</option>
            <option value="type">Type</option>
          </select>
        </div>
        <div className="flex gap-2 items-center">
          <label className="text-sm font-medium text-gray-700">Filtrer :</label>
          <select value={filterDriver} onChange={e => setFilterDriver(e.target.value)}
            className="text-sm border rounded px-3 py-1.5 bg-white">
            <option value="all">Tous</option>
            <option value="unassigned">À assigner</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="ml-auto">
          <button onClick={addNewTrip}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm">
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
                <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Guest</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">Pers</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">Bag</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">BB</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">Client €</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">Driver €</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">Centre €</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Notes</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-700">✏️</th>
              </tr>
            </thead>
            <tbody>
              {sortedTrips.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-gray-500 italic">Aucun trajet</td>
                </tr>
              ) : sortedTrips.map(trip => {
                const driver = drivers.find(d => d.id === trip.taxi_driver_id)
                return (
                  <tr key={trip.id} className="border-b hover:bg-blue-50 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-800">{trip.date}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-800">{trip.start_time}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">{TRIP_TYPE_LABELS[trip.type]}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{driver?.name ?? <span className="text-red-400 italic">Non assigné</span>}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap">{guestName(trip.booking_id)}</td>
                    <td className="px-3 py-2 text-center text-gray-800">{trip.nb_persons}</td>
                    <td className="px-3 py-2 text-center text-gray-800">{trip.nb_luggage}</td>
                    <td className="px-3 py-2 text-center text-gray-800">{trip.nb_boardbags}</td>
                    <td className="px-3 py-2 text-right font-semibold text-blue-900">{trip.price_paid_by_client}€</td>
                    <td className="px-3 py-2 text-right font-semibold text-amber-900">{trip.price_cost_to_driver}€</td>
                    <td className="px-3 py-2 text-right font-semibold text-green-900">{trip.center_margin}€</td>
                    <td className="px-3 py-2 text-xs text-gray-500 max-w-[120px] truncate">{trip.notes ?? '—'}</td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => setEditTrip(trip)}
                        className="text-blue-600 hover:text-blue-800 text-sm px-2 py-1 rounded hover:bg-blue-50"
                        title="Éditer">
                        ✏️
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit modal */}
      {editTrip && (
        <EditModal
          trip={editTrip}
          drivers={drivers}
          onChange={handleEditChange}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditTrip(null)}
        />
      )}
    </>
  )
}
