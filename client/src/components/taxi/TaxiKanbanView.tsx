import { useState } from 'react'
import type { TaxiTrip, TaxiDriver, TaxiPricingDefaults, TaxiTripStatus, BookingRef, BookingParticipant } from '../../types/database'
import { computeTaxiMarginEur } from '../accounting/utils'

const STATUS_CONFIG: Record<TaxiTripStatus, { label: string; card: string; badge: string }> = {
  confirmed:    { label: 'Confirmed',     card: 'from-slate-50 to-gray-50 border-gray-200',     badge: 'bg-gray-100 text-gray-600' },
  needs_details:{ label: 'Needs details', card: 'from-red-50 to-red-50 border-red-300',         badge: 'bg-red-100 text-red-700' },
  done:         { label: 'Done',          card: 'from-green-50 to-emerald-50 border-green-300',  badge: 'bg-green-100 text-green-700' },
}

function guestName(bookingId: string | null, bookings: BookingRef[]): string {
  if (!bookingId) return ''
  const b = bookings.find(b => b.id === bookingId)
  return b?.client ? `${b.client.first_name} ${b.client.last_name}` : ''
}

function bookingLabel(b: BookingRef): string {
  const name = b.client ? `${b.client.first_name} ${b.client.last_name}` : '?'
  return `#${String(b.booking_number).padStart(3, '0')} — ${name} (${b.check_in} → ${b.check_out})`
}

