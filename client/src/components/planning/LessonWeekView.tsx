import { useState } from 'react'
import type { Lesson, DayActivity, DaySlot, LessonType, Booking, EquipmentRental } from '../../types/database'
import { mockInstructors, mockClients, mockEquipment, mockEquipmentRentals } from '../../data/mock'

// ─── Config ──────────────────────────────────────────────────────────────────

type Slot = DaySlot

const SLOTS: Slot[] = ['morning', 'afternoon', 'evening']

const SLOT_CONFIG: Record<Slot, { label: string; icon: string; defaultTime: string }> = {
  morning:   { label: 'Morning',   icon: '🌅', defaultTime: '09:00' },
  afternoon: { label: 'Afternoon', icon: '☀️', defaultTime: '14:00' },
  evening:   { label: 'Evening',   icon: '🌙', defaultTime: '19:00' },
}

const LESSON_TYPE_CFG: Record<LessonType, { label: string; card: string; badge: string; dot: string }> = {
  private:    { label: 'Private', card: 'bg-purple-50 border-purple-300 text-purple-900', badge: 'bg-purple-500 text-white', dot: 'bg-purple-500' },
  group:      { label: 'Group',   card: 'bg-green-50  border-green-300  text-green-900',  badge: 'bg-green-500  text-white', dot: 'bg-green-500'  },
  supervision:{ label: 'Superv.', card: 'bg-blue-50   border-blue-300   text-blue-900',   badge: 'bg-blue-500   text-white', dot: 'bg-blue-500'   },
}

const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DURATION_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3]

// Default rental prices per type — will come from "Gestion" settings
const DEFAULT_RENTAL_PRICES: Record<string, number> = {
  kite: 40, board: 20, full: 55, surfboard: 25, foilboard: 35, free: 0,
}

type RentalType = 'kite' | 'board' | 'full' | 'surfboard' | 'foilboard' | 'free'

