import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PlannedLesson, PlannedRental, LessonType, Instructor, BookingParticipant, Equipment } from '../types/database'
import { useTable } from '../hooks/useSupabase'
import { toISODate as dateToISO, addDays } from '../utils/dates'
import { readLocal, writeLocal } from '../utils/safeStorage'

// ─── Types ────────────────────────────────────────────────────────────────────

// This page shows the PLAN (Planning › Forecast), not what was counted in Daily:
// the plan tables hold no price and no pay at all, so there is nothing to redact.
// The shapes are the column-level GRANT anon is served (see security-rls.md) —
// typing them narrow keeps the compiler on the side of the GRANT.
type ForecastLesson = Pick<PlannedLesson,
  'id' | 'instructor_id' | 'participant_ids' | 'date' | 'start_time' |
  'duration_hours' | 'type' | 'notes'>

type ForecastRental = Pick<PlannedRental,
  'id' | 'equipment_id' | 'participant_id' | 'date' | 'slot' | 'rental_type' | 'notes'>

// Anon gets identity only from booking_participants (id, first/last name).
type ForecastGuest = Pick<BookingParticipant, 'id' | 'first_name' | 'last_name'>

// ─── Constants ────────────────────────────────────────────────────────────────

const SLOT_H = 44          // px per 30 min on the desktop grid
const TIME_COL_W = 56
const MIN_START_H = 8
const MIN_END_H = 18

const LESSON_CFG: Record<LessonType, { label: string; bg: string; border: string; text: string; badge: string }> = {
  private:     { label: 'Private',     bg: 'bg-purple-100 dark:bg-purple-900/30', border: 'border-purple-500 dark:border-purple-600', text: 'text-purple-900 dark:text-purple-300', badge: 'bg-purple-600 text-white' },
  group:       { label: 'Group',       bg: 'bg-green-100 dark:bg-green-900/30',   border: 'border-green-500 dark:border-green-600',   text: 'text-green-900 dark:text-green-300',   badge: 'bg-green-600 text-white'  },
  supervision: { label: 'Supervision', bg: 'bg-blue-100 dark:bg-blue-900/30',     border: 'border-blue-500 dark:border-blue-600',     text: 'text-blue-900 dark:text-blue-300',     badge: 'bg-blue-600 text-white'   },
}

const RENTAL_TYPE_LABELS: Record<string, { icon: string; label: string }> = {
  kite:      { icon: '🪂', label: 'Kite' },
  board:     { icon: '🏄', label: 'Board' },
  full:      { icon: '🪂🏄', label: 'Full set' },
  surfboard: { icon: '🌊', label: 'Surfboard' },
  foilboard: { icon: '⬆️', label: 'Foilboard' },
  free:      { icon: '📦', label: 'Other' },
}

const SLOT_SECTIONS = [
  { key: 'morning',   label: 'Morning',   icon: '🌅' },
  { key: 'afternoon', label: 'Afternoon', icon: '☀️' },
  { key: 'full_day',  label: 'Full day',  icon: '📅' },
] as const

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Calendar-day helpers live in utils/dates — never `.toISOString()` on a date
// the user thinks of as a day (it shifts a day back east of Greenwich).

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

