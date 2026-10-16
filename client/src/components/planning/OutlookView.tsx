import { useMemo, useState } from 'react'
import type {
  Agency, AgencyBillingLine, Booking, BookingParticipant, Client, Instructor,
  IntentKind, Lesson, LessonIntent, RentalType,
} from '../../types/database'
import { lessonDiscipline } from '../../types/database'
import { addDaysISO, daysBetween, fmtDateShort, fromISODate, localeTag, toISODate, todayISO } from '../../utils/dates'
import { stayBookings } from '../../utils/dayVisitor'
import { agencyMarker } from '../accounting/utils'
import { useLanguage } from '../../contexts/LanguageContext'
import { useTable } from '../../hooks/useSupabase'
import { supabase } from '../../lib/supabase'
import { i18n } from '../../data/i18n'
import { RENTAL_TYPES } from './rentalTypes'

// Outlook = long-term INTENTIONS per traveller, read from the upcoming bookings, and above all a
// way to ANTICIPATE the load: hours, students and lessons per instructor per day. Not accounting:
// nothing here is billed, paid or counted by payroll. Forecast stays the hour-by-hour plan.
// Rows are created on first edit; until then they are derived from the traveller's checkboxes
// (wants_*) — no trigger, so nothing can ever block a booking_participants insert.

type Horizon = '1w' | '2w' | '1m' | 'season'
const HORIZON_KEY = 'outlook_horizon'
const DEFAULT_INSTR_KEY = 'outlook_default_instructor'
const MAX_SEASON_DAYS = 240
/** gui, 2026-10-16: a typical lesson lasts 2 h — only used to show "≈ N lessons" from hours. */
const TYPICAL_LESSON_H = 2
/** A day above this many hours (average over the cell) turns red. A tuning knob, not a rule. */
const OVERLOAD_H_PER_DAY = 8

interface Props {
  bookings: Booking[]
  bookingParticipants: BookingParticipant[]
  instructors: Instructor[]
  lessons: Lesson[]
  clients: Client[]
  agencies: Agency[]
  agencyBillingLines: AgencyBillingLine[]
}

/** A row as the screen sees it: stored (has an id) or derived from a checkbox (no id yet). */
interface IntentRowData {
  id: string | null
  booking_id: string
  participant_id: string
  kind: IntentKind
  instructor_id: string | null
  planned_hours: number | null
  prepaid_hours: number | null
  rental_type: RentalType | 'free' | null
  estimated_days: number | null
  window_start: string | null
  window_end: string | null
  notes: string | null
}

interface Bucket { from: string; to: string; label: string; days: number }
interface Contribution { row: IntentRowData; instrKey: string; bucket: number; share: number; defaulted: boolean }
interface Cell { kite: number; wing: number; defaulted: number; students: Set<string>; rows: Set<IntentRowData> }

const fmt = (n: number) => String(Math.round(n * 10) / 10)

const KIND_STYLE: Record<IntentKind, string> = {
  kite:   'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  wing:   'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300',
  rental: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
}
const KIND_ICON: Record<IntentKind, string> = { kite: '🪁', wing: '🪽', rental: '🎒' }
const INSTR_DOT = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500']

function readPref(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function writePref(key: string, v: string) {
  try { localStorage.setItem(key, v) } catch { /* storage can be unavailable */ }
}
function readHorizon(): Horizon {
  const v = readPref(HORIZON_KEY)
  return v === '1w' || v === '2w' || v === '1m' || v === 'season' ? v : '2w'
}

/** Columns: a day each up to 2 weeks (no horizontal scroll), a week for a month, a month for a season. */
function makeBuckets(start: string, end: string, horizon: Horizon, lang: 'fr' | 'en' | 'es'): Bucket[] {
  const out: Bucket[] = []
  const tag = localeTag(lang)
  if (horizon === 'season') {
    let from = start
    while (from <= end) {
      const d = fromISODate(from)
      const last = toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0))
      const to = last > end ? end : last
      out.push({ from, to, days: daysBetween(from, to) + 1, label: d.toLocaleDateString(tag, { month: 'short' }) })
      from = addDaysISO(to, 1)
    }
    return out
  }
  const step = horizon === '1m' ? 7 : 1
  for (let from = start; from <= end; from = addDaysISO(from, step)) {
    const t = addDaysISO(from, step - 1)
    const to = t > end ? end : t
    const label = step === 1
      ? fromISODate(from).toLocaleDateString(tag, { weekday: 'short', day: 'numeric' })
      : fmtDateShort(from)
    out.push({ from, to, days: daysBetween(from, to) + 1, label })
  }
  return out
}

