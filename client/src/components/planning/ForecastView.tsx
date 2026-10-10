import { useState } from 'react'
import type { Lesson, LessonType, Instructor, Booking, BookingParticipant, Agency, AgencyBillingLine, Lang } from '../../types/database'
import { agencyMarker } from '../accounting/utils'
import { toISODate as dateToISO, addDays, localeTag } from '../../utils/dates'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'

// Read-only day overview of every instructor. Lessons are entered, edited and
// counted in the Daily tab — this view only looks at the same `lessons` rows, so
// there is nothing to "export" between the two: a click on a card jumps to that
// day in Daily. (It used to carry its own add/edit modals, which wrote a lesson
// with `booking_id: ''` and client ids where participant ids belong.)

// ─── Constants ────────────────────────────────────────────────────────────────

const SLOT_H = 36        // px per 30-min slot
const END_HOUR = 19      // grid always ends at 19:00
const TIME_COL_W = 48    // px for the time label column

const LESSON_CFG: Record<LessonType, { bg: string; border: string; text: string; badge: string; bar: string }> = {
  private:    { bg: 'bg-purple-100 dark:bg-purple-900/30', border: 'border-purple-400 dark:border-purple-700', text: 'text-purple-900 dark:text-purple-400', badge: 'bg-purple-500 text-white', bar: 'border-purple-500' },
  group:      { bg: 'bg-green-100 dark:bg-green-900/30',  border: 'border-green-400 dark:border-green-700',  text: 'text-green-900 dark:text-green-400',  badge: 'bg-green-500 text-white',  bar: 'border-green-500'  },
  supervision:{ bg: 'bg-blue-100 dark:bg-blue-900/30',   border: 'border-blue-400 dark:border-blue-700',   text: 'text-blue-900 dark:text-blue-400',   badge: 'bg-blue-500 text-white',   bar: 'border-blue-500'   },
}

const TYPE_TEXT: Record<LessonType, string> = {
  private:     'text-purple-700 dark:text-purple-400',
  group:       'text-green-700 dark:text-green-400',
  supervision: 'text-blue-700 dark:text-blue-400',
}

const TYPES: LessonType[] = ['private', 'group', 'supervision']

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

function formatDate(d: Date, lang: Lang): string {
  return d.toLocaleDateString(localeTag(lang), { weekday: 'long', day: 'numeric', month: 'long' })
}

function lessonTypeLabel(t: LessonType, lang: Lang): string {
  const labels: Record<LessonType, string> = {
    private:     i18n.planning.lesson_type_private[lang],
    group:       i18n.planning.lesson_type_group[lang],
    supervision: i18n.planning.lesson_type_supervision[lang],
  }
  return labels[t]
}

function initialsOf(first?: string | null, last?: string | null): string {
  return `${first?.charAt(0) ?? ''}${last?.charAt(0) ?? ''}`.toUpperCase()
}

/** 1.5 → "1.5", 2 → "2": no trailing zeros, no float noise. */
const fmtH = (n: number) => `${Number(n.toFixed(2))}`

