import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useClients } from '../hooks/useClients'
import { useBookings, useBookingRooms, useBookingRoomPrices, useBookingParticipants } from '../hooks/useBookings'
import { useAccommodations, useRooms } from '../hooks/useAccommodations'
import { useTable } from '../hooks/useSupabase'
import type { Booking, BookingParticipant, BookingStatus, Client, Room, Accommodation, HouseRental, RoomRate } from '../types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WizardData {
  // Step 1 – Client
  client_id: string
  // new client inline
  new_client_first_name: string
  new_client_last_name: string
  new_client_email: string
  new_client_phone: string
  new_client_nationality: string
  new_client_kite_level: 'beginner' | 'intermediate' | 'advanced' | ''
  // Step 2 – Stay
  check_in: string
  check_out: string
  visa_entry_date: string
  visa_exit_date: string
  room_ids: string[]
  room_prices: Record<string, number>
  status: BookingStatus
  // Step 3 – Guests
  participants: { id: string; first_name: string; last_name: string; passport_number: string }[]
  couples_count: number
  children_count: number
  // Step 4 – Transport
  arrival_time: string
  departure_time: string
  taxi_arrival: boolean
  taxi_departure: boolean
  luggage_count: number
  boardbag_count: number
  // Step 5 – KiteCenter
  num_lessons: number        // persons wanting lessons
  num_equipment_rentals: number // persons wanting equipment rental
  num_center_access: number  // persons using center only (no lesson/rental)
  // Step 6 – Payment
  amount_paid: number
  notes: string
}

const EMPTY_WIZARD: WizardData = {
  client_id: '',
  new_client_first_name: '', new_client_last_name: '', new_client_email: '',
  new_client_phone: '', new_client_nationality: '', new_client_kite_level: '',
  check_in: '', check_out: '', visa_entry_date: '', visa_exit_date: '', room_ids: [], room_prices: {}, status: 'provisional',
  participants: [], couples_count: 0, children_count: 0,
  arrival_time: '', departure_time: '',
  taxi_arrival: false, taxi_departure: false,
  luggage_count: 0, boardbag_count: 0,
  num_lessons: 0, num_equipment_rentals: 0, num_center_access: 0,
  amount_paid: 0, notes: '',
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, icon: '👤', label: 'Client' },
  { n: 2, icon: '🏠', label: 'Stay' },
  { n: 3, icon: '👥', label: 'Guests' },
  { n: 4, icon: '🚕', label: 'Transport' },
  { n: 5, icon: '🏄', label: 'KiteCenter' },
  { n: 6, icon: '💰', label: 'Payment' },
]

interface StepBarProps { current: number; onGoto: (n: number) => void; maxReached: number }
function StepBar({ current, onGoto, maxReached }: StepBarProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const done = s.n < current
        const active = s.n === current
        const reachable = s.n <= maxReached
        return (
          <div key={s.n} className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => reachable && onGoto(s.n)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${active ? 'bg-blue-600 text-white' : done ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : reachable ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-gray-50 text-gray-300 cursor-default'}`}
            >
              <span>{done ? '✓' : s.icon}</span>
              <span className="hidden sm:block">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <div className={`w-3 h-px ${done ? 'bg-blue-300' : 'bg-gray-200'}`} />}
          </div>
        )
      })}
    </div>
  )
}


// ─── Field helpers ────────────────────────────────────────────────────────────

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const numCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center'

function Counter({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
        className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 font-bold text-lg leading-none flex items-center justify-center">−</button>
      <span className="w-8 text-center font-semibold text-gray-800">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)}
        className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 font-bold text-lg leading-none flex items-center justify-center">+</button>
    </div>
  )
}

// ─── Wizard component (top-level for focus safety) ────────────────────────────

interface WizardProps {
  initial: WizardData
  clients: Client[]
  clientsLoading: boolean
  rooms: Room[]
  accommodations: Accommodation[]
  houseRentals: HouseRental[]
  roomRates: RoomRate[]
  isEditing: boolean
  onCancel: () => void
  onSave: (data: WizardData, isNew: boolean) => void
}

