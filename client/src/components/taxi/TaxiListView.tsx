import { useState, useRef } from 'react'
import type { TaxiTrip, TaxiDriver, TaxiPricingDefaults, TaxiTripStatus, BookingRef, BookingParticipant } from '../../types/database'

const STATUS_CONFIG: Record<TaxiTripStatus, { label: string; row: string; badge: string }> = {
  confirmed:    { label: 'Confirmed',     row: '',            badge: 'bg-gray-100 text-gray-600' },
  needs_details:{ label: 'Needs details', row: 'bg-red-50',   badge: 'bg-red-100 text-red-700' },
  done:         { label: 'Done',          row: 'bg-green-50', badge: 'bg-green-100 text-green-700' },
}

function guestName(bookingId: string | null, bookings: BookingRef[]): string {
  if (!bookingId) return '—'
  const b = bookings.find(b => b.id === bookingId)
  return b?.client ? `${b.client.first_name} ${b.client.last_name}` : '—'
}

function bookingLabel(b: BookingRef): string {
  const name = b.client ? `${b.client.first_name} ${b.client.last_name}` : 'Unknown'
  return `#${String(b.booking_number).padStart(3, '0')} — ${name} (${b.check_in} → ${b.check_out})`
}

const TRIP_TYPE_LABELS: Record<string, string> = {
  'aero-to-center': '✈️ Airport → Centre',
  'center-to-aero': '🏠 Centre → Airport',
  'aero-to-spot':   '✈️ Airport → Spot',
  'spot-to-aero':   '🏄 Spot → Airport',
  'center-to-town': '🏠 Centre → Town',
  'town-to-center': '🏢 Town → Centre',
  'other':          '❓ Other',
}

