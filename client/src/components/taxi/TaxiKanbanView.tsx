import { useState } from 'react'
import type { TaxiTrip, TaxiDriver } from '../../types/database'
import { mockClients, mockTaxiDrivers, mockBookings } from '../../data/mock'

function guestName(bookingId: string | null): string {
  if (!bookingId) return ''
  const b = mockBookings.find(b => b.id === bookingId)
  return b?.client ? `${b.client.first_name} ${b.client.last_name}` : ''
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

function newId(prefix: string): string {
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 6)}`
}

interface EditFormState {
  trip: TaxiTrip
  data: Partial<TaxiTrip>
}

interface TaxiKanbanViewProps {
  trips: TaxiTrip[]
  drivers: TaxiDriver[]
  onTripsChange: (fn: (prev: TaxiTrip[]) => TaxiTrip[]) => void
}

export default function TaxiKanbanView({ trips, drivers, onTripsChange }: TaxiKanbanViewProps) {
  const [editForm, setEditForm] = useState<EditFormState | null>(null)
  const [draggedTrip, setDraggedTrip] = useState<{ id: string; fromDriverId: string | null } | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  // Columns: "À assigner" + one per driver
  const assignedColumns = ['unassigned' as const, ...drivers.map(d => d.id)]

  function getTripsForDriver(driverId: string | 'unassigned'): TaxiTrip[] {
    if (driverId === 'unassigned') {
      return trips.filter(t => t.taxi_driver_id === null).sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`))
    }
    return trips.filter(t => t.taxi_driver_id === driverId).sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`))
  }

  function openEdit(trip: TaxiTrip) {
    setEditForm({ trip, data: { ...trip } })
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editForm) return
    onTripsChange(prev => prev.map(t => t.id === editForm.trip.id ? { ...t, ...editForm.data } : t))
    setEditForm(null)
  }

  function deleteTrip(id: string) {
    if (confirm('Supprimer ce trajet ?')) {
      onTripsChange(prev => prev.filter(t => t.id !== id))
    }
  }

  function addNewTrip(driverId: string | null) {
    const newTrip: TaxiTrip = {
      id: newId('trp'),
      date: new Date().toISOString().slice(0, 10),
      start_time: '10:00',
      type: 'aero-to-center',
      taxi_driver_id: driverId === 'unassigned' ? null : driverId,
      booking_id: mockClients[0]?.id ? `bk1` : null,
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
    openEdit(newTrip)
  }

  function handleDragStart(trip: TaxiTrip) {
    setDraggedTrip({ id: trip.id, fromDriverId: trip.taxi_driver_id })
  }

  function handleDragOver(e: React.DragEvent, driverId: string | null) {
    e.preventDefault()
    setDropTarget(driverId === null ? 'unassigned' : driverId)
  }

  function handleDrop(e: React.DragEvent, driverId: string | null) {
    e.preventDefault()
    if (!draggedTrip) return
    onTripsChange(prev => prev.map(t =>
      t.id === draggedTrip.id ? { ...t, taxi_driver_id: driverId } : t
    ))
    setDraggedTrip(null)
    setDropTarget(null)
  }

  function handleDragEnd() {
    setDraggedTrip(null)
    setDropTarget(null)
  }

  // Totals
  const totalClientPrice = trips.reduce((sum, t) => sum + t.price_paid_by_client, 0)
  const totalCenterMargin = trips.reduce((sum, t) => sum + t.center_margin, 0)
  const totalDriverCost = trips.reduce((sum, t) => sum + t.price_cost_to_driver, 0)

  return (
    <>
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <p className="text-sm text-blue-600 font-medium">CA Total</p>
          <p className="text-2xl font-bold text-blue-900">{totalClientPrice}€</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <p className="text-sm text-green-600 font-medium">Marge Centre</p>
          <p className="text-2xl font-bold text-green-900">{totalCenterMargin}€</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
          <p className="text-sm text-amber-600 font-medium">Coût Drivers</p>
          <p className="text-2xl font-bold text-amber-900">{totalDriverCost}€</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <p className="text-sm text-purple-600 font-medium">Total Trajets</p>
          <p className="text-2xl font-bold text-purple-900">{trips.length}</p>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-6">
        {assignedColumns.map(colId => {
          const isUnassigned = colId === 'unassigned'
          const driver = isUnassigned ? null : drivers.find(d => d.id === colId)
          const columnTrips = getTripsForDriver(colId)
          const isDropping = dropTarget === colId

          return (
            <div
              key={colId}
              className={`flex-shrink-0 w-96 bg-white rounded-lg border-2 flex flex-col ${
                isDropping ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
              }`}
            >
              {/* Column header */}
              <div className={`px-4 py-3 border-b font-semibold ${
                isUnassigned ? 'bg-gray-100 text-gray-700' : 'bg-blue-50 text-blue-900'
              }`}>
                <div className="flex justify-between items-center">
                  <span>
                    {isUnassigned ? '📋 À assigner' : `🚕 ${driver?.name}`}
                  </span>
                  <span className="text-sm font-normal text-gray-600">
                    {columnTrips.length} trajet{columnTrips.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {!isUnassigned && driver && (
                  <div className="text-xs text-gray-600 mt-1">
                    {driver.phone && <p>📞 {driver.phone}</p>}
                    {driver.vehicle && <p>🚗 {driver.vehicle}</p>}
                    <p>Marge: {driver.margin_percent}%</p>
                  </div>
                )}
              </div>

              {/* Column content */}
              <div
                className={`flex-1 p-3 space-y-2 overflow-y-auto min-h-96 ${
                  isDropping ? 'bg-blue-50' : ''
                }`}
                onDragOver={(e) => handleDragOver(e, isUnassigned ? null : colId)}
                onDragLeave={() => setDropTarget(null)}
                onDrop={(e) => handleDrop(e, isUnassigned ? null : colId)}
              >
                {columnTrips.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4 italic">Aucun trajet</p>
                ) : (
                  columnTrips.map(trip => {
                    const isDragging = draggedTrip?.id === trip.id
                    const driverMargin = Math.round((trip.price_cost_to_driver / trip.price_paid_by_client) * 100)

                    return (
                      <div
                        key={trip.id}
                        draggable
                        onDragStart={() => handleDragStart(trip)}
                        onDragEnd={handleDragEnd}
                        className={`group/card bg-gradient-to-br from-slate-50 to-gray-50 border border-gray-200 rounded p-3 text-sm cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all ${
                          isDragging ? 'opacity-40' : ''
                        }`}
                      >
                        {/* Card actions (hover) */}
                        <div className="absolute top-2 right-2 hidden group-hover/card:flex gap-1 bg-white rounded shadow-sm">
                          <button
                            onClick={() => openEdit(trip)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="Éditer"
                          >✏️</button>
                          <button
                            onClick={() => deleteTrip(trip.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Supprimer"
                          >✕</button>
                        </div>

                        {/* Trip info */}
                        <div className="font-bold text-gray-900 mb-1">
                          {trip.date} · {trip.start_time}
                        </div>

                        <div className="text-xs text-gray-700 mb-2">
                          <div className="font-medium">{TRIP_TYPE_LABELS[trip.type]}</div>
                          {trip.booking_id && (
                            <div className="text-gray-600">📌 {trip.booking_id}</div>
                          )}
                          {guestName(trip.booking_id) && (
                            <div className="font-semibold text-gray-800">👤 {guestName(trip.booking_id)}</div>
                          )}
                        </div>

                        {/* Passengers & luggage */}
                        <div className="text-xs text-gray-600 space-y-0.5 mb-2 pb-2 border-b">
                          <p>👥 {trip.nb_persons} pers{trip.nb_persons > 1 ? '.' : ''}</p>
                          <p>🧳 {trip.nb_luggage} bag{trip.nb_luggage !== 1 ? 's' : ''} + {trip.nb_boardbags} bb</p>
                        </div>

                        {/* Finance */}
                        <div className="text-xs font-medium space-y-0.5 bg-white rounded p-2">
                          <div className="flex justify-between text-blue-900">
                            <span>Client</span>
                            <span>{trip.price_paid_by_client}€</span>
                          </div>
                          <div className="flex justify-between text-amber-900">
                            <span>Driver</span>
                            <span className="text-right">-{trip.price_cost_to_driver}€ ({driverMargin}%)</span>
                          </div>
                          <div className="flex justify-between text-green-900 border-t pt-1">
                            <span>Centre</span>
                            <span className="font-bold">{trip.center_margin}€</span>
                          </div>
                        </div>

                        {trip.notes && (
                          <p className="text-xs text-gray-500 italic mt-2 pt-2 border-t">
                            💬 {trip.notes}
                          </p>
                        )}
                      </div>
                    )
                  })
                )}

                {/* Add button */}
                <button
                  onClick={() => addNewTrip(isUnassigned ? null : colId)}
                  className="w-full mt-2 py-2 border-2 border-dashed border-gray-300 rounded text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors text-sm font-medium"
                >
                  + Ajouter trajet
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit modal */}
      {editForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b sticky top-0">
              <h3 className="font-bold text-lg text-gray-800">Modifier trajet taxi</h3>
              <button onClick={() => setEditForm(null)} className="text-gray-500 hover:text-gray-800 font-bold text-xl">✕</button>
            </div>

            <form onSubmit={submitEdit} className="overflow-y-auto flex-1 p-4 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
                  <input
                    type="date"
                    value={editForm.data.date || ''}
                    onChange={e => setEditForm(f => f && { ...f, data: { ...f.data, date: e.target.value } })}
                    className="w-full text-sm border rounded px-2 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Heure *</label>
                  <input
                    type="time"
                    value={editForm.data.start_time || ''}
                    onChange={e => setEditForm(f => f && { ...f, data: { ...f.data, start_time: e.target.value } })}
                    className="w-full text-sm border rounded px-2 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
                  <select
                    value={editForm.data.type || ''}
                    onChange={e => setEditForm(f => f && { ...f, data: { ...f.data, type: e.target.value as any } })}
                    className="w-full text-sm border rounded px-2 py-1.5"
                  >
                    {Object.entries(TRIP_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Taxi *</label>
                  <select
                    value={editForm.data.taxi_driver_id || ''}
                    onChange={e => setEditForm(f => f && { ...f, data: { ...f.data, taxi_driver_id: e.target.value || null } })}
                    className="w-full text-sm border rounded px-2 py-1.5"
                  >
                    <option value="">Non assigné</option>
                    {mockTaxiDrivers.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Réservation</label>
                  <input
                    type="text"
                    placeholder="ex: bk1"
                    value={editForm.data.booking_id || ''}
                    onChange={e => setEditForm(f => f && { ...f, data: { ...f.data, booking_id: e.target.value || null } })}
                    className="w-full text-sm border rounded px-2 py-1.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Personnes</label>
                  <input
                    type="number"
                    min="1"
                    value={editForm.data.nb_persons || 1}
                    onChange={e => setEditForm(f => f && { ...f, data: { ...f.data, nb_persons: parseInt(e.target.value) || 1 } })}
                    className="w-full text-sm border rounded px-2 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Bagages</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.data.nb_luggage || 0}
                    onChange={e => setEditForm(f => f && { ...f, data: { ...f.data, nb_luggage: parseInt(e.target.value) || 0 } })}
                    className="w-full text-sm border rounded px-2 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Boardbags</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.data.nb_boardbags || 0}
                    onChange={e => setEditForm(f => f && { ...f, data: { ...f.data, nb_boardbags: parseInt(e.target.value) || 0 } })}
                    className="w-full text-sm border rounded px-2 py-1.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea
                  value={editForm.data.notes || ''}
                  onChange={e => setEditForm(f => f && { ...f, data: { ...f.data, notes: e.target.value || null } })}
                  className="w-full text-sm border rounded px-2 py-1.5"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-3 gap-4 bg-gray-50 p-3 rounded border border-gray-200">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Prix Client (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.data.price_paid_by_client || 0}
                    onChange={e => setEditForm(f => f && { ...f, data: { ...f.data, price_paid_by_client: parseFloat(e.target.value) || 0 } })}
                    className="w-full text-sm border rounded px-2 py-1.5 font-semibold text-blue-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Coût Driver (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.data.price_cost_to_driver || 0}
                    onChange={e => setEditForm(f => f && { ...f, data: { ...f.data, price_cost_to_driver: parseFloat(e.target.value) || 0 } })}
                    className="w-full text-sm border rounded px-2 py-1.5 font-semibold text-amber-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Marge Centre (€)</label>
                  <div className="w-full text-sm border rounded px-2 py-1.5 font-semibold text-green-900 bg-white">
                    {Math.max(0, (editForm.data.price_paid_by_client || 0) - (editForm.data.price_cost_to_driver || 0))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => deleteTrip(editForm.trip.id)}
                  className="px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded font-medium text-sm"
                >
                  🗑️ Supprimer
                </button>
                <button
                  type="button"
                  onClick={() => setEditForm(null)}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded font-medium text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
