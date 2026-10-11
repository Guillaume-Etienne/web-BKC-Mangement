import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Instructor, Lesson, LessonType } from '../types/database'
import { usePref, Segmented } from './taxiShareUI'
import { todayISO, fromISODate } from '../utils/dates'
import { legacySeasonYear } from '../utils/seasonWindow'

interface Props { instructorId: string }

// What anon is actually served (column-level GRANT — see security-rls.md). The
// pay columns (`instructor_rate`, client price) are revoked for anon, so this
// page can only ever count hours: leaving them out of the type keeps a future
// edit from reaching for them.
type HourLesson = Pick<Lesson, 'id' | 'date' | 'start_time' | 'duration_hours' | 'type' | 'participant_ids'>

// Students: anon only gets identity (id, first/last name) from booking_participants,
// and only those of THIS instructor's lessons (policy 2026-10-11).
type Student = { id: string; first_name: string; last_name: string }

type DayLesson = { id: string; type: LessonType; hours: number; names: string[]; start: string; end: string }

/** "09:00:00" + 1.5 → "10:30" */
function addHours(time: string, h: number): string {
  const [hh, mm] = time.split(':').map(Number)
  const total = Math.round(hh * 60 + mm + h * 60)
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

type Lang = 'en' | 'fr' | 'pt'
type Mode = 'month' | 'season'

const LANGS: { code: Lang; flag: string }[] = [
  { code: 'en', flag: '🇬🇧' },
  { code: 'fr', flag: '🇫🇷' },
  { code: 'pt', flag: '🇲🇿' },
]

// Local dictionary: this page is the only reader. Three columns of the same
// shape as the taxi pages (`tr.key[lang]`).
const tr = {
  title:        { en: 'My hours',            fr: 'Mes heures',           pt: 'As minhas horas' },
  loading:      { en: 'Loading…',            fr: 'Chargement…',          pt: 'A carregar…' },
  not_found:    { en: 'Instructor not found.', fr: 'Moniteur introuvable.', pt: 'Instrutor não encontrado.' },
  month:        { en: 'Month',               fr: 'Mois',                 pt: 'Mês' },
  season:       { en: 'Season',              fr: 'Saison',               pt: 'Época' },
  today:        { en: 'This month',          fr: 'Ce mois-ci',           pt: 'Este mês' },
  total:        { en: 'Total',               fr: 'Total',                pt: 'Total' },
  private:      { en: 'Private',             fr: 'Privé',                pt: 'Privado' },
  group:        { en: 'Group',               fr: 'Groupe',               pt: 'Grupo' },
  supervision:  { en: 'Supervision',         fr: 'Supervision',          pt: 'Supervisão' },
  by_day:       { en: 'Day by day',          fr: 'Jour par jour',        pt: 'Dia a dia' },
  by_month:     { en: 'Month by month',      fr: 'Mois par mois',        pt: 'Mês a mês' },
  students:     { en: 'Students',            fr: 'Élèves',               pt: 'Alunos' },
  col_date:     { en: 'Date',                fr: 'Date',                 pt: 'Data' },
  col_month:    { en: 'Month',               fr: 'Mois',                 pt: 'Mês' },
  no_hours:     { en: 'No hours for this period.', fr: 'Aucune heure sur cette période.', pt: 'Sem horas neste período.' },
  hours_unit:   { en: 'h',                   fr: 'h',                    pt: 'h' },
  lessons:      { en: 'lessons',             fr: 'cours',                pt: 'aulas' },
  footer:       { en: 'Updated',             fr: 'Mis à jour',           pt: 'Atualizado' },
} as const

const LOCALE: Record<Lang, string> = { en: 'en-GB', fr: 'fr-FR', pt: 'pt-PT' }

const TYPES: LessonType[] = ['private', 'group', 'supervision']

type Hours = Record<LessonType, number>
const emptyHours = (): Hours => ({ private: 0, group: 0, supervision: 0 })

/** 1.5 → "1.5", 2 → "2", 0.333 → "0.33": no trailing zeros, no float noise. */
const fmtH = (n: number) => `${Number(n.toFixed(2))}`

/** "2026-10" ← "2026-10-09" */
const monthOf = (iso: string) => iso.slice(0, 7)

/** Season N = 1 Sep N → 31 Aug N+1. The `seasons` table is admin-only (not
 *  readable with a share token), so the season is derived from the calendar,
 *  with the same rule the planning falls back on. */
const seasonStart = (year: number) => `${year}-09-01`
const seasonEnd   = (year: number) => `${year + 1}-08-31`
const seasonOfDate = (iso: string) => {
  const y = Number(iso.slice(0, 4))
  return Number(iso.slice(5, 7)) >= 9 ? y : y - 1
}
const seasonLabel = (year: number) => `${year}/${String(year + 1).slice(2)}`

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthName(key: string, lang: Lang): string {
  return fromISODate(`${key}-01`).toLocaleDateString(LOCALE[lang], { month: 'long', year: 'numeric' })
}

function dayLabel(iso: string, lang: Lang): string {
  return fromISODate(iso).toLocaleDateString(LOCALE[lang], { weekday: 'short', day: '2-digit', month: '2-digit' })
}

export default function InstructorSharePage({ instructorId }: Props) {
  const [instructor, setInstructor] = useState<Pick<Instructor, 'id' | 'first_name' | 'last_name'> | null>(null)
  const [lessons,    setLessons]    = useState<HourLesson[]>([])
  const [students,   setStudents]   = useState<Map<string, Student>>(new Map())
  const [loading,    setLoading]    = useState(true)

  const [lang, setLang] = usePref<Lang>('instructor_share_lang', 'en')
  const [mode, setMode] = useState<Mode>('month')

  const today = todayISO()
  const [month,  setMonth]  = useState(monthOf(today))
  const [season, setSeason] = useState(legacySeasonYear(new Date()))

  useEffect(() => {
    async function load() {
      const [instrRes, lessonsRes] = await Promise.all([
        // Identity only — rate_* is payroll and is not granted to anon.
        supabase.from('instructors').select('id, first_name, last_name').eq('id', instructorId).single(),
        // Column-restricted for anon (see security-rls.md). RLS already narrows
        // this to the token's instructor; the filter is for the reader, not the guard.
        supabase
          .from('lessons')
          .select('id, date, start_time, duration_hours, type, participant_ids')
          .eq('instructor_id', instructorId)
          .order('date', { ascending: true }),
      ])
      setInstructor((instrRes.data ?? null) as typeof instructor)
      setLessons((lessonsRes.data ?? []) as HourLesson[])
      // Names are a bonus: if this read fails (policy not applied yet), the hours still show.
      const { data: guests } = await supabase.from('booking_participants').select('id, first_name, last_name')
      setStudents(new Map(((guests ?? []) as Student[]).map(g => [g.id, g])))
      setLoading(false)
    }
    load()
  }, [instructorId])

  // Seasons the instructor has hours in, plus the current one, newest first.
  const seasonOptions = useMemo(() => {
    const years = new Set<number>([legacySeasonYear(new Date())])
    for (const l of lessons) years.add(seasonOfDate(l.date))
    return [...years].sort((a, b) => b - a)
  }, [lessons])

  // Lessons inside the chosen period.
  const inPeriod = useMemo(() => {
    if (mode === 'month') return lessons.filter(l => monthOf(l.date) === month)
    return lessons.filter(l => l.date >= seasonStart(season) && l.date <= seasonEnd(season))
  }, [lessons, mode, month, season])

  // Hours per day, in date order.
  const days = useMemo(() => {
    const m = new Map<string, { hours: Hours; items: DayLesson[] }>()
    for (const l of inPeriod) {
      const d = m.get(l.date) ?? { hours: emptyHours(), items: [] }
      d.hours[l.type] += l.duration_hours
      const names = (l.participant_ids ?? [])
        .map(pid => students.get(pid))
        .filter((g): g is Student => !!g)
        .map(g => `${g.first_name} ${g.last_name}`.trim())
      d.items.push({
        id: l.id, type: l.type, hours: l.duration_hours, names,
        start: l.start_time.slice(0, 5), end: addHours(l.start_time, l.duration_hours),
      })
      m.set(l.date, d)
    }
    for (const d of m.values()) d.items.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [inPeriod, students])

  // Hours per month (season view).
  const months = useMemo(() => {
    const m = new Map<string, Hours>()
    for (const l of inPeriod) {
      const h = m.get(monthOf(l.date)) ?? emptyHours()
      h[l.type] += l.duration_hours
      m.set(monthOf(l.date), h)
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [inPeriod])

  const counts = useMemo(() => {
    const c = emptyHours()
    for (const l of inPeriod) c[l.type]++
    return c
  }, [inPeriod])

  const totals = useMemo(() => {
    const t = emptyHours()
    for (const l of inPeriod) t[l.type] += l.duration_hours
    return t
  }, [inPeriod])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 dark:text-gray-400">{tr.loading[lang]}</p>
      </div>
    )
  }

  if (!instructor) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">{tr.not_found[lang]}</p>
      </div>
    )
  }

  const typeCard: Record<LessonType, string> = {
    private:     'border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300',
    group:       'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300',
    supervision: 'border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-300',
  }

  const periodTitle = mode === 'month' ? monthName(month, lang) : `${tr.season[lang]} ${seasonLabel(season)}`

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl text-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-blue-200 dark:text-blue-300 text-sm font-medium uppercase tracking-wide mb-1">{tr.title[lang]}</p>
              <h1 className="text-2xl md:text-3xl font-bold">{instructor.first_name} {instructor.last_name}</h1>
            </div>
            <Segmented value={lang} onChange={setLang}
              options={LANGS.map(l => ({ v: l.code, label: `${l.flag} ${l.code.toUpperCase()}` }))} />
          </div>
          <div className="mt-4">
            <Segmented value={mode} onChange={setMode}
              options={[{ v: 'month', label: `📅 ${tr.month[lang]}` }, { v: 'season', label: `🌊 ${tr.season[lang]}` }]} />
          </div>
        </div>

        {/* Period picker */}
        {mode === 'month' ? (
          <div className="flex items-center justify-between gap-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-3 py-2">
            <button onClick={() => setMonth(m => shiftMonth(m, -1))} aria-label="Previous month"
              className="px-3 py-2 rounded-lg text-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">◀</button>
            <div className="text-center">
              <div className="font-bold text-gray-900 dark:text-gray-100 capitalize">{monthName(month, lang)}</div>
              {month !== monthOf(today) && (
                <button onClick={() => setMonth(monthOf(today))}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline">{tr.today[lang]}</button>
              )}
            </div>
            <button onClick={() => setMonth(m => shiftMonth(m, 1))} aria-label="Next month"
              className="px-3 py-2 rounded-lg text-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">▶</button>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3">
            <select value={season} onChange={e => setSeason(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
              {seasonOptions.map(y => <option key={y} value={y}>{tr.season[lang]} {seasonLabel(y)}</option>)}
            </select>
          </div>
        )}

        {/* Totals */}
        <div className="space-y-3">
          {/* No grand total on purpose: private / group / supervision are paid at different rates. */}
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 capitalize">{periodTitle}</p>
          <div className="grid grid-cols-3 gap-3">
            {TYPES.map(t => (
              <div key={t} className={`rounded-xl border px-3 py-4 ${typeCard[t]}`}>
                <p className="text-xs font-medium uppercase tracking-wide opacity-80">{tr[t][lang]}</p>
                <p className="mt-1 text-2xl md:text-3xl font-bold">{fmtH(totals[t])} {tr.hours_unit[lang]}</p>
                <p className="text-xs opacity-80">{counts[t]} {tr.lessons[lang]}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Month by month (season only) */}
        {mode === 'season' && months.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50 dark:bg-gray-800">
              <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300">{tr.by_month[lang]}</h2>
            </div>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b text-xs text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2 text-left font-medium">{tr.col_month[lang]}</th>
                  {TYPES.map(t => <th key={t} className="px-2 py-2 text-right font-medium">{tr[t][lang]}</th>)}
                </tr>
              </thead>
              <tbody>
                {months.map(([key, h]) => (
                  <tr key={key} onClick={() => { setMonth(key); setMode('month') }}
                    className="border-b cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-3 py-2 font-medium capitalize text-gray-800 dark:text-gray-200">{monthName(key, lang)}</td>
                    {TYPES.map(t => (
                      <td key={t} className="px-2 py-2 text-right text-gray-600 dark:text-gray-400">{h[t] ? fmtH(h[t]) : '–'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}

        {/* Day by day */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b bg-blue-50 dark:bg-blue-950/40">
            <h2 className="text-sm font-bold text-blue-800 dark:text-blue-400">{tr.by_day[lang]}</h2>
          </div>
          {days.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-400 italic py-6 text-center">{tr.no_hours[lang]}</p>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {days.map(([date, d]) => (
                <div key={date} className={date === today ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}>
                  <div className="flex items-baseline justify-between px-4 pt-3 pb-1">
                    <span className="font-bold capitalize text-gray-900 dark:text-gray-100">{dayLabel(date, lang)}</span>
                    <span className="flex gap-2 text-xs font-bold">
                      {TYPES.filter(t => d.hours[t] > 0).map(t => (
                        <span key={t} className={`rounded-full border px-2 py-0.5 ${typeCard[t]}`}>
                          {tr[t][lang]} {fmtH(d.hours[t])} {tr.hours_unit[lang]}
                        </span>
                      ))}
                    </span>
                  </div>
                  <ul className="px-3 pb-3 space-y-1.5">
                    {d.items.map(it => (
                      <li key={it.id} className={`rounded-lg border px-3 py-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 ${typeCard[it.type]}`}>
                        <span className="text-sm font-bold tabular-nums">{it.start}–{it.end}</span>
                        <span className="text-sm font-semibold">{fmtH(it.hours)} {tr.hours_unit[lang]} · {tr[it.type][lang]}</span>
                        <span className="text-sm w-full sm:w-auto sm:ml-auto sm:text-right">
                          {it.names.length > 0 ? it.names.join(', ') : '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-300 dark:text-gray-500">
          Bilene Kite Center · {tr.footer[lang]} {new Date().toLocaleDateString(LOCALE[lang])}
        </p>

      </div>
    </div>
  )
}
