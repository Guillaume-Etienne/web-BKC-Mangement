import { useState } from 'react'
import type { Lesson, LessonType, EquipmentRental, Instructor, Client, Equipment } from '../types/database'
import { useTable } from '../hooks/useSupabase'
import { toISODate as dateToISO, addDays } from '../utils/dates'

// ─── Types ────────────────────────────────────────────────────────────────────

// The shapes anon is actually served (column-level GRANT — see security-rls.md).
// Typing them narrow keeps the compiler on the side of the GRANT: reaching for
// the client price or the instructor payout no longer compiles here.
type ForecastLesson = Pick<Lesson,
  'id' | 'booking_id' | 'instructor_id' | 'participant_ids' | 'date' | 'start_time' |
  'duration_hours' | 'type' | 'notes'>

// `price` is the redacted mirror: null when the rental is billed to an agency.
type ForecastRental = Pick<EquipmentRental,
  'id' | 'equipment_id' | 'booking_id' | 'participant_id' | 'date' | 'slot'>
  & { price: number | null }

// ─── Constants ────────────────────────────────────────────────────────────────

const SLOT_H = 36
const END_HOUR = 19
const TIME_COL_W = 48

const LESSON_CFG: Record<LessonType, { bg: string; border: string; text: string; badge: string }> = {
  private:    { bg: 'bg-purple-100 dark:bg-purple-900/30', border: 'border-purple-400 dark:border-purple-700', text: 'text-purple-900 dark:text-purple-400', badge: 'bg-purple-500 text-white' },
  group:      { bg: 'bg-green-100 dark:bg-green-900/30',  border: 'border-green-400 dark:border-green-700',  text: 'text-green-900 dark:text-green-400',  badge: 'bg-green-500 text-white'  },
  supervision:{ bg: 'bg-blue-100 dark:bg-blue-900/30',   border: 'border-blue-400 dark:border-blue-700',   text: 'text-blue-900 dark:text-blue-400',   badge: 'bg-blue-500 text-white'   },
}

