import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAccommodations, useRooms } from '../../hooks/useAccommodations'
import { useTable } from '../../hooks/useSupabase'
import type { Accommodation, Room, RoomRate, HouseRental } from '../../types/database'

// ── House form (module scope) ─────────────────────────────────────────────────
interface HouseFormProps {
  initial: { name: string; is_active: boolean }
  title: string
  onSave: (data: { name: string; is_active: boolean }) => Promise<void>
  onClose: () => void
}
function HouseForm({ initial, title, onSave, onClose }: HouseFormProps) {
  const [name, setName]         = useState(initial.name)
  const [active, setActive]     = useState(initial.is_active)
  const [saving, setSaving]     = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave({ name: name.trim(), is_active: active })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-sm">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-xl font-bold">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input type="text" value={name} required
              onChange={e => setName(e.target.value)}
              placeholder="e.g. House 1"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="rounded" />
            Active (available for bookings)
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium text-sm">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm disabled:opacity-60">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Rental period form (module scope) ─────────────────────────────────────────
interface RentalFormProps {
  accommodationId: string
  onAdd: (r: Omit<HouseRental, 'id'>) => Promise<void>
}
function RentalForm({ accommodationId, onAdd }: RentalFormProps) {
  const today = new Date().toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState(today)
  const [endDate,   setEndDate]   = useState(today)
  const [cost,      setCost]      = useState('')
  const [notes,     setNotes]     = useState('')
  const [saving,    setSaving]    = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (endDate <= startDate) { alert('End date must be after start date.'); return }
    setSaving(true)
    await onAdd({
      accommodation_id: accommodationId,
      start_date: startDate,
      end_date:   endDate,
      total_cost: parseInt(cost) || 0,
      notes:      notes.trim() || null,
    })
    setSaving(false)
    setCost('')
    setNotes('')
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Add rental period</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Start date</label>
          <input type="date" value={startDate} required
            onChange={e => setStartDate(e.target.value)}
            className="w-full text-sm border rounded px-2 py-1.5" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">End date</label>
          <input type="date" value={endDate} required
            onChange={e => setEndDate(e.target.value)}
            className="w-full text-sm border rounded px-2 py-1.5" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Total cost (€)</label>
          <input type="number" min="0" value={cost} required placeholder="e.g. 2000"
            onChange={e => setCost(e.target.value)}
            className="w-full text-sm border rounded px-2 py-1.5" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
          <input type="text" value={notes} placeholder="Optional"
            onChange={e => setNotes(e.target.value)}
            className="w-full text-sm border rounded px-2 py-1.5" />
        </div>
      </div>
      <button type="submit" disabled={saving}
        className="w-full px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium text-sm disabled:opacity-60">
        {saving ? 'Saving…' : '+ Add period'}
      </button>
    </form>
  )
}