// Lesson.participant_ids points to BookingParticipant rows, not to Client rows
// (see the Lesson type).
function shortName(p: BookingParticipant | undefined): string {
  if (!p) return '—'
  return `${p.first_name} ${p.last_name ? p.last_name.charAt(0) + '.' : ''}`.trim()
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ForecastViewProps {
  lessons: Lesson[]
  instructors: Instructor[]
  bookings: Booking[]
  agencies: Agency[]
  agencyBillingLines: AgencyBillingLine[]
  bookingParticipants: BookingParticipant[]
  /** Jump to the Daily tab on this day (ISO date). */
  onOpenInDaily: (iso: string) => void
}

export default function ForecastView({ lessons, instructors, bookings, agencies, agencyBillingLines, bookingParticipants, onOpenInDaily }: ForecastViewProps) {
  const { lang } = useLanguage()
  const today = new Date()

  const [selectedDate, setSelectedDate] = useState<Date>(() => addDays(today, 1))
  const [startHour, setStartHour]       = useState(8)

  const iso = dateToISO(selectedDate)
  const dayLessons = lessons.filter(l => l.date === iso)
  const totalSlots = (END_HOUR - startHour) * 2
  const gridHeight = totalSlots * SLOT_H

  const namesOf = (l: Lesson) => l.participant_ids.map(id => bookingParticipants.find(p => p.id === id))
  const marker  = (l: Lesson) => agencyMarker(l, { agencies, bookings, agencyBillingLines })

  const dayHours = dayLessons.reduce((s, l) => s + l.duration_hours, 0)
  const hoursByType = TYPES.map(t => ({
    t, h: dayLessons.filter(l => l.type === t).reduce((s, l) => s + l.duration_hours, 0),
  }))

  // Mobile agenda: the whole day, every instructor, one time-sorted list.
  const agendaRows = [...dayLessons].sort((a, b) => a.start_time.localeCompare(b.start_time))

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedDate(d => addDays(d, -1))}
            className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-bold">←</button>
          <span className="text-base font-semibold min-w-[200px] text-center text-gray-800 dark:text-gray-200 capitalize">{formatDate(selectedDate, lang)}</span>
          <button onClick={() => setSelectedDate(d => addDays(d, 1))}
            className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-bold">→</button>
          <button onClick={() => setSelectedDate(addDays(today, 1))}
            className="px-2.5 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-800">
            {i18n.planning.btn_tomorrow[lang]}
          </button>
        </div>

        <div className="hidden md:flex items-center gap-1.5">
          <span className="text-xs text-gray-500 dark:text-gray-400">{i18n.planning.label_start[lang]}</span>
          <select value={startHour} onChange={e => setStartHour(+e.target.value)}
            className="text-sm border rounded px-2 py-1 bg-white dark:bg-gray-900">
            {[8, 9, 10, 11, 12, 13, 14, 15, 16].map(h => (
              <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
            ))}
          </select>
          <span className="text-xs text-gray-400 dark:text-gray-400">→ 19:00</span>
        </div>

        <button onClick={() => onOpenInDaily(iso)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
          🗓️ {i18n.pages.tab_planning_daily[lang]} →
        </button>
      </div>

      {/* Day summary: hours by type */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-700 dark:text-gray-300">
        <span className="font-bold">{dayLessons.length} · {fmtH(dayHours)} h</span>
        {hoursByType.map(({ t, h }) => (
          <span key={t} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            <span className={`inline-block w-2.5 h-2.5 rounded-sm border-l-4 ${LESSON_CFG[t].bar}`} />
            {lessonTypeLabel(t, lang)} {fmtH(h)} h
          </span>
        ))}
      </div>

      {/* Mobile: the whole day for everyone */}
      <div className="md:hidden space-y-2">
        <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">{i18n.planning.agenda_title[lang]}</h2>
        {agendaRows.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-6">{i18n.planning.agenda_empty[lang]}</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900 overflow-hidden">
            {agendaRows.map(l => {
              const names = namesOf(l)
              const shown = names.slice(0, 2).map(shortName).join(', ')
              const more  = names.length > 2 ? ` +${names.length - 2}` : ''
              const instr = instructors.find(i => i.id === l.instructor_id)
              return (
                <li key={l.id}>
                  <button type="button" onClick={() => onOpenInDaily(iso)}
                    className={`w-full text-left flex items-stretch gap-3 py-2.5 pr-3 pl-2 border-l-4 ${LESSON_CFG[l.type].bar} active:bg-gray-100 dark:active:bg-gray-800`}>
                    <div className="w-11 shrink-0 text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-200">{l.start_time.slice(0, 5)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        {instr && <span className="font-bold text-gray-900 dark:text-gray-100">{initialsOf(instr.first_name, instr.last_name)}</span>}
                        <span className={`text-xs font-medium ${TYPE_TEXT[l.type]}`}>{lessonTypeLabel(l.type, lang)}</span>
                        {marker(l) && <span className="text-[11px] font-bold">{marker(l)}</span>}
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-300 truncate">{names.length ? shown + more : '—'}</div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{fmtH(l.duration_hours)} h</div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Desktop: time grid, one column per instructor */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-20">
          <div style={{ width: TIME_COL_W }} className="shrink-0 border-r border-gray-200 dark:border-gray-800" />
          {instructors.map(instr => {
            const mine = dayLessons.filter(l => l.instructor_id === instr.id)
            const hours = mine.reduce((s, l) => s + l.duration_hours, 0)
            return (
              <div key={instr.id} className="flex-1 min-w-[130px] px-2 py-2 text-center border-r border-gray-200 dark:border-gray-800 last:border-r-0">
                <div className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{instr.first_name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{instr.last_name}</div>
                {mine.length > 0 && (
                  <div className="mt-1 inline-block px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] font-semibold">
                    {mine.length} · {fmtH(hours)} h
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 560 }}>
          <div className="flex" style={{ height: gridHeight }}>
            {/* Time labels */}
            <div style={{ width: TIME_COL_W }} className="shrink-0 border-r border-gray-200 dark:border-gray-800 relative bg-gray-50 dark:bg-gray-800">
              {Array.from({ length: totalSlots }, (_, i) => {
                const isHour = i % 2 === 0
                return (
                  <div key={i}
                    className={`absolute w-full border-t flex items-start justify-end pr-1.5 ${isHour ? 'border-gray-300 dark:border-gray-700' : 'border-gray-100 dark:border-gray-800'}`}
                    style={{ top: i * SLOT_H, height: SLOT_H }}>
                    {isHour && <span className="text-[10px] text-gray-400 dark:text-gray-400 font-medium -mt-1.5">{slotToTime(i, startHour)}</span>}
                  </div>
                )
              })}
            </div>

            {instructors.map(instr => (
              <div key={instr.id} className="relative flex-1 min-w-[130px] border-r border-gray-200 dark:border-gray-800 last:border-r-0">
                {Array.from({ length: totalSlots }, (_, i) => (
                  <div key={i}
                    className={`absolute w-full border-t ${i % 2 === 0 ? 'border-gray-200 dark:border-gray-800' : 'border-gray-100 dark:border-gray-800'}`}
                    style={{ top: i * SLOT_H, height: SLOT_H }} />
                ))}

                {dayLessons.filter(l => l.instructor_id === instr.id).map(lesson => {
                  const slot   = Math.max(0, timeToSlot(lesson.start_time, startHour))
                  const height = lesson.duration_hours * 2 * SLOT_H
                  const cfg    = LESSON_CFG[lesson.type]
                  const names  = namesOf(lesson)
                  return (
                    <button key={lesson.id} type="button" onClick={() => onOpenInDaily(iso)}
                      title={names.map(shortName).join(', ')}
                      className={`absolute left-0.5 right-0.5 text-left rounded border-l-4 px-1.5 py-1 overflow-hidden z-10 shadow-sm hover:shadow-md
                        ${cfg.bg} ${cfg.border} ${cfg.text}`}
                      style={{ top: slot * SLOT_H + 1, height: height - 2 }}>
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="text-[10px] font-bold">{lesson.start_time.slice(0, 5)}</span>
                        <span className={`text-[9px] px-1 rounded font-semibold ${cfg.badge}`}>
                          {lesson.type === 'private' ? 'P' : lesson.type === 'group' ? 'G' : 'S'}
                        </span>
                        {/* On the top line, not with the name: the name row only renders
                            on tall enough blocks, and an agency lesson must be
                            recognisable at any height. */}
                        {marker(lesson) && <span className="text-[9px] font-bold shrink-0" title="Agency booking">{marker(lesson)}</span>}
                      </div>
                      {height >= SLOT_H * 2 && (
                        <div className="text-xs font-semibold truncate">
                          {shortName(names[0])}
                          {names.length > 1 && <span className="ml-1 font-normal opacity-70">+{names.length - 1}</span>}
                        </div>
                      )}
                      {height >= SLOT_H * 3 && lesson.notes && (
                        <div className="text-[10px] opacity-60 truncate">{lesson.notes}</div>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
