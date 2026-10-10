import { useMemo, useRef, useState } from 'react'
import type {
  Lesson, LessonType, EquipmentRental, RentalSlot, Instructor, Equipment, Booking, BookingParticipant,
  Agency, AgencyBillingLine, PriceItem, PriceTier, PlannedLesson, PlannedRental, RentalType, Lang,
} from '../../types/database'
import { rentalBillable } from '../../types/database'
import { currentInstructorRate, resolveLessonRate, agencyMarker } from '../accounting/utils'
import { toISODate as dateToISO, addDays, localeTag } from '../../utils/dates'
import { isOnSiteOn } from '../../utils/dayVisitor'
import { readLocal, writeLocal } from '../../utils/safeStorage'
import { useLanguage } from '../../contexts/LanguageContext'
import { useTable } from '../../hooks/useSupabase'
import { supabase } from '../../lib/supabase'
import { i18n } from '../../data/i18n'
import { RENTAL_TYPES, type RentalKind } from './rentalTypes'

// Forecast = the ORGANISING sandbox. What is placed here is a plan: it lives in
// `planned_lessons` / `planned_rentals`, which nothing in accounting, payroll or
// the hour counters reads. Daily (`lessons`, `equipment_rentals`) stays the figures
// of what actually happened; "Export to Daily" is the one bridge between the two
// (prices and pay are frozen at that moment, exactly as when typed in Daily).

// ─── Constants ────────────────────────────────────────────────────────────────

const SLOT_H = 36        // px per 30-min slot
const END_HOUR = 19      // grid always ends at 19:00
const TIME_COL_W = 48    // px for the time label column

const LESSON_CFG: Record<LessonType, { bg: string; border: string; text: string; badge: string; bar: string }> = {
  private:    { bg: 'bg-purple-100 dark:bg-purple-900/30', border: 'border-purple-400 dark:border-purple-700', text: 'text-purple-900 dark:text-purple-400', badge: 'bg-purple-500 text-white', bar: 'border-purple-500' },
  group:      { bg: 'bg-green-100 dark:bg-green-900/30',  border: 'border-green-400 dark:border-green-700',  text: 'text-green-900 dark:text-green-400',  badge: 'bg-green-500 text-white',  bar: 'border-green-500'  },
  supervision:{ bg: 'bg-blue-100 dark:bg-blue-900/30',   border: 'border-blue-400 dark:border-blue-700',   text: 'text-blue-900 dark:text-blue-400',   badge: 'bg-blue-500 text-white',   bar: 'border-blue-500'   },
}

const TYPES: LessonType[] = ['private', 'group', 'supervision']
const SHOW_ACTUAL_KEY = 'forecast_show_actual'

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
  return {
    private:     i18n.planning.lesson_type_private[lang],
    group:       i18n.planning.lesson_type_group[lang],
    supervision: i18n.planning.lesson_type_supervision[lang],
  }[t]
}

function initialsOf(first?: string | null, last?: string | null): string {
  return `${first?.charAt(0) ?? ''}${last?.charAt(0) ?? ''}`.toUpperCase()
}

/** 1.5 → "1.5", 2 → "2": no trailing zeros, no float noise. */
const fmtH = (n: number) => `${Number(n.toFixed(2))}`

/** Lesson.participant_ids and rental participant ids point to BookingParticipant
 *  rows, not to Client rows (see the Lesson type). */
function shortName(p: BookingParticipant | undefined): string {
  if (!p) return '—'
  return `${p.first_name} ${p.last_name ? p.last_name.charAt(0) + '.' : ''}`.trim()
}

const RENTAL_ICON: Record<string, string> = Object.fromEntries(RENTAL_TYPES.map(r => [r.key, r.icon]))
const RENTAL_LABEL: Record<string, string> = Object.fromEntries(RENTAL_TYPES.map(r => [r.key, r.label]))
const RENTAL_KINDS = RENTAL_TYPES.map(r => r.key as string)

function bookingLabel(b: Booking | undefined): string {
  if (!b) return '—'
  const name = b.client ? `${b.client.first_name} ${b.client.last_name}`.trim() : ''
  return `#${String(b.booking_number).padStart(3, '0')}${name ? ' ' + name : ''}`
}

// ─── Guest picker: chips grouped by booking ───────────────────────────────────
// One chip per traveller, under their booking — so "this guest or the other one
// of the same booking" is a single tap, and a group lesson can mix bookings.

interface GuestPickerProps {
  participants: BookingParticipant[]
  bookings: Booking[]
  selectedIds: string[]
  multi: boolean
  /** hours already planned / done that day, per participant, to spread the load */
  hoursByParticipant: Map<string, number>
  onToggle: (id: string) => void
}