function BookingWizard({ initial, clients, clientsLoading, rooms, accommodations, houseRentals, roomRates, isEditing, onCancel, onSave }: WizardProps) {
  const [step, setStep] = useState(1)
  const [maxReached, setMaxReached] = useState(isEditing ? 6 : 1)
  const [d, setD] = useState<WizardData>(initial)
  const [creatingClient, setCreatingClient] = useState(false)
  const [clientSearch, setClientSearch] = useState('')

  function update(patch: Partial<WizardData>) { setD(prev => ({ ...prev, ...patch })) }

  function goTo(n: number) {
    if (n === 3 && !isEditing && d.participants.length === 0) {
      const firstName = d.client_id
        ? (clients.find(c => c.id === d.client_id)?.first_name ?? '')
        : d.new_client_first_name
      const lastName = d.client_id
        ? (clients.find(c => c.id === d.client_id)?.last_name ?? '')
        : d.new_client_last_name
      if (firstName || lastName) {
        update({ participants: [{ id: `p${Date.now()}`, first_name: firstName, last_name: lastName, passport_number: '' }] })
      }
    }
    setStep(n)
    if (n > maxReached) setMaxReached(n)
  }
  function next() { goTo(Math.min(6, step + 1)) }
  function back() { setStep(s => Math.max(1, s - 1)) }

  // Nights count
  const nights = d.check_in && d.check_out
    ? Math.max(0, (new Date(d.check_out).getTime() - new Date(d.check_in).getTime()) / 86400000)
    : 0

  const filteredClients = clients.filter(c =>
    `${c.first_name} ${c.last_name} ${c.email ?? ''}`
      .toLowerCase()
      .includes(clientSearch.toLowerCase())
  )

  // Participant helpers
  function addParticipant() {
    update({ participants: [...d.participants, { id: `p${Date.now()}`, first_name: '', last_name: '', passport_number: '' }] })
  }
  function updateParticipant(i: number, field: 'first_name' | 'last_name' | 'passport_number', val: string) {
    const parts = [...d.participants]
    parts[i] = { ...parts[i], [field]: val }
    update({ participants: parts })
  }
  function removeParticipant(i: number) {
    update({ participants: d.participants.filter((_, idx) => idx !== i) })
  }

  // Rooms grouped by accommodation
  const roomsByAcco = accommodations.map(acc => ({
    acc,
    rooms: rooms.filter(r => r.accommodation_id === acc.id),
  })).filter(g => g.rooms.length > 0)

  // Room selection helpers
  function toggleRoom(roomId: string) {
    if (d.room_ids.includes(roomId)) {
      const newPrices = { ...d.room_prices }
      delete newPrices[roomId]
      update({ room_ids: d.room_ids.filter(id => id !== roomId), room_prices: newPrices })
    } else {
      const baseRate = roomRates.find(r => r.room_id === roomId)?.price_per_night ?? 0
      update({
        room_ids: [...d.room_ids, roomId],
        room_prices: { ...d.room_prices, [roomId]: d.room_prices[roomId] ?? baseRate },
      })
    }
  }
  function toggleFullHouse(accRoomIds: string[]) {
    const allSelected = accRoomIds.every(id => d.room_ids.includes(id))
    if (allSelected) {
      const newPrices = { ...d.room_prices }
      accRoomIds.forEach(id => delete newPrices[id])
      update({ room_ids: d.room_ids.filter(id => !accRoomIds.includes(id)), room_prices: newPrices })
    } else {
      const newPrices = { ...d.room_prices }
      accRoomIds.forEach(id => {
        if (!(id in newPrices)) newPrices[id] = roomRates.find(r => r.room_id === id)?.price_per_night ?? 0
      })
      update({ room_ids: [...d.room_ids.filter(id => !accRoomIds.includes(id)), ...accRoomIds], room_prices: newPrices })
    }
  }
  function isHouseAvailable(accId: string): boolean | null {
    if (!d.check_in || !d.check_out) return null
    const rentals = houseRentals.filter(r => r.accommodation_id === accId)
    if (rentals.length === 0) return false
    return rentals.some(r => r.start_date <= d.check_in && r.end_date >= d.check_out)
  }

  const canProceed: Record<number, boolean> = {
    1: creatingClient
      ? !!(d.new_client_first_name && d.new_client_last_name)
      : !!d.client_id,
    2: !!(d.check_in && d.check_out && d.check_in < d.check_out),
    3: true,
    4: true,
    5: true,
    6: true,
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-white w-full sm:max-w-xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[95dvh] sm:max-h-[90vh]">

        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-800">
              {isEditing ? 'Edit booking' : 'New booking'}
            </h2>
            <button onClick={onCancel} className="text-gray-400 hover:text-gray-700 font-bold text-xl w-8 h-8 flex items-center justify-center">✕</button>
          </div>
          <StepBar current={step} onGoto={goTo} maxReached={maxReached} />
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

          {/* ── Step 1: Client ──────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Who is booking? Select an existing client or create a new one.</p>

              {!creatingClient ? (
                <>
                  <Field label="Search client">
                    <input type="text" placeholder="Name or email…" value={clientSearch}
                      onChange={e => setClientSearch(e.target.value)} className={inputCls} />
                  </Field>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {clientsLoading ? (
                      <p className="text-sm text-gray-400 italic px-1 py-2">Loading clients…</p>
                    ) : filteredClients.length === 0 ? (
                      <p className="text-sm text-gray-400 italic px-1">No client found.</p>
                    ) : filteredClients.map(c => (
                      <button key={c.id} type="button"
                        onClick={() => update({ client_id: c.id })}
                        className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors
                          ${d.client_id === c.id ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-200 hover:border-gray-300 bg-white text-gray-800'}`}
                      >
                        <div className="font-medium">{c.first_name} {c.last_name}</div>
                        <div className="text-xs text-gray-400">{c.email ?? c.phone ?? c.nationality ?? '—'}</div>
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => { setCreatingClient(true); update({ client_id: '' }) }}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                    + Create new client
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    This client will be added to the client list on save.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="First name *">
                      <input type="text" value={d.new_client_first_name}
                        onChange={e => update({ new_client_first_name: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="Last name *">
                      <input type="text" value={d.new_client_last_name}
                        onChange={e => update({ new_client_last_name: e.target.value })} className={inputCls} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Email">
                      <input type="email" value={d.new_client_email}
                        onChange={e => update({ new_client_email: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="Phone">
                      <input type="tel" value={d.new_client_phone}
                        onChange={e => update({ new_client_phone: e.target.value })} className={inputCls} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Nationality">
                      <input type="text" value={d.new_client_nationality}
                        onChange={e => update({ new_client_nationality: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="Kite level">
                      <select value={d.new_client_kite_level}
                        onChange={e => update({ new_client_kite_level: e.target.value as WizardData['new_client_kite_level'] })}
                        className={inputCls}>
                        <option value="">— unknown —</option>
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </Field>
                  </div>
                  <button type="button" onClick={() => setCreatingClient(false)}
                    className="text-sm text-gray-500 hover:text-gray-700">← Back to list</button>
                </>
              )}
            </div>
          )}

          {/* ── Step 2: Stay ────────────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Kite center dates */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">🏄 Kite center stay</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Check-in *">
                    <input type="date" value={d.check_in}
                      onChange={e => {
                        const val = e.target.value
                        update({ check_in: val, ...(d.visa_entry_date === '' || d.visa_entry_date === d.check_in ? { visa_entry_date: val } : {}) })
                      }} className={inputCls} />
                  </Field>
                  <Field label="Check-out *">
                    <input type="date" value={d.check_out}
                      onChange={e => {
                        const val = e.target.value
                        update({ check_out: val, ...(d.visa_exit_date === '' || d.visa_exit_date === d.check_out ? { visa_exit_date: val } : {}) })
                      }} className={inputCls} />
                  </Field>
                </div>
                {nights > 0 && (
                  <p className="text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2 font-medium mt-2">
                    {nights} night{nights > 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {/* Visa / Mozambique dates */}
              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">🛂 Mozambique — visa dates</p>
                <p className="text-xs text-gray-400 mb-2">Entry/exit dates in the country, used for the visa invitation letter. Can differ from the center stay.</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Entry date">
                    <input type="date" value={d.visa_entry_date}
                      onChange={e => update({ visa_entry_date: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Exit date">
                    <input type="date" value={d.visa_exit_date}
                      onChange={e => update({ visa_exit_date: e.target.value })} className={inputCls} />
                  </Field>
                </div>
              </div>

              <Field label="Rooms" hint="Optional — can be assigned later in the planning view">
                <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                  {d.room_ids.length === 0 && (
                    <p className="text-xs text-gray-400 italic px-1">No room selected — click to assign.</p>
                  )}
                  {roomsByAcco.map(({ acc, rooms: accRooms }) => {
                    const isHouse = acc.type === 'house'
                    const accRoomIds = accRooms.map(r => r.id)
                    const allSelected = accRoomIds.every(id => d.room_ids.includes(id))
                    const availability = isHouse ? isHouseAvailable(acc.id) : null
                    return (
                      <div key={acc.id}>
                        <div className="flex items-center gap-2 px-1 mb-1">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{acc.name}</p>
                          {isHouse && availability === false && (
                            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Not rented</span>
                          )}
                          {isHouse && availability === true && (
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">Available</span>
                          )}
                        </div>
                        <div className="space-y-1">
                          {isHouse && accRooms.length === 2 && (
                            <button type="button" onClick={() => toggleFullHouse(accRoomIds)}
                              className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors font-medium
                                ${allSelected ? 'border-purple-500 bg-purple-50 text-purple-800' : 'border-gray-200 hover:border-gray-300 text-gray-700'}`}>
                              🏠 Full house (F + B)
                            </button>
                          )}
                          {accRooms.map(r => (
                            <button key={r.id} type="button" onClick={() => toggleRoom(r.id)}
                              className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors
                                ${d.room_ids.includes(r.id) ? 'border-blue-500 bg-blue-50 text-blue-800 font-medium' : 'border-gray-200 hover:border-gray-300 text-gray-700'}`}>
                              {acc.name} / {r.name}
                              <span className="text-xs text-gray-400 ml-2">capacity {r.capacity}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Field>


              {d.room_ids.length > 0 && nights > 0 && (
                <div className="border-t pt-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">💰 Pricing</p>
                  <div className="space-y-2">
                    {d.room_ids.map(rid => {
                      const room = rooms.find(r => r.id === rid)
                      const acc = accommodations.find(a => a.id === room?.accommodation_id)
                      return (
                        <div key={rid} className="flex items-center gap-2">
                          <span className="text-sm text-gray-700 flex-1 truncate">{acc?.name} / {room?.name}</span>
                          <input
                            type="number" min="0" step="1"
                            value={d.room_prices[rid] ?? 0}
                            onChange={e => update({ room_prices: { ...d.room_prices, [rid]: parseFloat(e.target.value) || 0 } })}
                            className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-xs text-gray-400 shrink-0">€/night</span>
                          <span className="text-xs text-gray-500 w-16 text-right shrink-0">= {(d.room_prices[rid] ?? 0) * nights} €</span>
                        </div>
                      )
                    })}
                    {d.room_ids.length > 1 && (
                      <div className="flex justify-between items-center pt-2 border-t text-sm font-semibold text-gray-700">
                        <span>Total accommodation</span>
                        <span>{d.room_ids.reduce((s, id) => s + (d.room_prices[id] ?? 0) * nights, 0)} €</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Field label="Status">
                <div className="flex gap-2">
                  {(['provisional', 'confirmed', 'cancelled'] as BookingStatus[]).map(s => (
                    <button key={s} type="button" onClick={() => update({ status: s })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize border transition-colors
                        ${d.status === s
                          ? s === 'confirmed' ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : s === 'cancelled' ? 'bg-gray-200 text-gray-700 border-gray-400'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          )}

          {/* ── Step 3: Guests ──────────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Add each person staying — their names and passport numbers are needed for the visa document.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Couples">
                  <Counter value={d.couples_count} onChange={v => update({ couples_count: v })} />
                </Field>
                <Field label="Children">
                  <Counter value={d.children_count} onChange={v => update({ children_count: v })} />
                </Field>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800">
                    Participants
                    <span className="ml-2 font-normal text-gray-400">{d.participants.length} person{d.participants.length !== 1 ? 's' : ''}</span>
                  </h3>
                  <button type="button" onClick={addParticipant}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium">+ Add</button>
                </div>

                {d.participants.length === 0 && (
                  <p className="text-xs text-gray-400 italic">No participants yet. Add them for visa document generation.</p>
                )}

                <div className="space-y-2">
                  {d.participants.map((p, i) => (
                    <div key={p.id} className="flex gap-1.5 items-start">
                      <div className="flex-1 grid grid-cols-3 gap-1">
                        <input placeholder="First name" value={p.first_name}
                          onChange={e => updateParticipant(i, 'first_name', e.target.value)}
                          className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        <input placeholder="Last name" value={p.last_name}
                          onChange={e => updateParticipant(i, 'last_name', e.target.value)}
                          className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        <input placeholder="Passport #" value={p.passport_number}
                          onChange={e => updateParticipant(i, 'passport_number', e.target.value)}
                          className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <button type="button" onClick={() => removeParticipant(i)}
                        className="shrink-0 text-red-400 hover:text-red-600 text-lg leading-none px-0.5 mt-1">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Transport ───────────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-5">
              {/* Arrival */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">✈️ Arrival</h3>
                <div className="space-y-3">
                  <Field label="Arrival time">
                    <input type="time" value={d.arrival_time}
                      onChange={e => update({ arrival_time: e.target.value })} className={inputCls} />
                  </Field>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={d.taxi_arrival}
                      onChange={e => update({ taxi_arrival: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300" />
                    <span className="text-sm text-gray-700">🚕 Taxi needed on arrival</span>
                  </label>
                </div>
              </div>

              {/* Departure */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">🛫 Departure</h3>
                <div className="space-y-3">
                  <Field label="Departure time">
                    <input type="time" value={d.departure_time}
                      onChange={e => update({ departure_time: e.target.value })} className={inputCls} />
                  </Field>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={d.taxi_departure}
                      onChange={e => update({ taxi_departure: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300" />
                    <span className="text-sm text-gray-700">🚕 Taxi needed on departure</span>
                  </label>
                </div>
              </div>

              {/* Baggage */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">🧳 Baggage</h3>
                <div className="grid grid-cols-2 gap-6">
                  <Field label="Suitcases / bags">
                    <Counter value={d.luggage_count} onChange={v => update({ luggage_count: v })} />
                  </Field>
                  <Field label="Boardbags">
                    <Counter value={d.boardbag_count} onChange={v => update({ boardbag_count: v })} />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 5: KiteCenter ──────────────────────────────────────── */}
          {step === 5 && (
            <div className="space-y-5">
              <p className="text-sm text-gray-500">
                How many people in this group want each service? Each is billed separately.
              </p>

              <div className="space-y-4">
                {/* Lessons */}
                <div className="flex items-center justify-between p-4 bg-purple-50 border border-purple-200 rounded-xl">
                  <div>
                    <p className="font-semibold text-purple-900 text-sm">📚 Lessons</p>
                    <p className="text-xs text-purple-600 mt-0.5">Persons wanting kite lessons</p>
                  </div>
                  <Counter value={d.num_lessons} onChange={v => update({ num_lessons: v })} />
                </div>

                {/* Rentals */}
                <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div>
                    <p className="font-semibold text-amber-900 text-sm">🪁 Equipment rental</p>
                    <p className="text-xs text-amber-600 mt-0.5">Persons renting kite, board, etc.</p>
                  </div>
                  <Counter value={d.num_equipment_rentals} onChange={v => update({ num_equipment_rentals: v })} />
                </div>

                {/* Center access only */}
                <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div>
                    <p className="font-semibold text-blue-900 text-sm">🏖️ Center access</p>
                    <p className="text-xs text-blue-600 mt-0.5">Persons using the center only (no lesson, no rental)</p>
                  </div>
                  <Counter value={d.num_center_access} onChange={v => update({ num_center_access: v })} />
                </div>
              </div>

              {(d.num_lessons + d.num_equipment_rentals + d.num_center_access) > 0 && (
                <p className="text-sm text-gray-500 text-right">
                  Total: <span className="font-semibold text-gray-700">{d.num_lessons + d.num_equipment_rentals + d.num_center_access} person{(d.num_lessons + d.num_equipment_rentals + d.num_center_access) > 1 ? 's' : ''}</span> using the center
                </p>
              )}
            </div>
          )}

          {/* ── Step 6: Payment ─────────────────────────────────────────── */}
          {step === 6 && (
            <div className="space-y-4">
              <Field label="Amount already paid (€)">
                <input type="number" min="0" value={d.amount_paid || ''}
                  onChange={e => update({ amount_paid: parseFloat(e.target.value) || 0 })}
                  placeholder="0" className={numCls} />
              </Field>

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-2 text-sm">
                <p className="font-semibold text-gray-700 mb-2">Summary</p>
                <div className="flex justify-between text-gray-600">
                  <span>Status</span>
                  <span className={`font-medium capitalize ${d.status === 'confirmed' ? 'text-emerald-700' : d.status === 'cancelled' ? 'text-gray-500' : 'text-amber-700'}`}>{d.status}</span>
                </div>
                {d.check_in && d.check_out && (
                  <div className="flex justify-between text-gray-600">
                    <span>🏄 Stay</span>
                    <span>{d.check_in} → {d.check_out} ({nights}n)</span>
                  </div>
                )}
                {(d.visa_entry_date || d.visa_exit_date) && (
                  <div className="flex justify-between text-gray-600">
                    <span>🛂 Visa dates</span>
                    <span>{d.visa_entry_date || '?'} → {d.visa_exit_date || '?'}</span>
                  </div>
                )}
                {d.room_ids.length > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Room{d.room_ids.length > 1 ? 's' : ''}</span>
                    <span>{d.room_ids.map(rid => {
                      const r = rooms.find(r => r.id === rid)
                      const a = accommodations.find(a => a.id === r?.accommodation_id)
                      return r ? `${a?.name}/${r.name}` : '—'
                    }).join(', ')}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>Participants</span>
                  <span>{d.participants.length} person{d.participants.length !== 1 ? 's' : ''}</span>
                </div>
                {(d.taxi_arrival || d.taxi_departure) && (
                  <div className="flex justify-between text-gray-600">
                    <span>Taxis</span>
                    <span>{[d.taxi_arrival && 'arrival', d.taxi_departure && 'departure'].filter(Boolean).join(' + ')}</span>
                  </div>
                )}
                {(d.luggage_count > 0 || d.boardbag_count > 0) && (
                  <div className="flex justify-between text-gray-600">
                    <span>Baggage</span>
                    <span>{d.luggage_count} bag{d.luggage_count !== 1 ? 's' : ''}{d.boardbag_count > 0 ? ` · ${d.boardbag_count} boardbag${d.boardbag_count !== 1 ? 's' : ''}` : ''}</span>
                  </div>
                )}
                {(d.num_lessons > 0 || d.num_equipment_rentals > 0 || d.num_center_access > 0) && (
                  <div className="flex justify-between text-gray-600">
                    <span>KiteCenter</span>
                    <span>
                      {[
                        d.num_lessons > 0 && `${d.num_lessons} lesson${d.num_lessons > 1 ? 's' : ''}`,
                        d.num_equipment_rentals > 0 && `${d.num_equipment_rentals} rental${d.num_equipment_rentals > 1 ? 's' : ''}`,
                        d.num_center_access > 0 && `${d.num_center_access} access`,
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                )}
              </div>

              <Field label="Internal notes">
                <textarea value={d.notes} onChange={e => update({ notes: e.target.value })}
                  rows={3} placeholder="Allergies, special requests, Google Form reference…" className={inputCls} />
              </Field>
            </div>
          )}

        </div>

        {/* Footer nav */}
        <div className="px-5 py-4 border-t flex gap-3 bg-white">
          {step > 1 && (
            <button type="button" onClick={back}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm">
              ← Back
            </button>
          )}
          <div className="flex-1" />
          {step < 6 ? (
            <button type="button" onClick={next} disabled={!canProceed[step]}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg font-semibold text-sm transition-colors">
              Next →
            </button>
          ) : (
            <button type="button" onClick={() => onSave(d, !isEditing)}
              className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-sm transition-colors">
              ✓ Save booking
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusLabel: Record<BookingStatus, string> = {
  confirmed: 'Confirmed', provisional: 'Provisional', cancelled: 'Cancelled',
}
const statusColor: Record<BookingStatus, string> = {
  confirmed: 'bg-emerald-100 text-emerald-800',
  provisional: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-gray-200 text-gray-500',
}

type MissingField = 'room' | 'participants' | 'arrival_time' | 'visa_dates' | 'taxi_time'

function getMissingFields(b: Booking, hasRoom: boolean, bParticipants: BookingParticipant[]): MissingField[] {
  if (b.status === 'cancelled') return []
  const missing: MissingField[] = []
  if (!hasRoom) missing.push('room')
  if (!bParticipants.some(p => p.booking_id === b.id)) missing.push('participants')
  if (!b.arrival_time) missing.push('arrival_time')
  if (!b.visa_entry_date || !b.visa_exit_date) missing.push('visa_dates')
  if ((b.taxi_arrival && !b.arrival_time) || (b.taxi_departure && !b.departure_time)) missing.push('taxi_time')
  return missing
}

const MISSING_LABELS: Record<MissingField, string> = {
  room: 'No room',
  participants: 'No guests',
  arrival_time: 'No arrival time',
  visa_dates: 'Visa dates missing',
  taxi_time: 'Taxi time missing',
}

function getNights(b: Booking) {
  if (!b.check_in || !b.check_out) return 0
  return Math.max(0, (new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000)
}

type FilterKey = 'all' | 'complete' | 'incomplete' | 'upcoming' | 'active' | 'confirmed' | 'provisional' | 'cancelled'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',         label: 'All' },
  { key: 'complete',    label: '✅ Complete' },
  { key: 'incomplete',  label: '⚠️ Incomplete' },
  { key: 'upcoming',    label: '📅 Upcoming' },
  { key: 'active',      label: '🏄 Active' },
  { key: 'confirmed',   label: 'Confirmed' },
  { key: 'provisional', label: 'Provisional' },
  { key: 'cancelled',   label: 'Cancelled' },
]

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function BookingsPage() {
  const { data: bookings, loading, error, refresh: refreshBookings } = useBookings()
  const { data: clients, loading: clientsLoading, refresh: refreshClients } = useClients()
  const { data: bookingRooms, refresh: refreshBookingRooms } = useBookingRooms()
  const { data: bookingRoomPricesData } = useBookingRoomPrices()
  const { data: rooms } = useRooms()
  const { data: accommodations } = useAccommodations()
  const { data: houseRentals } = useTable<HouseRental>('house_rentals')
  const { data: roomRatesData } = useTable<RoomRate>('room_rates')
  const { data: participantsData } = useBookingParticipants()
  const [bookingParticipants, setBookingParticipants] = useState<BookingParticipant[]>([])
  useEffect(() => setBookingParticipants(participantsData), [participantsData])

  const [wizard, setWizard] = useState<{ open: boolean; editing: Booking | null }>({ open: false, editing: null })
  const [filter, setFilter] = useState<FilterKey>('all')
  const [saving, setSaving] = useState(false)

  const getClientName = (id: string) => {
    const c = clients.find(c => c.id === id)
    return c ? `${c.first_name} ${c.last_name}` : '?'
  }

  const getRoomLabel = (bookingId: string) => {
    const brs = bookingRooms.filter(b => b.booking_id === bookingId)
    if (brs.length === 0) return '—'
    return brs.map(br => {
      const r = rooms.find(r => r.id === br.room_id)
      const a = accommodations.find(a => a.id === r?.accommodation_id)
      return r ? `${a?.name}/${r.name}` : '—'
    }).join(', ')
  }

  function openNew() { setWizard({ open: true, editing: null }) }
  function openEdit(b: Booking) { setWizard({ open: true, editing: b }) }
  function closeWizard() { setWizard({ open: false, editing: null }) }

  async function handleSave(data: WizardData, isNew: boolean) {
    setSaving(true)
    let clientId = data.client_id

    // 1. Create new client if needed
    if (!clientId && data.new_client_first_name) {
      const { data: newClientData, error: clientErr } = await supabase
        .from('clients')
        .insert({
          first_name: data.new_client_first_name,
          last_name: data.new_client_last_name,
          email: data.new_client_email || null,
          phone: data.new_client_phone || null,
          nationality: data.new_client_nationality || null,
          kite_level: data.new_client_kite_level || null,
          notes: null, passport_number: null, birth_date: null, import_id: null,
          emergency_contact_name: null, emergency_contact_phone: null,
          emergency_contact_email: null, emergency_contact_relation: null,
        })
        .select('id')
        .single()
      if (clientErr) {
        console.error('Client insert error:', clientErr)
        alert('Error creating client: ' + clientErr.message)
        setSaving(false)
        return
      }
      clientId = newClientData.id
      refreshClients()
    }

    if (!clientId) {
      alert('Please select or create a client.')
      setSaving(false)
      return
    }

    // 2. Insert or update booking
    const bookingFields = {
      client_id: clientId,
      check_in: data.check_in,
      check_out: data.check_out,
      visa_entry_date: data.visa_entry_date || null,
      visa_exit_date: data.visa_exit_date || null,
      status: data.status,
      notes: data.notes || null,
      num_lessons: data.num_lessons,
      num_equipment_rentals: data.num_equipment_rentals,
      num_center_access: data.num_center_access,
      arrival_time: data.arrival_time || null,
      departure_time: data.departure_time || null,
      luggage_count: data.luggage_count,
      boardbag_count: data.boardbag_count,
      taxi_arrival: data.taxi_arrival,
      taxi_departure: data.taxi_departure,
      couples_count: data.couples_count,
      children_count: data.children_count,
      amount_paid: data.amount_paid,
      emergency_contact_name: null,
      emergency_contact_phone: null,
      emergency_contact_email: null,
    }

    let bookingId: string
    if (isNew) {
      // booking_number auto-assigned by DB sequence
      const { data: saved, error: bookingErr } = await supabase
        .from('bookings')
        .insert({ ...bookingFields, import_id: null })
        .select('id')
        .single()
      if (bookingErr) {
        console.error('Booking insert error:', bookingErr)
        alert('Error saving booking: ' + bookingErr.message)
        setSaving(false)
        return
      }
      bookingId = saved.id
    } else {
      const { data: saved, error: bookingErr } = await supabase
        .from('bookings')
        .update({ ...bookingFields, import_id: wizard.editing?.import_id ?? null })
        .eq('id', wizard.editing!.id)
        .select('id')
        .single()
      if (bookingErr) {
        console.error('Booking update error:', bookingErr)
        alert('Error saving booking: ' + bookingErr.message)
        setSaving(false)
        return
      }
      bookingId = saved.id
    }
    // 3. Guests — delete all + re-insert to booking_participants
    const { error: delErr } = await supabase.from('booking_participants').delete().eq('booking_id', bookingId)
    if (delErr) console.error('booking_participants delete error:', delErr)

    // If no participants entered, auto-add the main client
    const named = data.participants.filter(p => p.first_name.trim())
    const autoList = named.length === 0 ? (() => {
      const firstName = data.new_client_first_name || clients.find(c => c.id === clientId)?.first_name || ''
      const lastName  = data.new_client_last_name  || clients.find(c => c.id === clientId)?.last_name  || ''
      return firstName ? [{ first_name: firstName, last_name: lastName }] : []
    })() : []
    const participantsToInsert = [
      ...named.map(p => ({ first_name: p.first_name.trim(), last_name: p.last_name.trim() || null, passport_number: p.passport_number.trim() || null })),
      ...autoList.map(p => ({ ...p, passport_number: null })),
    ]
    if (participantsToInsert.length > 0) {
      const { data: inserted, error: insErr } = await supabase.from('booking_participants').insert(
        participantsToInsert.map(p => ({
          booking_id: bookingId,
          first_name: p.first_name,
          last_name: p.last_name || null,
          passport_number: p.passport_number || null,
          client_id: null,
          notes: null,
        }))
      ).select()
      if (insErr) {
        console.error('booking_participants insert error:', insErr)
        alert('Error saving guests: ' + insErr.message)
      } else if (inserted) {
        setBookingParticipants(prev => [
          ...prev.filter(p => p.booking_id !== bookingId),
          ...(inserted as BookingParticipant[]),
        ])
      }
    } else {
      setBookingParticipants(prev => prev.filter(p => p.booking_id !== bookingId))
    }

    // 4. Booking rooms (delete all + re-insert)
    await supabase.from('booking_rooms').delete().eq('booking_id', bookingId)
    if (data.room_ids.length > 0) {
      await supabase.from('booking_rooms').insert(
        data.room_ids.map(rid => ({ booking_id: bookingId, room_id: rid }))
      )
    }

    // 5. Booking room prices (delete all + re-insert)
    await supabase.from('booking_room_prices').delete().eq('booking_id', bookingId)
    if (data.room_ids.length > 0) {
      await supabase.from('booking_room_prices').insert(
        data.room_ids.map(rid => ({
          booking_id: bookingId,
          room_id: rid,
          price_per_night: data.room_prices[rid] ?? 0,
          override_note: null,
        }))
      )
    }

    refreshBookings()
    refreshBookingRooms()
    setSaving(false)
    closeWizard()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this booking?')) return
    const { error: err } = await supabase.from('bookings').delete().eq('id', id)
    if (err) { alert('Delete error: ' + err.message); return }
    refreshBookings()
    refreshBookingRooms()
  }

  function bookingToWizard(b: Booking): WizardData {
    const brs = bookingRooms.filter(r => r.booking_id === b.id)
    const existingPrices = bookingRoomPricesData.filter(p => p.booking_id === b.id)
    const room_prices: Record<string, number> = {}
    brs.forEach(br => {
      const snap = existingPrices.find(p => p.room_id === br.room_id)
      room_prices[br.room_id] = snap?.price_per_night ?? roomRatesData.find(r => r.room_id === br.room_id)?.price_per_night ?? 0
    })
    return {
      ...EMPTY_WIZARD,
      client_id: b.client_id,
      check_in: b.check_in, check_out: b.check_out,
      visa_entry_date: b.visa_entry_date ?? '', visa_exit_date: b.visa_exit_date ?? '',
      room_ids: brs.map(r => r.room_id),
      room_prices,
      status: b.status,
      participants: (() => {
        const existing = bookingParticipants.filter(p => p.booking_id === b.id).map(p => ({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name ?? '',
          passport_number: p.passport_number ?? '',
        }))
        if (existing.length > 0) return existing
        // No participants yet — pre-fill with main client
        const c = clients.find(cl => cl.id === b.client_id)
        return c ? [{ id: `pre_${b.id}`, first_name: c.first_name, last_name: c.last_name, passport_number: '' }] : []
      })(),
      couples_count: b.couples_count, children_count: b.children_count,
      arrival_time: b.arrival_time ?? '', departure_time: b.departure_time ?? '',
      taxi_arrival: b.taxi_arrival, taxi_departure: b.taxi_departure,
      luggage_count: b.luggage_count, boardbag_count: b.boardbag_count,
      num_lessons: b.num_lessons, num_equipment_rentals: b.num_equipment_rentals, num_center_access: b.num_center_access,
      amount_paid: b.amount_paid, notes: b.notes ?? '',
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  const filteredBookings = bookings.filter(b => {
    const hasRoom = bookingRooms.some(br => br.booking_id === b.id)
    const missing = getMissingFields(b, hasRoom, bookingParticipants)
    const isComplete = missing.length === 0
    const isUpcoming = b.check_in > today
    const isActive = b.check_in <= today && b.check_out > today
    switch (filter) {
      case 'complete':    return isComplete
      case 'incomplete':  return !isComplete && b.status !== 'cancelled'
      case 'upcoming':    return isUpcoming && b.status !== 'cancelled'
      case 'active':      return isActive && b.status !== 'cancelled'
      case 'confirmed':   return b.status === 'confirmed'
      case 'provisional': return b.status === 'provisional'
      case 'cancelled':   return b.status === 'cancelled'
      default:            return true
    }
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading bookings...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <p className="text-red-700 font-semibold">Error loading bookings</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800">Bookings</h1>
            <p className="text-gray-500 mt-1 text-sm">{filteredBookings.length} of {bookings.length} booking{bookings.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={openNew}
            className="w-full md:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors">
            + New booking
          </button>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === f.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-500 w-12">#</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">Client</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">Stay</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">Room</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">Dates</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">Status</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">⚠</th>
                <th className="px-3 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map(b => {
                const hasRoom = bookingRooms.some(br => br.booking_id === b.id)
                const missing = getMissingFields(b, hasRoom, bookingParticipants)
                const nights = getNights(b)
                const isIncomplete = missing.length > 0
                const isCancelled = b.status === 'cancelled'
                const isActive = b.check_in <= today && b.check_out > today

                // Compact info codes
                const codes = [
                  bookingParticipants.filter(p => p.booking_id === b.id).length > 0 && `${bookingParticipants.filter(p => p.booking_id === b.id).length}G`,
                  nights > 0 && `${nights}n`,
                  b.num_lessons > 0 && `${b.num_lessons}L`,
                  b.num_equipment_rentals > 0 && `${b.num_equipment_rentals}R`,
                  b.num_center_access > 0 && `${b.num_center_access}C`,
                ].filter(Boolean).join(' · ')

                const rowBg = isCancelled
                  ? 'bg-gray-50 opacity-60'
                  : isIncomplete
                    ? 'bg-amber-50 border-l-2 border-l-amber-400'
                    : isActive
                      ? 'bg-blue-50 border-l-2 border-l-blue-400'
                      : ''

                return (
                  <tr key={b.id}
                    className={`border-b hover:brightness-95 cursor-pointer transition-colors ${rowBg}`}
                    onClick={() => openEdit(b)}>
                    <td className="px-3 py-2 font-mono text-gray-400 whitespace-nowrap">
                      #{String(b.booking_number).padStart(3, '0')}
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">
                      {getClientName(b.client_id)}
                    </td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap font-mono text-xs">
                      {codes || '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                      {getRoomLabel(b.id)}
                    </td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-xs">
                      {b.check_in} → {b.check_out}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor[b.status]}`}>
                        {statusLabel[b.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {isIncomplete && !isCancelled && (
                        <span title={missing.map(m => MISSING_LABELS[m]).join(', ')}
                          className="text-amber-500 cursor-help text-sm">⚠️</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEdit(b)} className="text-gray-400 hover:text-blue-600 mr-2">✏️</button>
                      <button onClick={() => handleDelete(b.id)} className="text-gray-400 hover:text-red-600">🗑️</button>
                    </td>
                  </tr>
                )
              })}
              {filteredBookings.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">No bookings match this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="hidden md:flex items-center gap-4 mt-2 text-xs text-gray-400">
          <span>Stay codes:</span>
          <span><b className="text-gray-500">G</b> guests · <b className="text-gray-500">n</b> nights · <b className="text-gray-500">L</b> lessons · <b className="text-gray-500">R</b> rentals · <b className="text-gray-500">C</b> center access</span>
          <span className="ml-4 flex items-center gap-1"><span className="inline-block w-3 h-3 bg-blue-100 border-l-2 border-blue-400 rounded-sm" /> Active now</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-amber-100 border-l-2 border-amber-400 rounded-sm" /> Incomplete</span>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-4">
          {bookings.map(b => (
            <div key={b.id} className="bg-white rounded-lg shadow p-4" onClick={() => openEdit(b)}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold text-gray-800">
                    <span className="font-mono text-gray-400 text-xs mr-1">#{String(b.booking_number).padStart(3, '0')}</span>
                    {getClientName(b.client_id)}
                  </p>
                  <p className="text-sm text-gray-500">{getRoomLabel(b.id)}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColor[b.status]}`}>
                  {statusLabel[b.status]}
                </span>
              </div>
              <div className="text-sm text-gray-600 space-y-1 mb-3">
                <p>📅 {b.check_in} → {b.check_out}</p>
                <p>👥 {bookingParticipants.filter(p => p.booking_id === b.id).length} pax · 📚 {b.num_lessons} lessons
                  {(b.taxi_arrival || b.taxi_departure) && ` · 🚕`}
                </p>
              </div>
              <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                <button onClick={() => openEdit(b)}
                  className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded font-medium text-sm hover:bg-blue-200">✏️ Edit</button>
                <button onClick={() => handleDelete(b.id)}
                  className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded font-medium text-sm hover:bg-red-200">🗑️ Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Wizard */}
      {wizard.open && (
        <BookingWizard
          initial={wizard.editing ? bookingToWizard(wizard.editing) : EMPTY_WIZARD}
          clients={clients}
          clientsLoading={clientsLoading}
          rooms={rooms}
          accommodations={accommodations}
          houseRentals={houseRentals}
          roomRates={roomRatesData}
          isEditing={!!wizard.editing}
          onCancel={closeWizard}
          onSave={handleSave}
        />
      )}

      {/* Saving overlay */}
      {saving && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg px-8 py-5 shadow-xl">
            <p className="text-gray-700 font-medium">Saving...</p>
          </div>
        </div>
      )}
    </div>
  )
}