// ── Summary table — réalisés vs prévus ───────────────────────────────────────
function SummaryTable({ trips }: { trips: TaxiTrip[] }) {
  const today = new Date().toISOString().slice(0, 10)

  function stats(subset: TaxiTrip[]) {
    return {
      count:      subset.length,
      clientMzn:  subset.reduce((s, t) => s + t.price_client_mzn,   0),
      clientEur:  subset.reduce((s, t) => s + t.price_eur,           0),
      driverMzn:  subset.reduce((s, t) => s + t.price_driver_mzn,   0),
      managerMzn: subset.reduce((s, t) => s + t.margin_manager_mzn, 0),
      centreMzn:  subset.reduce((s, t) => s + t.margin_centre_mzn,  0),
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
            <th className="px-3 py-2 text-right font-semibold text-blue-700">Client MZN</th>
            <th className="px-3 py-2 text-right font-semibold text-blue-500">EUR</th>
            <th className="px-3 py-2 text-right font-semibold text-amber-700">Driver MZN</th>
            <th className="px-3 py-2 text-right font-semibold text-purple-700">Manager MZN</th>
            <th className="px-3 py-2 text-right font-semibold text-green-700">Centre MZN</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-500">Trips</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label} className={`border-b ${r.bg}`}>
              <td className="px-3 py-2 font-semibold text-gray-700 whitespace-nowrap">{r.label}</td>
              <td className="px-3 py-2 text-right font-bold text-blue-900">{r.clientMzn.toLocaleString()}</td>
              <td className="px-3 py-2 text-right text-blue-700">≈ {r.clientEur}€</td>
              <td className="px-3 py-2 text-right text-amber-900">{r.driverMzn.toLocaleString()}</td>
              <td className="px-3 py-2 text-right text-purple-900">{r.managerMzn.toLocaleString()}</td>
              <td className="px-3 py-2 text-right font-semibold text-green-900">{r.centreMzn.toLocaleString()}</td>
              <td className="px-3 py-2 text-right text-gray-600">{r.count}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold">
            <td className="px-3 py-2 text-gray-800">Total</td>
            <td className="px-3 py-2 text-right text-blue-900">{total.clientMzn.toLocaleString()}</td>
            <td className="px-3 py-2 text-right text-blue-700">≈ {total.clientEur}€</td>
            <td className="px-3 py-2 text-right text-amber-900">{total.driverMzn.toLocaleString()}</td>
            <td className="px-3 py-2 text-right text-purple-900">{total.managerMzn.toLocaleString()}</td>
            <td className="px-3 py-2 text-right text-green-900">{total.centreMzn.toLocaleString()}</td>
            <td className="px-3 py-2 text-right text-gray-600">{total.count}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── Edit modal — module scope to avoid focus loss on re-render ──────────────
interface EditModalProps {
  trip: TaxiTrip
  drivers: TaxiDriver[]
  bookings: BookingRef[]
  bookingParticipants: BookingParticipant[]
  pricingDefaults: TaxiPricingDefaults
  onChange: (data: Partial<TaxiTrip>) => void
  onSave: (updateRate?: number) => void
  onDelete: () => void
  onClose: () => void
}

function EditModal({ trip, drivers, bookings, bookingParticipants, pricingDefaults, onChange, onSave, onDelete, onClose }: EditModalProps) {
  const [updateRateChecked, setUpdateRateChecked] = useState(false)
  const [newRate, setNewRate] = useState(pricingDefaults.eur_mzn_rate)

  const driverMzn = trip.price_client_mzn - trip.margin_manager_mzn - trip.margin_centre_mzn
  const effectiveRate = updateRateChecked ? newRate : trip.exchange_rate
  const priceEur = effectiveRate > 0 ? Math.round(trip.price_client_mzn / effectiveRate) : 0

  function handleSave() {
    onSave(updateRateChecked ? newRate : undefined)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold text-lg text-gray-800">Edit taxi trip</h3>
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
              <label className="block text-xs font-medium text-gray-600 mb-1">Time *</label>
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

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <div className="flex gap-2">
              {(Object.entries(STATUS_CONFIG) as [TaxiTripStatus, typeof STATUS_CONFIG[TaxiTripStatus]][]).map(([val, cfg]) => (
                <button key={val} type="button"
                  onClick={() => onChange({ status: val })}
                  className={`flex-1 px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
                    trip.status === val
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
              <select value={trip.taxi_driver_id || ''}
                onChange={e => onChange({ taxi_driver_id: e.target.value || null })}
                className="w-full text-sm border rounded px-2 py-1.5">
                <option value="">Unassigned</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Booking</label>
              <select
                value={trip.booking_id || ''}
                onChange={e => {
                  const id = e.target.value || null
                  const b = bookings.find(b => b.id === id)
                  onChange({
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
              <input type="number" min="1" value={trip.nb_persons}
                onChange={e => onChange({ nb_persons: parseInt(e.target.value) || 1 })}
                className="w-full text-sm border rounded px-2 py-1.5" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Luggage</label>
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

          {/* Financial — MZN */}
          <div className="bg-gray-50 p-3 rounded border border-gray-200 space-y-3">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Client price (MZN) *</label>
                <input type="number" min="0" value={trip.price_client_mzn}
                  onChange={e => onChange({ price_client_mzn: parseInt(e.target.value) || 0 })}
                  className="w-full text-sm border rounded px-2 py-1.5 font-semibold text-blue-900" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Manager margin (MZN) *</label>
                <input type="number" min="0" value={trip.margin_manager_mzn}
                  onChange={e => onChange({ margin_manager_mzn: parseInt(e.target.value) || 0 })}
                  className="w-full text-sm border rounded px-2 py-1.5 font-semibold text-purple-900" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Centre margin (MZN) *</label>
                <input type="number" min="0" value={trip.margin_centre_mzn}
                  onChange={e => onChange({ margin_centre_mzn: parseInt(e.target.value) || 0 })}
                  className="w-full text-sm border rounded px-2 py-1.5 font-semibold text-green-900" />
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-sm font-semibold text-amber-900">
              Driver receives: {driverMzn.toLocaleString()} MZN
            </div>
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <span>EUR/MZN rate: <strong>{trip.exchange_rate}</strong></span>
                <span className="text-gray-500">≈ <strong>{priceEur}€</strong></span>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={updateRateChecked}
                  onChange={e => setUpdateRateChecked(e.target.checked)}
                  className="rounded" />
                Update global rate
              </label>
              {updateRateChecked && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-gray-600">New rate (MZN/1€):</label>
                  <input type="number" min="1" step="0.01" value={newRate}
                    onChange={e => setNewRate(parseFloat(e.target.value) || 65)}
                    className="w-28 text-sm border rounded px-2 py-1" />
                  <span className="text-xs text-gray-500">≈ {Math.round(trip.price_client_mzn / newRate)}€</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 p-4 border-t">
          <button onClick={onDelete}
            className="px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded font-medium text-sm">
            🗑️ Delete
          </button>
          <button onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded font-medium text-sm">
            Cancel
          </button>
          <button onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm">
            Save
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
  bookings: BookingRef[]
  bookingParticipants: BookingParticipant[]
  pricingDefaults: TaxiPricingDefaults
  onAddTrip:    (trip: Omit<TaxiTrip, 'id'>) => Promise<TaxiTrip | null>
  onUpdateTrip: (trip: TaxiTrip) => Promise<void>
  onDeleteTrip: (id: string) => Promise<void>
  onUpdateRate: (rate: number) => void
}

export default function TaxiListView({ trips, drivers, bookings, bookingParticipants, pricingDefaults, onAddTrip, onUpdateTrip, onDeleteTrip, onUpdateRate }: TaxiListViewProps) {
  const [sortBy, setSortBy]             = useState<'date' | 'driver' | 'type'>('date')
  const [filterDriver, setFilterDriver] = useState<string>('all')
  const [editTrip, setEditTrip]         = useState<TaxiTrip | null>(null)
  const tableContainerRef               = useRef<HTMLDivElement>(null)

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
    const d = pricingDefaults
    const rate = d.eur_mzn_rate
    const driver_mzn = d.price_client_mzn - d.margin_manager_mzn - d.margin_centre_mzn
    const created = await onAddTrip({
      date: new Date().toISOString().slice(0, 10),
      start_time: '10:00',
      type: 'aero-to-center',
      status: 'confirmed',
      taxi_driver_id: null,
      booking_id: null,
      nb_persons: 1,
      nb_luggage: 0,
      nb_boardbags: 0,
      notes: null,
      price_client_mzn: d.price_client_mzn,
      margin_manager_mzn: d.margin_manager_mzn,
      margin_centre_mzn: d.margin_centre_mzn,
      price_driver_mzn: driver_mzn,
      price_eur: Math.round(d.price_client_mzn / rate),
      exchange_rate: rate,
    })
    if (created) setEditTrip(created)
  }

  function handleEditChange(data: Partial<TaxiTrip>) {
    if (!editTrip) return
    setEditTrip({ ...editTrip, ...data })
  }

  async function handleSave(updateRate?: number) {
    if (!editTrip) return
    const rate = updateRate ?? editTrip.exchange_rate
    const saved: TaxiTrip = {
      ...editTrip,
      price_driver_mzn: editTrip.price_client_mzn - editTrip.margin_manager_mzn - editTrip.margin_centre_mzn,
      price_eur: Math.round(editTrip.price_client_mzn / rate),
      exchange_rate: rate,
    }
    await onUpdateTrip(saved)
    if (updateRate !== undefined) onUpdateRate(updateRate)
    setEditTrip(null)
  }

  function scrollToToday() {
    const today = new Date().toISOString().slice(0, 10)
    const container = tableContainerRef.current
    if (!container) return
    const rows = container.querySelectorAll<HTMLTableRowElement>('tr[data-date]')
    let target: HTMLTableRowElement | null = null
    rows.forEach(row => {
      if (!target && (row.getAttribute('data-date') ?? '') >= today) target = row
    })
    if (!target && rows.length > 0) target = rows[rows.length - 1]
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function handleDelete() {
    if (!editTrip) return
    if (confirm('Delete this trip?')) {
      await onDeleteTrip(editTrip.id)
      setEditTrip(null)
    }
  }

  return (
    <>
      {/* Summary */}
      <SummaryTable trips={sortedTrips} />

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 items-start md:items-center">
        <div className="flex gap-2 items-center">
          <label className="text-sm font-medium text-gray-700">Sort:</label>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="text-sm border rounded px-3 py-1.5 bg-white">
            <option value="date">Date/Time</option>
            <option value="driver">Driver</option>
            <option value="type">Type</option>
          </select>
        </div>
        <div className="flex gap-2 items-center">
          <label className="text-sm font-medium text-gray-700">Filter:</label>
          <select value={filterDriver} onChange={e => setFilterDriver(e.target.value)}
            className="text-sm border rounded px-3 py-1.5 bg-white">
            <option value="all">All</option>
            <option value="unassigned">Unassigned</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={scrollToToday}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold text-sm border border-gray-300">
            📅 Today
          </button>
          <button onClick={addNewTrip}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm">
            + Add trip
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto" ref={tableContainerRef}>
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Date</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Time</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Type</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Notes</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Driver</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Guest</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">Pers</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">Bag</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">BB</th>
                <th className="px-3 py-2 text-right font-semibold text-blue-700 whitespace-nowrap">Client MZN</th>
                <th className="px-3 py-2 text-right font-semibold text-purple-700 whitespace-nowrap">Mgr MZN</th>
                <th className="px-3 py-2 text-right font-semibold text-green-700 whitespace-nowrap">Centre MZN</th>
                <th className="px-3 py-2 text-right font-semibold text-amber-700 whitespace-nowrap">Driver MZN</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">EUR</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Status</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-700">✏️</th>
              </tr>
            </thead>
            <tbody>
              {sortedTrips.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-4 py-8 text-center text-gray-500 italic">No trips</td>
                </tr>
              ) : sortedTrips.map(trip => {
                const driver = drivers.find(d => d.id === trip.taxi_driver_id)
                const sc = STATUS_CONFIG[trip.status]
                return (
                  <tr key={trip.id} data-date={trip.date} className={`border-b transition-colors hover:brightness-95 ${sc.row}`}>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-800">{trip.date}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-800">{trip.start_time}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">{TRIP_TYPE_LABELS[trip.type]}</td>
                    <td className="px-3 py-2 text-xs text-gray-500 max-w-[140px] truncate">{trip.notes ?? <span className="italic text-gray-300">—</span>}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{driver?.name ?? <span className="text-red-400 italic">Unassigned</span>}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap">{guestName(trip.booking_id, bookings)}</td>
                    <td className="px-3 py-2 text-center text-gray-800">{trip.nb_persons}</td>
                    <td className="px-3 py-2 text-center text-gray-800">{trip.nb_luggage}</td>
                    <td className="px-3 py-2 text-center text-gray-800">{trip.nb_boardbags}</td>
                    <td className="px-3 py-2 text-right font-semibold text-blue-900">{trip.price_client_mzn.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-semibold text-purple-900">{trip.margin_manager_mzn.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-semibold text-green-900">{trip.margin_centre_mzn.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-semibold text-amber-900">{trip.price_driver_mzn.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{trip.price_eur}€</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sc.badge}`}>{sc.label}</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => setEditTrip(trip)}
                        className="text-blue-600 hover:text-blue-800 text-sm px-2 py-1 rounded hover:bg-blue-50"
                        title="Edit">
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
          bookings={bookings}
          bookingParticipants={bookingParticipants}
          pricingDefaults={pricingDefaults}
          onChange={handleEditChange}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditTrip(null)}
        />
      )}
    </>
  )
}
