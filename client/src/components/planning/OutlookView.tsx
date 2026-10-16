import { useMemo, useState } from 'react'
import type {
  Agency, AgencyBillingLine, Booking, BookingParticipant, Client, Instructor,
  IntentKind, Lesson, LessonIntent, RentalType,
} from '../../types/database'
import { lessonDiscipline } from '../../types/database'
import { addDaysISO, daysBetween, fmtDateShort, todayISO } from '../../utils/dates'
import { stayBookings } from '../../utils/dayVisitor'
import { agencyMarker } from '../accounting/utils'
import { useLanguage } from '../../contexts/LanguageContext'
import { useTable } from '../../hooks/useSupabase'
import { supabase } from '../../lib/supabase'
import { i18n } from '../../data/i18n'
import { RENTAL_TYPES } from './rentalTypes'

// Outlook = long-term INTENTIONS per traveller ("~6 h of wing with Leo, 20th→25th"), read from
// the upcoming bookings. Not accounting: nothing here is billed, paid or counted by payroll.
// Forecast stays the hour-by-hour plan for tomorrow; this is the "who needs what, and do we
// have the people" view weeks ahead. Rows are created on first edit; until then they are
// derived from the traveller's checkboxes (wants_kite_lessons / wants_wing_lessons /
// wants_kite_rental) — no trigger, so nothing can ever block a booking_participants insert.

type Horizon = '1w' | '2w' | '1m' | 'season'
const HORIZON_KEY = 'outlook_horizon'
const MAX_SEASON_DAYS = 240

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

const fmt = (n: number) => String(Math.round(n * 10) / 10)

const KIND_STYLE: Record<IntentKind, string> = {
  kite:   'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  wing:   'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300',
  rental: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
}
const KIND_ICON: Record<IntentKind, string> = { kite: '🪁', wing: '🪽', rental: '🎒' }

function readHorizon(): Horizon {
  try {
    const v = localStorage.getItem(HORIZON_KEY)
    if (v === '1w' || v === '2w' || v === '1m' || v === 'season') return v
  } catch { /* storage can be unavailable */ }
  return '2w'
}