// ── Summary table — réalisés vs prévus ───────────────────────────────────────
function SummaryTable({ trips, rate }: { trips: TaxiTrip[]; rate: number }) {
  const today = new Date().toISOString().slice(0, 10)

  function stats(subset: TaxiTrip[]) {
    return {
      count:      subset.length,
      clientEur:  subset.reduce((s, t) => s + t.price_eur,           0),
      driverMzn:  subset.reduce((s, t) => s + t.price_driver_mzn,   0),
      managerMzn: subset.reduce((s, t) => s + t.margin_manager_mzn, 0),
      centreEur:  subset.reduce((s, t) => s + computeTaxiMarginEur(t, rate), 0),
    }
  }

  const done    = stats(trips.filter(t => t.date <  today))
  const planned = stats(trips.filter(t => t.date >= today))
  const total   = stats(trips)

  const rows = [
    { label: '✅ Completed', bg: 'bg-green-50',  ...done    },
    { label: '📅 Planned',   bg: 'bg-blue-50',   ...planned },
  ]

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b text-xs">
            <th className="px-3 py-2 text-left font-medium text-gray-500"></th>
            <th className="px-3 py-2 text-right font-semibold text-blue-700">Client EUR</th>
            <th className="px-3 py-2 text-right font-semibold text-amber-700">Driver MZN</th>
            <th className="px-3 py-2 text-right font-semibold text-purple-700">Manager MZN</th>
            <th className="px-3 py-2 text-right font-semibold text-emerald-700">Centre €</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-500">Trips</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label} className={`border-b ${r.bg}`}>
              <td className="px-3 py-2 font-semibold text-gray-700 whitespace-nowrap">{r.label}</td>
              <td className="px-3 py-2 text-right font-bold text-blue-900">{r.clientEur}€</td>
              <td className="px-3 py-2 text-right text-amber-900">{r.driverMzn.toLocaleString()}</td>
              <td className="px-3 py-2 text-right text-purple-900">{r.managerMzn.toLocaleString()}</td>
              <td className="px-3 py-2 text-right font-semibold text-emerald-900">{r.centreEur}€</td>
              <td className="px-3 py-2 text-right text-gray-600">{r.count}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold">
            <td className="px-3 py-2 text-gray-800">Total</td>
            <td className="px-3 py-2 text-right text-blue-900">{total.clientEur}€</td>
            <td className="px-3 py-2 text-right text-amber-900">{total.driverMzn.toLocaleString()}</td>
            <td className="px-3 py-2 text-right text-purple-900">{total.managerMzn.toLocaleString()}</td>
            <td className="px-3 py-2 text-right text-emerald-900">{total.centreEur}€</td>
            <td className="px-3 py-2 text-right text-gray-600">{total.count}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

const TRIP_TYPE_LABELS: Record<string, string> = {
  'aero-to-center': '✈️ Airport → Centre',
  'center-to-aero': '🏠 Centre → Airport',
  'aero-to-spot': '✈️ Airport → Spot',
  'spot-to-aero': '🏄 Spot → Airport',
  'center-to-town': '🏠 Centre → Town',
  'town-to-center': '🏢 Town → Centre',
  'other': '❓ Other',
}

interface TaxiKanbanViewProps {
  trips: TaxiTrip[]
  drivers: TaxiDriver[]
  pricingDefaults: TaxiPricingDefaults
  bookings: BookingRef[]
  bookingParticipants: BookingParticipant[]
  onAddTrip:    (trip: Omit<TaxiTrip, 'id'>) => Promise<TaxiTrip | null>
  onUpdateTrip: (trip: TaxiTrip) => Promise<void>
  onDeleteTrip: (id: string) => Promise<void>
}

export default function TaxiKanbanView({ trips, drivers, pricingDefaults, bookings, bookingParticipants, onAddTrip, onUpdateTrip, onDeleteTrip }: TaxiKanbanViewProps) {
  const [editTrip, setEditTrip]         = useState<TaxiTrip | null>(null)
  const [draggedTrip, setDraggedTrip]   = useState<{ id: string; fromDriverId: string | null } | null>(null)
  const [dropTarget, setDropTarget]     = useState<string | null>(null)

  // Columns: "Unassigned" + one per driver
  const assignedColumns = ['unassigned' as const, ...drivers.map(d => d.id)]

  function getTripsForDriver(driverId: string | 'unassigned'): TaxiTrip[] {
    if (driverId === 'unassigned') {
      return trips.filter(t => t.taxi_driver_id === null).sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`))
    }
    return trips.filter(t => t.taxi_driver_id === driverId).sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`))
  }

  function openEdit(trip: TaxiTrip) {
    setEditTrip({ ...trip })
  }

  function handleEditChange(data: Partial<TaxiTrip>) {
    if (!editTrip) return
    setEditTrip({ ...editTrip, ...data })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editTrip) return
    await onUpdateTrip(editTrip)
    setEditTrip(null)
  }

  async function deleteTrip(id: string) {
    if (confirm('Delete this trip?')) {
      await onDeleteTrip(id)
      if (editTrip?.id === id) setEditTrip(null)
    }
  }

  async function addNewTrip(driverId: string | null) {
    const d = pricingDefaults
    const created = await onAddTrip({
      date: new Date().toISOString().slice(0, 10),
      start_time: '10:00',
      type: 'aero-to-center',
      status: 'confirmed',
      taxi_driver_id: driverId === 'unassigned' ? null : driverId,
      booking_id: null,
      nb_persons: 1,
      nb_luggage: 0,
      nb_boardbags: 0,
      notes: null,
      price_eur: d.default_price_eur,
      price_driver_mzn: d.default_driver_mzn,
      margin_manager_mzn: d.default_manager_mzn,
    })
    if (created) openEdit(created)
  }

  function handleDragStart(trip: TaxiTrip) {
    setDraggedTrip({ id: trip.id, fromDriverId: trip.taxi_driver_id })
  }

  function handleDragOver(e: React.DragEvent, driverId: string | null) {
    e.preventDefault()
    setDropTarget(driverId === null ? 'unassigned' : driverId)
  }

  async function handleDrop(e: React.DragEvent, driverId: string | null) {
    e.preventDefault()
    if (!draggedTrip) return
    const trip = trips.find(t => t.id === draggedTrip.id)
    if (trip) await onUpdateTrip({ ...trip, taxi_driver_id: driverId })
    setDraggedTrip(null)
    setDropTarget(null)
  }

  function handleDragEnd() {
    setDraggedTrip(null)
    setDropTarget(null)
  }

  return (
    <>
      {/* Summary */}
      <SummaryTable trips={trips} rate={pricingDefaults.eur_mzn_rate} />

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
                    {isUnassigned ? '📋 Unassigned' : `🚕 ${driver?.name}`}
                  </span>
                  <span className="text-sm font-normal text-gray-600">
                    {columnTrips.length} trip{columnTrips.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {!isUnassigned && driver && (
                  <div className="text-xs text-gray-600 mt-1">
                    {driver.phone && <p>📞 {driver.phone}</p>}
                    {driver.vehicle && <p>🚗 {driver.vehicle}</p>}
                  </div>
                )}
              </div>

              {/* Column content */}
              <div
                className={`flex-1 p-3 space-y-2 overflow-y-auto min-h-96 ${isDropping ? 'bg-blue-50' : ''}`}
                onDragOver={(e) => handleDragOver(e, isUnassigned ? null : colId)}
                onDragLeave={() => setDropTarget(null)}
                onDrop={(e) => handleDrop(e, isUnassigned ? null : colId)}
              >
                {columnTrips.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4 italic">No trips</p>
                ) : (
                  columnTrips.map(trip => {
                    const isDragging = draggedTrip?.id === trip.id

                    const sc = STATUS_CONFIG[trip.status]
                    return (
                      <div
                        key={trip.id}
                        draggable
                        onDragStart={() => handleDragStart(trip)}
                        onDragEnd={handleDragEnd}
                        className={`group/card relative bg-gradient-to-br ${sc.card} border rounded p-3 text-sm cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all ${
                          isDragging ? 'opacity-40' : ''
                        }`}
                      >
                        {/* Card actions (hover) */}
                        <div className="absolute top-2 right-2 hidden group-hover/card:flex gap-1 bg-white rounded shadow-sm">
                          <button
                            onClick={() => openEdit(trip)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit"
                          >✏️</button>
                          <button
                            onClick={() => deleteTrip(trip.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                          >✕</button>
                        </div>

                        {/* Trip info */}
                        <div className="font-bold text-gray-900 mb-1">
                          {trip.date} · {trip.start_time}
                        </div>

                        <div className="text-xs text-gray-700 mb-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{TRIP_TYPE_LABELS[trip.type]}</span>
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${sc.badge}`}>{sc.label}</span>
                          </div>
                          {guestName(trip.booking_id, bookings) && (
                            <div className="font-semibold text-gray-800">👤 {guestName(trip.booking_id, bookings)}</div>
                          )}
                        </div>

                        {/* Passengers & luggage */}
                        <div className="text-xs text-gray-600 space-y-0.5 mb-2 pb-2 border-b">
                          <p>👥 {trip.nb_persons} pers{trip.nb_persons > 1 ? '.' : ''}</p>
                          <p>🧳 {trip.nb_luggage} bag{trip.nb_luggage !== 1 ? 's' : ''} + {trip.nb_boardbags} bb</p>
                        </div>

                        {/* Finance */}
                        <div className="text-xs font-medium space-y-0.5 bg-white rounded p-2">
                          <div className="flex justify-between text-blue-900 font-bold">
                            <span>Client</span>
                            <span>{trip.price_eur}€</span>
                          </div>
                          <div className="flex justify-between text-amber-900 border-t pt-1">
                            <span>Driver</span>
                            <span>{trip.price_driver_mzn.toLocaleString()} MZN</span>
                          </div>
                          <div className="flex justify-between text-purple-800">
                            <span>Manager</span>
                            <span>{trip.margin_manager_mzn.toLocaleString()} MZN</span>
                          </div>
                          <div className="flex justify-between text-emerald-800 border-t pt-1 font-bold">
                            <span>Centre</span>
                            <span>{computeTaxiMarginEur(trip, pricingDefaults.eur_mzn_rate)}€</span>
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
                  + Add trip
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit modal */}
      {editTrip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b sticky top-0">
              <h3 className="font-bold text-lg text-gray-800">Edit taxi trip</h3>
              <button onClick={() => setEditTrip(null)} className="text-gray-500 hover:text-gray-800 font-bold text-xl">✕</button>
            </div>

            <form onSubmit={handleSave} className="overflow-y-auto flex-1 p-4 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
                  <input type="date" value={editTrip.date}
                    onChange={e => handleEditChange({ date: e.target.value })}
                    className="w-full text-sm border rounded px-2 py-1.5" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Time *</label>
                  <input type="time" value={editTrip.start_time}
                    onChange={e => handleEditChange({ start_time: e.target.value })}
                    className="w-full text-sm border rounded px-2 py-1.5" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
                  <select value={editTrip.type}
                    onChange={e => handleEditChange({ type: e.target.value as TaxiTrip['type'] })}
                    className="w-full text-sm border rounded px-2 py-1.5">
                    {Object.entries(TRIP_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <div className="flex gap-2">
                  {(Object.entries(STATUS_CONFIG) as [TaxiTripStatus, typeof STATUS_CONFIG[TaxiTripStatus]][]).map(([val, cfg]) => (
                    <button key={val} type="button"
                      onClick={() => handleEditChange({ status: val })}
                      className={`flex-1 px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
                        editTrip.status === val
                          ? `${cfg.badge} border-current ring-2 ring-offset-1 ring-current`
                          : 'bg-white border-gray-300 text-gray-500 hover:border-gray-400'
                      }`}>
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Driver</label>
                  <select value={editTrip.taxi_driver_id || ''}
                    onChange={e => handleEditChange({ taxi_driver_id: e.target.value || null })}
                    className="w-full text-sm border rounded px-2 py-1.5">
                    <option value="">Unassigned</option>
                    {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Booking</label>
                  <select value={editTrip.booking_id || ''}
                    onChange={e => {
                      const id = e.target.value || null
                      const b = bookings.find(b => b.id === id)
                      handleEditChange({
                        booking_id: id,
                        ...(b ? {
                          nb_persons:   bookingParticipants.filter(p => p.booking_id === b.id).length || 1,
                          nb_luggage:   b.luggage_count,
                          nb_boardbags: b.boardbag_count,
                        } : {}),
                      })
                    }}
                    className="w-full text-sm border rounded px-2 py-1.5 bg-white">
                    <option value="">— Not linked —</option>
                    {bookings.map(b => (
                      <option key={b.id} value={b.id}>{bookingLabel(b)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Persons</label>
                  <input type="number" min="1" value={editTrip.nb_persons}
                    onChange={e => handleEditChange({ nb_persons: parseInt(e.target.value) || 1 })}
                    className="w-full text-sm border rounded px-2 py-1.5" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Luggage</label>
                  <input type="number" min="0" value={editTrip.nb_luggage}
                    onChange={e => handleEditChange({ nb_luggage: parseInt(e.target.value) || 0 })}
                    className="w-full text-sm border rounded px-2 py-1.5" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Boardbags</label>
                  <input type="number" min="0" value={editTrip.nb_boardbags}
                    onChange={e => handleEditChange({ nb_boardbags: parseInt(e.target.value) || 0 })}
                    className="w-full text-sm border rounded px-2 py-1.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea value={editTrip.notes || ''}
                  onChange={e => handleEditChange({ notes: e.target.value || null })}
                  className="w-full text-sm border rounded px-2 py-1.5" rows={2} />
              </div>

              {/* Financial */}
              <div className="bg-gray-50 p-3 rounded border border-gray-200 space-y-3">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-blue-700 mb-1">Client price (EUR) *</label>
                    <input type="number" min="0" step="1" value={editTrip.price_eur}
                      onChange={e => handleEditChange({ price_eur: parseFloat(e.target.value) || 0 })}
                      className="w-full text-sm border rounded px-2 py-1.5 font-semibold text-blue-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-amber-700 mb-1">Driver payment (MZN) *</label>
                    <input type="number" min="0" value={editTrip.price_driver_mzn}
                      onChange={e => handleEditChange({ price_driver_mzn: parseInt(e.target.value) || 0 })}
                      className="w-full text-sm border rounded px-2 py-1.5 font-semibold text-amber-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-purple-700 mb-1">Manager commission (MZN) *</label>
                    <input type="number" min="0" value={editTrip.margin_manager_mzn}
                      onChange={e => handleEditChange({ margin_manager_mzn: parseInt(e.target.value) || 0 })}
                      className="w-full text-sm border rounded px-2 py-1.5 font-semibold text-purple-900" />
                  </div>
                </div>
                <div className="border-t pt-3 flex items-center gap-3 text-sm text-gray-700">
                  <span className="text-gray-500">
                    Global rate: <strong>1€ = {pricingDefaults.eur_mzn_rate} MZN</strong>
                  </span>
                  <span className="text-gray-400">|</span>
                  <span className="text-gray-500">
                    MZN cost: <strong>{(editTrip.price_driver_mzn + editTrip.margin_manager_mzn).toLocaleString()}</strong>
                  </span>
                  <span className="text-gray-400">|</span>
                  <span className="font-semibold text-emerald-700">
                    Centre margin: {computeTaxiMarginEur(editTrip, pricingDefaults.eur_mzn_rate)}€
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <button type="button" onClick={() => deleteTrip(editTrip.id)}
                  className="px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded font-medium text-sm">
                  🗑️ Delete
                </button>
                <button type="button" onClick={() => setEditTrip(null)}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded font-medium text-sm">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
