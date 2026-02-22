import { useState, useMemo, useCallback } from 'react'
import { mockInstructors, mockDiningEvents, mockRooms, mockAccommodations } from '../../data/mock'
import type { Booking, BookingRoom, DiningEvent, EventAttendee, EventType } from '../../types/database'

// ─── Constants ────────────────────────────────────────────────────────────────

const MENU_FIELDS: { key: keyof Pick<EventAttendee, 'starter' | 'main' | 'side' | 'dessert'>; label: string }[] = [
  { key: 'starter', label: 'Starter' },
  { key: 'main',    label: 'Main' },
  { key: 'side',    label: 'Side' },
  { key: 'dessert', label: 'Dessert' },
]

const personIcon = (type: EventAttendee['person_type']) =>
  type === 'instructor' ? '👨‍🏫' : type === 'client' ? '🏄' : '👤'

// ─── Top-level sub-components (MUST be outside NowView to avoid focus loss) ──

interface AttendeeProps {
  a: EventAttendee
  isMenu: boolean
  eventPrice: number
  onUpdate: (id: string, changes: Partial<EventAttendee>) => void
  onRemove: (id: string) => void
}

function AttendeeTableRow({ a, isMenu, eventPrice, onUpdate, onRemove }: AttendeeProps) {
  const effectivePrice = a.price_override ?? eventPrice
  return (
    <tr className={`border-b transition-opacity ${a.is_attending ? '' : 'opacity-40'}`}>
      <td className="px-3 py-2 text-xs whitespace-nowrap">
        <div className="flex items-center gap-1">
          <button onClick={() => onRemove(a.id)} className="text-gray-300 hover:text-red-400 text-xs mr-1">✕</button>
          <span>{personIcon(a.person_type)}</span>
          <span className="font-medium text-gray-800">{a.person_name}</span>
          {a.room_label && <span className="text-gray-400 ml-1">({a.room_label})</span>}
        </div>
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox" checked={a.is_attending}
          onChange={e => onUpdate(a.id, { is_attending: e.target.checked })}
          className="w-4 h-4 accent-emerald-500 cursor-pointer"
        />
      </td>
      {isMenu && MENU_FIELDS.map(f => (
        <td key={f.key} className="px-1 py-1">
          <input
            type="text" value={a[f.key]} placeholder="—"
            disabled={!a.is_attending}
            onChange={e => onUpdate(a.id, { [f.key]: e.target.value })}
            className="w-full text-xs px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-400"
          />
        </td>
      ))}
      {eventPrice > 0 && (
        <td className="px-2 py-1">
          <input
            type="number" min="0"
            value={a.price_override ?? ''}
            placeholder={String(eventPrice)}
            disabled={!a.is_attending}
            onChange={e => onUpdate(a.id, { price_override: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
            className={`w-16 text-xs px-2 py-1 border rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-50 ${
              a.price_override !== undefined ? 'border-amber-300 bg-amber-50' : 'border-gray-200'
            }`}
          />
        </td>
      )}
      {eventPrice > 0 && (
        <td className="px-3 py-1 text-xs text-right font-medium text-gray-600 whitespace-nowrap">
          {a.is_attending ? `€${effectivePrice}` : '—'}
        </td>
      )}
    </tr>
  )
}

function AttendeeCard({ a, isMenu, eventPrice, onUpdate, onRemove }: AttendeeProps) {
  const effectivePrice = a.price_override ?? eventPrice
  return (
    <div className={`bg-white border rounded-lg p-3 transition-opacity ${a.is_attending ? '' : 'opacity-40'}`}>
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-1 min-w-0">
          <button onClick={() => onRemove(a.id)} className="text-gray-300 hover:text-red-400 text-xs shrink-0">✕</button>
          <span className="shrink-0">{personIcon(a.person_type)}</span>
          <span className="font-medium text-sm text-gray-800 truncate">{a.person_name}</span>
          {a.room_label && <span className="text-xs text-gray-400 shrink-0">({a.room_label})</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {eventPrice > 0 && a.is_attending && (
            <input
              type="number" min="0"
              value={a.price_override ?? ''}
              placeholder={String(eventPrice)}
              onChange={e => onUpdate(a.id, { price_override: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
              className={`w-14 text-xs px-1.5 py-1 border rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                a.price_override !== undefined ? 'border-amber-300 bg-amber-50' : 'border-gray-200'
              }`}
            />
          )}
          <input
            type="checkbox" checked={a.is_attending}
            onChange={e => onUpdate(a.id, { is_attending: e.target.checked })}
            className="w-4 h-4 accent-emerald-500 cursor-pointer"
          />
        </div>
      </div>
      {isMenu && (
        <div className="grid grid-cols-2 gap-1 mt-2">
          {MENU_FIELDS.map(f => (
            <div key={f.key}>
              <label className="text-xs text-gray-400">{f.label}</label>
              <input
                type="text" value={a[f.key]} placeholder="—"
                disabled={!a.is_attending}
                onChange={e => onUpdate(a.id, { [f.key]: e.target.value })}
                className="w-full text-xs px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-50"
              />
            </div>
          ))}
        </div>
      )}
      {eventPrice > 0 && a.is_attending && (
        <div className="text-xs text-right text-gray-500 mt-1.5 font-medium">
          {a.price_override !== undefined
            ? <span className="text-amber-600">€{effectivePrice} <span className="text-gray-400 font-normal">(custom)</span></span>
            : `€${effectivePrice}`
          }
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRoomLabel(bookingId: string, bookingRooms: BookingRoom[]): string {
  const br = bookingRooms.find(b => b.booking_id === bookingId)
  if (!br) return ''
  const room = mockRooms.find(r => r.id === br.room_id)
  const acc = room ? mockAccommodations.find(a => a.id === room.accommodation_id) : null
  return room && acc ? `${acc.name}/${room.name}` : ''
}

function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mt-4 mb-1">
      {label} <span className="font-normal">({count})</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface NowViewProps {
  bookings: Booking[]
  bookingRooms: BookingRoom[]
}

type View = 'table' | 'cards'

export default function NowView({ bookings, bookingRooms }: NowViewProps) {
  const today = new Date().toISOString().slice(0, 10)

  // ── Instructor presence ───────────────────────────────────────────
  const [presence, setPresence] = useState<Record<string, boolean>>(
    Object.fromEntries(mockInstructors.map(i => [i.id, true]))
  )
  const togglePresence = (id: string) =>
    setPresence(p => ({ ...p, [id]: !p[id] }))

  // ── Events ────────────────────────────────────────────────────────
  const [events, setEvents] = useState<DiningEvent[]>([...mockDiningEvents])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [view, setView] = useState<View>('table')
  const [showHistory, setShowHistory] = useState(false)
  const [extraName, setExtraName] = useState('')

  const activeEvent = useMemo(() => events.find(e => e.id === activeId) ?? null, [events, activeId])

  // ── Auto-detect present guests ────────────────────────────────────
  const buildAttendees = useCallback((): EventAttendee[] => {
    const list: EventAttendee[] = []
    for (const inst of mockInstructors) {
      if (!presence[inst.id]) continue
      list.push({
        id: `new-${inst.id}-${Date.now()}`, person_id: inst.id,
        person_type: 'instructor', person_name: `${inst.first_name} ${inst.last_name}`,
        room_label: '', is_attending: true, starter: '', main: '', side: '', dessert: '',
      })
    }
    for (const b of bookings) {
      if (b.check_in > today || b.check_out <= today) continue
      const roomLabel = getRoomLabel(b.id, bookingRooms)
      const people = b.participants.length > 0
        ? b.participants.map(p => ({ id: p.id, name: `${p.first_name} ${p.last_name}` }))
        : b.client ? [{ id: b.client_id, name: `${b.client.first_name} ${b.client.last_name}` }] : []
      for (const person of people) {
        list.push({
          id: `new-${person.id}-${Date.now()}`, person_id: person.id,
          person_type: 'client', person_name: person.name,
          room_label: roomLabel, is_attending: true, starter: '', main: '', side: '', dessert: '',
        })
      }
    }
    return list
  }, [presence, bookings, bookingRooms, today])

  // ── Event mutations ───────────────────────────────────────────────
  const createEvent = () => {
    const ev: DiningEvent = {
      id: `ev${Date.now()}`, name: '', date: today, time: '20:00',
      type: 'count', price_per_person: 0, notes: '', attendees: buildAttendees(),
    }
    setEvents(prev => [ev, ...prev])
    setActiveId(ev.id)
  }

  const duplicateEvent = (ev: DiningEvent) => {
    const copy: DiningEvent = {
      ...ev, id: `ev${Date.now()}`, name: `${ev.name} (copy)`,
      date: today, attendees: buildAttendees(),
    }
    setEvents(prev => [copy, ...prev])
    setActiveId(copy.id)
  }

  const deleteEvent = (id: string) => {
    if (!confirm('Delete this event?')) return
    setEvents(prev => prev.filter(e => e.id !== id))
    if (activeId === id) setActiveId(null)
  }

  const updateEvent = useCallback((changes: Partial<DiningEvent>) => {
    setEvents(prev => prev.map(e => e.id === activeId ? { ...e, ...changes } : e))
  }, [activeId])

  const updateAttendee = useCallback((attendeeId: string, changes: Partial<EventAttendee>) => {
    setEvents(prev => prev.map(e => {
      if (e.id !== activeId) return e
      return { ...e, attendees: e.attendees.map(a => a.id === attendeeId ? { ...a, ...changes } : a) }
    }))
  }, [activeId])

  const removeAttendee = useCallback((attendeeId: string) => {
    setEvents(prev => prev.map(e => {
      if (e.id !== activeId) return e
      return { ...e, attendees: e.attendees.filter(a => a.id !== attendeeId) }
    }))
  }, [activeId])

  const addExtra = () => {
    if (!activeEvent || !extraName.trim()) return
    const a: EventAttendee = {
      id: `extra${Date.now()}`, person_id: '', person_type: 'extra',
      person_name: extraName.trim(), room_label: '', is_attending: true,
      starter: '', main: '', side: '', dessert: '',
    }
    updateEvent({ attendees: [...activeEvent.attendees, a] })
    setExtraName('')
  }

  // ── Totals ────────────────────────────────────────────────────────
  const attending = useMemo(
    () => activeEvent?.attendees.filter(a => a.is_attending).length ?? 0,
    [activeEvent]
  )
  const total = useMemo(
    () => activeEvent?.attendees
      .filter(a => a.is_attending)
      .reduce((sum, a) => sum + (a.price_override ?? activeEvent.price_per_person), 0) ?? 0,
    [activeEvent]
  )

  const instructors = activeEvent?.attendees.filter(a => a.person_type === 'instructor') ?? []
  const guests      = activeEvent?.attendees.filter(a => a.person_type !== 'instructor') ?? []
  const isMenu      = activeEvent?.type === 'menu'
  const eventPrice  = activeEvent?.price_per_person ?? 0

  return (
    <div className="space-y-4">

      {/* ── Instructor presence ── */}
      <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide shrink-0">Present today:</span>
        {mockInstructors.map(i => (
          <button
            key={i.id} onClick={() => togglePresence(i.id)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
              presence[i.id]
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-gray-50 border-gray-200 text-gray-400'
            }`}
          >
            {presence[i.id] ? '✓' : '○'} {i.first_name}
          </button>
        ))}
      </div>

      {/* ── Empty state ── */}
      {!activeEvent ? (
        <div className="bg-white rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
          <p className="text-gray-400 mb-4">No event selected</p>
          <button onClick={createEvent} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            + New Event
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">

          {/* Event header */}
          <div className="p-4 border-b border-gray-100 space-y-3">
            <div className="flex flex-wrap gap-3 items-start">
              <input
                type="text" placeholder="Event name…" value={activeEvent.name}
                onChange={e => updateEvent({ name: e.target.value })}
                className="flex-1 min-w-[180px] text-lg font-bold border-0 border-b-2 border-gray-200 focus:border-blue-400 focus:outline-none px-0 py-1"
              />
              <div className="flex items-center gap-2 ml-auto">
                <button onClick={() => duplicateEvent(activeEvent)} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 text-gray-600">⧉ Duplicate</button>
                <button onClick={() => deleteEvent(activeEvent.id)} className="px-3 py-1.5 text-sm border border-red-200 rounded hover:bg-red-50 text-red-500">🗑</button>
                <button onClick={() => setActiveId(null)} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 text-gray-500">✕</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 items-center text-sm">
              <input type="date" value={activeEvent.date}
                onChange={e => updateEvent({ date: e.target.value })}
                className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <input type="time" value={activeEvent.time}
                onChange={e => updateEvent({ time: e.target.value })}
                className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                {(['count', 'menu'] as EventType[]).map(t => (
                  <button key={t} onClick={() => updateEvent({ type: t })}
                    className={`px-3 py-1 text-sm font-medium transition-colors ${activeEvent.type === t ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    {t === 'count' ? '🔢 Count' : '🍽️ Menu'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-400 text-xs">default €</span>
                <input type="number" min="0" value={activeEvent.price_per_person}
                  onChange={e => updateEvent({ price_per_person: parseFloat(e.target.value) || 0 })}
                  className="w-20 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="0"
                />
                <span className="text-gray-400 text-xs">/pers.</span>
              </div>
              <input type="text" value={activeEvent.notes} placeholder="Notes…"
                onChange={e => updateEvent({ notes: e.target.value })}
                className="flex-1 min-w-[140px] border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Totals bar */}
          <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-emerald-600">{attending}</span>
                <span className="text-sm text-gray-500">
                  {attending === 1 ? 'person' : 'people'} attending
                  {activeEvent.attendees.length > attending && (
                    <span className="ml-1 text-gray-400">/ {activeEvent.attendees.length} total</span>
                  )}
                </span>
              </div>
              {eventPrice > 0 && (
                <div className="flex items-center gap-1 border-l pl-4">
                  <span className="text-xl font-bold text-blue-600">€{total.toFixed(0)}</span>
                  <span className="text-xs text-gray-400">total</span>
                </div>
              )}
            </div>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {(['table', 'cards'] as View[]).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${view === v ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  {v === 'table' ? '⊞ Table' : '⊟ Cards'}
                </button>
              ))}
            </div>
          </div>

          {/* Attendee list */}
          <div className="p-4">
            {view === 'table' ? (
              <div className="overflow-x-auto">
                <table className={`text-sm ${isMenu ? 'w-full' : 'md:w-auto w-full'}`}>
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-56">Name</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">✓</th>
                      {isMenu && MENU_FIELDS.map(f => (
                        <th key={f.key} className="px-1 py-2 text-left text-xs font-semibold text-gray-500 min-w-[90px]">{f.label}</th>
                      ))}
                      {eventPrice > 0 && <th className="px-2 py-2 text-right text-xs font-semibold text-gray-500">Price</th>}
                      {eventPrice > 0 && <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Total</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {instructors.length > 0 && (
                      <tr><td colSpan={99} className="pt-2 pb-1 px-3">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Instructors</span>
                      </td></tr>
                    )}
                    {instructors.map(a => (
                      <AttendeeTableRow key={a.id} a={a} isMenu={isMenu} eventPrice={eventPrice} onUpdate={updateAttendee} onRemove={removeAttendee} />
                    ))}
                    {guests.length > 0 && (
                      <tr><td colSpan={99} className="pt-3 pb-1 px-3">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Guests</span>
                      </td></tr>
                    )}
                    {guests.map(a => (
                      <AttendeeTableRow key={a.id} a={a} isMenu={isMenu} eventPrice={eventPrice} onUpdate={updateAttendee} onRemove={removeAttendee} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-2">
                {instructors.length > 0 && <>
                  <SectionLabel label="Instructors" count={instructors.length} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {instructors.map(a => (
                      <AttendeeCard key={a.id} a={a} isMenu={isMenu} eventPrice={eventPrice} onUpdate={updateAttendee} onRemove={removeAttendee} />
                    ))}
                  </div>
                </>}
                {guests.length > 0 && <>
                  <SectionLabel label="Guests" count={guests.length} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {guests.map(a => (
                      <AttendeeCard key={a.id} a={a} isMenu={isMenu} eventPrice={eventPrice} onUpdate={updateAttendee} onRemove={removeAttendee} />
                    ))}
                  </div>
                </>}
              </div>
            )}

            {/* Add extra */}
            <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
              <input
                type="text" value={extraName} placeholder="Add someone manually…"
                onChange={e => setExtraName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addExtra()}
                className="flex-1 text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <button onClick={addExtra} disabled={!extraName.trim()}
                className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded font-medium disabled:opacity-40"
              >+ Add</button>
            </div>
          </div>
        </div>
      )}

      {/* New event button (when one is already open) */}
      {activeEvent && (
        <button onClick={createEvent} className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 hover:border-blue-300 hover:text-blue-500 text-sm transition-colors">
          + New Event
        </button>
      )}

      {/* ── History ── */}
      <div>
        <button onClick={() => setShowHistory(h => !h)} className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-800 py-1">
          <span className={`transition-transform inline-block ${showHistory ? 'rotate-90' : ''}`}>▶</span>
          History ({events.length} events)
        </button>
        {showHistory && (
          <div className="mt-2 space-y-1">
            {events.map(ev => {
              const evAttending = ev.attendees.filter(a => a.is_attending).length
              const evTotal = ev.attendees.filter(a => a.is_attending).reduce((s, a) => s + (a.price_override ?? ev.price_per_person), 0)
              return (
                <div
                  key={ev.id}
                  onClick={() => setActiveId(ev.id)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm ${
                    ev.id === activeId ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  <span>{ev.type === 'menu' ? '🍽️' : '🍖'}</span>
                  <span className="font-medium text-gray-800 flex-1 truncate">{ev.name || '(unnamed)'}</span>
                  <span className="text-gray-400 shrink-0">{ev.date} · {ev.time}</span>
                  <span className="text-emerald-600 font-semibold shrink-0">{evAttending} pers.</span>
                  {ev.price_per_person > 0 && <span className="text-blue-600 font-semibold shrink-0">€{evTotal}</span>}
                  <button onClick={e => { e.stopPropagation(); duplicateEvent(ev) }} className="text-gray-300 hover:text-blue-500 shrink-0">⧉</button>
                  <button onClick={e => { e.stopPropagation(); deleteEvent(ev.id) }} className="text-gray-300 hover:text-red-400 shrink-0">🗑</button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