export default function OutlookView({
  bookings, bookingParticipants, instructors, lessons, clients, agencies, agencyBillingLines,
}: Props) {
  const { lang } = useLanguage()
  const t = i18n.planning
  const { data: intents, refresh } = useTable<LessonIntent>('lesson_intents')
  const [horizon, setHorizon] = useState<Horizon>(readHorizon)
  const [sel, setSel] = useState<{ key: string; b: number } | null>(null)
  const [openStays, setOpenStays] = useState<Set<string>>(new Set())

  // The instructor whose name stands in for "nobody assigned". A preference you set once (kept in
  // this browser), pre-filled with Rémi when there is one — never a rule hard-coded on a name.
  // The list of instructors may still be loading on the first render, so the Rémi fallback is
  // resolved on every render rather than frozen at mount.
  const [defaultPref, setDefaultPref] = useState<string | null>(() => readPref(DEFAULT_INSTR_KEY))
  const defaultId = defaultPref ?? instructors.find(i => i.first_name === 'Rémi')?.id ?? ''
  function pickDefault(id: string) { setDefaultPref(id); writePref(DEFAULT_INSTR_KEY, id) }
  const defaultName = instructors.find(i => i.id === defaultId)?.first_name ?? t.outlook_none[lang]

  function pickHorizon(h: Horizon) { setHorizon(h); setSel(null); writePref(HORIZON_KEY, h) }

  const start = todayISO()
  const upcoming = useMemo(
    () => stayBookings(bookings).filter(b => b.status !== 'cancelled' && b.check_out >= start),
    [bookings, start],
  )
  const end = useMemo(() => {
    if (horizon === '1w') return addDaysISO(start, 6)
    if (horizon === '2w') return addDaysISO(start, 13)
    if (horizon === '1m') return addDaysISO(start, 34)
    const last = upcoming.reduce((m, b) => (b.check_out > m ? b.check_out : m), start)
    const cap = addDaysISO(start, MAX_SEASON_DAYS)
    return last > cap ? cap : last
  }, [horizon, start, upcoming])
  const shown = useMemo(
    () => upcoming.filter(b => b.check_in <= end).sort((a, b) => a.check_in.localeCompare(b.check_in)),
    [upcoming, end],
  )
  const buckets = useMemo(() => makeBuckets(start, end, horizon, lang), [start, end, horizon, lang])

  const bookingById = useMemo(() => new Map(bookings.map(b => [b.id, b])), [bookings])
  const partById = useMemo(() => new Map(bookingParticipants.map(p => [p.id, p])), [bookingParticipants])
  const clientName = (id: string) => {
    const c = clients.find(x => x.id === id)
    return c ? `${c.first_name} ${c.last_name}`.trim() : '—'
  }
  const participantsOf = (bookingId: string) => bookingParticipants.filter(p => p.booking_id === bookingId)
  const instrName = (key: string) =>
    key === 'none' ? t.outlook_none[lang] : (instructors.find(i => i.id === key)?.first_name ?? '—')

  // ── Rows: stored + derived from the checkboxes ───────────────────────────────
  const rowsByParticipant = useMemo(() => {
    const m = new Map<string, IntentRowData[]>()
    const push = (r: IntentRowData) => { const a = m.get(r.participant_id); if (a) a.push(r); else m.set(r.participant_id, [r]) }
    for (const i of intents) push({ ...i })
    for (const p of bookingParticipants) {
      const mine = m.get(p.id) ?? []
      const blank = { id: null, booking_id: p.booking_id, participant_id: p.id, instructor_id: null, planned_hours: null,
        prepaid_hours: null, estimated_days: null, window_start: null, window_end: null, notes: null }
      if (p.wants_kite_lessons && !mine.some(r => r.kind === 'kite')) push({ ...blank, kind: 'kite', rental_type: null })
      if (p.wants_wing_lessons && !mine.some(r => r.kind === 'wing')) push({ ...blank, kind: 'wing', rental_type: null })
      if (p.wants_kite_rental && !mine.some(r => r.kind === 'rental')) push({ ...blank, kind: 'rental', rental_type: 'kite' })
    }
    const order: Record<IntentKind, number> = { kite: 0, wing: 1, rental: 2 }
    for (const a of m.values()) a.sort((x, y) => order[x.kind] - order[y.kind])
    return m
  }, [intents, bookingParticipants])

  // Hours actually given (Daily is the truth), per traveller and discipline.
  const doneHours = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of lessons) {
      const kind: IntentKind = lessonDiscipline(l) === 'kite' ? 'kite' : 'wing'
      for (const pid of l.participant_ids) {
        const k = `${pid}|${kind}`
        m.set(k, (m.get(k) ?? 0) + l.duration_hours)
      }
    }
    return m
  }, [lessons])

  // Agency package hours frozen on the billing line — only ever a SUGGESTION, never saved without a click.
  const suggestedPrepaid = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of agencyBillingLines) {
      if (l.participant_id && l.unit_hours) m.set(l.participant_id, (m.get(l.participant_id) ?? 0) + l.unit_hours)
    }
    return m
  }, [agencyBillingLines])

  // ── The load: every stored row's hours, spread evenly over its window, per instructor & column ──
  const { contributions, cells, rentals } = useMemo(() => {
    const contribs: Contribution[] = []
    const cellMap = new Map<string, Cell>()
    const rent = new Map<string, number[]>()
    for (const rows of rowsByParticipant.values()) {
      for (const r of rows) {
        if (!r.id) continue                                   // derived rows carry no numbers
        const b = bookingById.get(r.booking_id)
        if (!b || b.status === 'cancelled') continue
        const ws = r.window_start ?? b.check_in
        const we = r.window_end ?? b.check_out
        if (we < ws) continue
        const wLen = daysBetween(ws, we) + 1
        const amount = r.kind === 'rental' ? r.estimated_days : r.planned_hours
        if (!amount) continue
        buckets.forEach((bk, idx) => {
          const from = ws > bk.from ? ws : bk.from
          const to = we < bk.to ? we : bk.to
          if (to < from) return
          const share = amount * (daysBetween(from, to) + 1) / wLen
          if (r.kind === 'rental') {
            const key = r.rental_type ?? 'kite'
            const arr = rent.get(key) ?? buckets.map(() => 0)
            arr[idx] += share
            rent.set(key, arr)
            return
          }
          const defaulted = !r.instructor_id
          const instrKey = r.instructor_id ?? (defaultId || 'none')
          contribs.push({ row: r, instrKey, bucket: idx, share, defaulted })
          const ck = `${instrKey}|${idx}`
          const c = cellMap.get(ck) ?? { kite: 0, wing: 0, defaulted: 0, students: new Set<string>(), rows: new Set<IntentRowData>() }
          c[r.kind as 'kite' | 'wing'] += share
          if (defaulted) c.defaulted += share
          c.students.add(r.participant_id)
          c.rows.add(r)
          cellMap.set(ck, c)
        })
      }
    }
    return { contributions: contribs, cells: cellMap, rentals: [...rent.entries()] }
  }, [rowsByParticipant, bookingById, buckets, defaultId])

  // Rows of the grid: the default instructor always, then everyone who carries hours.
  const gridRows = useMemo(() => {
    const keys = new Set<string>()
    if (defaultId) keys.add(defaultId)
    for (const c of contributions) keys.add(c.instrKey)
    const ordered = instructors.filter(i => keys.has(i.id)).map(i => i.id)
    if (keys.has('none')) ordered.push('none')
    return ordered
  }, [contributions, instructors, defaultId])

  const totals = useMemo(() => buckets.map((_, idx) => {
    const tot: Cell = { kite: 0, wing: 0, defaulted: 0, students: new Set(), rows: new Set() }
    for (const key of gridRows) {
      const c = cells.get(`${key}|${idx}`)
      if (!c) continue
      tot.kite += c.kite; tot.wing += c.wing
      c.students.forEach(s => tot.students.add(s))
    }
    return tot
  }), [buckets, gridRows, cells])

  // ── Writes ───────────────────────────────────────────────────────────────────
  async function save(row: IntentRowData, patch: Partial<IntentRowData>) {
    const { error } = row.id
      ? await supabase.from('lesson_intents').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', row.id)
      : await supabase.from('lesson_intents').insert([{
          booking_id: row.booking_id, participant_id: row.participant_id, kind: row.kind,
          rental_type: row.rental_type, ...patch,
        }])
    if (error) { alert(t.outlook_err_save[lang] + error.message); return }
    refresh()
  }
  async function remove(row: IntentRowData) {
    if (!row.id) return
    if (!confirm(t.outlook_remove_confirm[lang])) return
    const { error } = await supabase.from('lesson_intents').delete().eq('id', row.id)
    if (error) { alert(t.outlook_err_save[lang] + error.message); return }
    setSel(null)
    refresh()
  }
  async function add(p: BookingParticipant, kind: IntentKind) {
    const mine = rowsByParticipant.get(p.id) ?? []
    let rental_type: RentalType | 'free' | null = null
    if (kind === 'rental') {
      const used = new Set(mine.filter(r => r.kind === 'rental').map(r => r.rental_type))
      const free = RENTAL_TYPES.find(rt => !used.has(rt.key))
      if (!free) return
      rental_type = free.key
    }
    await save({
      id: null, booking_id: p.booking_id, participant_id: p.id, kind, instructor_id: null, planned_hours: null,
      prepaid_hours: null, rental_type, estimated_days: null, window_start: null, window_end: null, notes: null,
    }, {})
  }
  const toggleStay = (id: string) => setOpenStays(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const horizons: { key: Horizon; label: string }[] = [
    { key: '1w', label: t.outlook_h_1w[lang] }, { key: '2w', label: t.outlook_h_2w[lang] },
    { key: '1m', label: t.outlook_h_1m[lang] }, { key: 'season', label: t.outlook_h_season[lang] },
  ]
  const lessonsOf = (h: number) => fmt(h / TYPICAL_LESSON_H)
  const selContribs = sel ? contributions.filter(c => c.instrKey === sel.key && c.bucket === sel.b) : []
  const selRows = [...new Set(selContribs.map(c => c.row))]
  const selShare = (row: IntentRowData) => selContribs.filter(c => c.row === row).reduce((s, c) => s + c.share, 0)
  const selBucket = sel ? buckets[sel.b] : null

  const cellTone = (c: Cell | undefined, days: number) => {
    const h = c ? c.kite + c.wing : 0
    if (h < 0.04) return ''
    if (h / days > OVERLOAD_H_PER_DAY) return 'bg-red-100 dark:bg-red-950/50'
    if (h / days > OVERLOAD_H_PER_DAY * 0.6) return 'bg-amber-100 dark:bg-amber-950/40'
    return 'bg-blue-50 dark:bg-blue-950/30'
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {horizons.map(h => (
          <button key={h.key} onClick={() => pickHorizon(h.key)}
            className={`px-3 py-1.5 rounded text-sm font-medium ${horizon === h.key
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
            {h.label}
          </button>
        ))}
        <span className="text-xs text-gray-500 dark:text-gray-400">{fmtDateShort(start)} → {fmtDateShort(end)}</span>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400" title={t.outlook_default_tip[lang]}>
          {t.outlook_default_instr[lang]}
          <select value={defaultId} onChange={e => pickDefault(e.target.value)}
            className="border rounded px-1.5 py-1 text-xs bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-800 dark:text-gray-200">
            <option value="">{t.outlook_none[lang]}</option>
            {instructors.map(i => <option key={i.id} value={i.id}>{i.first_name}</option>)}
          </select>
        </label>
      </div>

      {/* Load grid: instructors × days */}
      <div className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-lg overflow-x-auto md:overflow-visible">
        <div className="px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300">{t.outlook_grid_title[lang]}</div>
        <table className="w-full table-fixed text-xs min-w-[640px] md:min-w-0">
          <thead>
            <tr className="text-gray-500 dark:text-gray-400">
              <th className="w-24 text-left font-medium px-3 py-1"></th>
              {buckets.map(bk => (
                <th key={bk.from} className="font-medium px-1 py-1 text-center capitalize">{bk.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gridRows.map((key, ri) => (
              <tr key={key} className="border-t dark:border-gray-800">
                <td className="px-3 py-1.5 font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">
                  <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${key === 'none' ? 'bg-red-500' : INSTR_DOT[ri % INSTR_DOT.length]}`} />
                  {instrName(key)}
                  {key === defaultId && <span className="block text-[10px] font-normal text-gray-400">{t.outlook_default_suffix[lang]}</span>}
                </td>
                {buckets.map((bk, idx) => {
                  const c = cells.get(`${key}|${idx}`)
                  const h = c ? c.kite + c.wing : 0
                  const isSel = sel?.key === key && sel.b === idx
                  return (
                    <td key={bk.from} className={`p-0.5 text-center align-top ${cellTone(c, bk.days)}`}>
                      {c && h > 0.04 ? (
                        <button onClick={() => setSel(isSel ? null : { key, b: idx })}
                          title={h / bk.days > OVERLOAD_H_PER_DAY ? t.outlook_overload_tip[lang] : undefined}
                          className={`w-full rounded px-0.5 py-1 hover:ring-2 hover:ring-blue-400 ${isSel ? 'ring-2 ring-blue-600' : ''}`}>
                          <div className="font-bold text-gray-900 dark:text-gray-100">{fmt(h)} {t.outlook_hours_short[lang]}{c.defaulted > 0.04 && <span className="text-amber-600"> ⚠</span>}</div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                            👥{c.students.size} · ≈{lessonsOf(h)}
                          </div>
                          <div className="mt-0.5 mx-1 h-1 rounded overflow-hidden flex bg-gray-200 dark:bg-gray-700">
                            <span className="bg-blue-500" style={{ width: `${(c.kite / h) * 100}%` }} />
                            <span className="bg-teal-500" style={{ width: `${(c.wing / h) * 100}%` }} />
                          </div>
                        </button>
                      ) : <span className="text-gray-300 dark:text-gray-600">·</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr className="border-t-2 dark:border-gray-700 font-semibold text-gray-800 dark:text-gray-200">
              <td className="px-3 py-1.5">{t.outlook_total[lang]}</td>
              {totals.map((c, idx) => {
                const h = c.kite + c.wing
                return (
                  <td key={idx} className="px-0.5 py-1.5 text-center">
                    {h > 0.04 ? (<>
                      <div>{fmt(h)} {t.outlook_hours_short[lang]}</div>
                      <div className="text-[10px] font-normal text-gray-500 dark:text-gray-400">👥{c.students.size} · ≈{lessonsOf(h)}</div>
                    </>) : <span className="text-gray-300 dark:text-gray-600">·</span>}
                  </td>
                )
              })}
            </tr>
            {rentals.map(([type, arr]) => (
              <tr key={type} className="border-t dark:border-gray-800">
                <td className="px-3 py-1 whitespace-nowrap text-amber-700 dark:text-amber-300">
                  {KIND_ICON.rental} {RENTAL_TYPES.find(r => r.key === type)?.label ?? type}
                </td>
                {arr.map((n, i) => (
                  <td key={i} className="px-0.5 py-1 text-center text-amber-700 dark:text-amber-300">{n > 0.04 ? fmt(n) : ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-3 py-2 text-[11px] text-gray-400 dark:text-gray-500">{t.outlook_grid_note[lang]}</p>
      </div>

      {/* Detail of the selected cell: who, what, editable in place */}
      {sel && selBucket && (
        <div className="bg-white dark:bg-gray-900 border-2 border-blue-500 rounded-lg">
          <div className="flex items-center justify-between px-3 py-2 border-b dark:border-gray-800">
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              {instrName(sel.key)} · {selBucket.from === selBucket.to ? fmtDateShort(selBucket.from) : `${fmtDateShort(selBucket.from)} → ${fmtDateShort(selBucket.to)}`}
            </span>
            <button onClick={() => setSel(null)} className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">{t.outlook_detail_close[lang]} ✕</button>
          </div>
          <div className="divide-y dark:divide-gray-800">
            {selRows.map(r => {
              const p = partById.get(r.participant_id)
              const b = bookingById.get(r.booking_id)
              return (
                <div key={r.id ?? r.participant_id} className="px-3 py-2">
                  <div className="flex flex-wrap items-baseline gap-x-2 mb-1">
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{p ? `${p.first_name} ${p.last_name ?? ''}`.trim() : '—'}</span>
                    {b && <span className="text-xs text-gray-500 dark:text-gray-400">#{String(b.booking_number).padStart(3, '0')} · {clientName(b.client_id)}</span>}
                    <span className="text-xs text-gray-600 dark:text-gray-300 ml-auto">{fmt(selShare(r))} {t.outlook_hours_short[lang]}</span>
                  </div>
                  <IntentRow row={r} instructors={instructors} defaultName={defaultName}
                    done={doneHours.get(`${r.participant_id}|${r.kind}`) ?? 0}
                    suggested={suggestedPrepaid.get(r.participant_id) ?? 0}
                    onSave={patch => save(r, patch)} onRemove={() => remove(r)} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Stays: one compact line each, click to edit its rows */}
      <div className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-lg">
        <div className="px-3 py-2 flex flex-wrap items-baseline gap-x-3">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t.outlook_stays[lang]}</span>
          <span className="text-[11px] text-gray-400 dark:text-gray-500">{t.outlook_edit_hint[lang]}</span>
        </div>
        {shown.length === 0 && <p className="px-3 pb-3 text-gray-400 dark:text-gray-400">{t.outlook_no_bookings[lang]}</p>}
        <div className="divide-y dark:divide-gray-800 border-t dark:border-gray-800">
          {shown.map(b => {
            const marker = agencyMarker({ booking_id: b.id }, { agencies, bookings, agencyBillingLines })
            const guests = participantsOf(b.id)
            const lessonRows = guests.flatMap(p => (rowsByParticipant.get(p.id) ?? []).filter(r => r.kind !== 'rental'))
            const sum = (k: 'kite' | 'wing') => lessonRows.filter(r => r.kind === k).reduce((s, r) => s + (r.planned_hours ?? 0), 0)
            const prepaid = lessonRows.reduce((s, r) => s + (r.prepaid_hours ?? 0), 0)
            const done = lessonRows.reduce((s, r) => s + (doneHours.get(`${r.participant_id}|${r.kind}`) ?? 0), 0)
            const noInstr = lessonRows.some(r => r.id && !r.instructor_id && (r.planned_hours ?? 0) > 0)
            const open = openStays.has(b.id)
            return (
              <div key={b.id}>
                <button onClick={() => toggleStay(b.id)}
                  className="w-full text-left px-3 py-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 hover:bg-gray-50 dark:hover:bg-gray-800/60">
                  <span className="text-gray-400 text-xs w-3">{open ? '▾' : '▸'}</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    #{String(b.booking_number).padStart(3, '0')} {marker ? `${marker} ` : ''}{clientName(b.client_id)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{fmtDateShort(b.check_in)} → {fmtDateShort(b.check_out)} · {guests.length} {t.outlook_guests[lang]}</span>
                  <span className="ml-auto flex flex-wrap items-center gap-1.5 text-xs">
                    {sum('kite') > 0 && <span className={`rounded px-1.5 py-0.5 ${KIND_STYLE.kite}`}>{KIND_ICON.kite} {fmt(sum('kite'))} {t.outlook_hours_short[lang]}</span>}
                    {sum('wing') > 0 && <span className={`rounded px-1.5 py-0.5 ${KIND_STYLE.wing}`}>{KIND_ICON.wing} {fmt(sum('wing'))} {t.outlook_hours_short[lang]}</span>}
                    {prepaid > 0 && <span className="text-purple-700 dark:text-purple-300">{t.outlook_prepaid[lang]} {fmt(prepaid)} · {t.outlook_left[lang]} {fmt(prepaid - done)} {t.outlook_hours_short[lang]}</span>}
                    {noInstr && defaultId === '' && <span className="text-red-600 dark:text-red-400 font-medium">⚠ {t.outlook_none[lang]}</span>}
                  </span>
                </button>
                {open && (
                  <div className="divide-y dark:divide-gray-800 bg-gray-50/50 dark:bg-gray-950/30">
                    {guests.map(p => (
                      <ParticipantBlock key={p.id}
                        p={p}
                        rows={rowsByParticipant.get(p.id) ?? []}
                        instructors={instructors}
                        defaultName={defaultName}
                        doneHours={doneHours}
                        suggested={suggestedPrepaid.get(p.id) ?? 0}
                        onSave={save} onRemove={remove} onAdd={kind => add(p, kind)} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── One traveller: their intent rows + an "add" menu ─────────────────────────────
function ParticipantBlock({ p, rows, instructors, defaultName, doneHours, suggested, onSave, onRemove, onAdd }: {
  p: BookingParticipant
  rows: IntentRowData[]
  instructors: Instructor[]
  defaultName: string
  doneHours: Map<string, number>
  suggested: number
  onSave: (row: IntentRowData, patch: Partial<IntentRowData>) => void
  onRemove: (row: IntentRowData) => void
  onAdd: (kind: IntentKind) => void
}) {
  const { lang } = useLanguage()
  const t = i18n.planning
  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-3 mb-1">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{p.first_name} {p.last_name ?? ''}</span>
        <select value="" onChange={e => { if (e.target.value) onAdd(e.target.value as IntentKind) }}
          className="text-xs border rounded px-1 py-0.5 bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-500 dark:text-gray-400">
          <option value="">{t.outlook_add[lang]}</option>
          <option value="kite">{t.outlook_kind_kite[lang]}</option>
          <option value="wing">{t.outlook_kind_wing[lang]}</option>
          <option value="rental">{t.outlook_kind_rental[lang]}</option>
        </select>
      </div>
      <div className="space-y-1">
        {rows.map(r => (
          <IntentRow key={r.id ?? `${r.participant_id}|${r.kind}|${r.rental_type}`}
            row={r} instructors={instructors} defaultName={defaultName}
            done={doneHours.get(`${r.participant_id}|${r.kind}`) ?? 0}
            suggested={suggested}
            onSave={patch => onSave(r, patch)} onRemove={() => onRemove(r)} />
        ))}
        {rows.length === 0 && <span className="text-xs text-gray-400 dark:text-gray-500">—</span>}
      </div>
    </div>
  )
}

const inputCls = 'border rounded px-1.5 py-0.5 text-xs bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-800 dark:text-gray-200'

// Text inputs commit on blur (one write per edit, not per keystroke); selects/dates on change.
function IntentRow({ row, instructors, defaultName, done, suggested, onSave, onRemove }: {
  row: IntentRowData
  instructors: Instructor[]
  defaultName: string
  done: number
  suggested: number
  onSave: (patch: Partial<IntentRowData>) => void
  onRemove: () => void
}) {
  const { lang } = useLanguage()
  const t = i18n.planning
  const isRental = row.kind === 'rental'
  const num = (v: string) => (v.trim() === '' ? null : Math.max(0, Number(v)))
  const prepaidLeft = row.prepaid_hours != null ? row.prepaid_hours - done : null

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded px-1.5 py-1 ${row.id ? '' : 'opacity-80 border border-dashed border-gray-300 dark:border-gray-700'}`}
      title={row.id ? undefined : t.outlook_not_saved[lang]}>
      <span className={`text-xs font-medium rounded px-1.5 py-0.5 ${KIND_STYLE[row.kind]}`}>
        {KIND_ICON[row.kind]} {t[`outlook_kind_${row.kind}` as 'outlook_kind_kite'][lang]}
      </span>

      {isRental ? (
        <>
          <select value={row.rental_type ?? 'kite'} className={inputCls}
            onChange={e => onSave({ rental_type: e.target.value as RentalType | 'free' })}
            aria-label={t.outlook_rental_type[lang]}>
            {RENTAL_TYPES.map(rt => <option key={rt.key} value={rt.key}>{rt.icon} {rt.label}</option>)}
          </select>
          <label className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            {t.outlook_est_days[lang]}
            <input type="number" min={0} step={1} defaultValue={row.estimated_days ?? ''} className={`${inputCls} w-14`}
              onBlur={e => { const v = num(e.target.value); if (v !== row.estimated_days) onSave({ estimated_days: v }) }} />
          </label>
        </>
      ) : (
        <>
          <select value={row.instructor_id ?? ''} className={inputCls}
            onChange={e => onSave({ instructor_id: e.target.value || null })}
            aria-label={t.outlook_instructor[lang]}>
            <option value="">{defaultName} ({t.outlook_default_suffix[lang]})</option>
            {instructors.map(i => <option key={i.id} value={i.id}>{i.first_name}</option>)}
          </select>
          <label className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            {t.outlook_planned[lang]}
            <input type="number" min={0} step={0.5} defaultValue={row.planned_hours ?? ''} className={`${inputCls} w-14`}
              onBlur={e => { const v = num(e.target.value); if (v !== row.planned_hours) onSave({ planned_hours: v }) }} />
            {t.outlook_hours_short[lang]}
          </label>
          <label className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            {t.outlook_prepaid[lang]}
            <input type="number" min={0} step={0.5} defaultValue={row.prepaid_hours ?? ''}
              placeholder={t.outlook_prepaid_unset[lang]} className={`${inputCls} w-32`}
              // key forces the uncontrolled input to follow a value saved from the suggestion chip
              key={`pp-${row.prepaid_hours ?? 'x'}`}
              onBlur={e => { const v = num(e.target.value); if (v !== row.prepaid_hours) onSave({ prepaid_hours: v }) }} />
            {t.outlook_hours_short[lang]}
          </label>
          {row.prepaid_hours == null && suggested > 0 && (
            <button type="button" title={t.outlook_suggested_tip[lang]} onClick={() => onSave({ prepaid_hours: suggested })}
              className="text-xs rounded border border-dashed border-purple-400 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 hover:bg-purple-50 dark:hover:bg-purple-950/30">
              {t.outlook_suggested[lang]}: {fmt(suggested)} {t.outlook_hours_short[lang]}
            </button>
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t.outlook_done[lang]} {fmt(done)} {t.outlook_hours_short[lang]}
            {prepaidLeft != null && (
              <> · <span className={prepaidLeft > 0 ? 'text-purple-700 dark:text-purple-300 font-medium' : ''}>
                {t.outlook_left[lang]} {fmt(prepaidLeft)} {t.outlook_hours_short[lang]}</span></>
            )}
          </span>
        </>
      )}

      <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1" title={t.outlook_window_tip[lang]}>
        {t.outlook_window[lang]}
        <input type="date" value={row.window_start ?? ''} className={inputCls}
          onChange={e => onSave({ window_start: e.target.value || null })} />
        →
        <input type="date" value={row.window_end ?? ''} className={inputCls}
          onChange={e => onSave({ window_end: e.target.value || null })} />
      </span>
      <input type="text" defaultValue={row.notes ?? ''} placeholder={t.outlook_notes[lang]} className={`${inputCls} w-40`}
        onBlur={e => { const v = e.target.value.trim() || null; if (v !== row.notes) onSave({ notes: v }) }} />
      {row.id && (
        <button type="button" onClick={onRemove} aria-label="Remove"
          className="text-xs text-gray-400 hover:text-red-600 dark:hover:text-red-400">✕</button>
      )}
    </div>
  )
}
