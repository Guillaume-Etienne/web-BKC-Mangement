import { useState } from 'react'
import type { Lesson, LessonType, EquipmentRental } from '../types/database'
import { mockInstructors, mockClients, mockEquipment, mockLessons, mockEquipmentRentals } from '../data/mock'

// ─── Constants ────────────────────────────────────────────────────────────────

const SLOT_H = 36
const END_HOUR = 19
const TIME_COL_W = 48

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

// ─── Main component (read-only) ───────────────────────────────────────────────

export default function ForecastSharePage() {
  const today = new Date()
  const [selectedDate, setSelectedDate] = useState<Date>(() => addDays(today, 1))
  const [mobileInstrIdx, setMobileInstrIdx] = useState(0)

  const lessons: Lesson[] = mockLessons
  const rentals: EquipmentRental[] = mockEquipmentRentals

  const iso = dateToISO(selectedDate)
  const startHour = 8
  const totalSlots = (END_HOUR - startHour) * 2
  const gridHeight = totalSlots * SLOT_H

  const dayLessons = lessons.filter(l => l.date === iso)
  const dayRentals = rentals.filter(r => r.date === iso)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Public header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-blue-600">🏄 Kitesurf Center</span>
          <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
            📋 Forecast — Read-only
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-4 select-none">
        {/* Date navigation */}
        <div className="flex flex-wrap items-center gap-3">
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
        </div>

        {/* Mobile instructor selector */}
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

        <div className="flex flex-col md:flex-row gap-4 items-start">

          {/* Time grid */}
          <div className="flex-1 w-full overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
            {/* Instructor headers — desktop */}
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
            <div className="overflow-y-auto" style={{ maxHeight: 520 }}>
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

                {/* Instructor columns */}
                {mockInstructors.map((instr, idx) => {
                  const isMobileHidden = idx !== mobileInstrIdx
                  const instrLessons = dayLessons.filter(l => l.instructor_id === instr.id)

                  return (
                    <div
                      key={instr.id}
                      className={`relative border-r border-gray-200 last:border-r-0
                        ${isMobileHidden ? 'hidden md:block' : ''}
                        flex-1 min-w-[130px]`}
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
                        const slot = Math.max(0, timeToSlot(lesson.start_time, startHour))
                        const dur = lesson.duration_hours * 2
                        const top = slot * SLOT_H
                        const height = dur * SLOT_H
                        const cfg = LESSON_CFG[lesson.type]
                        const lessonClients = lesson.client_ids.map(id => mockClients.find(c => c.id === id)).filter(Boolean)
                        const firstClient = lessonClients[0]

                        return (
                          <div key={lesson.id}
                            className={`absolute left-0.5 right-0.5 rounded border-l-4 px-1.5 py-1 overflow-hidden shadow-sm z-10
                              ${cfg.bg} ${cfg.border} ${cfg.text}`}
                            style={{ top: top + 1, height: height - 2 }}
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
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Rentals panel — read-only */}
          <div className="w-full md:w-52 md:shrink-0 flex flex-col gap-3">
            <h3 className="text-sm font-bold text-gray-700">📦 Rentals</h3>
            {(['morning', 'afternoon', 'full_day'] as const).map(slotKey => {
              const items = dayRentals.filter(r => r.slot === slotKey)
              if (items.length === 0) return null
              const slotLabel = slotKey === 'morning' ? 'Morning' : slotKey === 'afternoon' ? 'Afternoon' : 'Full day'
              return (
                <div key={slotKey}>
                  <div className="text-xs font-semibold text-gray-500 mb-1">{slotLabel}</div>
                  <div className="space-y-1">
                    {items.map(r => {
                      const client = mockClients.find(c => c.id === r.client_id)
                      const equip = mockEquipment.find(e => e.id === r.equipment_id)
                      const rt = RENTAL_TYPE_LABELS[equip?.category ?? r.equipment_id] ?? RENTAL_TYPE_LABELS.free
                      return (
                        <div key={r.id} className="flex items-start justify-between bg-amber-50 border border-amber-200 rounded px-2 py-1.5 text-xs">
                          <div>
                            <div className="font-semibold text-amber-900">{rt.icon} {rt.label}</div>
                            <div className="text-amber-700 truncate">{client?.first_name} {client?.last_name}</div>
                            <div className="text-amber-600 font-medium">€{r.price}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {dayRentals.length === 0 && <p className="text-xs text-gray-400 italic">No rentals planned</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