const RENTAL_TYPES: { key: RentalType; label: string; icon: string; sub?: string }[] = [
  { key: 'kite',      label: 'Kite',            icon: '🪁' },
  { key: 'board',     label: 'Board',           icon: '🏄' },
  { key: 'full',      label: 'Full',            icon: '🪁🏄', sub: 'Kite + Board' },
  { key: 'surfboard', label: 'Surfboard',       icon: '🌊' },
  { key: 'foilboard', label: 'Foilboard',       icon: '⬆️' },
  { key: 'free',      label: 'Other',           icon: '📦' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dateToISO(d: Date): string { return d.toISOString().slice(0, 10) }

function getSlotForTime(time: string): Slot {
  if (time < '12:00') return 'morning'
  if (time < '18:00') return 'afternoon'
  return 'evening'
}

function newId(prefix: string): string { return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 6)}` }

// ─── Types ───────────────────────────────────────────────────────────────────

interface AddForm {
  date: string
  slot: Slot
  kind: 'lesson' | 'activity' | 'rental'
  // lesson fields
  type: LessonType
  client_ids: string[]
  instructor_id: string
  start_time: string
  duration_hours: number
  notes: string
  kite_id: string | null
  board_id: string | null
  // activity fields
  name: string
  actNotes: string
  // rental fields
  rental_client_id: string
  rental_slot: 'morning' | 'afternoon' | 'full_day'
  rental_type: RentalType
  rental_price: number
  rental_kite_id: string | null
  rental_board_id: string | null
  rental_notes: string
}

interface DragState {
  lessonId: string
  fromDate: string
  fromSlot: Slot
}

interface LessonWeekViewProps {
  weekDays: Date[]
  lessons: Lesson[]
  dayActivities: DayActivity[]
  bookings: Booking[]
  lessonView: 'by-instructor' | 'by-client'
  onLessonsChange: (fn: (prev: Lesson[]) => Lesson[]) => void
  onActivitiesChange: (fn: (prev: DayActivity[]) => DayActivity[]) => void
  onRentalsChange?: (fn: (prev: EquipmentRental[]) => EquipmentRental[]) => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LessonWeekView({
  weekDays, lessons, dayActivities, lessonView,
  onLessonsChange, onActivitiesChange, onRentalsChange,
}: LessonWeekViewProps) {
  const today = dateToISO(new Date())

  // ── Inline add form ────────────────────────────────────────────────────────
  const emptyForm = (date: string, slot: Slot, kind: 'lesson' | 'activity' | 'rental'): AddForm => ({
    date, slot, kind,
    type: 'private', client_ids: [mockClients[0]?.id ?? ''], instructor_id: mockInstructors[0]?.id ?? '',
    start_time: SLOT_CONFIG[slot].defaultTime, duration_hours: 1, notes: '', kite_id: null, board_id: null,
    name: '', actNotes: '',
    rental_client_id: mockClients[0]?.id ?? '',
    rental_slot: slot === 'morning' ? 'morning' : slot === 'afternoon' ? 'afternoon' : 'full_day',
    rental_type: 'kite' as RentalType,
    rental_price: DEFAULT_RENTAL_PRICES.kite,
    rental_kite_id: null,
    rental_board_id: null,
    rental_notes: '',
  })

  const [addForm, setAddForm] = useState<AddForm | null>(null)

  // ── Edit modal ─────────────────────────────────────────────────────────────
  const [editLesson, setEditLesson] = useState<Lesson | null>(null)
  const [editData, setEditData] = useState<Partial<Lesson>>({})

  // ── Clipboard ─────────────────────────────────────────────────────────────
  const [clipboard, setClipboard] = useState<Lesson | null>(null)

  // ── Drag state ────────────────────────────────────────────────────────────
  const [drag, setDrag] = useState<DragState | null>(null)
  const [dropTarget, setDropTarget] = useState<{ date: string; slot: Slot } | null>(null)

  // ── Data helpers ──────────────────────────────────────────────────────────
  function lessonsForSlot(date: string, slot: Slot): Lesson[] {
    return lessons
      .filter(l => l.date === date && getSlotForTime(l.start_time) === slot)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }

  function activitiesForSlot(date: string, slot: Slot): DayActivity[] {
    return dayActivities.filter(a => a.date === date && a.slot === slot)
  }

  const [rentals, setRentals] = useState<EquipmentRental[]>(mockEquipmentRentals)

  function rentalsForSlot(date: string, slot: 'morning' | 'afternoon' | 'full_day') {
    return rentals.filter(r => r.date === date && (r.slot === slot || r.slot === 'full_day'))
  }

  function deleteRental(id: string) {
    setRentals(prev => prev.filter(r => r.id !== id))
    if (onRentalsChange) onRentalsChange(prev => prev.filter(r => r.id !== id))
  }

  // ── Add handlers ──────────────────────────────────────────────────────────
  function openAdd(date: string, slot: Slot, kind: 'lesson' | 'activity' | 'rental') {
    setAddForm(emptyForm(date, slot, kind))
  }

  function submitAdd() {
    if (!addForm) return
    if (addForm.kind === 'lesson') {
      const newLesson: Lesson = {
        id: newId('l'),
        booking_id: 'bk1', // placeholder
        instructor_id: addForm.instructor_id,
        client_ids: addForm.client_ids,
        date: addForm.date,
        start_time: addForm.start_time,
        duration_hours: addForm.duration_hours,
        type: addForm.type,
        notes: addForm.notes || null,
        kite_id: addForm.kite_id,
        board_id: addForm.board_id,
      }
      onLessonsChange(prev => [...prev, newLesson])
    } else if (addForm.kind === 'activity') {
      const newAct: DayActivity = {
        id: newId('a'),
        date: addForm.date,
        slot: addForm.slot,
        name: addForm.name,
        notes: addForm.actNotes || null,
      }
      onActivitiesChange(prev => [...prev, newAct])
    } else {
      // Use specific equipment id if chosen, otherwise fall back to the type key as virtual id
      const equipId = (
        addForm.rental_type === 'kite'  ? addForm.rental_kite_id  :
        addForm.rental_type === 'board' ? addForm.rental_board_id :
        addForm.rental_type === 'full'  ? (addForm.rental_kite_id ?? addForm.rental_board_id) :
        null
      ) ?? addForm.rental_type
      const newRental: EquipmentRental = {
        id: newId('r'),
        equipment_id: equipId,
        booking_id: null,
        client_id: addForm.rental_client_id,
        date: addForm.date,
        slot: addForm.rental_slot,
        price: addForm.rental_price,
        notes: addForm.rental_notes || null,
      }
      setRentals(prev => [...prev, newRental])
      if (onRentalsChange) onRentalsChange(prev => [...prev, newRental])
    }
    setAddForm(null)
  }

  // ── Edit handlers ─────────────────────────────────────────────────────────
  function openEdit(lesson: Lesson) {
    setEditLesson(lesson)
    setEditData({ ...lesson })
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editLesson) return
    onLessonsChange(prev => prev.map(l => l.id === editLesson.id ? { ...l, ...editData } : l))
    setEditLesson(null)
  }

  function deleteLesson(id: string) {
    if (confirm('Delete this lesson?')) {
      onLessonsChange(prev => prev.filter(l => l.id !== id))
      if (editLesson?.id === id) setEditLesson(null)
    }
  }

  function deleteActivity(id: string) {
    onActivitiesChange(prev => prev.filter(a => a.id !== id))
  }

  // ── Copy / paste ──────────────────────────────────────────────────────────
  function copyLesson(lesson: Lesson) {
    setClipboard(lesson)
  }

  function pasteLesson(date: string, slot: Slot) {
    if (!clipboard) return
    const newLesson: Lesson = {
      ...clipboard,
      id: newId('l'),
      date,
      start_time: SLOT_CONFIG[slot].defaultTime,
    }
    onLessonsChange(prev => [...prev, newLesson])
  }

  // ── Drag handlers ─────────────────────────────────────────────────────────
  function handleDragStart(lesson: Lesson) {
    setDrag({
      lessonId: lesson.id,
      fromDate: lesson.date,
      fromSlot: getSlotForTime(lesson.start_time),
    })
  }

  function handleDragOver(e: React.DragEvent, date: string, slot: Slot) {
    e.preventDefault()
    setDropTarget({ date, slot })
  }

  function handleDrop(e: React.DragEvent, date: string, slot: Slot) {
    e.preventDefault()
    if (!drag) return
    const lesson = lessons.find(l => l.id === drag.lessonId)
    if (!lesson) return
    const slotChanged = getSlotForTime(lesson.start_time) !== slot
    const newTime = slotChanged ? SLOT_CONFIG[slot].defaultTime : lesson.start_time
    onLessonsChange(prev => prev.map(l =>
      l.id === drag.lessonId ? { ...l, date, start_time: newTime } : l
    ))
    setDrag(null)
    setDropTarget(null)
  }

  function handleDragEnd() {
    setDrag(null)
    setDropTarget(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Clipboard banner */}
      {clipboard && (
        <div className="mb-4 flex items-center gap-3 px-4 py-2 bg-amber-50 border border-amber-300 rounded-lg text-sm">
          <span>📋 Lesson copied:</span>
          <span className="font-semibold">
            {mockClients.find(c => c.id === clipboard.client_ids[0])?.first_name}{' '}
            {mockClients.find(c => c.id === clipboard.client_ids[0])?.last_name}
            {clipboard.client_ids.length > 1 && ` +${clipboard.client_ids.length - 1}`}
            {' · '}{LESSON_TYPE_CFG[clipboard.type].label}{' · '}{clipboard.start_time}
          </span>
          <span className="text-gray-500 text-xs">→ Click "Paste" in a slot</span>
          <button
            onClick={() => setClipboard(null)}
            className="ml-auto text-gray-500 hover:text-gray-800 font-bold"
          >✕</button>
        </div>
      )}

      {/* 7-day cards */}
      <div className="flex gap-3 overflow-x-auto pb-3">
        {weekDays.map((day) => {
          const iso = dateToISO(day)
          const isToday = iso === today
          const isWeekend = day.getDay() === 0 || day.getDay() === 6

          return (
            <div
              key={iso}
              className={`min-w-[200px] flex-1 rounded-lg shadow-sm border flex flex-col ${
                isToday ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-200'
              } bg-white`}
            >
              {/* Card header */}
              <div className={`px-3 py-2 rounded-t-lg border-b ${
                isToday ? 'bg-blue-600 text-white' : isWeekend ? 'bg-blue-50' : 'bg-gray-50'
              }`}>
                <div className={`text-xs font-medium ${isToday ? 'text-blue-100' : 'text-gray-500'}`}>
                  {DAY_FULL[day.getDay()]}
                </div>
                <div className={`text-lg font-bold leading-tight ${isToday ? 'text-white' : 'text-gray-900'}`}>
                  {day.getDate()} {MONTH_SHORT[day.getMonth()]}
                </div>
              </div>

              {/* Slots */}
              <div className="flex-1 flex flex-col divide-y divide-gray-100">
                {SLOTS.map(slot => {
                  const slotLessons = lessonsForSlot(iso, slot)
                  const slotActivities = activitiesForSlot(iso, slot)
                  const slotRentals = slot !== 'evening' ? rentalsForSlot(iso, slot === 'morning' ? 'morning' : 'afternoon') : []
                  const cfg = SLOT_CONFIG[slot]
                  const isDropping = dropTarget?.date === iso && dropTarget?.slot === slot
                  const isAddOpen = addForm?.date === iso && addForm?.slot === slot

                  return (
                    <div
                      key={slot}
                      className={`p-2 transition-colors ${isDropping ? 'bg-blue-50 ring-1 ring-inset ring-blue-300' : ''}`}
                      onDragOver={(e) => handleDragOver(e, iso, slot)}
                      onDragLeave={() => setDropTarget(null)}
                      onDrop={(e) => handleDrop(e, iso, slot)}
                    >
                      {/* Slot header */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-gray-500">
                          {cfg.icon} {cfg.label}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                        </div>
                      </div>

                      {/* Lessons */}
                      {slotLessons.map(lesson => {
                        const lessonClients = lesson.client_ids.map(id => mockClients.find(c => c.id === id)).filter(Boolean)
                        const firstClient = lessonClients[0]
                        const instructor = mockInstructors.find(i => i.id === lesson.instructor_id)
                        const tc = LESSON_TYPE_CFG[lesson.type]
                        const isDragging = drag?.lessonId === lesson.id

                        return (
                          <div
                            key={lesson.id}
                            draggable
                            onDragStart={() => handleDragStart(lesson)}
                            onDragEnd={handleDragEnd}
                            className={`group/lesson relative rounded border p-1.5 text-xs mb-1 cursor-grab active:cursor-grabbing transition-opacity ${tc.card} ${isDragging ? 'opacity-40' : ''}`}
                          >
                            {/* Action buttons (hover) */}
                            <div className="absolute top-1 right-1 hidden group-hover/lesson:flex items-center gap-0.5 bg-white/90 rounded px-0.5 py-0.5 shadow-sm">
                              <button
                                onClick={() => copyLesson(lesson)}
                                className="text-gray-500 hover:text-amber-600 text-xs px-1"
                                title="Copy"
                              >⎘</button>
                              <button
                                onClick={() => openEdit(lesson)}
                                className="text-gray-500 hover:text-blue-600 text-xs px-1"
                                title="Edit"
                              >✏️</button>
                              <button
                                onClick={() => deleteLesson(lesson.id)}
                                className="text-gray-500 hover:text-red-600 text-xs px-1"
                                title="Delete"
                              >✕</button>
                            </div>

                            {/* Content */}
                            <div className="flex items-center justify-between mb-0.5 pr-16">
                              <span className="font-bold">{lesson.start_time}</span>
                              <div className="flex items-center gap-1">
                                <span className="opacity-60">{lesson.duration_hours}h</span>
                                <span className={`px-1 rounded text-xs font-medium ${tc.badge}`}>{tc.label}</span>
                              </div>
                            </div>
                            {lessonView === 'by-instructor' ? (
                              <>
                                <div className="font-semibold truncate">
                                  {firstClient?.first_name} {firstClient?.last_name}
                                  {lessonClients.length > 1 && <span className="ml-1 text-[10px] font-normal opacity-70">+{lessonClients.length - 1}</span>}
                                </div>
                                <div className="opacity-60 truncate">↳ {instructor?.first_name} {instructor?.last_name}</div>
                              </>
                            ) : (
                              <>
                                <div className="font-semibold truncate">{instructor?.first_name} {instructor?.last_name}</div>
                                <div className="opacity-60 truncate">
                                  ↳ {firstClient?.first_name} {firstClient?.last_name}
                                  {lessonClients.length > 1 && ` +${lessonClients.length - 1}`}
                                </div>
                              </>
                            )}
                          </div>
                        )
                      })}

                      {/* Activities */}
                      {slotActivities.map(act => (
                        <div
                          key={act.id}
                          className="group/act relative rounded border border-orange-200 bg-orange-50 text-orange-900 p-1.5 text-xs mb-1"
                        >
                          <div className="absolute top-1 right-1 hidden group-hover/act:flex">
                            <button
                              onClick={() => deleteActivity(act.id)}
                              className="text-gray-400 hover:text-red-600 text-xs px-1"
                              title="Delete"
                            >✕</button>
                          </div>
                          <span className="font-medium pr-4">🎯 {act.name}</span>
                          {act.notes && <div className="opacity-60 text-xs">{act.notes}</div>}
                        </div>
                      ))}

                      {/* Rentals */}
                      {slotRentals.map(r => {
                        const client = mockClients.find(c => c.id === r.client_id)
                        const equip = mockEquipment.find(e => e.id === r.equipment_id)
                        // Resolve display type: specific equip category → rental type key or fallback
                        const rt = RENTAL_TYPES.find(t => t.key === (equip?.category ?? r.equipment_id))
                        return (
                          <div
                            key={r.id}
                            className="group/rental relative rounded border border-amber-200 bg-amber-50 text-amber-900 p-1.5 text-xs mb-1"
                          >
                            <div className="absolute top-1 right-1 hidden group-hover/rental:flex">
                              <button
                                onClick={() => deleteRental(r.id)}
                                className="text-gray-400 hover:text-red-600 text-xs px-1"
                                title="Delete"
                              >✕</button>
                            </div>
                            <div className="flex items-center justify-between pr-4">
                              <span className="font-semibold">{rt?.icon ?? '📦'} {rt?.label ?? equip?.name ?? r.equipment_id}</span>
                              <span className="text-amber-700 font-semibold">€{r.price}</span>
                            </div>
                            {equip && <div className="text-[11px] opacity-60 truncate">{equip.name}</div>}
                            <div className="opacity-70 truncate">{client?.first_name} {client?.last_name}</div>
                          </div>
                        )
                      })}

                      {/* Inline add form */}
                      {isAddOpen ? (
                        <div className="mt-1.5 border border-gray-300 rounded-lg bg-white p-2 space-y-1.5 shadow-sm">
                          {addForm?.kind === 'rental' ? (
                            <>
                              {/* Rental form */}
                              <select
                                value={addForm?.rental_client_id}
                                onChange={e => setAddForm(f => f && { ...f, rental_client_id: e.target.value })}
                                className="w-full text-xs border rounded px-1 py-1"
                                autoFocus
                              >
                                {mockClients.map(c => (
                                  <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                                ))}
                              </select>
                              {/* Type buttons */}
                              <div className="grid grid-cols-3 gap-1">
                                {RENTAL_TYPES.map(rt => (
                                  <button
                                    key={rt.key}
                                    type="button"
                                    onClick={() => setAddForm(f => f && {
                                      ...f,
                                      rental_type: rt.key,
                                      rental_price: DEFAULT_RENTAL_PRICES[rt.key] ?? 0,
                                    })}
                                    className={`text-xs py-1 px-1 rounded border transition-colors text-center leading-tight ${
                                      addForm?.rental_type === rt.key
                                        ? 'bg-amber-500 border-amber-600 text-white font-semibold'
                                        : 'bg-white border-gray-200 text-gray-600 hover:border-amber-300'
                                    }`}
                                  >
                                    <div>{rt.icon}</div>
                                    <div>{rt.label}</div>
                                    {rt.sub && <div className="text-[10px] opacity-70">{rt.sub}</div>}
                                  </button>
                                ))}
                              </div>
                              {/* Optional equipment selection */}
                              {(addForm?.rental_type === 'kite' || addForm?.rental_type === 'full') && (
                                <select
                                  value={addForm?.rental_kite_id ?? ''}
                                  onChange={e => setAddForm(f => f && { ...f, rental_kite_id: e.target.value || null })}
                                  className="w-full text-xs border rounded px-1 py-1"
                                >
                                  <option value="">🪁 Kite — not specified</option>
                                  {mockEquipment.filter(e => e.category === 'kite' && e.is_active).map(e => (
                                    <option key={e.id} value={e.id}>{e.name}</option>
                                  ))}
                                </select>
                              )}
                              {(addForm?.rental_type === 'board' || addForm?.rental_type === 'full') && (
                                <select
                                  value={addForm?.rental_board_id ?? ''}
                                  onChange={e => setAddForm(f => f && { ...f, rental_board_id: e.target.value || null })}
                                  className="w-full text-xs border rounded px-1 py-1"
                                >
                                  <option value="">🏄 Board — not specified</option>
                                  {mockEquipment.filter(e => e.category === 'board' && e.is_active).map(e => (
                                    <option key={e.id} value={e.id}>{e.name}</option>
                                  ))}
                                </select>
                              )}
                              {/* Slot + Price */}
                              <div className="flex gap-1 items-center">
                                <select
                                  value={addForm?.rental_slot}
                                  onChange={e => setAddForm(f => f && { ...f, rental_slot: e.target.value as 'morning' | 'afternoon' | 'full_day' })}
                                  className="flex-1 text-xs border rounded px-1 py-1"
                                >
                                  <option value="morning">Morning</option>
                                  <option value="afternoon">Afternoon</option>
                                  <option value="full_day">Full day</option>
                                </select>
                                <input
                                  type="number"
                                  value={addForm?.rental_price ?? 0}
                                  onChange={e => setAddForm(f => f && { ...f, rental_price: parseFloat(e.target.value) || 0 })}
                                  className="w-16 text-xs border rounded px-1 py-1 text-right"
                                  min={0}
                                />
                                <span className="text-xs text-gray-500">€</span>
                              </div>
                              <input
                                type="text"
                                placeholder="Notes (optional)"
                                value={addForm?.rental_notes}
                                onChange={e => setAddForm(f => f && { ...f, rental_notes: e.target.value })}
                                className="w-full text-xs border rounded px-1 py-1"
                              />
                            </>
                          ) : addForm?.kind === 'lesson' ? (
                            <>
                              {/* Lesson form */}
                              <div className="flex gap-1">
                                <select
                                  value={addForm?.type}
                                  onChange={e => setAddForm(f => f && {
                                    ...f,
                                    type: e.target.value as LessonType,
                                    client_ids: [f.client_ids[0] ?? mockClients[0]?.id ?? ''],
                                  })}
                                  className="flex-1 text-xs border rounded px-1 py-1"
                                >
                                  <option value="private">Private</option>
                                  <option value="group">Group</option>
                                  <option value="supervision">Supervision</option>
                                </select>
                              </div>
                              {/* Client(s) — single for private/supervision, dynamic list for group */}
                              {addForm?.type !== 'group' ? (
                                <select
                                  value={addForm?.client_ids[0] ?? ''}
                                  onChange={e => setAddForm(f => f && { ...f, client_ids: [e.target.value] })}
                                  className="w-full text-xs border rounded px-1 py-1"
                                >
                                  {mockClients.map(c => (
                                    <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                                  ))}
                                </select>
                              ) : (
                                <div className="space-y-1">
                                  {(addForm?.client_ids ?? ['']).map((cid, idx) => (
                                    <div key={idx} className="flex gap-1">
                                      <select
                                        value={cid}
                                        onChange={e => setAddForm(f => {
                                          if (!f) return f
                                          const ids = [...f.client_ids]; ids[idx] = e.target.value
                                          return { ...f, client_ids: ids }
                                        })}
                                        className="flex-1 text-xs border rounded px-1 py-1"
                                      >
                                        {mockClients.map(c => (
                                          <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                                        ))}
                                      </select>
                                      {(addForm?.client_ids.length ?? 0) > 1 && (
                                        <button type="button"
                                          onClick={() => setAddForm(f => f && { ...f, client_ids: f.client_ids.filter((_, i) => i !== idx) })}
                                          className="text-red-400 hover:text-red-600 px-1 text-xs">✕</button>
                                      )}
                                    </div>
                                  ))}
                                  <button type="button"
                                    onClick={() => setAddForm(f => f && { ...f, client_ids: [...f.client_ids, mockClients[0]?.id ?? ''] })}
                                    className="text-xs text-green-700 hover:text-green-900 border border-dashed border-green-400 rounded px-2 py-0.5 w-full">
                                    + Add client
                                  </button>
                                </div>
                              )}
                              <select
                                value={addForm?.instructor_id}
                                onChange={e => setAddForm(f => f && { ...f, instructor_id: e.target.value })}
                                className="w-full text-xs border rounded px-1 py-1"
                              >
                                {mockInstructors.map(i => (
                                  <option key={i.id} value={i.id}>{i.first_name} {i.last_name}</option>
                                ))}
                              </select>
                              <div className="flex gap-1">
                                <input
                                  type="time"
                                  value={addForm?.start_time}
                                  onChange={e => setAddForm(f => f && { ...f, start_time: e.target.value })}
                                  className="flex-1 text-xs border rounded px-1 py-1"
                                />
                                <select
                                  value={addForm?.duration_hours}
                                  onChange={e => setAddForm(f => f && { ...f, duration_hours: parseFloat(e.target.value) })}
                                  className="flex-1 text-xs border rounded px-1 py-1"
                                >
                                  {DURATION_OPTIONS.map(d => (
                                    <option key={d} value={d}>{d}h</option>
                                  ))}
                                </select>
                              </div>
                              <input
                                type="text"
                                placeholder="Notes (optional)"
                                value={addForm?.notes}
                                onChange={e => setAddForm(f => f && { ...f, notes: e.target.value })}
                                className="w-full text-xs border rounded px-1 py-1"
                              />
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-600">Equipment (optional)</label>
                                <select
                                  value={addForm?.kite_id || ''}
                                  onChange={e => setAddForm(f => f && { ...f, kite_id: e.target.value || null })}
                                  className="w-full text-xs border rounded px-1 py-1"
                                >
                                  <option value="">No kite</option>
                                  {mockEquipment.filter(e => e.category === 'kite' && e.is_active).map(e => (
                                    <option key={e.id} value={e.id}>{e.name}</option>
                                  ))}
                                </select>
                                <select
                                  value={addForm?.board_id || ''}
                                  onChange={e => setAddForm(f => f && { ...f, board_id: e.target.value || null })}
                                  className="w-full text-xs border rounded px-1 py-1"
                                >
                                  <option value="">No board</option>
                                  {mockEquipment.filter(e => e.category !== 'kite' && e.is_active).map(e => (
                                    <option key={e.id} value={e.id}>{e.name}</option>
                                  ))}
                                </select>
                              </div>
                            </>
                          ) : (
                            <>
                              {/* Activity form */}
                              <input
                                type="text"
                                placeholder="Activity name *"
                                value={addForm?.name}
                                onChange={e => setAddForm(f => f && { ...f, name: e.target.value })}
                                className="w-full text-xs border rounded px-1 py-1"
                                autoFocus
                              />
                              <input
                                type="text"
                                placeholder="Notes (optional)"
                                value={addForm?.actNotes}
                                onChange={e => setAddForm(f => f && { ...f, actNotes: e.target.value })}
                                className="w-full text-xs border rounded px-1 py-1"
                              />
                            </>
                          )}
                          <div className="flex gap-1 pt-0.5">
                            <button
                              onClick={() => setAddForm(null)}
                              className="flex-1 text-xs py-1 bg-gray-100 hover:bg-gray-200 rounded font-medium"
                            >Cancel</button>
                            <button
                              onClick={submitAdd}
                              disabled={addForm?.kind === 'activity' && !addForm?.name}
                              className="flex-1 text-xs py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium disabled:opacity-40"
                            >Add</button>
                          </div>
                        </div>
                      ) : (
                        /* Add / paste buttons */
                        <div className="flex flex-wrap gap-1 mt-1">
                          <button
                            onClick={() => openAdd(iso, slot, 'lesson')}
                            className="text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 px-1.5 py-0.5 rounded border border-dashed border-gray-300 hover:border-blue-300 transition-colors"
                          >+ Lesson</button>
                          <button
                            onClick={() => openAdd(iso, slot, 'activity')}
                            className="text-xs text-gray-400 hover:text-orange-600 hover:bg-orange-50 px-1.5 py-0.5 rounded border border-dashed border-gray-300 hover:border-orange-300 transition-colors"
                          >+ Activity</button>
                          <button
                            onClick={() => openAdd(iso, slot, 'rental')}
                            className="text-xs text-gray-400 hover:text-amber-700 hover:bg-amber-50 px-1.5 py-0.5 rounded border border-dashed border-gray-300 hover:border-amber-400 transition-colors"
                          >+ Rental</button>
                          {clipboard && (
                            <button
                              onClick={() => pasteLesson(iso, slot)}
                              className="text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-50 px-1.5 py-0.5 rounded border border-amber-300 transition-colors font-medium"
                            >📋 Paste</button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Daily total footer */}
              {(() => {
                const dayLessons = lessons.filter(l => l.date === iso)
                const dayRentals = rentals.filter(r => r.date === iso)
                const lessonTotal = dayLessons.reduce((sum, l) => {
                  const instr = mockInstructors.find(i => i.id === l.instructor_id)
                  const rate = l.type === 'private' ? (instr?.rate_private ?? 0)
                             : l.type === 'group'   ? (instr?.rate_group ?? 0)
                             : (instr?.rate_supervision ?? 0)
                  return sum + rate * l.duration_hours
                }, 0)
                const rentalTotal = dayRentals.reduce((sum, r) => sum + r.price, 0)
                const total = lessonTotal + rentalTotal
                if (total === 0 && dayLessons.length === 0) return null
                return (
                  <div className="border-t px-3 py-2 bg-gray-50 rounded-b-lg flex items-center justify-between">
                    <div className="flex gap-2 text-xs text-gray-400">
                      {dayLessons.length > 0 && <span>{dayLessons.length} lesson{dayLessons.length > 1 ? 's' : ''}</span>}
                      {dayRentals.length > 0 && <span>{dayRentals.length} rental{dayRentals.length > 1 ? 's' : ''}</span>}
                    </div>
                    <span className={`text-sm font-bold ${total > 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
                      €{total}
                    </span>
                  </div>
                )
              })()}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 text-xs text-gray-500">
        {(['private', 'group', 'supervision'] as LessonType[]).map(t => (
          <span key={t} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm ${LESSON_TYPE_CFG[t].dot}`} />
            {LESSON_TYPE_CFG[t].label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-orange-400" /> Activity
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> Rental
        </span>
        <span className="text-gray-400 ml-2">· Drag & drop to move · ⎘ to copy</span>
      </div>

      {/* Edit modal */}
      {editLesson && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-bold text-gray-800">Edit lesson</h3>
              <button onClick={() => setEditLesson(null)} className="text-gray-500 hover:text-gray-800 font-bold">✕</button>
            </div>
            <form onSubmit={submitEdit} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select
                    value={editData.type || ''}
                    onChange={e => setEditData(d => ({ ...d, type: e.target.value as LessonType }))}
                    className="w-full text-sm border rounded px-2 py-1.5"
                  >
                    <option value="private">Private</option>
                    <option value="group">Group</option>
                    <option value="supervision">Supervision</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={editData.date || ''}
                    onChange={e => setEditData(d => ({ ...d, date: e.target.value }))}
                    className="w-full text-sm border rounded px-2 py-1.5"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {editData.type === 'group' ? 'Clients' : 'Client'}
                </label>
                {editData.type !== 'group' ? (
                  <select
                    value={editData.client_ids?.[0] ?? ''}
                    onChange={e => setEditData(d => ({ ...d, client_ids: [e.target.value] }))}
                    className="w-full text-sm border rounded px-2 py-1.5"
                  >
                    {mockClients.map(c => (
                      <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-1">
                    {(editData.client_ids ?? ['']).map((cid, idx) => (
                      <div key={idx} className="flex gap-1">
                        <select
                          value={cid}
                          onChange={e => setEditData(d => {
                            const ids = [...(d.client_ids ?? [])]; ids[idx] = e.target.value
                            return { ...d, client_ids: ids }
                          })}
                          className="flex-1 text-sm border rounded px-2 py-1.5"
                        >
                          {mockClients.map(c => (
                            <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                          ))}
                        </select>
                        {(editData.client_ids?.length ?? 0) > 1 && (
                          <button type="button"
                            onClick={() => setEditData(d => ({ ...d, client_ids: (d.client_ids ?? []).filter((_, i) => i !== idx) }))}
                            className="text-red-400 hover:text-red-600 px-1">✕</button>
                        )}
                      </div>
                    ))}
                    <button type="button"
                      onClick={() => setEditData(d => ({ ...d, client_ids: [...(d.client_ids ?? []), mockClients[0]?.id ?? ''] }))}
                      className="text-xs text-green-700 hover:text-green-900 border border-dashed border-green-400 rounded px-2 py-1 w-full">
                      + Add client
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Instructor</label>
                <select
                  value={editData.instructor_id || ''}
                  onChange={e => setEditData(d => ({ ...d, instructor_id: e.target.value }))}
                  className="w-full text-sm border rounded px-2 py-1.5"
                >
                  {mockInstructors.map(i => (
                    <option key={i.id} value={i.id}>{i.first_name} {i.last_name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Time</label>
                  <input
                    type="time"
                    value={editData.start_time || ''}
                    onChange={e => setEditData(d => ({ ...d, start_time: e.target.value }))}
                    className="w-full text-sm border rounded px-2 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Duration</label>
                  <select
                    value={editData.duration_hours || 1}
                    onChange={e => setEditData(d => ({ ...d, duration_hours: parseFloat(e.target.value) }))}
                    className="w-full text-sm border rounded px-2 py-1.5"
                  >
                    {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d}h</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <input
                  type="text"
                  value={editData.notes ?? ''}
                  onChange={e => setEditData(d => ({ ...d, notes: e.target.value || null }))}
                  className="w-full text-sm border rounded px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Kite (optional)</label>
                <select
                  value={editData.kite_id || ''}
                  onChange={e => setEditData(d => ({ ...d, kite_id: e.target.value || null }))}
                  className="w-full text-sm border rounded px-2 py-1.5"
                >
                  <option value="">None</option>
                  {mockEquipment.filter(e => e.category === 'kite' && e.is_active).map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Board (optional)</label>
                <select
                  value={editData.board_id || ''}
                  onChange={e => setEditData(d => ({ ...d, board_id: e.target.value || null }))}
                  className="w-full text-sm border rounded px-2 py-1.5"
                >
                  <option value="">None</option>
                  {mockEquipment.filter(e => e.category !== 'kite' && e.is_active).map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => deleteLesson(editLesson.id)}
                  className="px-3 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded font-medium text-sm"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setEditLesson(null)}
                  className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm"
                >
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
