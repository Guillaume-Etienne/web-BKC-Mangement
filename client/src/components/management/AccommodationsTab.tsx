import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAccommodations, useRooms } from '../../hooks/useAccommodations'
import { useTable } from '../../hooks/useSupabase'
import type { Accommodation, AccommodationType, Room, RoomRate, HouseRental } from '../../types/database'
import { todayISO, fmtDate } from '../../utils/dates'

const TYPE_META: Record<AccommodationType, { icon: string; label: string; plural: string }> = {
  house:    { icon: '🏠', label: 'House',    plural: 'Houses' },
  bungalow: { icon: '🏡', label: 'Bungalow', plural: 'Bungalows' },
  other:    { icon: '🏨', label: 'Other',    plural: 'Other' },
}

// ── Accommodation form (module scope) ────────────────────────────────────────
interface AccFormData {
  name: string
  is_active: boolean
  type: AccommodationType
  cost_per_night: number | null
  external_billing: boolean
}
interface AccFormProps {
  initial: { name: string; is_active: boolean; type: AccommodationType; cost_per_night: string; external_billing: boolean }
  title: string
  lockType?: boolean
  /** Present when editing an existing accommodation: lets the same modal set
   *  sell prices and manage rooms. Absent on creation — the rooms both hang off
   *  don't exist until the accommodation is inserted. */
  editContext?: {
    accommodation: Accommodation
    rooms: Room[]
    rates: RoomRate[]
    onRatesSaved: () => void
    onRoomsChanged: () => void
  }
  onSave: (data: AccFormData) => Promise<void>
  onClose: () => void
}
function AccForm({ initial, title, lockType, editContext, onSave, onClose }: AccFormProps) {
  const [name,    setName]    = useState(initial.name)
  const [active,  setActive]  = useState(initial.is_active)
  const [type,    setType]    = useState(initial.type)
  const [cost,    setCost]    = useState(initial.cost_per_night)
  const [external, setExternal] = useState(initial.external_billing)
  const [saving,  setSaving]  = useState(false)
  const [rateValues, setRateValues] = useState<Record<string, string>>(() =>
    editContext ? initialRateValues(editContext.accommodation, editContext.rooms, editContext.rates) : {})

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    // Rates first: if they fail we keep the modal open rather than closing on a
    // half-applied edit. onSave() is what dismisses it. Skipped when the place
    // is billed per stay — there is no grid to write.
    if (editContext && !external) {
      const failures = await saveRates(rateValues, editContext.rates)
      if (failures.length > 0) { setSaving(false); alertRatesFailed(failures); return }
      editContext.onRatesSaved()
    }
    await onSave({
      name: name.trim(),
      is_active: active,
      type,
      cost_per_night: type === 'bungalow' && cost !== '' ? parseFloat(cost) : null,
      external_billing: external,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className={`bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-h-[90vh] overflow-y-auto ${editContext ? 'max-w-lg' : 'max-w-sm'}`}>
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold text-gray-800 dark:text-gray-200">{title}</h3>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-xl font-bold">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Type selector */}
          {!lockType && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type *</label>
              <div className="flex gap-2">
                {(['house', 'bungalow', 'other'] as const).map(t => (
                  <button key={t} type="button"
                    onClick={() => setType(t)}
                    className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      type === t ? 'border-blue-500 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-400' : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'
                    }`}>
                    {TYPE_META[t].icon} {TYPE_META[t].label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input type="text" value={name} required
              onChange={e => setName(e.target.value)}
              placeholder={type === 'house' ? 'e.g. H-11' : type === 'bungalow' ? 'e.g. B-1' : 'e.g. Apt Maputo'}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {type === 'bungalow' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cost per night (€) — what we pay</label>
              <input type="number" min="0" step="0.5" value={cost}
                onChange={e => setCost(e.target.value)}
                placeholder="e.g. 25"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" checked={external} onChange={e => setExternal(e.target.checked)} className="rounded mt-0.5" />
            <span>
              Billed per stay, not per night
              <span className="block text-xs text-gray-500 dark:text-gray-400">
                For places we don't price ourselves — a third-party hotel, or guests with
                their own arrangement. The amount is entered on each booking instead.
              </span>
            </span>
          </label>
          {editContext ? (
            <>
              {!external && (
                <div className="pt-1 border-t border-gray-200 dark:border-gray-800">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-3 mb-2">
                    Sell prices — what the guest pays
                  </p>
                  <RateFields accommodation={editContext.accommodation} rooms={editContext.rooms}
                    values={rateValues} onChange={(k, v) => setRateValues(p => ({ ...p, [k]: v }))} />
                </div>
              )}
              <div className="pt-1 border-t border-gray-200 dark:border-gray-800">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-3 mb-2">
                  Rooms {external && <span className="font-normal text-gray-500 dark:text-gray-400">— one per simultaneous stay</span>}
                </p>
                {/* Applied immediately, unlike the fields above: adding a room changes
                    what the rest of this form can even show. Renaming keeps the rate. */}
                <RoomsEditor accommodation={editContext.accommodation} rooms={editContext.rooms}
                  onChanged={editContext.onRoomsChanged} />
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400 italic">
              Rooms and sell prices can be set once the accommodation exists — reopen this form after saving.
            </p>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="rounded" />
            Active (available for bookings)
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium text-sm">Cancel</button>
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
  const today = todayISO()
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
    <form onSubmit={handleSubmit} className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg p-3 space-y-3">
      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Add rental period</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start date</label>
          <input type="date" value={startDate} required
            onChange={e => setStartDate(e.target.value)}
            className="w-full text-sm border rounded px-2 py-1.5" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End date</label>
          <input type="date" value={endDate} required
            onChange={e => setEndDate(e.target.value)}
            className="w-full text-sm border rounded px-2 py-1.5" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Total cost (€)</label>
          <input type="number" min="0" value={cost} required placeholder="e.g. 2000"
            onChange={e => setCost(e.target.value)}
            className="w-full text-sm border rounded px-2 py-1.5" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
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

// ── Rates: shared model between the edit modal and the detail panel ──────────
// Historically the house form looked its rooms up by NAME (`r.name === 'F'`),
// so a room named anything else silently dropped out of the save — the field
// accepted a number and nothing was written. Rates are keyed by room id here;
// the name is only ever a label.

const ROOM_ORDER = ['F', 'B']
function sortRooms(rooms: Room[]): Room[] {
  return [...rooms].sort((a, b) => {
    const ia = ROOM_ORDER.indexOf(a.name)
    const ib = ROOM_ORDER.indexOf(b.name)
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    return a.name.localeCompare(b.name)
  })
}

/** Every rate an accommodation is expected to carry, in display order: one per
 *  room, plus the flat `full_{id}` key for houses (a single price, NOT F + B). */
function rateKeys(acc: Accommodation, rooms: Room[]): { key: string; label: string; short: string }[] {
  const isHouse = acc.type === 'house'
  const keys = sortRooms(rooms).map(r => ({
    key: r.id,
    short: r.name,
    label: isHouse
      ? `${r.name}${r.name === 'F' ? ' — Sea view' : r.name === 'B' ? ' — Back room' : ''} (€/night)`
      : `${r.name} — Sell price (€/night)`,
  }))
  return isHouse
    ? [...keys, { key: `full_${acc.id}`, short: 'Full', label: 'Full house (€/night)' }]
    : keys
}

function initialRateValues(acc: Accommodation, rooms: Room[], rates: RoomRate[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const { key } of rateKeys(acc, rooms)) {
    out[key] = String(rates.find(r => r.room_id === key)?.price_per_night ?? '')
  }
  return out
}

/** Upserts every non-empty field. @returns error messages, empty when all saved. */
async function saveRates(values: Record<string, string>, rates: RoomRate[]): Promise<string[]> {
  const ops = Object.entries(values)
    .filter(([, v]) => v !== '')
    .map(async ([roomId, v]) => {
      const existing = rates.find(r => r.room_id === roomId)
      const price = parseFloat(v)
      const { error } = existing
        ? await supabase.from('room_rates').update({ price_per_night: price }).eq('id', existing.id)
        : await supabase.from('room_rates').insert([{ room_id: roomId, price_per_night: price, notes: null }])
      return error ? error.message : null
    })
  return (await Promise.all(ops)).filter((e): e is string => e !== null)
}

/** A rate that looks saved but isn't is worse than one that was never set: the
 *  booking wizard finds nothing and quietly starts the stay at 0 €. */
function alertRatesFailed(failures: string[]) {
  alert(`The rates were NOT saved.\n\n${failures.join('\n')}\n\nStays booked here would be priced at 0 € — please try again.`)
}

// ── Rooms: the structure rates and the planning grid both hang off ───────────

async function addRoom(accId: string, name: string, roomCount: number): Promise<string | null> {
  const { error } = await supabase.from('rooms').insert([{ accommodation_id: accId, name, capacity: 2 }])
  if (error) return error.message
  await supabase.from('accommodations').update({ total_rooms: roomCount + 1 }).eq('id', accId)
  return null
}

/** Renaming is safe: rates are keyed by room id, so a renamed room keeps its
 *  price. Only the label moves. */
async function renameRoom(roomId: string, name: string): Promise<string | null> {
  const { error } = await supabase.from('rooms').update({ name }).eq('id', roomId)
  return error ? error.message : null
}

/** `booking_rooms.room_id` is ON DELETE CASCADE, so deleting an occupied room
 *  would strip it from those bookings without a word — and the stay would go on
 *  existing with no accommodation at all. Count first, refuse if occupied. */
async function deleteRoom(roomId: string, accId: string, roomCount: number): Promise<string | null> {
  const { count, error: countErr } = await supabase
    .from('booking_rooms').select('booking_id', { count: 'exact', head: true }).eq('room_id', roomId)
  if (countErr) return countErr.message
  if ((count ?? 0) > 0) {
    return `${count} booking(s) still occupy this room. Move them elsewhere first — deleting it now would quietly leave them with no accommodation.`
  }
  const { error } = await supabase.from('rooms').delete().eq('id', roomId)
  if (error) return error.message
  await supabase.from('accommodations').update({ total_rooms: Math.max(0, roomCount - 1) }).eq('id', accId)
  return null
}

interface RoomsEditorProps {
  accommodation: Accommodation
  rooms: Room[]
  onChanged: () => void
}
function RoomsEditor({ accommodation, rooms, onChanged }: RoomsEditorProps) {
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const sorted = sortRooms(rooms)

  async function run(op: Promise<string | null>) {
    setBusy(true)
    const err = await op
    setBusy(false)
    if (err) { alert(err); return }
    onChanged()
  }

  return (
    <div className="space-y-2">
      {sorted.length === 0 && (
        <p className="text-xs text-red-600 dark:text-red-400">
          No rooms yet — this accommodation cannot be booked or priced.
        </p>
      )}
      {sorted.map(r => (
        <div key={r.id} className="flex items-center gap-2">
          <input type="text" defaultValue={r.name} disabled={busy}
            onBlur={e => { const v = e.target.value.trim(); if (v && v !== r.name) run(renameRoom(r.id, v)) }}
            className="flex-1 text-sm border rounded px-2 py-1" />
          <button type="button" disabled={busy}
            onClick={() => run(deleteRoom(r.id, accommodation.id, rooms.length))}
            className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded text-sm disabled:opacity-50">🗑️</button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <input type="text" value={newName} disabled={busy} placeholder="Add a room / spot…"
          onChange={e => setNewName(e.target.value)}
          className="flex-1 text-sm border rounded px-2 py-1" />
        <button type="button" disabled={busy || newName.trim() === ''}
          onClick={() => run(addRoom(accommodation.id, newName.trim(), rooms.length)).then(() => setNewName(''))}
          className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded text-sm font-medium disabled:opacity-50">
          + Add
        </button>
      </div>
    </div>
  )
}

interface RateFieldsProps {
  accommodation: Accommodation
  rooms: Room[]
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}
function RateFields({ accommodation, rooms, values, onChange }: RateFieldsProps) {
  const keys = rateKeys(accommodation, rooms)
  if (keys.length === 0) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        This accommodation has no rooms, so it can carry no price — stays here would be billed 0 €.
      </p>
    )
  }
  const cols = keys.length >= 3 ? 'grid-cols-3' : keys.length === 2 ? 'grid-cols-2' : 'grid-cols-1 max-w-xs'
  return (
    <div className={`grid gap-3 ${cols}`}>
      {keys.map(({ key, label }) => (
        <div key={key}>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
          <input type="number" min="0" step="0.5" value={values[key] ?? ''} placeholder="—"
            onChange={e => onChange(key, e.target.value)}
            className="w-full text-sm border rounded px-2 py-1.5" />
        </div>
      ))}
    </div>
  )
}

// ── Rates inline form (module scope) — detail panel ──────────────────────────
interface RatesFormProps {
  accommodation: Accommodation
  rooms: Room[]
  rates: RoomRate[]
  onSaved: () => void
}
function RatesForm({ accommodation, rooms, rates, onSaved }: RatesFormProps) {
  const [values, setValues] = useState(() => initialRateValues(accommodation, rooms, rates))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValues(initialRateValues(accommodation, rooms, rates))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rates, rooms, accommodation.id])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const failures = await saveRates(values, rates)
    setSaving(false)
    if (failures.length > 0) { alertRatesFailed(failures); return }
    onSaved()
  }

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <RateFields accommodation={accommodation} rooms={rooms} values={values}
        onChange={(k, v) => setValues(p => ({ ...p, [k]: v }))} />
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

  async function handleCreate(data: AccFormData) {
    const { data: inserted, error } = await supabase
      .from('accommodations')
      .insert([{
        name: data.name,
        type: data.type,
        total_rooms: data.type === 'house' ? 2 : 1,
        is_active: data.is_active,
        cost_per_night: data.cost_per_night,
        external_billing: data.external_billing,
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

  async function handleEdit(data: AccFormData) {
    if (!editing) return
    const { error } = await supabase
      .from('accommodations')
      .update({
        name: data.name,
        is_active: data.is_active,
        cost_per_night: data.cost_per_night,
        external_billing: data.external_billing,
      })
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

  /** Rates this accommodation is expected to carry but doesn't. A stay on one
   *  of these is billed 0 € in silence (`getBaseNightlyRate` falls back to 0),
   *  which is why it earns a red badge rather than a discreet dash.
   *  Places billed per stay expect none — flagging them would cry wolf forever
   *  and teach the badge to be ignored. */
  function missingRates(acc: Accommodation, rms: Room[]): string[] {
    if (acc.external_billing) return []
    return rateKeys(acc, rms)
      .filter(({ key }) => !roomRates.some(r => r.room_id === key))
      .map(({ short }) => short)
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
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Accommodations</h2>
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm">
            + New
          </button>
        </div>

        {accommodations.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
            <p className="text-4xl mb-2">🏠</p>
            <p className="text-sm">No accommodations yet</p>
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(({ type, items }) => (
              <div key={type}>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  {TYPE_META[type].icon} {TYPE_META[type].plural} ({items.length})
                </p>
                {items.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-400 italic ml-1">None</p>
                ) : (
                  <div className="space-y-2">
                    {items.map(acc => {
                      const rms = accRooms(acc.id)
                      const isSelected = selected?.id === acc.id
                      return (
                        <div key={acc.id}
                          onClick={() => setSelected(isSelected ? null : acc)}
                          className={`bg-white dark:bg-gray-900 rounded-lg border-2 p-3 cursor-pointer transition-all ${isSelected ? 'border-blue-500 dark:border-blue-600 shadow-md' : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'}`}>
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-bold text-gray-800 dark:text-gray-200 text-sm">{TYPE_META[acc.type].icon} {acc.name}</p>
                              <div className="mt-1 flex gap-3 text-xs text-gray-500 dark:text-gray-400">
                                {acc.external_billing ? (
                                  <span className="text-blue-600 dark:text-blue-400">
                                    per-stay pricing · {rms.length} spot{rms.length === 1 ? '' : 's'}
                                  </span>
                                ) : (
                                  rateKeys(acc, rms).map(({ key, short }) => (
                                    <span key={key}>{acc.type === 'house' ? `${short}: ` : ''}{getRateLabel(key)}</span>
                                  ))
                                )}
                                {acc.cost_per_night != null && (
                                  <span className="text-amber-600 dark:text-amber-400">cost: {acc.cost_per_night}€/n</span>
                                )}
                              </div>
                              {rms.length === 0 ? (
                                <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                                  ⚠ no rooms — cannot be booked{acc.external_billing ? '' : ' or priced'}
                                </p>
                              ) : missingRates(acc, rms).length > 0 && (
                                <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                                  ⚠ no sell price: {missingRates(acc, rms).join(', ')} — billed 0 €
                                </p>
                              )}
                              {acc.type === 'house' && (
                                <div className="mt-0.5 text-xs text-gray-400 dark:text-gray-400">
                                  {accRentals(acc.id).length} rental period(s)
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${acc.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                                {acc.is_active ? 'Active' : 'Inactive'}
                              </span>
                              <div className="flex gap-1 mt-1" onClick={e => e.stopPropagation()}>
                                <button onClick={() => setEditing(acc)}
                                  className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded text-sm">✏️</button>
                                <button onClick={() => handleDelete(acc)}
                                  className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded text-sm">🗑️</button>
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
          <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
            <p className="text-sm">Select an accommodation to view details</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">{TYPE_META[selected.type].icon} {selected.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {TYPE_META[selected.type].label} — Rooms: {selRooms.map(r => r.name).join(', ') || 'none'}
                  {selected.cost_per_night != null && (
                    <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">Cost: {selected.cost_per_night}€/night</span>
                  )}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-xl">✕</button>
            </div>

            {/* Rates — a place billed per stay has no grid to show */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
              <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">
                {selected.external_billing ? 'Pricing' : selected.type === 'bungalow' ? 'Sell Rate' : 'Nightly Rates'}
              </h4>
              {selected.external_billing ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Billed per stay — the amount is entered on each booking, not here.
                  Its {selRooms.length} spot{selRooms.length === 1 ? '' : 's'} cap how many stays can run at once.
                </p>
              ) : (
                <RatesForm
                  accommodation={selected}
                  rooms={selRooms}
                  rates={roomRates}
                  onSaved={() => refreshRates()}
                />
              )}
            </div>

            {/* Rental periods — houses only */}
            {selected.type === 'house' && (
              <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
                <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Rental Periods</h4>

                {accRentals(selected.id).length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-400 italic mb-3">No rental periods yet — house is unavailable for bookings.</p>
                ) : (
                  <div className="space-y-2 mb-4">
                    {accRentals(selected.id).map(rp => (
                      <div key={rp.id} className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-lg px-3 py-2 text-sm">
                        <div>
                          <span className="font-semibold text-gray-800 dark:text-gray-200">
                            {fmtDate(rp.start_date)} → {fmtDate(rp.end_date)}
                          </span>
                          <span className="ml-3 font-bold text-blue-900 dark:text-blue-400">{rp.total_cost.toLocaleString()}€</span>
                          {rp.notes && <span className="ml-2 text-gray-500 dark:text-gray-400 italic">{rp.notes}</span>}
                        </div>
                        <button onClick={() => handleDeleteRental(rp.id)}
                          className="text-red-400 dark:text-red-300 hover:text-red-600 dark:hover:text-red-400 ml-2 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40">🗑️</button>
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
          initial={{ name: '', is_active: true, type: 'house', cost_per_night: '', external_billing: false }}
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
            // `?? false` only bites in the window before the migration is applied,
            // where the column doesn't exist yet — after it, NOT NULL DEFAULT false.
            // Without it the checkbox starts uncontrolled and React complains.
            external_billing: editing.external_billing ?? false,
          }}
          title={`Edit ${editing.name}`}
          lockType
          editContext={{
            accommodation: editing,
            rooms: accRooms(editing.id),
            rates: roomRates,
            onRatesSaved: refreshRates,
            onRoomsChanged: refreshRooms,
          }}
          onSave={handleEdit}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
