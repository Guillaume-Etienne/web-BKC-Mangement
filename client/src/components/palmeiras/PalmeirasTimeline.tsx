// The bungalows on a continuous timeline, like the planning: one row per
// Palmeiras bungalow, one bar per stay (from the middle of the arrival day to
// the middle of the departure day), coloured by who collected the money and
// carrying what the stay weighs in the account. Under the grid, one total per
// month. Shared by the admin tab and the Palmeiras share page.
import { useEffect, useMemo, useRef } from 'react'
import { addDaysISO, daysBetween, fromISODate, todayISO } from '../../utils/dates'
import {
  type Statement, type StatementInput, type StatementStay,
  stayAmounts, stayRef, fmtEurCents, fmtMonthLong, PALMEIRAS_COMMISSION_PCT,
} from '../../utils/palmeirasStatement'

const CELL_W = 30   // px per day — wider than the planning, the bars carry amounts

function monthsBetween(from: string, to: string): string[] {
  const out: string[] = []
  let [y, m] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    if (++m > 12) { m = 1; y++ }
  }
  return out
}

function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

function stayTitle(s: StatementStay): string {
  const { nights, gross, toUs, toPalmeiras } = stayAmounts(s)
  const head = `${stayRef(s)} — ${s.bungalow}, ${nights} night${nights === 1 ? '' : 's'}${s.provisional ? ' (provisional)' : ''}`
  return s.paid_direct
    ? `${head}\nGuest paid the Palmeiras ${fmtEurCents(gross)} → ${PALMEIRAS_COMMISSION_PCT}% owed to BKC: ${fmtEurCents(toUs)}`
    : `${head}\nGuest paid BKC → owed to the Palmeiras: ${fmtEurCents(toPalmeiras)}`
}

interface Props {
  input: StatementInput
  statement: Statement
}