// ── Rates inline form (module scope) ──────────────────────────────────────────
interface RatesFormProps {
  house: Accommodation
  rooms: Room[]
  rates: RoomRate[]
  onSaved: () => void
}
function RatesForm({ house, rooms, rates, onSaved }: RatesFormProps) {
  const roomF = rooms.find(r => r.name === 'F')
  const roomB = rooms.find(r => r.name === 'B')

  function getRate(roomId: string): string {
    return String(rates.find(r => r.room_id === roomId)?.price_per_night ?? '')
  }

  const [priceF,    setPriceF]    = useState(() => getRate(roomF?.id ?? ''))
  const [priceB,    setPriceB]    = useState(() => getRate(roomB?.id ?? ''))
  const [priceFull, setPriceFull] = useState(() => getRate(`full_${house.id}`))
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    setPriceF(getRate(roomF?.id ?? ''))
    setPriceB(getRate(roomB?.id ?? ''))
    setPriceFull(getRate(`full_${house.id}`))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rates, rooms])

  async function upsertRate(roomId: string, price: number) {
    const existing = rates.find(r => r.room_id === roomId)
    if (existing) {
      await supabase.from('room_rates').update({ price_per_night: price }).eq('id', existing.id)
    } else {
      await supabase.from('room_rates').insert([{ room_id: roomId, price_per_night: price, notes: null }])
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const ops: Promise<unknown>[] = []
    if (roomF && priceF !== '') ops.push(upsertRate(roomF.id, parseFloat(priceF)))
    if (roomB && priceB !== '') ops.push(upsertRate(roomB.id, parseFloat(priceB)))
    if (priceFull !== '')       ops.push(upsertRate(`full_${house.id}`, parseFloat(priceFull)))
    await Promise.all(ops)
    setSaving(false)
    onSaved()
  }

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">F — Sea view (€/night)</label>
          <input type="number" min="0" step="0.5" value={priceF} placeholder="—"
            onChange={e => setPriceF(e.target.value)}
            className="w-full text-sm border rounded px-2 py-1.5" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">B — Back room (€/night)</label>
          <input type="number" min="0" step="0.5" value={priceB} placeholder="—"
            onChange={e => setPriceB(e.target.value)}
            className="w-full text-sm border rounded px-2 py-1.5" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Full house (€/night)</label>
          <input type="number" min="0" step="0.5" value={priceFull} placeholder="—"
            onChange={e => setPriceFull(e.target.value)}
            className="w-full text-sm border rounded px-2 py-1.5" />
        </div>
      </div>
      <button type="submit" disabled={saving}
        className="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium text-sm disabled:opacity-60">
        {saving ? 'Saving…' : 'Save rates'}
      </button>
    </form>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function HousesTab() {
  const { data: accommodationsData, refresh: refreshAccommodations } = useAccommodations()
  const { data: roomsData,          refresh: refreshRooms }          = useRooms()
  const { data: roomRatesData,      refresh: refreshRates }          = useTable<RoomRate>('room_rates')
  const { data: houseRentalsData,   refresh: refreshRentals }        = useTable<HouseRental>('house_rentals', { order: 'start_date', ascending: false })

  const [accommodations, setAccommodations] = useState<Accommodation[]>([])
  const [rooms,          setRooms]          = useState<Room[]>([])
  const [roomRates,      setRoomRates]      = useState<RoomRate[]>([])
  const [houseRentals,   setHouseRentals]   = useState<HouseRental[]>([])

  useEffect(() => { setAccommodations(accommodationsData) }, [accommodationsData])
  useEffect(() => { setRooms(roomsData) },                   [roomsData])
  useEffect(() => { setRoomRates(roomRatesData) },           [roomRatesData])
  useEffect(() => { setHouseRentals(houseRentalsData) },     [houseRentalsData])

  const houses = accommodations.filter(a => a.type === 'house')

  const [selectedHouse, setSelectedHouse] = useState<Accommodation | null>(null)
  const [showHouseForm, setShowHouseForm] = useState(false)
  const [editingHouse,  setEditingHouse]  = useState<Accommodation | null>(null)

  // When houses reload, keep selectedHouse in sync
  useEffect(() => {
    if (selectedHouse) {
      const updated = accommodations.find(a => a.id === selectedHouse.id)
      if (updated) setSelectedHouse(updated)
    }
  }, [accommodations]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── House CRUD ──────────────────────────────────────────────────────────────

  async function handleCreateHouse(data: { name: string; is_active: boolean }) {
    const { data: inserted, error } = await supabase
      .from('accommodations')
      .insert([{ name: data.name, type: 'house', total_rooms: 2, is_active: data.is_active }])
      .select('id')
      .single()
    if (error) { alert('Error: ' + error.message); return }
    // Auto-create F and B rooms
    const { error: roomErr } = await supabase.from('rooms').insert([
      { accommodation_id: inserted.id, name: 'F', capacity: 2 },
      { accommodation_id: inserted.id, name: 'B', capacity: 2 },
    ])
    if (roomErr) alert('Rooms creation error: ' + roomErr.message)
    refreshAccommodations()
    refreshRooms()
    setShowHouseForm(false)
  }

  async function handleEditHouse(data: { name: string; is_active: boolean }) {
    if (!editingHouse) return
    const { error } = await supabase
      .from('accommodations')
      .update({ name: data.name, is_active: data.is_active })
      .eq('id', editingHouse.id)
    if (error) { alert('Error: ' + error.message); return }
    refreshAccommodations()
    setEditingHouse(null)
  }

  async function handleDeleteHouse(id: string) {
    if (!confirm('Delete this house and all its rental periods? Bookings already made will be kept.')) return
    const { error } = await supabase.from('accommodations').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    if (selectedHouse?.id === id) setSelectedHouse(null)
    refreshAccommodations()
    refreshRooms()
  }

  // ── Rental period CRUD ──────────────────────────────────────────────────────

  async function handleAddRental(r: Omit<HouseRental, 'id'>) {
    const { error } = await supabase.from('house_rentals').insert([r])
    if (error) { alert('Error: ' + error.message); return }
    refreshRentals()
  }

  async function handleDeleteRental(id: string) {
    if (!confirm('Delete this rental period?')) return
    const { error } = await supabase.from('house_rentals').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    refreshRentals()
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function getRate(roomId: string): string {
    const r = roomRates.find(r => r.room_id === roomId)
    return r ? `${r.price_per_night}€/n` : '—'
  }

  function houseRooms(houseId: string) {
    return rooms.filter(r => r.accommodation_id === houseId)
  }

  function houseRentalPeriods(houseId: string) {
    return houseRentals.filter(r => r.accommodation_id === houseId)
  }

  const selected = selectedHouse
  const selRooms = selected ? houseRooms(selected.id) : []

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

      {/* ── Left: house list ─────────────────────────────────────────────── */}
      <div className="xl:col-span-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Houses</h2>
          <button onClick={() => setShowHouseForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm">
            + New house
          </button>
        </div>

        {houses.length === 0 ? (
          <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
            <p className="text-4xl mb-2">🏠</p>
            <p className="text-sm">No houses yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {houses.map(house => {
              const hr = houseRooms(house.id)
              const roomF = hr.find(r => r.name === 'F')
              const roomB = hr.find(r => r.name === 'B')
              const isSelected = selectedHouse?.id === house.id
              return (
                <div key={house.id}
                  onClick={() => setSelectedHouse(isSelected ? null : house)}
                  className={`bg-white rounded-lg border-2 p-4 cursor-pointer transition-all ${isSelected ? 'border-blue-500 shadow-md' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-gray-800">🏠 {house.name}</p>
                      <div className="mt-1 flex gap-3 text-xs text-gray-500">
                        <span>F: {roomF ? getRate(roomF.id) : '—'}</span>
                        <span>B: {roomB ? getRate(roomB.id) : '—'}</span>
                        <span>Full: {getRate(`full_${house.id}`)}</span>
                      </div>
                      <div className="mt-1 text-xs text-gray-400">
                        {houseRentalPeriods(house.id).length} rental period(s)
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${house.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                        {house.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <div className="flex gap-1 mt-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setEditingHouse(house)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded text-sm">✏️</button>
                        <button onClick={() => handleDeleteHouse(house.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded text-sm">🗑️</button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Right: detail panel ──────────────────────────────────────────── */}
      <div className="xl:col-span-2">
        {!selected ? (
          <div className="flex items-center justify-center h-64 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
            <p className="text-sm">Select a house to view details</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-800">🏠 {selected.name}</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Rooms: {selRooms.map(r => r.name).join(', ') || 'none'}
                  {selRooms.length < 2 && (
                    <span className="ml-2 text-amber-600 font-medium">⚠️ Missing rooms</span>
                  )}
                </p>
              </div>
              <button onClick={() => setSelectedHouse(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>

            {/* Rates */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-700 mb-3">Nightly Rates</h4>
              <RatesForm
                house={selected}
                rooms={selRooms}
                rates={roomRates}
                onSaved={() => refreshRates()}
              />
            </div>

            {/* Rental periods */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-700 mb-3">Rental Periods</h4>

              {houseRentalPeriods(selected.id).length === 0 ? (
                <p className="text-sm text-gray-400 italic mb-3">No rental periods yet — house is unavailable for bookings.</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {houseRentalPeriods(selected.id).map(rp => (
                    <div key={rp.id} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-sm">
                      <div>
                        <span className="font-semibold text-gray-800">
                          {rp.start_date} → {rp.end_date}
                        </span>
                        <span className="ml-3 font-bold text-blue-900">{rp.total_cost.toLocaleString()}€</span>
                        {rp.notes && <span className="ml-2 text-gray-500 italic">{rp.notes}</span>}
                      </div>
                      <button onClick={() => handleDeleteRental(rp.id)}
                        className="text-red-400 hover:text-red-600 ml-2 p-1 rounded hover:bg-red-50">🗑️</button>
                    </div>
                  ))}
                </div>
              )}

              <RentalForm
                accommodationId={selected.id}
                onAdd={handleAddRental}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {showHouseForm && (
        <HouseForm
          initial={{ name: '', is_active: true }}
          title="New house"
          onSave={handleCreateHouse}
          onClose={() => setShowHouseForm(false)}
        />
      )}
      {editingHouse && (
        <HouseForm
          initial={{ name: editingHouse.name, is_active: editingHouse.is_active }}
          title="Edit house"
          onSave={handleEditHouse}
          onClose={() => setEditingHouse(null)}
        />
      )}
    </div>
  )
}
