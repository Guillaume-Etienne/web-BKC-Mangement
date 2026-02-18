import { useState } from 'react'
import type { Lesson, DayActivity, DaySlot, LessonType, Booking } from '../../types/database'
import { mockInstructors, mockClients, mockEquipment } from '../../data/mock'

// ─── Config ──────────────────────────────────────────────────────────────────

type Slot = DaySlot

const SLOTS: Slot[] = ['morning', 'afternoon', 'evening']

const SLOT_CONFIG: Record<Slot, { label: string; icon: string; defaultTime: string }> = {
  morning:   { label: 'Matin',       icon: '🌅', defaultTime: '09:00' },
  afternoon: { label: 'Après-midi',  icon: '☀️', defaultTime: '14:00' },
  evening:   { label: 'Soirée',      icon: '🌙', defaultTime: '19:00' },
}

const LESSON_TYPE_CFG: Record<LessonType, { label: string; card: string; badge: string; dot: string }> = {
  private:    { label: 'Privé',   card: 'bg-purple-50 border-purple-300 text-purple-900', badge: 'bg-purple-500 text-white', dot: 'bg-purple-500' },
  group:      { label: 'Groupe',  card: 'bg-green-50  border-green-300  text-green-900',  badge: 'bg-green-500  text-white', dot: 'bg-green-500'  },
  supervision:{ label: 'Superv.', card: 'bg-blue-50   border-blue-300   text-blue-900',   badge: 'bg-blue-500   text-white', dot: 'bg-blue-500'   },
}