export default function PalmeirasTimeline({ input, statement }: Props) {
  const today = todayISO()
  const scroller = useRef<HTMLDivElement>(null)

  const bungalows = useMemo(() => {
    const names = new Set([...(input.bungalows ?? []), ...input.stays.map(s => s.bungalow)])
    return [...names].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  }, [input])

  // From the first month with a stay (or this month) to the last one.
  const months = useMemo(() => {
    const starts = input.stays.map(s => s.check_in.slice(0, 7))
    const ends   = input.stays.map(s => addDaysISO(s.check_out, -1).slice(0, 7))
    const now = today.slice(0, 7)
    const from = [now, ...starts].sort()[0]
    const to   = [now, ...ends].sort().reverse()[0]
    return monthsBetween(from, to)
  }, [input, today])

  const first = `${months[0]}-01`
  const totalDays = months.reduce((n, m) => n + daysInMonth(m), 0)
  const idx = (iso: string) => daysBetween(first, iso)
  const todayIdx = idx(today)

  // Money per month, from the statement itself (due lines + upcoming ones),
  // so the timeline and the list can never disagree.
  const perMonth = useMemo(() => {
    const out: Record<string, { toUs: number; toPalmeiras: number; nights: number; rentMzn: number | null }> = {}
    const get = (m: string) => (out[m] ??= { toUs: 0, toPalmeiras: 0, nights: 0, rentMzn: null })
    for (const l of [...statement.months.flatMap(m => m.lines), ...statement.upcoming]) {
      const t = get(l.date.slice(0, 7))
      t.toUs += l.toUs
      t.toPalmeiras += l.toPalmeiras
    }
    for (const r of input.rents) if (r.amount_mzn) get(r.month).rentMzn = r.amount_mzn
    // Occupied nights counted in the month they fall in.
    for (const s of input.stays) {
      for (let d = s.check_in; d < s.check_out; d = addDaysISO(d, 1)) get(d.slice(0, 7)).nights++
    }
    return out
  }, [statement, input])

  useEffect(() => {
    const el = scroller.current
    if (el && todayIdx >= 0) el.scrollLeft = Math.max(0, todayIdx * CELL_W - el.clientWidth / 3)
  }, [todayIdx])

  const jumpTo = (month: string) => {
    scroller.current?.scrollTo({ left: idx(`${month}-01`) * CELL_W, behavior: 'smooth' })
  }

  const label = 'sticky left-0 z-20 shrink-0 w-24 sm:w-32 px-2 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800'

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      <header className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">Bungalows timeline</h3>
        <div className="flex flex-wrap gap-1">
          {months.map(m => (
            <button key={m} onClick={() => jumpTo(m)}
              className={`px-2.5 py-1 rounded text-xs font-medium ${m === today.slice(0, 7)
                ? 'bg-teal-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
              {fromISODate(`${m}-01`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
            </button>
          ))}
        </div>
      </header>

      {/* Legend */}
      <div className="px-4 py-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
        <span className="flex items-center gap-1.5"><span className="w-4 h-3 rounded-sm bg-purple-500" /> Guest paid the Palmeiras → {PALMEIRAS_COMMISSION_PCT}% owed to BKC</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-3 rounded-sm bg-sky-500" /> Guest paid BKC → cost owed to the Palmeiras</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-3 rounded-sm border-2 border-dashed border-gray-400" /> Provisional</span>
      </div>

      <div ref={scroller} className="overflow-x-auto">
        <div className="min-w-max">
          {/* Months */}
          <div className="flex border-b border-gray-200 dark:border-gray-800">
            <div className={`${label} py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400`}>Bungalow</div>
            {months.map(m => (
              <div key={m} style={{ width: daysInMonth(m) * CELL_W }}
                className="shrink-0 px-2 py-1.5 text-sm font-semibold text-gray-800 dark:text-gray-200 border-r-2 border-gray-300 dark:border-gray-600">
                <span className="sticky left-28 sm:left-36 inline-block">{fmtMonthLong(m)}</span>
              </div>
            ))}
          </div>
          {/* Days */}
          <div className="flex border-b border-gray-200 dark:border-gray-800">
            <div className={label} />
            {Array.from({ length: totalDays }, (_, i) => {
              const d = fromISODate(addDaysISO(first, i))
              const dow = d.getDay()
              const isToday = i === todayIdx
              return (
                <div key={i} style={{ width: CELL_W }}
                  className={`shrink-0 text-center py-0.5 leading-tight border-r ${d.getDate() === daysInMonth(addDaysISO(first, i).slice(0, 7))
                    ? 'border-r-2 border-gray-300 dark:border-gray-600' : 'border-gray-100 dark:border-gray-800'}
                    ${isToday ? 'bg-teal-600 text-white' : dow === 0 || dow === 6 ? 'bg-blue-50 dark:bg-blue-950/40 text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
                  <div className="text-[10px]">{'SMTWTFS'[dow]}</div>
                  <div className="text-xs font-medium">{d.getDate()}</div>
                </div>
              )
            })}
          </div>

          {/* One row per bungalow */}
          {bungalows.map(b => {
            const stays = input.stays.filter(s => s.bungalow === b)
            return (
              <div key={b} className="flex border-b border-gray-100 dark:border-gray-800">
                <div className={`${label} py-2 text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center`}>
                  <span className="truncate">{b}</span>
                </div>
                <div className="relative shrink-0" style={{ width: totalDays * CELL_W, height: 52 }}>
                  {/* weekend shading + today */}
                  <div className="absolute inset-0 flex">
                    {Array.from({ length: totalDays }, (_, i) => {
                      const dow = fromISODate(addDaysISO(first, i)).getDay()
                      return <div key={i} style={{ width: CELL_W }}
                        className={`shrink-0 border-r border-gray-100 dark:border-gray-800 ${i === todayIdx
                          ? 'bg-teal-50 dark:bg-teal-950/40' : dow === 0 || dow === 6 ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}`} />
                    })}
                  </div>
                  {stays.map((s, i) => {
                    const { toUs, toPalmeiras } = stayAmounts(s)
                    const left = idx(s.check_in) * CELL_W + CELL_W / 2
                    const width = Math.max(daysBetween(s.check_in, s.check_out) * CELL_W, CELL_W / 2)
                    return (
                      <div key={i} title={stayTitle(s)} style={{ left, width }}
                        className={`absolute top-1.5 h-10 rounded-md px-1.5 text-white overflow-hidden whitespace-nowrap shadow-sm flex flex-col justify-center leading-tight
                          ${s.paid_direct ? 'bg-purple-500 dark:bg-purple-600' : 'bg-sky-500 dark:bg-sky-600'}
                          ${s.provisional ? 'opacity-70 outline-2 outline-dashed outline-offset-[-2px] outline-white/80' : ''}`}>
                        <span className="text-xs font-semibold truncate">{s.guest || `#${s.booking_number}`}</span>
                        <span className="text-[11px] truncate opacity-95">
                          #{s.booking_number} · {s.paid_direct ? `+${fmtEurCents(toUs)} BKC` : `${fmtEurCents(toPalmeiras)} Palm.`}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Totals per month */}
          <div className="flex bg-gray-50 dark:bg-gray-800">
            <div className={`${label} py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center`}>Month total</div>
            {months.map(m => {
              const t = perMonth[m]
              return (
                <div key={m} style={{ width: daysInMonth(m) * CELL_W }}
                  className="shrink-0 px-3 py-2 border-r-2 border-gray-300 dark:border-gray-600 text-xs">
                  <div className="sticky left-28 sm:left-36 inline-flex flex-wrap gap-x-4 gap-y-0.5">
                    <span className="text-gray-600 dark:text-gray-400">🛏 {t?.nights ?? 0} night{t?.nights === 1 ? '' : 's'}</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">Owed to BKC {fmtEurCents(t?.toUs ?? 0)}</span>
                    <span className="font-semibold text-amber-700 dark:text-amber-400">Owed to the Palmeiras {fmtEurCents(t?.toPalmeiras ?? 0)}</span>
                    {t?.rentMzn != null && <span className="text-gray-600 dark:text-gray-400">incl. rent {Math.round(t.rentMzn).toLocaleString('en-US')} MZN</span>}
                    {m > today.slice(0, 7) && <span className="italic text-gray-400">not due yet</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