function GuestPicker({ participants, bookings, selectedIds, multi, hoursByParticipant, onToggle }: GuestPickerProps) {
  const groups = useMemo(() => {
    const m = new Map<string, BookingParticipant[]>()
    for (const p of participants) m.set(p.booking_id, [...(m.get(p.booking_id) ?? []), p])
    return [...m.entries()]
      .map(([bid, ps]) => ({ booking: bookings.find(b => b.id === bid), ps }))
      .sort((a, b) => (a.booking?.booking_number ?? 0) - (b.booking?.booking_number ?? 0))
  }, [participants, bookings])

  if (groups.length === 0) {
    return <p className="text-xs text-gray-400 dark:text-gray-400 italic">No guest on site that day.</p>
  }

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
      {groups.map(({ booking, ps }) => (
        <div key={booking?.id ?? ps[0].booking_id}>
          <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">{bookingLabel(booking)}</div>
          <div className="flex flex-wrap gap-1.5">
            {ps.map(p => {
              const on = selectedIds.includes(p.id)
              const h = hoursByParticipant.get(p.id) ?? 0
              return (
                <button key={p.id} type="button" onClick={() => onToggle(p.id)}
                  aria-pressed={on}
                  className={`px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
                    on
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}>
                  {p.first_name}{p.last_name ? ` ${p.last_name.charAt(0)}.` : ''}
                  {h > 0 && <span className={`ml-1 ${on ? 'text-blue-100' : 'text-gray-400 dark:text-gray-500'}`}>{fmtH(h)}h</span>}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {multi && <p className="text-[11px] text-gray-400 dark:text-gray-500">Group: tap several guests, from one booking or several.</p>}
    </div>
  )
}

// ─── Lesson modal (add + edit) ────────────────────────────────────────────────

interface LessonModalProps {
  lesson: PlannedLesson | null              // null = new
  date: string
  startHour: number
  totalSlots: number
  initialInstructorId: string
  initialSlot: number
  instructors: Instructor[]
  bookings: Booking[]
  bookingParticipants: BookingParticipant[]
  hoursByParticipant: Map<string, number>
  onSave: (draft: Omit<PlannedLesson, 'id' | 'exported_at' | 'booking_id'>, id: string | null) => void
  onDelete: (id: string) => void
  onExport: (l: PlannedLesson) => void
  onClose: () => void
}

function LessonModal({
  lesson, date, startHour, totalSlots, initialInstructorId, initialSlot, instructors, bookings,
  bookingParticipants, hoursByParticipant, onSave, onDelete, onExport, onClose,
}: LessonModalProps) {
  const { lang } = useLanguage()
  const [type, setType]       = useState<LessonType>(lesson?.type ?? 'private')
  const [ids, setIds]         = useState<string[]>(lesson?.participant_ids ?? [])
  const [instrId, setInstrId] = useState(lesson?.instructor_id ?? initialInstructorId)
  const [time, setTime]       = useState(lesson ? lesson.start_time.slice(0, 5) : slotToTime(Math.max(0, Math.min(totalSlots - 1, initialSlot)), startHour))
  const [dur, setDur]         = useState(lesson?.duration_hours ?? 1)
  const [notes, setNotes]     = useState(lesson?.notes ?? '')
  const [showAll, setShowAll] = useState(false)

  const exported = !!lesson?.exported_at

  // Guests on site that day, plus whoever is already picked (so an edit never
  // silently hides the person it is about). "Show all" escapes to everyone.
  const candidates = useMemo(() => {
    if (showAll) return bookingParticipants
    const onSite = new Set(bookings.filter(b => isOnSiteOn(b, date)).map(b => b.id))
    return bookingParticipants.filter(p => onSite.has(p.booking_id) || ids.includes(p.id))
  }, [showAll, bookings, bookingParticipants, date, ids])

  function toggle(id: string) {
    if (type !== 'group') { setIds(cur => (cur[0] === id ? [] : [id])); return }
    setIds(cur => cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id])
  }

  function changeType(t: LessonType) {
    setType(t)
    if (t !== 'group') setIds(cur => cur.slice(0, 1))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    onSave({ date, start_time: time, duration_hours: dur, type, instructor_id: instrId, participant_ids: ids, notes: notes.trim() || null }, lesson?.id ?? null)
  }

  const field = 'w-full text-sm border border-gray-300 dark:border-gray-700 rounded px-2 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100'
  const label = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="font-bold text-gray-800 dark:text-gray-200">
            {lesson ? i18n.planning.title_edit_lesson[lang] : i18n.planning.title_new_lesson[lang]} · <span className="font-normal capitalize">{formatDate(new Date(date + 'T00:00:00'), lang)}</span>
          </h3>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-bold text-lg">✕</button>
        </div>

        {exported ? (
          <div className="p-4 space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              ✓ This lesson is already in <b>Daily</b>. Editing the plan would no longer change it — change it in Daily.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded font-medium text-sm">{i18n.common.btn_cancel[lang]}</button>
              <button type="button" onClick={() => lesson && onDelete(lesson.id)}
                className="px-3 py-2 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded font-medium text-sm">Remove from plan</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Type</label>
                <select value={type} onChange={e => changeType(e.target.value as LessonType)} className={field}>
                  {TYPES.map(t => <option key={t} value={t}>{lessonTypeLabel(t, lang)}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Instructor</label>
                <select value={instrId} onChange={e => setInstrId(e.target.value)} className={field}>
                  {instructors.map(i => <option key={i.id} value={i.id}>{i.first_name} {i.last_name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>{i18n.planning.label_start[lang]}</label>
                <select value={time} onChange={e => setTime(e.target.value)} className={field}>
                  {Array.from({ length: totalSlots }, (_, i) => slotToTime(i, startHour)).map(t => <option key={t} value={t}>{t}</option>)}
                  {!Array.from({ length: totalSlots }, (_, i) => slotToTime(i, startHour)).includes(time) && <option value={time}>{time}</option>}
                </select>
              </div>
              <div>
                <label className={label}>Duration</label>
                <select value={dur} onChange={e => setDur(+e.target.value)} className={field}>
                  {[0.5, 1, 1.5, 2, 2.5, 3].map(h => <option key={h} value={h}>{h}h</option>)}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={`${label} mb-0`}>{type === 'group' ? 'Guests' : 'Guest'}{ids.length > 0 && ` · ${ids.length}`}</label>
                <label className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 cursor-pointer">
                  <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
                  Show all guests
                </label>
              </div>
              <GuestPicker participants={candidates} bookings={bookings} selectedIds={ids}
                multi={type === 'group'} hoursByParticipant={hoursByParticipant} onToggle={toggle} />
              {ids.length === 0 && (
                <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">No guest yet — fine for a plan, but it can't be exported to Daily without one.</p>
              )}
            </div>

            <div>
              <label className={label}>Notes</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className={field} placeholder="Optional" />
            </div>

            <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
              {lesson && (
                <button type="button" onClick={() => onDelete(lesson.id)}
                  className="px-3 py-2 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded font-medium text-sm">✕</button>
              )}
              <button type="button" onClick={onClose}
                className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded font-medium text-sm">{i18n.common.btn_cancel[lang]}</button>
              {lesson && (
                <button type="button" onClick={() => onExport(lesson)}
                  className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded font-medium text-sm">→ Daily</button>
              )}
              <button type="submit"
                className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm">
                {lesson ? 'Save' : i18n.common.btn_add[lang]}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Rentals panel ────────────────────────────────────────────────────────────

interface RentalsPanelProps {
  date: string
  plan: PlannedRental[]
  actual: EquipmentRental[]
  showActual: boolean
  equipment: Equipment[]
  bookings: Booking[]
  bookingParticipants: BookingParticipant[]
  onAdd: (r: Omit<PlannedRental, 'id' | 'exported_at' | 'booking_id'>) => void
  onDelete: (id: string) => void
  onExport: (r: PlannedRental) => void
}

function RentalsPanel({ date, plan, actual, showActual, equipment, bookings, bookingParticipants, onAdd, onDelete, onExport }: RentalsPanelProps) {
  const { lang } = useLanguage()
  const [showForm, setShowForm]   = useState(false)
  const [showAll, setShowAll]     = useState(false)
  const [participantId, setPid]   = useState('')
  const [type, setType]           = useState<RentalKind>('kite')
  const [slot, setSlot]           = useState<RentalSlot>('full_day')
  const [equipmentId, setEquip]   = useState('')
  const [notes, setNotes]         = useState('')

  const guests = useMemo(() => {
    if (showAll) return bookingParticipants
    const onSite = new Set(bookings.filter(b => isOnSiteOn(b, date)).map(b => b.id))
    return bookingParticipants.filter(p => onSite.has(p.booking_id))
  }, [showAll, bookings, bookingParticipants, date])

  const groups = useMemo(() => {
    const m = new Map<string, BookingParticipant[]>()
    for (const p of guests) m.set(p.booking_id, [...(m.get(p.booking_id) ?? []), p])
    return [...m.entries()]
      .map(([bid, ps]) => ({ booking: bookings.find(b => b.id === bid), ps }))
      .sort((a, b) => (a.booking?.booking_number ?? 0) - (b.booking?.booking_number ?? 0))
  }, [guests, bookings])

  const gearOptions = equipment.filter(e => e.is_active && (type === 'full' ? e.category === 'kite' : e.category === type))
  const slots: { key: RentalSlot; label: string }[] = [
    { key: 'morning',   label: i18n.planning.slot_morning[lang] },
    { key: 'afternoon', label: i18n.planning.slot_afternoon[lang] },
    { key: 'full_day',  label: i18n.planning.slot_full_day[lang] },
  ]
  const nameOf = (id: string | null) => shortName(bookingParticipants.find(p => p.id === id))
  const gearName = (id: string | null) => equipment.find(e => e.id === id)?.name

  function submit(e: React.FormEvent) {
    e.preventDefault()
    onAdd({
      date, slot, rental_type: type as PlannedRental['rental_type'],
      equipment_id: type === 'free' || type === 'full' ? null : (equipmentId || null),
      participant_id: participantId || null,
      notes: notes.trim() || null,
    })
    setNotes(''); setEquip(''); setShowForm(false)
  }

  const field = 'w-full text-xs border border-gray-300 dark:border-gray-700 rounded px-1.5 py-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100'

  return (
    <div className="w-full md:w-60 md:shrink-0 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">📦 {i18n.planning.section_rentals[lang]}</h3>
        <button onClick={() => setShowForm(v => !v)}
          className="text-xs px-2 py-0.5 rounded border border-dashed border-amber-400 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40">
          + {i18n.common.btn_add[lang]}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg p-2 space-y-1.5">
          <select value={participantId} onChange={e => setPid(e.target.value)} className={field}>
            <option value="">— guest (optional) —</option>
            {groups.map(({ booking, ps }) => (
              <optgroup key={booking?.id ?? ps[0].booking_id} label={bookingLabel(booking)}>
                {ps.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name ?? ''}</option>)}
              </optgroup>
            ))}
          </select>
          <label className="flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-400 cursor-pointer">
            <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} /> Show all guests
          </label>
          <select value={type} onChange={e => { setType(e.target.value as RentalKind); setEquip('') }} className={field}>
            {RENTAL_TYPES.map(r => <option key={r.key} value={r.key}>{r.icon} {r.label}</option>)}
          </select>
          {gearOptions.length > 0 && type !== 'free' && (
            <select value={equipmentId} onChange={e => setEquip(e.target.value)} className={field}>
              <option value="">Any available</option>
              {gearOptions.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
          <select value={slot} onChange={e => setSlot(e.target.value as RentalSlot)} className={field}>
            {slots.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" className={field} />
          <div className="flex gap-1">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 text-xs py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">{i18n.common.btn_cancel[lang]}</button>
            <button type="submit" className="flex-1 text-xs py-1 bg-amber-500 hover:bg-amber-600 text-white rounded font-medium">{i18n.common.btn_add[lang]}</button>
          </div>
        </form>
      )}

      {slots.map(s => {
        const items = plan.filter(r => r.slot === s.key)
        if (items.length === 0) return null
        return (
          <div key={s.key}>
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{s.label}</div>
            <div className="space-y-1">
              {items.map(r => (
                <div key={r.id} className={`flex items-start justify-between gap-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded px-2 py-1.5 text-xs ${r.exported_at ? 'opacity-60' : ''}`}>
                  <div className="min-w-0">
                    <div className="font-semibold text-amber-900 dark:text-amber-400">
                      {RENTAL_ICON[r.rental_type] ?? '📦'} {RENTAL_LABEL[r.rental_type] ?? r.rental_type}
                      {r.exported_at && <span className="ml-1 text-emerald-700 dark:text-emerald-400">✓ Daily</span>}
                    </div>
                    <div className="text-amber-700 dark:text-amber-400 truncate">{r.participant_id ? nameOf(r.participant_id) : '—'}</div>
                    {gearName(r.equipment_id) && <div className="text-[10px] text-amber-700/80 dark:text-amber-400/80 truncate">{gearName(r.equipment_id)}</div>}
                    {r.notes && <div className="text-[10px] italic text-amber-800 dark:text-amber-400 truncate">{r.notes}</div>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!r.exported_at && (
                      <button onClick={() => onExport(r)} title="Export to Daily"
                        className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-bold">→</button>
                    )}
                    <button onClick={() => onDelete(r.id)} title="Remove from plan"
                      className="text-gray-400 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400">✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {plan.length === 0 && !showForm && (
        <p className="text-xs text-gray-400 dark:text-gray-400 italic">{i18n.planning.msg_no_rentals_planned[lang]}</p>
      )}

      {showActual && actual.length > 0 && (
        <div className="pt-2 border-t border-dashed border-gray-300 dark:border-gray-700">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">In Daily</div>
          <div className="space-y-1">
            {actual.map(r => {
              const eq = equipment.find(e => e.id === r.equipment_id)
              return (
                <div key={r.id} className="border border-dashed border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-600 dark:text-gray-400">
                  <div className="font-medium">{RENTAL_ICON[eq?.category ?? 'free'] ?? '📦'} {eq?.name ?? RENTAL_LABEL.free}</div>
                  <div className="truncate">{r.participant_id ? nameOf(r.participant_id) : '—'}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ForecastViewProps {
  lessons: Lesson[]                // Daily — the truth, only read here (and written by export)
  rentals: EquipmentRental[]
  instructors: Instructor[]
  equipment: Equipment[]
  bookings: Booking[]
  agencies: Agency[]
  agencyBillingLines: AgencyBillingLine[]
  bookingParticipants: BookingParticipant[]
  priceItems: PriceItem[]
  priceTiers: PriceTier[]
  /** Resolve true once saved — the plan row is stamped exported only then. */
  onAddLesson: (l: Omit<Lesson, 'id'>) => Promise<boolean>
  onAddRental: (r: Omit<EquipmentRental, 'id'>) => Promise<boolean>
}

type Clip = { from: string; lessons: Omit<PlannedLesson, 'id' | 'exported_at' | 'date'>[]; rentals: Omit<PlannedRental, 'id' | 'exported_at' | 'date'>[] }

export default function ForecastView({
  lessons, rentals, instructors, equipment, bookings, agencies, agencyBillingLines,
  bookingParticipants, priceItems, priceTiers, onAddLesson, onAddRental,
}: ForecastViewProps) {
  const { lang } = useLanguage()
  const today = new Date()

  const [selectedDate, setSelectedDate] = useState<Date>(() => addDays(today, 1))
  const [startHour, setStartHour]       = useState(8)
  const [showActual, setShowActual]     = useState(() => readLocal(SHOW_ACTUAL_KEY) === '1')
  const [clip, setClip]                 = useState<Clip | null>(null)
  const [busy, setBusy]                 = useState(false)

  // Modals
  const [modal, setModal] = useState<{ lesson: PlannedLesson | null; instructorId: string; slot: number } | null>(null)

  // Drag state (plan cards only)
  const [dragLesson, setDragLesson]   = useState<PlannedLesson | null>(null)
  const [dragMode, setDragMode]       = useState<'move' | 'resize'>('move')
  const [dragPreview, setDragPreview] = useState<{ instructorId: string; startSlot: number; durationSlots: number } | null>(null)
  const dragStartY    = useRef(0)
  const dragStartSlot = useRef(0)
  const dragStartDur  = useRef(0)
  const gridRef       = useRef<HTMLDivElement>(null)

  // The plan. Two reads, refreshed after every write.
  const { data: planLessons, refresh: refreshPlanLessons } = useTable<PlannedLesson>('planned_lessons', { order: 'date' })
  const { data: planRentals, refresh: refreshPlanRentals } = useTable<PlannedRental>('planned_rentals', { order: 'date' })

  const iso         = dateToISO(selectedDate)
  const totalSlots  = (END_HOUR - startHour) * 2
  const gridHeight  = totalSlots * SLOT_H

  const dayPlan     = planLessons.filter(l => l.date === iso)
  const dayPlanRent = planRentals.filter(r => r.date === iso)
  const dayActual   = lessons.filter(l => l.date === iso)
  const dayActualRent = rentals.filter(r => r.date === iso)

  const onSiteBookingIds = useMemo(
    () => new Set(bookings.filter(b => isOnSiteOn(b, iso)).map(b => b.id)),
    [bookings, iso],
  )
  const onSiteParticipantIds = useMemo(
    () => new Set(bookingParticipants.filter(p => onSiteBookingIds.has(p.booking_id)).map(p => p.id)),
    [bookingParticipants, onSiteBookingIds],
  )

  // Hours per guest that day, plan + Daily — shown on the picker chips.
  const hoursByParticipant = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of [...dayPlan, ...dayActual]) {
      for (const id of l.participant_ids) m.set(id, (m.get(id) ?? 0) + l.duration_hours)
    }
    return m
  }, [dayPlan, dayActual])

  const namesOf = (ids: string[]) => ids.map(id => bookingParticipants.find(p => p.id === id))
  const bookingOf = (ids: string[]) => bookingParticipants.find(p => p.id === ids[0])?.booking_id ?? null
  const offSite = (ids: string[]) => ids.some(id => !onSiteParticipantIds.has(id))
  const marker = (l: Lesson) => agencyMarker(l, { agencies, bookings, agencyBillingLines })

  const planHours   = dayPlan.reduce((s, l) => s + l.duration_hours, 0)
  const actualHours = dayActual.reduce((s, l) => s + l.duration_hours, 0)

  function toggleShowActual(v: boolean) {
    setShowActual(v)
    writeLocal(SHOW_ACTUAL_KEY, v ? '1' : '0')
  }

  // ── Plan writes ───────────────────────────────────────────────────────────

  async function savePlanLesson(draft: Omit<PlannedLesson, 'id' | 'exported_at' | 'booking_id'>, id: string | null) {
    const row = { ...draft, booking_id: bookingOf(draft.participant_ids) }
    const { error } = id
      ? await supabase.from('planned_lessons').update(row).eq('id', id)
      : await supabase.from('planned_lessons').insert([row])
    if (error) { alert('Error saving plan: ' + error.message); return }
    refreshPlanLessons()
  }

  async function deletePlanLesson(id: string) {
    const { error } = await supabase.from('planned_lessons').delete().eq('id', id)
    if (error) { alert('Error removing from plan: ' + error.message); return }
    refreshPlanLessons()
  }

  async function addPlanRental(draft: Omit<PlannedRental, 'id' | 'exported_at' | 'booking_id'>) {
    const booking_id = bookingParticipants.find(p => p.id === draft.participant_id)?.booking_id ?? null
    const { error } = await supabase.from('planned_rentals').insert([{ ...draft, booking_id }])
    if (error) { alert('Error saving plan: ' + error.message); return }
    refreshPlanRentals()
  }

  async function deletePlanRental(id: string) {
    const { error } = await supabase.from('planned_rentals').delete().eq('id', id)
    if (error) { alert('Error removing from plan: ' + error.message); return }
    refreshPlanRentals()
  }

  // ── Export to Daily ───────────────────────────────────────────────────────
  // The only bridge between plan and truth. Prices and pay are frozen NOW, from
  // the same sources Daily uses, so an exported lesson is indistinguishable from
  // one typed there. Returns why it was skipped, or null when it went through.

  async function exportLesson(p: PlannedLesson): Promise<string | null> {
    if (p.exported_at) return 'already exported'
    const bookingId = p.booking_id ?? bookingOf(p.participant_ids)
    if (!bookingId) return 'no guest picked'
    const duplicate = lessons.some(l =>
      l.date === p.date && l.instructor_id === p.instructor_id &&
      l.start_time.slice(0, 5) === p.start_time.slice(0, 5) &&
      l.participant_ids.some(id => p.participant_ids.includes(id)))
    if (duplicate) return 'already in Daily'
    const instr = instructors.find(i => i.id === p.instructor_id)
    const ok = await onAddLesson({
      booking_id: bookingId,
      instructor_id: p.instructor_id,
      participant_ids: p.participant_ids,
      date: p.date,
      start_time: p.start_time,
      duration_hours: p.duration_hours,
      type: p.type,
      notes: p.notes,
      kite_id: null,
      board_id: null,
      price_per_hour: resolveLessonRate(
        { id: '', type: p.type, participant_ids: p.participant_ids, price_per_hour: null },
        priceItems, { tiers: priceTiers, allLessons: lessons, bookingParticipants }),
      instructor_rate: instr ? currentInstructorRate({ type: p.type }, instr) : null,
    })
    if (!ok) return 'could not be saved'
    const { error } = await supabase.from('planned_lessons').update({ exported_at: new Date().toISOString() }).eq('id', p.id)
    if (error) return 'exported, but the plan could not be marked'
    return null
  }

  async function exportRental(p: PlannedRental): Promise<string | null> {
    if (p.exported_at) return 'already exported'
    const kind = p.rental_type
    // Specific gear if the plan named one, else the first active item of the
    // category — the same fallback the old Forecast used. 'full' books the kite.
    const category = kind === 'full' ? 'kite' : kind
    const equipmentId = p.equipment_id
      ?? (kind === 'free' ? null : equipment.find(e => e.category === category && e.is_active)?.id ?? null)
    const duplicate = rentals.some(r =>
      r.date === p.date && r.slot === p.slot && r.participant_id === p.participant_id &&
      r.equipment_id === equipmentId && p.participant_id !== null)
    if (duplicate) return 'already in Daily'
    const price = kind === 'free' ? 0
      : priceItems.find(pi => pi.billable_type === rentalBillable(kind as RentalType))?.price ?? 0
    const ok = await onAddRental({
      equipment_id: equipmentId,
      booking_id: p.booking_id,
      participant_id: p.participant_id,
      date: p.date,
      slot: p.slot,
      price,
      notes: p.notes,
    })
    if (!ok) return 'could not be saved'
    const { error } = await supabase.from('planned_rentals').update({ exported_at: new Date().toISOString() }).eq('id', p.id)
    if (error) return 'exported, but the plan could not be marked'
    return null
  }

  function reportSkips(done: number, skips: string[]) {
    refreshPlanLessons(); refreshPlanRentals()
    if (skips.length === 0) return
    alert(`${done} exported to Daily.\n\nNot exported:\n• ${skips.join('\n• ')}`)
  }

  async function exportOneLesson(p: PlannedLesson) {
    if (busy) return
    setBusy(true)
    const why = await exportLesson(p)
    setBusy(false)
    setModal(null)
    reportSkips(why ? 0 : 1, why ? [why] : [])
  }

  async function exportOneRental(p: PlannedRental) {
    if (busy) return
    setBusy(true)
    const why = await exportRental(p)
    setBusy(false)
    reportSkips(why ? 0 : 1, why ? [why] : [])
  }

  async function exportDay() {
    const ls = dayPlan.filter(l => !l.exported_at)
    const rs = dayPlanRent.filter(r => !r.exported_at)
    if (ls.length + rs.length === 0) { alert('Nothing left to export for this day.'); return }
    if (!confirm(
      `Export ${ls.length} lesson(s) and ${rs.length} rental(s) of ${formatDate(selectedDate, lang)} to Daily?\n\n` +
      'They will be counted from now on: the client price and the instructor pay are frozen today. ' +
      'Items without a guest, or already in Daily, are skipped.',
    )) return
    setBusy(true)
    let done = 0
    const skips: string[] = []
    for (const l of ls) {
      const why = await exportLesson(l)
      if (why) skips.push(`${l.start_time.slice(0, 5)} ${shortName(namesOf(l.participant_ids)[0])}: ${why}`)
      else done++
    }
    for (const r of rs) {
      const why = await exportRental(r)
      if (why) skips.push(`${RENTAL_LABEL[r.rental_type] ?? 'Rental'}: ${why}`)
      else done++
    }
    setBusy(false)
    reportSkips(done, skips)
  }

  // ── Copy / paste ──────────────────────────────────────────────────────────

  function copyPlan() {
    setClip({
      from: iso,
      lessons: dayPlan.map(({ id: _i, exported_at: _e, date: _d, ...rest }) => rest),
      rentals: dayPlanRent.map(({ id: _i, exported_at: _e, date: _d, ...rest }) => rest),
    })
  }

  function copyFromDaily() {
    setClip({
      from: iso,
      lessons: dayActual.map(l => ({
        start_time: l.start_time, duration_hours: l.duration_hours, type: l.type, instructor_id: l.instructor_id,
        participant_ids: l.participant_ids, booking_id: l.booking_id, notes: l.notes,
      })),
      rentals: dayActualRent.map(r => {
        const cat = equipment.find(e => e.id === r.equipment_id)?.category
        return {
          slot: r.slot,
          rental_type: (cat && RENTAL_KINDS.includes(cat) ? cat : 'free') as PlannedRental['rental_type'],
          equipment_id: r.equipment_id, participant_id: r.participant_id, booking_id: r.booking_id, notes: r.notes,
        }
      }),
    })
  }

  async function pasteDay() {
    if (!clip || clip.lessons.length + clip.rentals.length === 0) return
    setBusy(true)
    const [a, b] = await Promise.all([
      clip.lessons.length
        ? supabase.from('planned_lessons').insert(clip.lessons.map(l => ({ ...l, date: iso })))
        : Promise.resolve({ error: null }),
      clip.rentals.length
        ? supabase.from('planned_rentals').insert(clip.rentals.map(r => ({ ...r, date: iso })))
        : Promise.resolve({ error: null }),
    ])
    setBusy(false)
    const err = a.error ?? b.error
    if (err) alert('Error pasting: ' + err.message)
    refreshPlanLessons(); refreshPlanRentals()
  }

  // ── Drag (plan cards) ─────────────────────────────────────────────────────

  function startDrag(e: React.PointerEvent, lesson: PlannedLesson, mode: 'move' | 'resize') {
    if (lesson.exported_at) return
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragStartY.current    = e.clientY
    dragStartSlot.current = Math.max(0, timeToSlot(lesson.start_time, startHour))
    dragStartDur.current  = lesson.duration_hours * 2
    setDragLesson(lesson)
    setDragMode(mode)
    setDragPreview({ instructorId: lesson.instructor_id, startSlot: dragStartSlot.current, durationSlots: dragStartDur.current })
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragLesson || !dragPreview) return
    const dSlots = Math.round((e.clientY - dragStartY.current) / SLOT_H)
    if (dragMode === 'resize') {
      const newDur = Math.max(1, Math.min(totalSlots - dragPreview.startSlot, dragStartDur.current + dSlots))
      if (newDur !== dragPreview.durationSlots) setDragPreview(p => p && { ...p, durationSlots: newDur })
      return
    }
    const newStart = Math.max(0, Math.min(totalSlots - 1, dragStartSlot.current + dSlots))
    let newInstr = dragPreview.instructorId
    if (gridRef.current) {
      for (const col of gridRef.current.querySelectorAll('[data-instructor-id]')) {
        const r = col.getBoundingClientRect()
        if (e.clientX >= r.left && e.clientX <= r.right) { newInstr = col.getAttribute('data-instructor-id') ?? newInstr; break }
      }
    }
    if (newStart !== dragPreview.startSlot || newInstr !== dragPreview.instructorId)
      setDragPreview(p => p && { ...p, startSlot: newStart, instructorId: newInstr })
  }

  async function onPointerUp() {
    if (!dragLesson || !dragPreview) { setDragLesson(null); return }
    const moved = dragLesson
    const pv = dragPreview
    setDragLesson(null)
    setDragPreview(null)
    const same = pv.startSlot === Math.max(0, timeToSlot(moved.start_time, startHour))
      && pv.durationSlots === moved.duration_hours * 2 && pv.instructorId === moved.instructor_id
    if (same) return
    // A plan has no frozen pay to re-freeze — that happens at export.
    const { error } = await supabase.from('planned_lessons').update({
      start_time: slotToTime(pv.startSlot, startHour),
      duration_hours: pv.durationSlots * 0.5,
      instructor_id: pv.instructorId,
    }).eq('id', moved.id)
    if (error) alert('Error moving: ' + error.message)
    refreshPlanLessons()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const agenda = [...dayPlan].sort((a, b) => a.start_time.localeCompare(b.start_time))
  const actualAgenda = [...dayActual].sort((a, b) => a.start_time.localeCompare(b.start_time))
  const pendingCount = dayPlan.filter(l => !l.exported_at).length + dayPlanRent.filter(r => !r.exported_at).length
  const btn = 'px-3 py-1.5 rounded text-sm font-medium'

  return (
    <div className="flex flex-col gap-4 select-none" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
      {/* Plan banner: this is not the accounting view */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 px-3 py-2 text-xs text-blue-800 dark:text-blue-300">
        <span className="font-bold">📝 Plan</span>
        <span>Organising sandbox — nothing here is counted. What really happened is in <b>Daily</b>; use “→ Daily” to turn a plan into a real lesson.</span>
      </div>

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
            className="text-sm border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            {[8, 9, 10, 11, 12, 13, 14, 15, 16].map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
          </select>
          <span className="text-xs text-gray-400 dark:text-gray-400">→ 19:00</span>
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
          <span role="switch" aria-checked={showActual}
            onClick={() => toggleShowActual(!showActual)}
            className={`relative inline-block w-9 h-5 rounded-full transition-colors ${showActual ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${showActual ? 'left-[18px]' : 'left-0.5'}`} />
          </span>
          <span onClick={() => toggleShowActual(!showActual)}>Show Daily</span>
        </label>
      </div>

      {/* Actions + plan vs Daily */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setModal({ lesson: null, instructorId: instructors[0]?.id ?? '', slot: 2 })}
          className={`${btn} bg-blue-600 hover:bg-blue-700 text-white`}>+ Lesson</button>
        <button onClick={copyPlan} disabled={dayPlan.length + dayPlanRent.length === 0}
          className={`${btn} bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40`}>
          {i18n.planning.btn_copy_day[lang]}
        </button>
        <button onClick={copyFromDaily} disabled={dayActual.length + dayActualRent.length === 0}
          title="Copy what really happened this day (Daily), to paste it as a plan on another day"
          className={`${btn} bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40`}>
          📋 From Daily
        </button>
        {clip && clip.lessons.length + clip.rentals.length > 0 && (
          <button onClick={pasteDay} disabled={busy}
            className={`${btn} bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-800 text-amber-800 dark:text-amber-400`}>
            Paste {clip.lessons.length + clip.rentals.length} here
          </button>
        )}
        <button onClick={exportDay} disabled={busy || pendingCount === 0}
          className={`${btn} ml-auto bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40`}>
          → Export day to Daily{pendingCount > 0 ? ` (${pendingCount})` : ''}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-bold text-gray-800 dark:text-gray-200">Plan {fmtH(planHours)} h · {dayPlan.length} lesson{dayPlan.length === 1 ? '' : 's'}</span>
        <span className={`${actualHours > 0 ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
          Daily {fmtH(actualHours)} h · {dayActual.length}
        </span>
        {TYPES.map(t => (
          <span key={t} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            <span className={`inline-block w-2.5 h-2.5 rounded-sm border-l-4 ${LESSON_CFG[t].bar}`} />
            {lessonTypeLabel(t, lang)}
          </span>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start">
        <div className="flex-1 w-full min-w-0">

          {/* Mobile: whole day as a list; tap = edit */}
          <div className="md:hidden space-y-2">
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">{i18n.planning.agenda_title[lang]}</h2>
            {agenda.length === 0 && !(showActual && actualAgenda.length > 0) ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-6">{i18n.planning.agenda_empty[lang]}</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900 overflow-hidden">
                {agenda.map(l => {
                  const names = namesOf(l.participant_ids)
                  const instr = instructors.find(i => i.id === l.instructor_id)
                  return (
                    <li key={l.id}>
                      <button type="button" onClick={() => setModal({ lesson: l, instructorId: l.instructor_id, slot: 0 })}
                        className={`w-full text-left flex items-stretch gap-3 py-2.5 pr-3 pl-2 border-l-4 ${LESSON_CFG[l.type].bar} active:bg-gray-100 dark:active:bg-gray-800 ${l.exported_at ? 'opacity-60' : ''}`}>
                        <div className="w-11 shrink-0 text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-200">{l.start_time.slice(0, 5)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-sm">
                            {instr && <span className="font-bold text-gray-900 dark:text-gray-100">{initialsOf(instr.first_name, instr.last_name)}</span>}
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{lessonTypeLabel(l.type, lang)} · {fmtH(l.duration_hours)}h</span>
                            {l.exported_at && <span className="text-[11px] text-emerald-700 dark:text-emerald-400">✓ Daily</span>}
                            {offSite(l.participant_ids) && <span title="A guest is not on site that day">⚠️</span>}
                          </div>
                          <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
                            {names.length ? names.slice(0, 2).map(shortName).join(', ') + (names.length > 2 ? ` +${names.length - 2}` : '') : '—'}
                          </div>
                        </div>
                      </button>
                    </li>
                  )
                })}
                {showActual && actualAgenda.map(l => {
                  const names = namesOf(l.participant_ids)
                  const instr = instructors.find(i => i.id === l.instructor_id)
                  return (
                    <li key={l.id} className="flex items-stretch gap-3 py-2 pr-3 pl-2 border-l-4 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40">
                      <div className="w-11 shrink-0 text-sm tabular-nums text-gray-500 dark:text-gray-400">{l.start_time.slice(0, 5)}</div>
                      <div className="min-w-0 flex-1 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-semibold">Daily</span> · {instr ? initialsOf(instr.first_name, instr.last_name) : ''} {lessonTypeLabel(l.type, lang)} · {fmtH(l.duration_hours)}h
                        <div className="truncate">{names.map(shortName).join(', ') || '—'}</div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Desktop: time grid */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-20">
              <div style={{ width: TIME_COL_W }} className="shrink-0 border-r border-gray-200 dark:border-gray-800" />
              {instructors.map(instr => {
                const mine = dayPlan.filter(l => l.instructor_id === instr.id)
                const hours = mine.reduce((s, l) => s + l.duration_hours, 0)
                return (
                  <div key={instr.id} className={`flex-1 ${showActual ? 'min-w-[190px]' : 'min-w-[130px]'} px-2 py-2 text-center border-r border-gray-200 dark:border-gray-800 last:border-r-0`}>
                    <div className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{instr.first_name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{instr.last_name}</div>
                    {mine.length > 0 && (
                      <div className="mt-1 inline-block px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] font-semibold">
                        {mine.length} · {fmtH(hours)} h
                      </div>
                    )}
                    {showActual && (
                      <div className="mt-1 flex text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        <span className="flex-1">Plan</span><span className="flex-1">Daily</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div ref={gridRef} className="overflow-y-auto" style={{ maxHeight: 560 }}>
              <div className="flex" style={{ height: gridHeight }}>
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
                  <div key={instr.id} data-instructor-id={instr.id}
                    className={`relative flex-1 ${showActual ? 'min-w-[190px]' : 'min-w-[130px]'} border-r border-gray-200 dark:border-gray-800 last:border-r-0`}>
                    {Array.from({ length: totalSlots }, (_, i) => (
                      <div key={i}
                        className={`absolute w-full border-t ${i % 2 === 0 ? 'border-gray-200 dark:border-gray-800' : 'border-gray-100 dark:border-gray-800'}`}
                        style={{ top: i * SLOT_H, height: SLOT_H }} />
                    ))}

                    {/* Plan lane — click an empty spot to place a lesson */}
                    <div className={`absolute inset-y-0 left-0 ${showActual ? 'w-1/2' : 'w-full'}`}
                      onClick={e => {
                        if (dragLesson) return
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                        const slot = Math.max(0, Math.min(totalSlots - 1, Math.floor((e.clientY - rect.top) / SLOT_H)))
                        setModal({ lesson: null, instructorId: instr.id, slot })
                      }}>
                      {dayPlan.filter(l => l.instructor_id === instr.id).map(lesson => {
                        const isDragging = dragLesson?.id === lesson.id
                        const rawSlot = Math.max(0, timeToSlot(lesson.start_time, startHour))
                        const slot = isDragging && dragPreview?.instructorId === instr.id ? dragPreview.startSlot : rawSlot
                        const dur  = isDragging && dragPreview?.instructorId === instr.id ? dragPreview.durationSlots : lesson.duration_hours * 2
                        if (isDragging && dragPreview && dragPreview.instructorId !== instr.id) return null
                        const height = dur * SLOT_H
                        const cfg = LESSON_CFG[lesson.type]
                        const names = namesOf(lesson.participant_ids)
                        const done = !!lesson.exported_at
                        return (
                          <div key={lesson.id}
                            className={`absolute left-0.5 right-0.5 rounded border-l-4 px-1.5 py-1 overflow-hidden z-10
                              ${cfg.bg} ${cfg.border} ${cfg.text}
                              ${done ? 'opacity-50' : 'cursor-grab active:cursor-grabbing'}
                              ${isDragging ? 'opacity-70 shadow-lg ring-2 ring-blue-400' : 'shadow-sm hover:shadow-md'}`}
                            style={{ top: slot * SLOT_H + 1, height: height - 2 }}
                            onClick={e => { e.stopPropagation(); setModal({ lesson, instructorId: lesson.instructor_id, slot: rawSlot }) }}
                            onPointerDown={e => startDrag(e, lesson, 'move')}>
                            <div className="flex items-center gap-1 mb-0.5">
                              <span className="text-[10px] font-bold">{lesson.start_time.slice(0, 5)}</span>
                              <span className={`text-[9px] px-1 rounded font-semibold ${cfg.badge}`}>
                                {lesson.type === 'private' ? 'P' : lesson.type === 'group' ? 'G' : 'S'}
                              </span>
                              {done && <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400">✓</span>}
                              {offSite(lesson.participant_ids) && <span className="text-[10px]" title="A guest is not on site that day">⚠️</span>}
                            </div>
                            {height >= SLOT_H * 2 && (
                              <div className="text-xs font-semibold truncate">
                                {lesson.participant_ids.length ? shortName(names[0]) : <span className="italic opacity-60">no guest</span>}
                                {names.length > 1 && <span className="ml-1 font-normal opacity-70">+{names.length - 1}</span>}
                              </div>
                            )}
                            {height >= SLOT_H * 3 && lesson.notes && <div className="text-[10px] opacity-60 truncate">{lesson.notes}</div>}
                            {!done && (
                              <>
                                <button type="button" title="Export to Daily"
                                  onClick={e => { e.stopPropagation(); exportOneLesson(lesson) }}
                                  onPointerDown={e => e.stopPropagation()}
                                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded bg-white/70 dark:bg-gray-900/70 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold leading-none hover:bg-white dark:hover:bg-gray-900">→</button>
                                <div className="absolute bottom-0 left-0 right-0 h-3 cursor-s-resize flex items-center justify-center opacity-0 hover:opacity-100 active:opacity-100"
                                  onPointerDown={e => { e.stopPropagation(); startDrag(e, lesson, 'resize') }}>
                                  <div className="w-8 h-0.5 bg-current rounded opacity-40" />
                                </div>
                              </>
                            )}
                          </div>
                        )
                      })}

                      {dragLesson && dragPreview?.instructorId === instr.id && dragLesson.instructor_id !== instr.id && (
                        <div className={`absolute left-0.5 right-0.5 rounded border-l-4 opacity-50 pointer-events-none z-10 ${LESSON_CFG[dragLesson.type].bg} ${LESSON_CFG[dragLesson.type].border}`}
                          style={{ top: dragPreview.startSlot * SLOT_H + 1, height: dragPreview.durationSlots * SLOT_H - 2 }} />
                      )}
                    </div>

                    {/* Daily lane — what really happened; look, don't touch */}
                    {showActual && (
                      <div className="absolute inset-y-0 right-0 w-1/2 border-l border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/30">
                        {dayActual.filter(l => l.instructor_id === instr.id).map(l => {
                          const slot = Math.max(0, timeToSlot(l.start_time, startHour))
                          const height = l.duration_hours * 2 * SLOT_H
                          const cfg = LESSON_CFG[l.type]
                          const names = namesOf(l.participant_ids)
                          return (
                            <div key={l.id} title="In Daily"
                              className={`absolute left-0.5 right-0.5 rounded border border-dashed border-l-4 px-1.5 py-1 overflow-hidden opacity-80 ${cfg.bg} ${cfg.border} ${cfg.text}`}
                              style={{ top: slot * SLOT_H + 1, height: height - 2 }}>
                              <div className="flex items-center gap-1 mb-0.5">
                                <span className="text-[10px] font-bold">{l.start_time.slice(0, 5)}</span>
                                <span className={`text-[9px] px-1 rounded font-semibold ${cfg.badge}`}>{l.type === 'private' ? 'P' : l.type === 'group' ? 'G' : 'S'}</span>
                                {marker(l) && <span className="text-[9px] font-bold shrink-0">{marker(l)}</span>}
                              </div>
                              {height >= SLOT_H * 2 && (
                                <div className="text-xs font-semibold truncate">
                                  {shortName(names[0])}{names.length > 1 && <span className="ml-1 font-normal opacity-70">+{names.length - 1}</span>}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <RentalsPanel
          date={iso}
          plan={dayPlanRent}
          actual={dayActualRent}
          showActual={showActual}
          equipment={equipment}
          bookings={bookings}
          bookingParticipants={bookingParticipants}
          onAdd={addPlanRental}
          onDelete={deletePlanRental}
          onExport={exportOneRental}
        />
      </div>

      {/* Mobile: the grid is desktop-only, so adding goes through a button */}
      <button onClick={() => setModal({ lesson: null, instructorId: instructors[0]?.id ?? '', slot: 2 })}
        className="md:hidden fixed bottom-4 right-4 z-30 px-4 py-3 rounded-full bg-blue-600 text-white font-semibold shadow-lg">+ Lesson</button>

      {modal && (
        <LessonModal
          key={modal.lesson?.id ?? `new-${modal.instructorId}-${modal.slot}`}
          lesson={modal.lesson}
          date={iso}
          startHour={startHour}
          totalSlots={totalSlots}
          initialInstructorId={modal.instructorId}
          initialSlot={modal.slot}
          instructors={instructors}
          bookings={bookings}
          bookingParticipants={bookingParticipants}
          hoursByParticipant={hoursByParticipant}
          onSave={async (draft, id) => { setModal(null); await savePlanLesson(draft, id) }}
          onDelete={async id => { setModal(null); await deletePlanLesson(id) }}
          onExport={exportOneLesson}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
