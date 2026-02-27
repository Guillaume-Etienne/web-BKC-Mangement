import { useState, useRef } from 'react'
import type { Lesson, LessonType, EquipmentRental } from '../../types/database'
import { mockInstructors, mockClients, mockEquipment, mockEquipmentRentals } from '../../data/mock'

// ─── Constants ────────────────────────────────────────────────────────────────

const SLOT_H = 36        // px per 30-min slot
const END_HOUR = 19      // grid always ends at 19:00
const TIME_COL_W = 48    // px for the time label column

const LESSON_CFG: Record<LessonType, { bg: string; border: string; text: string; badge: string }> = {
  private:    { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-900', badge: 'bg-purple-500 text-white' },
  group:      { bg: 'bg-green-100',  border: 'border-green-400',  text: 'text-green-900',  badge: 'bg-green-500 text-white'  },
  supervision:{ bg: 'bg-blue-100',   border: 'border-blue-400',   text: 'text-blue-900',   badge: 'bg-blue-500 text-white'   },
}

const RENTAL_TYPE_LABELS: Record<string, { icon: string; label: string }> = {
  kite:      { icon: '🪁', label: 'Kite' },
  board:     { icon: '🏄', label: 'Board' },
  full:      { icon: '🪁🏄', label: 'Full' },
  surfboard: { icon: '🌊', label: 'Surfboard' },
  foilboard: { icon: '⬆️', label: 'Foilboard' },
  free:      { icon: '📦', label: 'Other' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dateToISO(d: Date) { return d.toISOString().slice(0, 10) }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function newId(p: string) { return `${p}${Date.now()}${Math.random().toString(36).slice(2, 6)}` }

function timeToSlot(time: string, startHour: number): number {
  const [h, m] = time.split(':').map(Number)
  return (h - startHour) * 2 + (m >= 30 ? 1 : 0)
}

function slotToTime(slot: number, startHour: number): string {
  const total = startHour * 60 + slot * 30
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

// ─── Top-level modal: Add lesson ─────────────────────────────────────────────

interface AddLessonModalProps {
  date: string
  startHour: number
  totalSlots: number
  instructorId: string
  initialSlot: number
  onConfirm: (lesson: Omit<Lesson, 'id'>) => void
  onClose: () => void
}

function AddLessonModal({ date, startHour, totalSlots, instructorId, initialSlot, onConfirm, onClose }: AddLessonModalProps) {
  const [type, setType]           = useState<LessonType>('private')
  const [clientIds, setClientIds] = useState<string[]>([mockClients[0]?.id ?? ''])
  const [instrId, setInstrId]     = useState(instructorId)
  const [startSlot, setStartSlot] = useState(Math.max(0, Math.min(totalSlots - 1, initialSlot)))
  const [durSlots, setDurSlots]   = useState(2)
  const [notes, setNotes]         = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onConfirm({
      booking_id: 'bk1',
      instructor_id: instrId,
      client_ids: clientIds,
      date,
      start_time: slotToTime(startSlot, startHour),
      duration_hours: durSlots * 0.5,
      type,
      notes: notes || null,
      kite_id: null,
      board_id: null,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-sm">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold text-gray-800">New lesson</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 font-bold text-lg">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <select value={type} onChange={e => setType(e.target.value as LessonType)} className="w-full text-sm border rounded px-2 py-1.5">
              <option value="private">Private</option>
              <option value="group">Group</option>
              <option value="supervision">Supervision</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{type === 'group' ? 'Clients' : 'Client'}</label>
            {type !== 'group' ? (
              <select value={clientIds[0] ?? ''} onChange={e => setClientIds([e.target.value])} className="w-full text-sm border rounded px-2 py-1.5">
                {mockClients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            ) : (
              <div className="space-y-1">
                {clientIds.map((cid, idx) => (
                  <div key={idx} className="flex gap-1">
                    <select value={cid} onChange={e => { const ids = [...clientIds]; ids[idx] = e.target.value; setClientIds(ids) }}
                      className="flex-1 text-sm border rounded px-2 py-1.5">
                      {mockClients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                    </select>
                    {clientIds.length > 1 && (
                      <button type="button" onClick={() => setClientIds(ids => ids.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-600 px-1 text-sm">✕</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setClientIds(ids => [...ids, mockClients[0]?.id ?? ''])}
                  className="text-xs text-green-700 border border-dashed border-green-400 rounded px-2 py-1 w-full hover:bg-green-50">
                  + Add client
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Instructor</label>
            <select value={instrId} onChange={e => setInstrId(e.target.value)} className="w-full text-sm border rounded px-2 py-1.5">
              {mockInstructors.map(i => <option key={i.id} value={i.id}>{i.first_name} {i.last_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start</label>
              <select value={startSlot} onChange={e => setStartSlot(+e.target.value)} className="w-full text-sm border rounded px-2 py-1.5">
                {Array.from({ length: totalSlots }, (_, i) => (
                  <option key={i} value={i}>{slotToTime(i, startHour)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Duration</label>
              <select value={durSlots} onChange={e => setDurSlots(+e.target.value)} className="w-full text-sm border rounded px-2 py-1.5">
                {[1, 2, 3, 4, 5, 6].map(s => <option key={s} value={s}>{s * 0.5}h</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full text-sm border rounded px-2 py-1.5" placeholder="Optional" />
          </div>
          <div className="flex gap-2 pt-2 border-t">
            <button type="button" onClick={onClose}
              className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded font-medium text-sm">Cancel</button>
            <button type="submit"
              className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm">Add</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Top-level modal: Edit lesson ─────────────────────────────────────────────

interface EditLessonModalProps {
  lesson: Lesson
  startHour: number
  totalSlots: number
  onSave: (l: Lesson) => void
  onDelete: (id: string) => void
  onClose: () => void
}

function EditLessonModal({ lesson, startHour, totalSlots, onSave, onDelete, onClose }: EditLessonModalProps) {
  const [type, setType]           = useState<LessonType>(lesson.type)
  const [clientIds, setClientIds] = useState<string[]>(lesson.client_ids)
  const [instrId, setInstrId]     = useState(lesson.instructor_id)
  const [startSlot, setStartSlot] = useState(Math.max(0, timeToSlot(lesson.start_time, startHour)))
  const [durSlots, setDurSlots]   = useState(lesson.duration_hours * 2)
  const [notes, setNotes]         = useState(lesson.notes ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({ ...lesson, type, client_ids: clientIds, instructor_id: instrId,
      start_time: slotToTime(startSlot, startHour), duration_hours: durSlots * 0.5, notes: notes || null })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-sm">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold text-gray-800">Edit lesson</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 font-bold text-lg">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <select value={type} onChange={e => setType(e.target.value as LessonType)} className="w-full text-sm border rounded px-2 py-1.5">
              <option value="private">Private</option>
              <option value="group">Group</option>
              <option value="supervision">Supervision</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{type === 'group' ? 'Clients' : 'Client'}</label>
            {type !== 'group' ? (
              <select value={clientIds[0] ?? ''} onChange={e => setClientIds([e.target.value])} className="w-full text-sm border rounded px-2 py-1.5">
                {mockClients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            ) : (
              <div className="space-y-1">
                {clientIds.map((cid, idx) => (
                  <div key={idx} className="flex gap-1">
                    <select value={cid} onChange={e => { const ids = [...clientIds]; ids[idx] = e.target.value; setClientIds(ids) }}
                      className="flex-1 text-sm border rounded px-2 py-1.5">
                      {mockClients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                    </select>
                    {clientIds.length > 1 && (
                      <button type="button" onClick={() => setClientIds(ids => ids.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-600 px-1">✕</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setClientIds(ids => [...ids, mockClients[0]?.id ?? ''])}
                  className="text-xs text-green-700 border border-dashed border-green-400 rounded px-2 py-1 w-full hover:bg-green-50">
                  + Add client
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Instructor</label>
            <select value={instrId} onChange={e => setInstrId(e.target.value)} className="w-full text-sm border rounded px-2 py-1.5">
              {mockInstructors.map(i => <option key={i.id} value={i.id}>{i.first_name} {i.last_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start</label>
              <select value={startSlot} onChange={e => setStartSlot(+e.target.value)} className="w-full text-sm border rounded px-2 py-1.5">
                {Array.from({ length: totalSlots }, (_, i) => (
                  <option key={i} value={i}>{slotToTime(i, startHour)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Duration</label>
              <select value={durSlots} onChange={e => setDurSlots(+e.target.value)} className="w-full text-sm border rounded px-2 py-1.5">
                {[1, 2, 3, 4, 5, 6].map(s => <option key={s} value={s}>{s * 0.5}h</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full text-sm border rounded px-2 py-1.5" placeholder="Optional" />
          </div>
          <div className="flex gap-2 pt-2 border-t">
            <button type="button"
              onClick={() => { if (confirm('Delete this lesson?')) { onDelete(lesson.id); onClose() } }}
              className="px-3 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded font-medium text-sm">Delete</button>
            <button type="button" onClick={onClose}
              className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded font-medium text-sm">Cancel</button>
            <button type="submit"
              className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm">Save</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Top-level: Rentals panel ─────────────────────────────────────────────────

interface RentalsPanelProps {
  rentals: EquipmentRental[]
  onDelete: (id: string) => void
  onAdd: (r: EquipmentRental) => void
  date: string
}

function RentalsPanel({ rentals, onDelete, onAdd, date }: RentalsPanelProps) {
  const [showForm, setShowForm] = useState(false)
  const [clientId, setClientId] = useState(mockClients[0]?.id ?? '')
  const [equipType, setEquipType] = useState('kite')
  const [slot, setSlot] = useState<'morning' | 'afternoon' | 'full_day'>('full_day')
  const [price, setPrice] = useState(40)
  const [otherDesc, setOtherDesc] = useState('')

  const DEFAULT_PRICES: Record<string, number> = { kite: 40, board: 20, full: 55, surfboard: 25, foilboard: 35, free: 0 }

  const groups: { key: 'morning' | 'afternoon' | 'full_day'; label: string }[] = [
    { key: 'morning', label: 'Morning' },
    { key: 'afternoon', label: 'Afternoon' },
    { key: 'full_day', label: 'Full day' },
  ]

  function submitRental(e: React.FormEvent) {
    e.preventDefault()
    const equip = mockEquipment.find(eq => eq.category === equipType && eq.is_active)
    onAdd({
      id: newId('r'),
      equipment_id: equip?.id ?? equipType,
      booking_id: null,
      client_id: clientId,
      date,
      slot,
      price,
      notes: equipType === 'free' ? (otherDesc || null) : null,
    })
    setOtherDesc('')
    setShowForm(false)
  }

  return (
    <div className="w-52 shrink-0 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700">📦 Rentals</h3>
        <button
          onClick={() => setShowForm(v => !v)}
          className="text-xs px-2 py-0.5 rounded border border-dashed border-amber-400 text-amber-700 hover:bg-amber-50 transition-colors"
        >+ Add</button>
      </div>

      {showForm && (
        <form onSubmit={submitRental} className="bg-amber-50 border border-amber-200 rounded-lg p-2 space-y-1.5">
          <select value={clientId} onChange={e => setClientId(e.target.value)}
            className="w-full text-xs border rounded px-1 py-1">
            {mockClients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
          </select>
          <select value={equipType} onChange={e => { setEquipType(e.target.value); setPrice(DEFAULT_PRICES[e.target.value] ?? 0) }}
            className="w-full text-xs border rounded px-1 py-1">
            {Object.entries(RENTAL_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v.icon} {v.label}</option>
            ))}
          </select>
          {equipType === 'free' && (
            <input
              type="text"
              value={otherDesc}
              onChange={e => setOtherDesc(e.target.value)}
              placeholder="What is being rented?"
              className="w-full text-xs border rounded px-1 py-1"
            />
          )}
          <div className="flex gap-1">
            <select value={slot} onChange={e => setSlot(e.target.value as typeof slot)}
              className="flex-1 text-xs border rounded px-1 py-1">
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="full_day">Full day</option>
            </select>
            <input type="number" value={price} onChange={e => setPrice(+e.target.value)}
              className="w-14 text-xs border rounded px-1 py-1 text-right" min={0} />
            <span className="text-xs text-gray-500 self-center">€</span>
          </div>
          <div className="flex gap-1">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 text-xs py-1 bg-gray-100 hover:bg-gray-200 rounded">Cancel</button>
            <button type="submit"
              className="flex-1 text-xs py-1 bg-amber-500 hover:bg-amber-600 text-white rounded font-medium">Add</button>
          </div>
        </form>
      )}

      {groups.map(g => {
        const items = rentals.filter(r => r.slot === g.key || (g.key === 'full_day' && r.slot === 'full_day'))
          .filter(r => g.key === 'full_day' ? r.slot === 'full_day' : r.slot === g.key)
        if (items.length === 0) return null
        return (
          <div key={g.key}>
            <div className="text-xs font-semibold text-gray-500 mb-1">{g.label}</div>
            <div className="space-y-1">
              {items.map(r => {
                const client = mockClients.find(c => c.id === r.client_id)
                const equip = mockEquipment.find(e => e.id === r.equipment_id)
                const rt = RENTAL_TYPE_LABELS[equip?.category ?? r.equipment_id] ?? RENTAL_TYPE_LABELS.free
                return (
                  <div key={r.id} className="group/r flex items-start justify-between bg-amber-50 border border-amber-200 rounded px-2 py-1.5 text-xs">
                    <div>
                      <div className="font-semibold text-amber-900">{rt.icon} {rt.label}</div>
                      {r.notes && <div className="text-amber-800 text-[10px] italic truncate">{r.notes}</div>}
                      <div className="text-amber-700 truncate">{client?.first_name} {client?.last_name}</div>
                      <div className="text-amber-600 font-medium">€{r.price}</div>
                    </div>
                    <button onClick={() => onDelete(r.id)}
                      className="opacity-0 group-hover/r:opacity-100 text-gray-400 hover:text-red-600 ml-1 mt-0.5">✕</button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {rentals.length === 0 && !showForm && (
        <p className="text-xs text-gray-400 italic">No rentals planned</p>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ForecastViewProps {
  lessons: Lesson[]
  onLessonsChange: (fn: (prev: Lesson[]) => Lesson[]) => void
}

export default function ForecastView({ lessons, onLessonsChange }: ForecastViewProps) {
  const today = new Date()

  const [selectedDate, setSelectedDate]   = useState<Date>(() => addDays(today, 1))
  const [startHour, setStartHour]         = useState(8)
  const [rentals, setRentals]             = useState<EquipmentRental[]>(mockEquipmentRentals)
  const [dayClipboard, setDayClipboard]   = useState<Lesson[] | null>(null)
  const [mobileInstrIdx, setMobileInstrIdx] = useState(0)

  // Modals
  const [addModal, setAddModal]   = useState<{ instructorId: string; slot: number } | null>(null)
  const [editModal, setEditModal] = useState<Lesson | null>(null)

  // Drag state
  const [dragLesson, setDragLesson]   = useState<Lesson | null>(null)
  const [dragMode, setDragMode]       = useState<'move' | 'resize'>('move')
  const [dragPreview, setDragPreview] = useState<{ instructorId: string; startSlot: number; durationSlots: number } | null>(null)
  const dragStartY      = useRef(0)
  const dragStartX      = useRef(0)
  const dragStartSlot   = useRef(0)
  const dragStartDur    = useRef(0)
  const gridRef         = useRef<HTMLDivElement>(null)

  const iso = dateToISO(selectedDate)
  const dayLessons  = lessons.filter(l => l.date === iso)
  const dayRentals  = rentals.filter(r => r.date === iso)
  const totalSlots  = (END_HOUR - startHour) * 2
  const gridHeight  = totalSlots * SLOT_H

  // ── Drag ──────────────────────────────────────────────────────────────────

  function startDrag(e: React.PointerEvent, lesson: Lesson, mode: 'move' | 'resize') {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragStartY.current    = e.clientY
    dragStartX.current    = e.clientX
    dragStartSlot.current = Math.max(0, timeToSlot(lesson.start_time, startHour))
    dragStartDur.current  = lesson.duration_hours * 2
    setDragLesson(lesson)
    setDragMode(mode)
    setDragPreview({
      instructorId:  lesson.instructor_id,
      startSlot:     dragStartSlot.current,
      durationSlots: dragStartDur.current,
    })
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragLesson || !dragPreview) return
    const dSlots = Math.round((e.clientY - dragStartY.current) / SLOT_H)

    if (dragMode === 'resize') {
      const newDur = Math.max(1, Math.min(totalSlots - dragPreview.startSlot, dragStartDur.current + dSlots))
      if (newDur !== dragPreview.durationSlots)
        setDragPreview(p => p && { ...p, durationSlots: newDur })
    } else {
      const newStart = Math.max(0, Math.min(totalSlots - 1, dragStartSlot.current + dSlots))
      let newInstr = dragPreview.instructorId
      if (gridRef.current) {
        for (const col of gridRef.current.querySelectorAll('[data-instructor-id]')) {
          const r = col.getBoundingClientRect()
          if (e.clientX >= r.left && e.clientX <= r.right) {
            newInstr = col.getAttribute('data-instructor-id') ?? newInstr
            break
          }
        }
      }
      if (newStart !== dragPreview.startSlot || newInstr !== dragPreview.instructorId)
        setDragPreview(p => p && { ...p, startSlot: newStart, instructorId: newInstr })
    }
  }

  function onPointerUp() {
    if (!dragLesson || !dragPreview) { setDragLesson(null); return }
    onLessonsChange(prev => prev.map(l =>
      l.id === dragLesson.id ? {
        ...l,
        start_time:     slotToTime(dragPreview.startSlot, startHour),
        duration_hours: dragPreview.durationSlots * 0.5,
        instructor_id:  dragPreview.instructorId,
      } : l
    ))
    setDragLesson(null)
    setDragPreview(null)
  }

  // ── Copy / paste day ──────────────────────────────────────────────────────

  function copyDay() { setDayClipboard([...dayLessons]) }

  function pasteDay() {
    if (!dayClipboard || dayClipboard.length === 0) return
    const newLessons = dayClipboard.map(l => ({ ...l, id: newId('l'), date: iso }))
    onLessonsChange(prev => [...prev.filter(l => l.date !== iso), ...newLessons])
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col gap-4 select-none"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date navigation */}
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedDate(d => addDays(d, -1))}
            className="w-8 h-8 rounded bg-gray-200 hover:bg-gray-300 text-sm font-bold">←</button>
          <span className="text-base font-semibold min-w-[200px] text-center">{formatDate(selectedDate)}</span>
          <button onClick={() => setSelectedDate(d => addDays(d, 1))}
            className="w-8 h-8 rounded bg-gray-200 hover:bg-gray-300 text-sm font-bold">→</button>
          <button onClick={() => setSelectedDate(addDays(today, 1))}
            className="px-2.5 py-1 rounded bg-blue-100 text-blue-700 text-xs font-medium hover:bg-blue-200">
            Tomorrow
          </button>
        </div>

        {/* Start hour */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Start:</span>
          <select
            value={startHour}
            onChange={e => setStartHour(+e.target.value)}
            className="text-sm border rounded px-2 py-1 bg-white"
          >
            {[8, 9, 10, 11, 12, 13, 14, 15, 16].map(h => (
              <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
            ))}
          </select>
          <span className="text-xs text-gray-400">→ 19:00</span>
        </div>

        {/* Copy / paste */}
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={copyDay}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-700">
            ⎘ Copy day
          </button>
          {dayClipboard && dayClipboard.length > 0 && (
            <button onClick={pasteDay}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-100 hover:bg-amber-200 text-sm font-medium text-amber-800">
              📋 Paste ({dayClipboard.length} lessons)
            </button>
          )}
        </div>
      </div>

      {/* Mobile: instructor selector */}
      <div className="flex md:hidden items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
        <button
          onClick={() => setMobileInstrIdx(i => Math.max(0, i - 1))}
          disabled={mobileInstrIdx === 0}
          className="w-8 h-8 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-30 font-bold text-sm"
        >←</button>
        <div className="text-center">
          <div className="font-bold text-gray-800">{mockInstructors[mobileInstrIdx]?.first_name} {mockInstructors[mobileInstrIdx]?.last_name}</div>
          {(() => {
            const count = dayLessons.filter(l => l.instructor_id === mockInstructors[mobileInstrIdx]?.id).length
            return count > 0 ? <div className="text-xs text-blue-600 font-medium">{count} lesson{count > 1 ? 's' : ''}</div> : null
          })()}
        </div>
        <button
          onClick={() => setMobileInstrIdx(i => Math.min(mockInstructors.length - 1, i + 1))}
          disabled={mobileInstrIdx === mockInstructors.length - 1}
          className="w-8 h-8 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-30 font-bold text-sm"
        >→</button>
      </div>

      {/* Main content — desktop: side by side | mobile: stacked */}
      <div className="flex flex-col md:flex-row gap-4 items-start">

        {/* Time grid */}
        <div className="flex-1 w-full overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          {/* Instructor headers — desktop only (hidden on mobile, replaced by nav above) */}
          <div className="hidden md:flex border-b border-gray-200 bg-white sticky top-0 z-20">
            <div style={{ width: TIME_COL_W }} className="shrink-0 border-r border-gray-200" />
            {mockInstructors.map(instr => (
              <div key={instr.id} className="flex-1 min-w-[130px] px-2 py-2 text-center border-r border-gray-200 last:border-r-0">
                <div className="text-sm font-bold text-gray-800 truncate">{instr.first_name}</div>
                <div className="text-xs text-gray-500 truncate">{instr.last_name}</div>
                {(() => {
                  const count = dayLessons.filter(l => l.instructor_id === instr.id).length
                  return count > 0 ? (
                    <div className="mt-1 inline-block px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold">
                      {count} lesson{count > 1 ? 's' : ''}
                    </div>
                  ) : null
                })()}
              </div>
            ))}
          </div>

          {/* Grid body */}
          <div ref={gridRef} className="overflow-y-auto" style={{ maxHeight: 520 }}>
            <div className="flex" style={{ height: gridHeight }}>

              {/* Time labels */}
              <div style={{ width: TIME_COL_W }} className="shrink-0 border-r border-gray-200 relative bg-gray-50">
                {Array.from({ length: totalSlots }, (_, i) => {
                  const isHour = i % 2 === 0
                  return (
                    <div key={i}
                      className={`absolute w-full border-t flex items-start justify-end pr-1.5 ${isHour ? 'border-gray-300' : 'border-gray-100'}`}
                      style={{ top: i * SLOT_H, height: SLOT_H }}
                    >
                      {isHour && <span className="text-[10px] text-gray-400 font-medium -mt-1.5">{slotToTime(i, startHour)}</span>}
                    </div>
                  )
                })}
              </div>

              {/* Instructor columns — desktop: all | mobile: active one only */}
              {mockInstructors.map((instr, idx) => {
                const isMobileHidden = idx !== mobileInstrIdx
                const instrLessons = dayLessons.filter(l => l.instructor_id === instr.id)

                return (
                  <div
                    key={instr.id}
                    data-instructor-id={instr.id}
                    className={`relative border-r border-gray-200 last:border-r-0
                      ${isMobileHidden ? 'hidden md:block' : ''}
                      flex-1 min-w-[130px] md:min-w-[130px]`}
                    onClick={e => {
                      if (dragLesson) return
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      const slot = Math.floor((e.clientY - rect.top) / SLOT_H)
                      setAddModal({ instructorId: instr.id, slot })
                    }}
                  >
                    {/* Slot lines */}
                    {Array.from({ length: totalSlots }, (_, i) => (
                      <div key={i}
                        className={`absolute w-full border-t ${i % 2 === 0 ? 'border-gray-200' : 'border-gray-100'}`}
                        style={{ top: i * SLOT_H, height: SLOT_H }}
                      />
                    ))}

                    {/* Lesson cards */}
                    {instrLessons.map(lesson => {
                      const isDragging = dragLesson?.id === lesson.id
                      const rawSlot    = timeToSlot(lesson.start_time, startHour)
                      const displaySlot = (isDragging && dragPreview?.instructorId === instr.id)
                        ? dragPreview.startSlot : rawSlot
                      const displayDur  = (isDragging && dragPreview?.instructorId === instr.id)
                        ? dragPreview.durationSlots : lesson.duration_hours * 2

                      if (isDragging && dragPreview && dragPreview.instructorId !== instr.id) return null

                      const top    = displaySlot * SLOT_H
                      const height = displayDur * SLOT_H
                      const cfg    = LESSON_CFG[lesson.type]
                      const lessonClients = lesson.client_ids.map(id => mockClients.find(c => c.id === id)).filter(Boolean)
                      const firstClient = lessonClients[0]

                      return (
                        <div key={lesson.id}
                          className={`absolute left-0.5 right-0.5 rounded border-l-4 px-1.5 py-1 overflow-hidden cursor-grab active:cursor-grabbing z-10
                            ${cfg.bg} ${cfg.border} ${cfg.text}
                            ${isDragging ? 'opacity-70 shadow-lg ring-2 ring-blue-400' : 'shadow-sm hover:shadow-md'}`}
                          style={{ top: top + 1, height: height - 2 }}
                          onClick={e => { e.stopPropagation(); setEditModal(lesson) }}
                          onPointerDown={e => startDrag(e, lesson, 'move')}
                        >
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className="text-[10px] font-bold">{lesson.start_time}</span>
                            <span className={`text-[9px] px-1 rounded font-semibold ${cfg.badge}`}>
                              {lesson.type === 'private' ? 'P' : lesson.type === 'group' ? 'G' : 'S'}
                            </span>
                          </div>
                          {height >= SLOT_H * 2 && (
                            <div className="text-xs font-semibold truncate">
                              {firstClient?.first_name} {firstClient?.last_name}
                              {lessonClients.length > 1 && <span className="ml-1 font-normal opacity-70">+{lessonClients.length - 1}</span>}
                            </div>
                          )}
                          {height >= SLOT_H * 3 && lesson.notes && (
                            <div className="text-[10px] opacity-60 truncate">{lesson.notes}</div>
                          )}
                          {/* Resize handle */}
                          <div
                            className="absolute bottom-0 left-0 right-0 h-3 cursor-s-resize flex items-center justify-center opacity-0 hover:opacity-100 active:opacity-100"
                            onPointerDown={e => { e.stopPropagation(); startDrag(e, lesson, 'resize') }}
                          >
                            <div className="w-8 h-0.5 bg-current rounded opacity-40" />
                          </div>
                        </div>
                      )
                    })}

                    {/* Ghost card for cross-instructor drag */}
                    {dragLesson && dragPreview?.instructorId === instr.id && dragLesson.instructor_id !== instr.id && (
                      <div
                        className={`absolute left-0.5 right-0.5 rounded border-l-4 opacity-50 pointer-events-none z-10
                          ${LESSON_CFG[dragLesson.type].bg} ${LESSON_CFG[dragLesson.type].border}`}
                        style={{ top: dragPreview.startSlot * SLOT_H + 1, height: dragPreview.durationSlots * SLOT_H - 2 }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Rentals panel — desktop: right side | mobile: below grid */}
        <div className="w-full md:w-52 md:shrink-0">
          <RentalsPanel
            rentals={dayRentals}
            date={iso}
            onDelete={id => setRentals(prev => prev.filter(r => r.id !== id))}
            onAdd={r => setRentals(prev => [...prev, r])}
          />
        </div>
      </div>

      {/* Modals */}
      {addModal && (
        <AddLessonModal
          date={iso}
          startHour={startHour}
          totalSlots={totalSlots}
          instructorId={addModal.instructorId}
          initialSlot={addModal.slot}
          onConfirm={lesson => {
            onLessonsChange(prev => [...prev, { ...lesson, id: newId('l') }])
            setAddModal(null)
          }}
          onClose={() => setAddModal(null)}
        />
      )}
      {editModal && (
        <EditLessonModal
          lesson={editModal}
          startHour={startHour}
          totalSlots={totalSlots}
          onSave={updated => {
            onLessonsChange(prev => prev.map(l => l.id === updated.id ? updated : l))
            setEditModal(null)
          }}
          onDelete={id => {
            onLessonsChange(prev => prev.filter(l => l.id !== id))
            setEditModal(null)
          }}
          onClose={() => setEditModal(null)}
        />
      )}
    </div>
  )
}