const DAY_FULL = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const MONTH_SHORT = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc']
const DURATION_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3]

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
  kind: 'lesson' | 'activity'
  // lesson fields
  type: LessonType
  client_id: string
  instructor_id: string
  start_time: string
  duration_hours: number
  notes: string
  kite_id: string | null
  board_id: string | null
  // activity fields
  name: string
  actNotes: string
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
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LessonWeekView({
  weekDays, lessons, dayActivities, bookings, lessonView,
  onLessonsChange, onActivitiesChange,
}: LessonWeekViewProps) {
  const today = dateToISO(new Date())

  // ── Inline add form ────────────────────────────────────────────────────────
  const emptyForm = (date: string, slot: Slot, kind: 'lesson' | 'activity'): AddForm => ({
    date, slot, kind,
    type: 'private', client_id: mockClients[0]?.id ?? '', instructor_id: mockInstructors[0]?.id ?? '',
    start_time: SLOT_CONFIG[slot].defaultTime, duration_hours: 1, notes: '', kite_id: null, board_id: null,
    name: '', actNotes: '',
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

  function rentalsForDate(date: string) {
    return bookings.filter(b =>
      b.num_equipment_rentals > 0 &&
      b.check_in <= date && b.check_out > date &&
      b.status !== 'cancelled'
    )
  }

  // ── Add handlers ──────────────────────────────────────────────────────────
  function openAdd(date: string, slot: Slot, kind: 'lesson' | 'activity') {
    setAddForm(emptyForm(date, slot, kind))
  }

  function submitAdd() {
    if (!addForm) return
    if (addForm.kind === 'lesson') {
      const newLesson: Lesson = {
        id: newId('l'),
        booking_id: 'bk1', // placeholder
        instructor_id: addForm.instructor_id,
        client_id: addForm.client_id,
        date: addForm.date,
        start_time: addForm.start_time,
        duration_hours: addForm.duration_hours,
        type: addForm.type,
        notes: addForm.notes || null,
        kite_id: addForm.kite_id,
        board_id: addForm.board_id,
      }
      onLessonsChange(prev => [...prev, newLesson])
    } else {
      const newAct: DayActivity = {
        id: newId('a'),
        date: addForm.date,
        slot: addForm.slot,
        name: addForm.name,
        notes: addForm.actNotes || null,
      }
      onActivitiesChange(prev => [...prev, newAct])
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
    if (confirm('Supprimer ce cours ?')) {
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
          <span>📋 Cours copié :</span>
          <span className="font-semibold">
            {mockClients.find(c => c.id === clipboard.client_id)?.first_name}{' '}
            {mockClients.find(c => c.id === clipboard.client_id)?.last_name}
            {' · '}{LESSON_TYPE_CFG[clipboard.type].label}{' · '}{clipboard.start_time}
          </span>
          <span className="text-gray-500 text-xs">→ Cliquez "Coller" dans une section</span>
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
          const dayRentals = rentalsForDate(iso)

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
                        const client = mockClients.find(c => c.id === lesson.client_id)
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
                                title="Copier"
                              >⎘</button>
                              <button
                                onClick={() => openEdit(lesson)}
                                className="text-gray-500 hover:text-blue-600 text-xs px-1"
                                title="Éditer"
                              >✏️</button>
                              <button
                                onClick={() => deleteLesson(lesson.id)}
                                className="text-gray-500 hover:text-red-600 text-xs px-1"
                                title="Supprimer"
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
                                <div className="font-semibold truncate">{client?.first_name} {client?.last_name}</div>
                                <div className="opacity-60 truncate">↳ {instructor?.first_name} {instructor?.last_name}</div>
                              </>
                            ) : (
                              <>
                                <div className="font-semibold truncate">{instructor?.first_name} {instructor?.last_name}</div>
                                <div className="opacity-60 truncate">↳ {client?.first_name} {client?.last_name}</div>
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
                              title="Supprimer"
                            >✕</button>
                          </div>
                          <span className="font-medium pr-4">🎯 {act.name}</span>
                          {act.notes && <div className="opacity-60 text-xs">{act.notes}</div>}
                        </div>
                      ))}

                      {/* Inline add form */}
                      {isAddOpen ? (
                        <div className="mt-1.5 border border-gray-300 rounded-lg bg-white p-2 space-y-1.5 shadow-sm">
                          {addForm?.kind === 'lesson' ? (
                            <>
                              {/* Lesson form */}
                              <div className="flex gap-1">
                                <select
                                  value={addForm?.type}
                                  onChange={e => setAddForm(f => f && { ...f, type: e.target.value as LessonType })}
                                  className="flex-1 text-xs border rounded px-1 py-1"
                                >
                                  <option value="private">Privé</option>
                                  <option value="group">Groupe</option>
                                  <option value="supervision">Supervision</option>
                                </select>
                              </div>
                              <select
                                value={addForm?.client_id}
                                onChange={e => setAddForm(f => f && { ...f, client_id: e.target.value })}
                                className="w-full text-xs border rounded px-1 py-1"
                              >
                                {mockClients.map(c => (
                                  <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                                ))}
                              </select>
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
                                placeholder="Notes (optionnel)"
                                value={addForm?.notes}
                                onChange={e => setAddForm(f => f && { ...f, notes: e.target.value })}
                                className="w-full text-xs border rounded px-1 py-1"
                              />
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-600">Matériel (optionnel)</label>
                                <select
                                  value={addForm?.kite_id || ''}
                                  onChange={e => setAddForm(f => f && { ...f, kite_id: e.target.value || null })}
                                  className="w-full text-xs border rounded px-1 py-1"
                                >
                                  <option value="">Aucun kite</option>
                                  {mockEquipment.filter(e => e.category === 'kite' && e.is_active).map(e => (
                                    <option key={e.id} value={e.id}>{e.name}</option>
                                  ))}
                                </select>
                                <select
                                  value={addForm?.board_id || ''}
                                  onChange={e => setAddForm(f => f && { ...f, board_id: e.target.value || null })}
                                  className="w-full text-xs border rounded px-1 py-1"
                                >
                                  <option value="">Aucune planche</option>
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
                                placeholder="Nom de l'activité *"
                                value={addForm?.name}
                                onChange={e => setAddForm(f => f && { ...f, name: e.target.value })}
                                className="w-full text-xs border rounded px-1 py-1"
                                autoFocus
                              />
                              <input
                                type="text"
                                placeholder="Notes (optionnel)"
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
                            >Annuler</button>
                            <button
                              onClick={submitAdd}
                              disabled={addForm?.kind === 'activity' && !addForm?.name}
                              className="flex-1 text-xs py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium disabled:opacity-40"
                            >Ajouter</button>
                          </div>
                        </div>
                      ) : (
                        /* Add / paste buttons */
                        <div className="flex flex-wrap gap-1 mt-1">
                          <button
                            onClick={() => openAdd(iso, slot, 'lesson')}
                            className="text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 px-1.5 py-0.5 rounded border border-dashed border-gray-300 hover:border-blue-300 transition-colors"
                          >+ Cours</button>
                          <button
                            onClick={() => openAdd(iso, slot, 'activity')}
                            className="text-xs text-gray-400 hover:text-orange-600 hover:bg-orange-50 px-1.5 py-0.5 rounded border border-dashed border-gray-300 hover:border-orange-300 transition-colors"
                          >+ Activité</button>
                          {clipboard && (
                            <button
                              onClick={() => pasteLesson(iso, slot)}
                              className="text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-50 px-1.5 py-0.5 rounded border border-amber-300 transition-colors font-medium"
                            >📋 Coller</button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Rentals footer */}
              <div className={`border-t px-2 py-2 rounded-b-lg ${dayRentals.length > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                <p className="text-xs font-semibold text-gray-500 mb-1">📦 Locations</p>
                {dayRentals.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">—</p>
                ) : (
                  <div className="space-y-0.5">
                    {dayRentals.map(b => {
                      const client = mockClients.find(c => c.id === b.client_id)
                      return (
                        <div key={b.id} className="text-xs text-amber-900 font-medium">
                          {client?.first_name} {client?.last_name}
                          <span className="text-amber-600 font-normal"> × {b.num_equipment_rentals}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
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
          <span className="w-2.5 h-2.5 rounded-sm bg-orange-400" /> Activité
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> Location active
        </span>
        <span className="text-gray-400 ml-2">· Glisser-déposer pour déplacer · ⎘ pour copier</span>
      </div>

      {/* Edit modal */}
      {editLesson && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-bold text-gray-800">Modifier le cours</h3>
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
                    <option value="private">Privé</option>
                    <option value="group">Groupe</option>
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
                <label className="block text-xs font-medium text-gray-600 mb-1">Client</label>
                <select
                  value={editData.client_id || ''}
                  onChange={e => setEditData(d => ({ ...d, client_id: e.target.value }))}
                  className="w-full text-sm border rounded px-2 py-1.5"
                >
                  {mockClients.map(c => (
                    <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Moniteur</label>
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
                  <label className="block text-xs font-medium text-gray-600 mb-1">Heure</label>
                  <input
                    type="time"
                    value={editData.start_time || ''}
                    onChange={e => setEditData(d => ({ ...d, start_time: e.target.value }))}
                    className="w-full text-sm border rounded px-2 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Durée</label>
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
                <label className="block text-xs font-medium text-gray-600 mb-1">Kite (optionnel)</label>
                <select
                  value={editData.kite_id || ''}
                  onChange={e => setEditData(d => ({ ...d, kite_id: e.target.value || null }))}
                  className="w-full text-sm border rounded px-2 py-1.5"
                >
                  <option value="">Aucun</option>
                  {mockEquipment.filter(e => e.category === 'kite' && e.is_active).map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Planche (optionnel)</label>
                <select
                  value={editData.board_id || ''}
                  onChange={e => setEditData(d => ({ ...d, board_id: e.target.value || null }))}
                  className="w-full text-sm border rounded px-2 py-1.5"
                >
                  <option value="">Aucune</option>
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
                  Supprimer
                </button>
                <button
                  type="button"
                  onClick={() => setEditLesson(null)}
                  className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded font-medium text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm"
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