function fmtMinutes(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function fmtDuration(hours: number): string {
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1).replace(/\.0$/, '')}h`
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/** Side-by-side lanes for one instructor's overlapping lessons. */
function layoutLanes<T extends { start: number; end: number }>(items: T[]): (T & { lane: number; lanes: number })[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end)
  const out: (T & { lane: number; lanes: number })[] = []
  let cluster: (T & { lane: number; lanes: number })[] = []
  let clusterEnd = -1
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map(c => c.lane + 1))
    cluster.forEach(c => { c.lanes = lanes })
    out.push(...cluster)
    cluster = []
  }
  for (const it of sorted) {
    if (cluster.length && it.start >= clusterEnd) flush()
    const used = new Set(cluster.filter(c => c.end > it.start).map(c => c.lane))
    let lane = 0
    while (used.has(lane)) lane++
    cluster.push({ ...it, lane, lanes: 1 })
    clusterEnd = Math.max(clusterEnd, it.end)
  }
  flush()
  return out
}

type PickedLesson = ForecastLesson & { start: number; end: number; names: string[] }

// ─── Main component (read-only) ───────────────────────────────────────────────

const DAYS_KEY = 'forecast_share_days'   // '1' = single day; anything else = 3 days
const PHONE_VIEW_KEY = 'forecast_share_phone_view'   // 'grid' = all instructors in one table; anything else = one block each

function useWideScreen(minPx = 1024): boolean {
  const query = `(min-width: ${minPx}px)`
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setWide(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return wide
}

export default function ForecastSharePage() {
  const today = new Date()
  const wide = useWideScreen()
  const [threeDays, setThreeDays] = useState(() => readLocal(DAYS_KEY) !== '1')
  // Laptop (3 days): centred on today → yesterday · today · tomorrow.
  // Phone / 1 day: the page is mostly opened to see tomorrow's plan.
  const [selectedDate, setSelectedDate] = useState<Date>(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches && readLocal(DAYS_KEY) !== '1'
      ? today : addDays(today, 1))
  // Phone: the per-instructor blocks stay the default; the shared table is opt-in.
  const [phoneGrid, setPhoneGrid] = useState(() => readLocal(PHONE_VIEW_KEY) === 'grid')
  function pickPhoneView(grid: boolean) {
    setPhoneGrid(grid)
    writeLocal(PHONE_VIEW_KEY, grid ? 'grid' : 'list')
  }
  // Lesson opened from the phone table (tap) → detail sheet.
  const [picked, setPicked] = useState<{ lesson: PickedLesson; instructor: string } | null>(null)
  function pickDays(three: boolean) {
    setThreeDays(three)
    writeLocal(DAYS_KEY, three ? '3' : '1')
  }

  // Column-restricted for anon: `*` returns 42501 and empties the page. These
  // two tables are the Forecast plan (2026-10-10c) — a token of type `forecast`
  // is the only one that can read them.
  const { data: lessons } = useTable<ForecastLesson>('planned_lessons', {
    select: 'id, instructor_id, participant_ids, date, start_time, duration_hours, type, notes',
    order: 'date',
  })
  const { data: rentals } = useTable<ForecastRental>('planned_rentals', {
    select: 'id, equipment_id, participant_id, date, slot, rental_type, notes',
    order: 'date',
  })
  // Column-restricted for anon: identity ONLY. rate_* is instructor payroll and is
  // revoked from anon (2026-07-29_lesson_pricing.sql) — asking for it returns 42501
  // and empties the whole page. This view never needed them.
  const { data: instructors } = useTable<Instructor>('instructors', { select: 'id, first_name, last_name', order: 'last_name' })
  // Lesson / rental participant ids are BookingParticipant ids, not Client ids —
  // looking them up in `clients` is what used to leave every name blank here.
  const { data: guests } = useTable<ForecastGuest>('booking_participants', { select: 'id, first_name, last_name' })
  const { data: equipment } = useTable<Equipment>('equipment', { order: 'name' })

  // Walk-ins placed in the plan carry a `client_id` and no participant (2026-10-10d).
  // That column is granted to anon by a LATER migration (10g): it is therefore read by
  // its own requests, errors swallowed — naming it in the selects above would turn a
  // missing GRANT into 42501 and empty the whole page. Without 10g: no name, nothing breaks.
  const [walkInOf, setWalkInOf] = useState<Record<string, string>>({})   // plan row id → "🚶 First L."
  useEffect(() => {
    let alive = true
    async function load() {
      const [l, r, c] = await Promise.all([
        supabase.from('planned_lessons').select('id, client_id'),
        supabase.from('planned_rentals').select('id, client_id'),
        supabase.from('clients').select('id, first_name, last_name'),
      ])
      if (!alive || c.error) return
      const names = new Map(((c.data ?? []) as { id: string; first_name: string; last_name: string | null }[])
        .map(x => [x.id, `🚶 ${x.first_name} ${x.last_name ? x.last_name.charAt(0) + '.' : ''}`.trim()]))
      const out: Record<string, string> = {}
      for (const res of [l, r]) {
        if (res.error) continue
        for (const row of (res.data ?? []) as { id: string; client_id: string | null }[]) {
          const n = row.client_id ? names.get(row.client_id) : undefined
          if (n) out[row.id] = n
        }
      }
      setWalkInOf(out)
    }
    load()
    return () => { alive = false }
  }, [])

  const todayIso = dateToISO(today)
  const tomorrowIso = dateToISO(addDays(today, 1))
  const iso = dateToISO(selectedDate)
  // Laptop with "3 days": the day before, the selected day, the day after — side by side.
  const multi = wide && threeDays
  const shownDates = multi ? [-1, 0, 1].map(o => addDays(selectedDate, o)) : [selectedDate]

  const guestById = useMemo(() => new Map(guests.map(g => [g.id, g])), [guests])
  const equipById = useMemo(() => new Map(equipment.map(e => [e.id, e])), [equipment])

  const guestName = (id: string | null | undefined): string | null => {
    if (!id) return null
    const g = guestById.get(id)
    return g ? `${g.first_name} ${g.last_name ?? ''}`.trim() : null
  }

  // Everything one day needs, computed from the plan rows of that day.
  function dayData(dayIso: string) {
    const dayLessons = lessons
      .filter(l => l.date === dayIso)
      .map(l => {
        const start = toMinutes(l.start_time)
        const end = start + Math.round(l.duration_hours * 60)
        const names = l.participant_ids.map(guestName).filter((n): n is string => !!n)
        if (names.length === 0 && walkInOf[l.id]) names.push(walkInOf[l.id])
        return { ...l, start, end, names }
      })
    const dayRentals = rentals.filter(r => r.date === dayIso)
    const teaching = instructors
      .map(instr => ({ instr, items: dayLessons.filter(l => l.instructor_id === instr.id).sort((a, b) => a.start - b.start) }))
      .filter(x => x.items.length > 0)
    const idle = instructors.filter(i => !teaching.some(t => t.instr.id === i.id))
    // Grid range follows the content (never narrower than 8–18).
    const startHour = Math.min(MIN_START_H, ...dayLessons.map(l => Math.floor(l.start / 60)))
    const endHour = Math.max(MIN_END_H, ...dayLessons.map(l => Math.ceil(l.end / 60)))
    return { dayLessons, dayRentals, teaching, idle, startHour, endHour }
  }
  type DayData = ReturnType<typeof dayData>

  const summaryOf = (d: DayData) => [
    plural(d.dayLessons.length, 'lesson'),
    plural(d.teaching.length, 'instructor'),
    plural(d.dayRentals.length, 'rental'),
  ].join(' · ')

  const rentalCard = (r: ForecastRental) => {
    const rt = RENTAL_TYPE_LABELS[r.rental_type] ?? RENTAL_TYPE_LABELS.free
    const who = guestName(r.participant_id) ?? walkInOf[r.id]
    const equip = r.equipment_id ? equipById.get(r.equipment_id) : undefined
    return (
      <div key={r.id} className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 border-l-4 border-l-amber-500 rounded-md px-3 py-2">
        <div className="text-sm font-semibold text-amber-900 dark:text-amber-300">{rt.icon} {rt.label}</div>
        {who && <div className="text-sm text-amber-900 dark:text-amber-200">{who}</div>}
        {equip && <div className="text-xs text-amber-800/80 dark:text-amber-400/80">{equip.name}</div>}
        {r.notes && <div className="text-xs italic text-amber-800 dark:text-amber-400 mt-0.5">{r.notes}</div>}
      </div>
    )
  }

  const rentalsPanel = (d: DayData) => (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
        📦 Rentals
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">{d.dayRentals.length}</span>
      </h2>
      {d.dayRentals.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 italic">No rentals planned</p>}
      {SLOT_SECTIONS.map(sec => {
        const items = d.dayRentals.filter(r => r.slot === sec.key)
        if (items.length === 0) return null
        return (
          <div key={sec.key}>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">{sec.icon} {sec.label}</div>
            <div className="flex flex-col gap-1.5">{items.map(rentalCard)}</div>
          </div>
        )
      })}
    </section>
  )

  /** Time grid of one day. `narrow` = one of three columns. */
  const dayGrid = (d: DayData, narrow: boolean, phone = false) => {
    const totalSlots = (d.endHour - d.startHour) * 2
    const gridHeight = totalSlots * SLOT_H
    const colMin = phone ? 'min-w-[92px]' : narrow ? 'min-w-[104px]' : 'min-w-[170px]'
    if (d.teaching.length === 0) {
      return (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-10 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
          No lessons planned
        </p>
      )
    }
    return (
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
        <div className="min-w-fit">
          {/* Instructor headers */}
          <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60">
            <div style={{ width: TIME_COL_W }} className="shrink-0 sticky left-0 z-20 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800" />
            {d.teaching.map(({ instr, items }) => (
              <div key={instr.id} className={`flex-1 ${colMin} px-2 py-2 border-r border-gray-200 dark:border-gray-800 last:border-r-0`}>
                <div className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{narrow ? instr.first_name : `${instr.first_name} ${instr.last_name}`}</div>
                <div className="text-xs text-blue-700 dark:text-blue-400 font-medium">{plural(items.length, 'lesson')}</div>
              </div>
            ))}
          </div>

          {/* Grid body */}
          <div className="flex" style={{ height: gridHeight }}>
            {/* Time labels */}
            <div style={{ width: TIME_COL_W }} className="shrink-0 sticky left-0 z-20 border-r border-gray-200 dark:border-gray-800 relative bg-gray-50 dark:bg-gray-800">
              {Array.from({ length: totalSlots }, (_, i) => i % 2 === 0 && (
                <div key={i} className="absolute w-full border-t border-gray-300 dark:border-gray-700 pr-2 text-right"
                  style={{ top: i * SLOT_H }}>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium relative -top-2 bg-gray-50 dark:bg-gray-800 px-0.5">
                    {fmtMinutes(d.startHour * 60 + i * 30)}
                  </span>
                </div>
              ))}
            </div>

            {/* Instructor columns */}
            {d.teaching.map(({ instr, items }) => (
              <div key={instr.id} className={`relative flex-1 ${colMin} border-r border-gray-200 dark:border-gray-800 last:border-r-0`}>
                {Array.from({ length: totalSlots }, (_, i) => (
                  <div key={i}
                    className={`absolute w-full border-t ${i % 2 === 0 ? 'border-gray-200 dark:border-gray-700' : 'border-dashed border-gray-100 dark:border-gray-800'}`}
                    style={{ top: i * SLOT_H }} />
                ))}

                {layoutLanes(items).map(l => {
                  const cfg = LESSON_CFG[l.type]
                  const top = ((l.start - d.startHour * 60) / 30) * SLOT_H
                  const height = Math.max(((l.end - l.start) / 30) * SLOT_H, SLOT_H)
                  const widthPct = 100 / l.lanes
                  const roomy = height >= SLOT_H * 2
                  return (
                    <div key={l.id}
                      {...(phone ? {
                        role: 'button', tabIndex: 0,
                        onClick: () => setPicked({ lesson: l, instructor: `${instr.first_name} ${instr.last_name}`.trim() }),
                        onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') setPicked({ lesson: l, instructor: `${instr.first_name} ${instr.last_name}`.trim() }) },
                      } : {})}
                      className={`absolute rounded-md border-l-4 px-2 py-1 overflow-hidden shadow-sm z-10 ${phone ? 'cursor-pointer active:brightness-95' : ''} ${cfg.bg} ${cfg.border} ${cfg.text}`}
                      style={{ top: top + 1, height: height - 2, left: `calc(${l.lane * widthPct}% + 2px)`, width: `calc(${widthPct}% - 4px)` }}
                      title={[`${fmtMinutes(l.start)}–${fmtMinutes(l.end)} ${cfg.label}`, l.names.join(', '), l.notes].filter(Boolean).join('\n')}
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold">{narrow ? fmtMinutes(l.start) : `${fmtMinutes(l.start)}–${fmtMinutes(l.end)}`}</span>
                        <span className={`text-[10px] px-1 rounded font-semibold ${cfg.badge}`}>{narrow ? cfg.label.charAt(0) : cfg.label}</span>
                      </div>
                      <div className={`text-sm font-semibold leading-tight ${roomy ? '' : 'truncate'}`}>
                        {l.names.length ? l.names.join(', ') : <span className="italic font-normal opacity-60">No name</span>}
                      </div>
                      {roomy && l.notes && <div className="text-xs italic opacity-80 leading-tight line-clamp-3 mt-0.5">{l.notes}</div>}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const idleLine = (d: DayData) => d.idle.length > 0 && d.teaching.length > 0 && (
    <p className="text-xs text-gray-500 dark:text-gray-400">No lessons: {d.idle.map(i => i.first_name).join(', ')}</p>
  )

  const navBtn = 'h-10 w-10 shrink-0 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-base font-bold'
  const chip = (on: boolean) => `px-3 py-1.5 rounded-full text-xs font-medium border ${on
    ? 'bg-blue-600 border-blue-600 text-white'
    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`

  const selectedDay = dayData(iso)
  const shortDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Public header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
        <span className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400">🏄 Kitesurf Center</span>
        <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full font-medium">
          📋 Forecast
        </span>
      </div>

      <div className={`${multi ? 'max-w-[1800px]' : 'max-w-6xl'} mx-auto px-3 sm:px-4 py-4 sm:py-6 flex flex-col gap-4`}>
        {/* Date navigation */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button aria-label="Previous day" onClick={() => setSelectedDate(d => addDays(d, -1))} className={navBtn}>←</button>
            <div className="flex-1 min-w-0 text-center">
              {multi ? (
                <div className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">
                  {shortDate(shownDates[0])} – {shortDate(shownDates[2])}
                </div>
              ) : (
                <>
                  <div className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">{formatDate(selectedDate)}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{summaryOf(selectedDay)}</div>
                </>
              )}
            </div>
            <button aria-label="Next day" onClick={() => setSelectedDate(d => addDays(d, 1))} className={navBtn}>→</button>
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button onClick={() => setSelectedDate(new Date())} className={chip(iso === todayIso)}>Today</button>
            <button onClick={() => setSelectedDate(addDays(new Date(), 1))} className={chip(iso === tomorrowIso)}>Tomorrow</button>
            <input type="date" value={iso} aria-label="Pick a date"
              onChange={e => { if (e.target.value) setSelectedDate(fromISO(e.target.value)) }}
              className="px-2 py-1 rounded-lg text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300" />
            {wide && (
              <button onClick={() => pickDays(!threeDays)} className={chip(false)}>
                {threeDays ? '▭ 1 day' : '◧ 3 days'}
              </button>
            )}
          </div>
        </div>

        {/* ── Mobile: one block per instructor, lessons in time order ── */}
        <div className="md:hidden flex flex-col gap-4">
          <div className="flex justify-center gap-2">
            <button onClick={() => pickPhoneView(false)} className={chip(!phoneGrid)}>☰ By instructor</button>
            <button onClick={() => pickPhoneView(true)} className={chip(phoneGrid)}>▦ All together</button>
          </div>
          {phoneGrid && (
            <>
              {dayGrid(selectedDay, true, true)}
              {idleLine(selectedDay)}
              <p className="text-[11px] text-gray-500 dark:text-gray-400 text-center -mt-2">Tap a lesson for details · swipe sideways for more instructors</p>
            </>
          )}
          {!phoneGrid && selectedDay.teaching.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-6">No lessons planned</p>
          )}
          {!phoneGrid && selectedDay.teaching.map(({ instr, items }) => (
            <section key={instr.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800 flex items-center justify-between">
                <h2 className="font-bold text-gray-900 dark:text-gray-100">{instr.first_name} {instr.last_name}</h2>
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">{plural(items.length, 'lesson')}</span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.map(l => {
                  const cfg = LESSON_CFG[l.type]
                  return (
                    <div key={l.id} className={`flex gap-3 px-3 py-2.5 border-l-4 ${cfg.border}`}>
                      <div className="w-14 shrink-0 text-center">
                        <div className="text-sm font-bold text-gray-900 dark:text-gray-100">{fmtMinutes(l.start)}</div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">→ {fmtMinutes(l.end)}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[11px] px-1.5 py-0.5 rounded font-semibold ${cfg.badge}`}>{cfg.label}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{fmtDuration(l.duration_hours)}</span>
                        </div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {l.names.length ? l.names.join(', ') : <span className="italic text-gray-400">No name</span>}
                        </div>
                        {l.notes && <div className="text-xs italic text-gray-600 dark:text-gray-400 mt-0.5">{l.notes}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
          {!phoneGrid && idleLine(selectedDay)}
          {rentalsPanel(selectedDay)}
        </div>

        {/* Lesson detail (phone table) */}
        {picked && (() => {
          const l = picked.lesson
          const cfg = LESSON_CFG[l.type]
          return (
            <div className="md:hidden fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setPicked(null)}>
              <div role="dialog" aria-label="Lesson details" onClick={e => e.stopPropagation()}
                className={`w-full max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white dark:bg-gray-900 border-t-4 ${cfg.border} p-4 flex flex-col gap-2 shadow-xl`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{fmtMinutes(l.start)}–{fmtMinutes(l.end)}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{picked.instructor} · {fmtDuration(l.duration_hours)}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-semibold ${cfg.badge}`}>{cfg.label}</span>
                </div>
                <div className="text-base font-medium text-gray-900 dark:text-gray-100">
                  {l.names.length ? l.names.join(', ') : <span className="italic text-gray-400">No name</span>}
                </div>
                {l.notes && <div className="text-sm italic text-gray-700 dark:text-gray-300">{l.notes}</div>}
                <button onClick={() => setPicked(null)}
                  className="mt-2 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm font-medium text-gray-800 dark:text-gray-200">Close</button>
              </div>
            </div>
          )
        })()}

        {/* ── Laptop: time grid(s) (only instructors who teach that day) + rentals ── */}
        {multi ? (
          <div className="hidden md:grid grid-cols-3 gap-4 items-start">
            {shownDates.map(date => {
              const dIso = dateToISO(date)
              const d = dayData(dIso)
              return (
                <div key={dIso} className="min-w-0 flex flex-col gap-2">
                  <button onClick={() => setSelectedDate(date)}
                    className={`text-center rounded-lg px-2 py-1.5 ${dIso === todayIso ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100'}`}>
                    <div className="text-sm font-bold">{formatDate(date)}</div>
                    <div className={`text-[11px] ${dIso === todayIso ? 'text-blue-100' : 'text-gray-600 dark:text-gray-400'}`}>{summaryOf(d)}</div>
                  </button>
                  {dayGrid(d, true)}
                  {idleLine(d)}
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3">
                    {rentalsPanel(d)}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="hidden md:flex gap-5 items-start">
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              {dayGrid(selectedDay, false)}
              {idleLine(selectedDay)}
            </div>
            <aside className="w-64 shrink-0 sticky top-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3">
              {rentalsPanel(selectedDay)}
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}