export default function OutlookView({
  bookings, bookingParticipants, instructors, lessons, clients, agencies, agencyBillingLines,
}: Props) {
  const { lang } = useLanguage()
  const t = i18n.planning
  const { data: intents, refresh } = useTable<LessonIntent>('lesson_intents')
  const [horizon, setHorizon] = useState<Horizon>(readHorizon)

  function pickHorizon(h: Horizon) {
    setHorizon(h)
    try { localStorage.setItem(HORIZON_KEY, h) } catch { /* ignore */ }
  }

  const start = todayISO()

  const upcoming = useMemo(
    () => stayBookings(bookings).filter(b => b.status !== 'cancelled' && b.check_out >= start),
    [bookings, start],
  )

  const end = useMemo(() => {
    if (horizon === '1w') return addDaysISO(start, 6)
    if (horizon === '2w') return addDaysISO(start, 13)
    if (horizon === '1m') return addDaysISO(start, 30)
    const last = upcoming.reduce((m, b) => (b.check_out > m ? b.check_out : m), start)
    const cap = addDaysISO(start, MAX_SEASON_DAYS)
    return last > cap ? cap : last
  }, [horizon, start, upcoming])

  const shown = useMemo(
    () => upcoming.filter(b => b.check_in <= end).sort((a, b) => a.check_in.localeCompare(b.check_in)),
    [upcoming, end],
  )

  // ── Buckets (a day each, or a week each over a whole season) ─────────────────
  const buckets = useMemo(() => {
    const step = horizon === 'season' ? 7 : 1
    const out: { from: string; to: string }[] = []
    for (let d = start; d <= end; d = addDaysISO(d, step)) {
      const to = addDaysISO(d, step - 1)
      out.push({ from: d, to: to > end ? end : to })
    }
    return out
  }, [horizon, start, end])

  const bookingById = useMemo(() => new Map(bookings.map(b => [b.id, b])), [bookings])
  const clientName = (id: string) => {
    const c = clients.find(x => x.id === id)
    return c ? `${c.first_name} ${c.last_name}`.trim() : '—'
  }
  const participantsOf = (bookingId: string) => bookingParticipants.filter(p => p.booking_id === bookingId)

  // ── Rows: stored + derived from the checkboxes ───────────────────────────────
  const rowsByParticipant = useMemo(() => {
    const m = new Map<string, IntentRowData[]>()
    const push = (r: IntentRowData) => { const a = m.get(r.participant_id); if (a) a.push(r); else m.set(r.participant_id, [r]) }
    for (const i of intents) push({ ...i })
    for (const p of bookingParticipants) {
      const mine = m.get(p.id) ?? []
      const blank = { id: null, booking_id: p.booking_id, participant_id: p.id, instructor_id: null, planned_hours: null,
        prepaid_hours: null, estimated_days: null, window_start: null, window_end: null, notes: null }
      if (p.wants_kite_lessons && !mine.some(r => r.kind === 'kite'))
        push({ ...blank, kind: 'kite', rental_type: null })
      if (p.wants_wing_lessons && !mine.some(r => r.kind === 'wing'))
        push({ ...blank, kind: 'wing', rental_type: null })
      if (p.wants_kite_rental && !mine.some(r => r.kind === 'rental'))
        push({ ...blank, kind: 'rental', rental_type: 'kite' })
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

  // Agency package hours frozen on the billing line — only ever a SUGGESTION, never saved
  // without a click: the discipline isn't on the line and a label is not a source of hours.
  const suggestedPrepaid = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of agencyBillingLines) {
      if (l.participant_id && l.unit_hours) m.set(l.participant_id, (m.get(l.participant_id) ?? 0) + l.unit_hours)
    }
    return m
  }, [agencyBillingLines])

  // ── Load strip ───────────────────────────────────────────────────────────────
  const load = useMemo(() => {
    const kite = buckets.map(() => 0)
    const wing = buckets.map(() => 0)
    const unassigned = buckets.map(() => 0)
    const rentals = new Map<string, number[]>()
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
          if (r.kind === 'kite') kite[idx] += share
          else if (r.kind === 'wing') wing[idx] += share
          else {
            const key = r.rental_type ?? 'kite'
            const arr = rentals.get(key) ?? buckets.map(() => 0)
            arr[idx] += share
            rentals.set(key, arr)
          }
          if (r.kind !== 'rental' && !r.instructor_id) unassigned[idx] += share
        })
      }
    }
    return { kite, wing, unassigned, rentals }
  }, [buckets, rowsByParticipant, bookingById])

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

  const horizons: { key: Horizon; label: string }[] = [
    { key: '1w', label: t.outlook_h_1w[lang] }, { key: '2w', label: t.outlook_h_2w[lang] },
    { key: '1m', label: t.outlook_h_1m[lang] }, { key: 'season', label: t.outlook_h_season[lang] },
  ]
  const bucketLabel = (bk: { from: string; to: string }) =>
    bk.from === bk.to ? fmtDateShort(bk.from) : `${fmtDateShort(bk.from)}–${fmtDateShort(bk.to)}`
  const cell = (n: number) => (n > 0.04 ? fmt(n) : '')
  const rentalRows = [...load.rentals.entries()]

  return (
    <div>
      {/* Horizon */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {horizons.map(h => (
          <button key={h.key} onClick={() => pickHorizon(h.key)}
            className={`px-3 py-1.5 rounded text-sm font-medium ${horizon === h.key
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
            {h.label}
          </button>
        ))}
        <span className="text-xs text-gray-500 dark:text-gray-400">{fmtDateShort(start)} → {fmtDateShort(end)}</span>
      </div>

      {/* Load strip */}
      <div className="mb-6 bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-lg overflow-x-auto">
        <div className="px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300">{t.outlook_load[lang]}</div>
        <table className="text-xs w-full">
          <thead>
            <tr className="text-gray-500 dark:text-gray-400">
              <th className="text-left font-medium px-3 py-1 sticky left-0 bg-white dark:bg-gray-900"></th>
              {buckets.map(bk => <th key={bk.from} className="font-medium px-2 py-1 whitespace-nowrap">{bucketLabel(bk)}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-3 py-1 sticky left-0 bg-white dark:bg-gray-900 whitespace-nowrap">{KIND_ICON.kite} {t.outlook_kite_h[lang]}</td>
              {load.kite.map((n, i) => <td key={i} className="text-center px-2 py-1 text-blue-700 dark:text-blue-300">{cell(n)}</td>)}
            </tr>
            <tr>
              <td className="px-3 py-1 sticky left-0 bg-white dark:bg-gray-900 whitespace-nowrap">{KIND_ICON.wing} {t.outlook_wing_h[lang]}</td>
              {load.wing.map((n, i) => <td key={i} className="text-center px-2 py-1 text-teal-700 dark:text-teal-300">{cell(n)}</td>)}
            </tr>
            <tr>
              <td className="px-3 py-1 sticky left-0 bg-white dark:bg-gray-900 whitespace-nowrap text-red-600 dark:text-red-400">⚠ {t.outlook_unassigned_h[lang]}</td>
              {load.unassigned.map((n, i) => <td key={i} className="text-center px-2 py-1 text-red-600 dark:text-red-400 font-medium">{cell(n)}</td>)}
            </tr>
            {rentalRows.map(([type, arr]) => (
              <tr key={type}>
                <td className="px-3 py-1 sticky left-0 bg-white dark:bg-gray-900 whitespace-nowrap">
                  {KIND_ICON.rental} {t.outlook_rentals[lang]} · {RENTAL_TYPES.find(r => r.key === type)?.label ?? type}
                </td>
                {arr.map((n, i) => <td key={i} className="text-center px-2 py-1 text-amber-700 dark:text-amber-300">{cell(n)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-3 py-2 text-[11px] text-gray-400 dark:text-gray-500">{t.outlook_load_note[lang]}</p>
      </div>

      {/* Bookings */}
      {shown.length === 0 && (
        <p className="text-gray-400 dark:text-gray-400">{t.outlook_no_bookings[lang]}</p>
      )}
      <div className="space-y-4">
        {shown.map(b => {
          const marker = agencyMarker({ booking_id: b.id }, { agencies, bookings, agencyBillingLines })
          return (
            <div key={b.id} className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-lg">
              <div className="flex flex-wrap items-baseline gap-x-3 px-3 py-2 border-b dark:border-gray-800">
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  #{String(b.booking_number).padStart(3, '0')} {marker ? `${marker} ` : ''}{clientName(b.client_id)}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{fmtDateShort(b.check_in)} → {fmtDateShort(b.check_out)}</span>
              </div>
              <div className="divide-y dark:divide-gray-800">
                {participantsOf(b.id).map(p => (
                  <ParticipantBlock key={p.id}
                    p={p}
                    rows={rowsByParticipant.get(p.id) ?? []}
                    instructors={instructors}
                    doneHours={doneHours}
                    suggested={suggestedPrepaid.get(p.id) ?? 0}
                    onSave={save} onRemove={remove} onAdd={kind => add(p, kind)} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── One traveller: their intent rows + an "add" menu ─────────────────────────────
function ParticipantBlock({ p, rows, instructors, doneHours, suggested, onSave, onRemove, onAdd }: {
  p: BookingParticipant
  rows: IntentRowData[]
  instructors: Instructor[]
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
            row={r} instructors={instructors}
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
function IntentRow({ row, instructors, done, suggested, onSave, onRemove }: {
  row: IntentRowData
  instructors: Instructor[]
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
            <option value="">{t.outlook_unassigned[lang]}</option>
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
