import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAccommodations, useRooms } from '../../hooks/useAccommodations'
import { useTable } from '../../hooks/useSupabase'
import type { Accommodation, AccommodationType, Room, RoomRate, HouseRental } from '../../types/database'

const TYPE_META: Record<AccommodationType, { icon: string; label: string; plural: string }> = {
  house:    { icon: '🏠', label: 'House',    plural: 'Houses' },
  bungalow: { icon: '🏡', label: 'Bungalow', plural: 'Bungalows' },
  other:    { icon: '🏨', label: 'Other',    plural: 'Other' },
}

// ── Accommodation form (module scope) ────────────────────────────────────────
interface AccFormProps {
  initial: { name: string; is_active: boolean; type: AccommodationType; cost_per_night: string }
  title: string
  lockType?: boolean
  onSave: (data: { name: string; is_active: boolean; type: AccommodationType; cost_per_night: number | null }) => Promise<void>
  onClose: () => void
}
function AccForm({ initial, title, lockType, onSave, onClose }: AccFormProps) {
  const [name,    setName]    = useState(initial.name)
  const [active,  setActive]  = useState(initial.is_active)
  const [type,    setType]    = useState(initial.type)
  const [cost,    setCost]    = useState(initial.cost_per_night)
  const [saving,  setSaving]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave({
      name: name.trim(),
      is_active: active,
      type,
      cost_per_night: type === 'bungalow' && cost !== '' ? parseFloat(cost) : null,
    })
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
          {/* Type selector */}
          {!lockType && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <div className="flex gap-2">
                {(['house', 'bungalow', 'other'] as const).map(t => (
                  <button key={t} type="button"
                    onClick={() => setType(t)}
                    className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      type === t ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    {TYPE_META[t].icon} {TYPE_META[t].label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input type="text" value={name} required
              onChange={e => setName(e.target.value)}
              placeholder={type === 'house' ? 'e.g. H-11' : type === 'bungalow' ? 'e.g. B-1' : 'e.g. Apt Maputo'}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {type === 'bungalow' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cost per night (€) — what we pay</label>
              <input type="number" min="0" step="0.5" value={cost}
                onChange={e => setCost(e.target.value)}
                placeholder="e.g. 25"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
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

// ── Rental period form (module scope, houses only) ───────────────────────────
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

// ── Rates inline form (module scope) — adapts to house vs other ──────────────
interface RatesFormProps {
  accommodation: Accommodation
  rooms: Room[]
  rates: RoomRate[]
  onSaved: () => void
}
function RatesForm({ accommodation, rooms, rates, onSaved }: RatesFormProps) {
  const isHouse = accommodation.type === 'house'
  const roomF = isHouse ? rooms.find(r => r.name === 'F') : null
  const roomB = isHouse ? rooms.find(r => r.name === 'B') : null

  function getRate(roomId: string): string {
    return String(rates.find(r => r.room_id === roomId)?.price_per_night ?? '')
  }

  // For houses: F, B, Full.  For bungalow/other: one rate per room
  const [priceF,    setPriceF]    = useState(() => roomF ? getRate(roomF.id) : '')
  const [priceB,    setPriceB]    = useState(() => roomB ? getRate(roomB.id) : '')
  const [priceFull, setPriceFull] = useState(() => isHouse ? getRate(`full_${accommodation.id}`) : '')
  const [roomPrices, setRoomPrices] = useState<Record<string, string>>(() => {
    if (isHouse) return {}
    const m: Record<string, string> = {}
    for (const r of rooms) m[r.id] = getRate(r.id)
    return m
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isHouse) {
      setPriceF(roomF ? getRate(roomF.id) : '')
      setPriceB(roomB ? getRate(roomB.id) : '')
      setPriceFull(getRate(`full_${accommodation.id}`))
    } else {
      const m: Record<string, string> = {}
      for (const r of rooms) m[r.id] = getRate(r.id)
      setRoomPrices(m)
    }
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
    if (isHouse) {
      if (roomF && priceF !== '') ops.push(upsertRate(roomF.id, parseFloat(priceF)))
      if (roomB && priceB !== '') ops.push(upsertRate(roomB.id, parseFloat(priceB)))
      if (priceFull !== '')       ops.push(upsertRate(`full_${accommodation.id}`, parseFloat(priceFull)))
    } else {
      for (const r of rooms) {
        const val = roomPrices[r.id]
        if (val !== '') ops.push(upsertRate(r.id, parseFloat(val)))
      }
    }
    await Promise.all(ops)
    setSaving(false)
    onSaved()
  }

  return (
    <form onSubmit={handleSave} className="space-y-3">
      {isHouse ? (
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
      ) : (
        <div className={`grid gap-3 ${rooms.length === 1 ? 'grid-cols-1 max-w-xs' : 'grid-cols-2'}`}>
          {rooms.map(r => (
            <div key={r.id}>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {r.name} — Sell price (€/night)
              </label>
              <input type="number" min="0" step="0.5" value={roomPrices[r.id] ?? ''} placeholder="—"
                onChange={e => setRoomPrices(p => ({ ...p, [r.id]: e.target.value }))}
                className="w-full text-sm border rounded px-2 py-1.5" />
            </div>
          ))}
        </div>
      )}
      <button type="submit" disabled={saving}
        className="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium text-sm disabled:opacity-60">
        {saving ? 'Saving…' : 'Save rates'}
      </button>
    </form>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AccommodationsTab() {
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

  const [selected,    setSelected]    = useState<Accommodation | null>(null)
  const [showForm,    setShowForm]    = useState(false)
  const [editing,     setEditing]     = useState<Accommodation | null>(null)

  // Keep selection in sync
  useEffect(() => {
    if (selected) {
      const updated = accommodations.find(a => a.id === selected.id)
      if (updated) setSelected(updated)
    }
  }, [accommodations]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── CRUD ────────────────────────────────────────────────────────────────────

  async function handleCreate(data: { name: string; is_active: boolean; type: AccommodationType; cost_per_night: number | null }) {
    const { data: inserted, error } = await supabase
      .from('accommodations')
      .insert([{
        name: data.name,
        type: data.type,
        total_rooms: data.type === 'house' ? 2 : 1,
        is_active: data.is_active,
        cost_per_night: data.cost_per_night,
      }])
      .select('id')
      .single()
    if (error) { alert('Error: ' + error.message); return }

    // Auto-create rooms
    const roomRows = data.type === 'house'
      ? [
          { accommodation_id: inserted.id, name: 'F', capacity: 2 },
          { accommodation_id: inserted.id, name: 'B', capacity: 2 },
        ]
      : [{ accommodation_id: inserted.id, name: 'Room', capacity: 2 }]

    const { error: roomErr } = await supabase.from('rooms').insert(roomRows)
    if (roomErr) alert('Rooms creation error: ' + roomErr.message)
    refreshAccommodations()
    refreshRooms()
    setShowForm(false)
  }

  async function handleEdit(data: { name: string; is_active: boolean; type: AccommodationType; cost_per_night: number | null }) {
    if (!editing) return
    const { error } = await supabase
      .from('accommodations')
      .update({ name: data.name, is_active: data.is_active, cost_per_night: data.cost_per_night })
      .eq('id', editing.id)
    if (error) { alert('Error: ' + error.message); return }
    refreshAccommodations()
    setEditing(null)
  }

  async function handleDelete(acc: Accommodation) {
    if (!confirm(`Delete ${acc.name} and all associated data? Existing bookings will be kept.`)) return
    const { error } = await supabase.from('accommodations').delete().eq('id', acc.id)
    if (error) { alert('Error: ' + error.message); return }
    if (selected?.id === acc.id) setSelected(null)
    refreshAccommodations()
    refreshRooms()
  }

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

  function getRateLabel(roomId: string): string {
    const r = roomRates.find(r => r.room_id === roomId)
    return r ? `${r.price_per_night}€/n` : '—'
  }

  function accRooms(accId: string)    { return rooms.filter(r => r.accommodation_id === accId) }
  function accRentals(accId: string)  { return houseRentals.filter(r => r.accommodation_id === accId) }

  const selRooms = selected ? accRooms(selected.id) : []

  // Group by type, preserving order
  const typeOrder: AccommodationType[] = ['house', 'bungalow', 'other']
  const grouped = typeOrder
    .map(t => ({ type: t, items: accommodations.filter(a => a.type === t) }))
    .filter(g => g.items.length > 0 || g.type === 'house') // always show houses section

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

      {/* ── Left: accommodation list ─────────────────────────────────────── */}
      <div className="xl:col-span-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Accommodations</h2>
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm">
            + New
          </button>
        </div>

        {accommodations.length === 0 ? (
          <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
            <p className="text-4xl mb-2">🏠</p>
            <p className="text-sm">No accommodations yet</p>
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(({ type, items }) => (
              <div key={type}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {TYPE_META[type].icon} {TYPE_META[type].plural} ({items.length})
                </p>
                {items.length === 0 ? (
                  <p className="text-xs text-gray-400 italic ml-1">None</p>
                ) : (
                  <div className="space-y-2">
                    {items.map(acc => {
                      const rms = accRooms(acc.id)
                      const isSelected = selected?.id === acc.id
                      return (
                        <div key={acc.id}
                          onClick={() => setSelected(isSelected ? null : acc)}
                          className={`bg-white rounded-lg border-2 p-3 cursor-pointer transition-all ${isSelected ? 'border-blue-500 shadow-md' : 'border-gray-200 hover:border-gray-300'}`}>
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-bold text-gray-800 text-sm">{TYPE_META[acc.type].icon} {acc.name}</p>
                              <div className="mt-1 flex gap-3 text-xs text-gray-500">
                                {acc.type === 'house' ? (
                                  <>
                                    <span>F: {getRateLabel(rms.find(r => r.name === 'F')?.id ?? '')}</span>
                                    <span>B: {getRateLabel(rms.find(r => r.name === 'B')?.id ?? '')}</span>
                                    <span>Full: {getRateLabel(`full_${acc.id}`)}</span>
                                  </>
                                ) : (
                                  <>
                                    {rms.map(r => <span key={r.id}>{getRateLabel(r.id)}</span>)}
                                    {acc.cost_per_night != null && (
                                      <span className="text-amber-600">cost: {acc.cost_per_night}€/n</span>
                                    )}
                                  </>
                                )}
                              </div>
                              {acc.type === 'house' && (
                                <div className="mt-0.5 text-xs text-gray-400">
                                  {accRentals(acc.id).length} rental period(s)
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${acc.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                                {acc.is_active ? 'Active' : 'Inactive'}
                              </span>
                              <div className="flex gap-1 mt-1" onClick={e => e.stopPropagation()}>
                                <button onClick={() => setEditing(acc)}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded text-sm">✏️</button>
                                <button onClick={() => handleDelete(acc)}
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
            ))}
          </div>
        )}
      </div>

      {/* ── Right: detail panel ──────────────────────────────────────────── */}
      <div className="xl:col-span-2">
        {!selected ? (
          <div className="flex items-center justify-center h-64 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
            <p className="text-sm">Select an accommodation to view details</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-800">{TYPE_META[selected.type].icon} {selected.name}</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {TYPE_META[selected.type].label} — Rooms: {selRooms.map(r => r.name).join(', ') || 'none'}
                  {selected.cost_per_night != null && (
                    <span className="ml-2 text-amber-600 font-medium">Cost: {selected.cost_per_night}€/night</span>
                  )}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>

            {/* Rates */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-700 mb-3">
                {selected.type === 'bungalow' ? 'Sell Rate' : 'Nightly Rates'}
              </h4>
              <RatesForm
                accommodation={selected}
                rooms={selRooms}
                rates={roomRates}
                onSaved={() => refreshRates()}
              />
            </div>

            {/* Rental periods — houses only */}
            {selected.type === 'house' && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h4 className="font-semibold text-gray-700 mb-3">Rental Periods</h4>

                {accRentals(selected.id).length === 0 ? (
                  <p className="text-sm text-gray-400 italic mb-3">No rental periods yet — house is unavailable for bookings.</p>
                ) : (
                  <div className="space-y-2 mb-4">
                    {accRentals(selected.id).map(rp => (
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

                <RentalForm accommodationId={selected.id} onAdd={handleAddRental} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {showForm && (
        <AccForm
          initial={{ name: '', is_active: true, type: 'house', cost_per_night: '' }}
          title="New accommodation"
          onSave={handleCreate}
          onClose={() => setShowForm(false)}
        />
      )}
      {editing && (
        <AccForm
          initial={{
            name: editing.name,
            is_active: editing.is_active,
            type: editing.type,
            cost_per_night: editing.cost_per_night != null ? String(editing.cost_per_night) : '',
          }}
          title={`Edit ${editing.name}`}
          lockType
          onSave={handleEdit}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