const RENTAL_TYPE_LABELS: Record<string, { icon: string; label: string }> = {
  kite:      { icon: '🪂', label: 'Kite' },
  board:     { icon: '🏄', label: 'Board' },
  full:      { icon: '🪂🏄', label: 'Full' },
  surfboard: { icon: '🌊', label: 'Surfboard' },
  foilboard: { icon: '⬆️', label: 'Foilboard' },
  free:      { icon: '📦', label: 'Other' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Calendar-day helpers live in utils/dates — never `.toISOString()` on a date
// the user thinks of as a day (it shifts a day back east of Greenwich).

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

  // Column-restricted for anon since 2026-08-18c, same trap as the instructors
  // below: `*` returns 42501 and empties the page. This view shows who teaches
  // what and when, so it never asks for the lesson's client price at all — and
  // `lessons.instructor_rate` (payroll) is now revoked, not merely unused.
  const { data: lessons } = useTable<ForecastLesson>('lessons', {
    select: 'id, booking_id, instructor_id, participant_ids, date, start_time, duration_hours, type, notes',
    order: 'date',
  })
  // Rentals DO show a price here (they always have), so this one reads the
  // redacted mirror: a rental billed to a partner agency arrives as null.
  const { data: rentals } = useTable<ForecastRental>('equipment_rentals', {
    select: 'id, equipment_id, booking_id, participant_id, date, slot, price:share_price',
    order: 'date',
  })
  // Column-restricted for anon: identity ONLY. rate_* is instructor payroll and is
  // revoked from anon (2026-07-29_lesson_pricing.sql) — asking for it returns 42501
  // and empties the whole page. This view never needed them.
  const { data: instructors } = useTable<Instructor>('instructors', { select: 'id, first_name, last_name', order: 'last_name' })
  // Anon only gets identity columns from clients (no email/phone/passport/etc — see security-rls.md)
  const { data: clients } = useTable<Client>('clients', { select: 'id, first_name, last_name', order: 'last_name' })
  const { data: equipment } = useTable<Equipment>('equipment', { order: 'name' })

  const iso = dateToISO(selectedDate)
  const startHour = 8
  const totalSlots = (END_HOUR - startHour) * 2
  const gridHeight = totalSlots * SLOT_H

  const dayLessons = lessons.filter(l => l.date === iso)
  const dayRentals = rentals.filter(r => r.date === iso)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Public header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-blue-600 dark:text-blue-400">🏄 Kitesurf Center</span>
          <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full font-medium">
            📋 Forecast — Read-only
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-4 select-none">
        {/* Date navigation */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedDate(d => addDays(d, -1))}
              className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-bold">←</button>
            <span className="text-base font-semibold min-w-[200px] text-center">{formatDate(selectedDate)}</span>
            <button onClick={() => setSelectedDate(d => addDays(d, 1))}
              className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-bold">→</button>
            <button onClick={() => setSelectedDate(addDays(today, 1))}
              className="px-2.5 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-800">
              Tomorrow
            </button>
          </div>
        </div>

        {/* Mobile instructor selector */}
        <div className="flex md:hidden items-center justify-between bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2">
          <button
            onClick={() => setMobileInstrIdx(i => Math.max(0, i - 1))}
            disabled={mobileInstrIdx === 0}
            className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-30 font-bold text-sm"
          >←</button>
          <div className="text-center">
            <div className="font-bold text-gray-800 dark:text-gray-200">{instructors[mobileInstrIdx]?.first_name} {instructors[mobileInstrIdx]?.last_name}</div>
            {(() => {
              const count = dayLessons.filter(l => l.instructor_id === instructors[mobileInstrIdx]?.id).length
              return count > 0 ? <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">{count} lesson{count > 1 ? 's' : ''}</div> : null
            })()}
          </div>
          <button
            onClick={() => setMobileInstrIdx(i => Math.min(instructors.length - 1, i + 1))}
            disabled={mobileInstrIdx === instructors.length - 1}
            className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-30 font-bold text-sm"
          >→</button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-start">

          {/* Time grid */}
          <div className="flex-1 w-full overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
            {/* Instructor headers — desktop */}
            <div className="hidden md:flex border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-20">
              <div style={{ width: TIME_COL_W }} className="shrink-0 border-r border-gray-200 dark:border-gray-800" />
              {instructors.map(instr => (
                <div key={instr.id} className="flex-1 min-w-[130px] px-2 py-2 text-center border-r border-gray-200 dark:border-gray-800 last:border-r-0">
                  <div className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{instr.first_name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{instr.last_name}</div>
                  {(() => {
                    const count = dayLessons.filter(l => l.instructor_id === instr.id).length
                    return count > 0 ? (
                      <div className="mt-1 inline-block px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] font-semibold">
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
                <div style={{ width: TIME_COL_W }} className="shrink-0 border-r border-gray-200 dark:border-gray-800 relative bg-gray-50 dark:bg-gray-800">
                  {Array.from({ length: totalSlots }, (_, i) => {
                    const isHour = i % 2 === 0
                    return (
                      <div key={i}
                        className={`absolute w-full border-t flex items-start justify-end pr-1.5 ${isHour ? 'border-gray-300 dark:border-gray-700' : 'border-gray-100 dark:border-gray-800'}`}
                        style={{ top: i * SLOT_H, height: SLOT_H }}
                      >
                        {isHour && <span className="text-[10px] text-gray-400 dark:text-gray-400 font-medium -mt-1.5">{slotToTime(i, startHour)}</span>}
                      </div>
                    )
                  })}
                </div>

                {/* Instructor columns */}
                {instructors.map((instr, idx) => {
                  const isMobileHidden = idx !== mobileInstrIdx
                  const instrLessons = dayLessons.filter(l => l.instructor_id === instr.id)

                  return (
                    <div
                      key={instr.id}
                      className={`relative border-r border-gray-200 dark:border-gray-800 last:border-r-0
                        ${isMobileHidden ? 'hidden md:block' : ''}
                        flex-1 min-w-[130px]`}
                    >
                      {/* Slot lines */}
                      {Array.from({ length: totalSlots }, (_, i) => (
                        <div key={i}
                          className={`absolute w-full border-t ${i % 2 === 0 ? 'border-gray-200 dark:border-gray-800' : 'border-gray-100 dark:border-gray-800'}`}
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
                        const lessonClients = lesson.participant_ids.map(id => clients.find(c => c.id === id)).filter(Boolean)
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
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">📦 Rentals</h3>
            {(['morning', 'afternoon', 'full_day'] as const).map(slotKey => {
              const items = dayRentals.filter(r => r.slot === slotKey)
              if (items.length === 0) return null
              const slotLabel = slotKey === 'morning' ? 'Morning' : slotKey === 'afternoon' ? 'Afternoon' : 'Full day'
              return (
                <div key={slotKey}>
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{slotLabel}</div>
                  <div className="space-y-1">
                    {items.map(r => {
                      const client = clients.find(c => c.id === r.participant_id)
                      const equip = equipment.find(e => e.id === r.equipment_id)
                      const rt = RENTAL_TYPE_LABELS[equip?.category ?? r.equipment_id ?? ''] ?? RENTAL_TYPE_LABELS.free
                      return (
                        <div key={r.id} className="flex items-start justify-between bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded px-2 py-1.5 text-xs">
                          <div>
                            <div className="font-semibold text-amber-900 dark:text-amber-400">{rt.icon} {rt.label}</div>
                            <div className="text-amber-700 dark:text-amber-400 truncate">{client?.first_name} {client?.last_name}</div>
                            {/* null = billed to a partner agency, so there is no
                                price to show here — "€" alone would read as a bug. */}
                            <div className="text-amber-600 dark:text-amber-400 font-medium">
                              {r.price != null ? `€${r.price}` : '—'}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {dayRentals.length === 0 && <p className="text-xs text-gray-400 dark:text-gray-400 italic">No rentals planned</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
