import { useState, useMemo } from 'react'
import type { SharedAccountingData } from './types'
import { computeBookingTotal, fmtEur, fmtMonth } from './utils'

interface Props { data: SharedAccountingData }

type PeriodMode  = 'month' | 'season' | 'custom'
type ChartType   = 'bars' | 'diverging' | 'line'

interface MonthRow {
  month: string
  billed:    number
  collected: number
  palmIn:    number
  expenses:  number
  rent:      number
  instrPaid: number
  net:       number
}

export default function CashFlow({ data }: Props) {
  const {
    payments, expenses, palmeirasRents, palmeirasReversals,
    seasons, bookings, instructorPayments,
  } = data

  const currentSeason = seasons[seasons.length - 1]

  const [mode,      setMode]  = useState<PeriodMode>('season')
  const [chartType, setChart] = useState<ChartType>('bars')
  const [customFrom, setFrom] = useState(currentSeason?.start_date.slice(0, 7) ?? '')
  const [customTo,   setTo]   = useState(currentSeason?.end_date.slice(0, 7)   ?? '')

  // ── Build month index ───────────────────────────────────────────────────
  const allRows = useMemo<MonthRow[]>(() => {
    const idx: Record<string, MonthRow> = {}

    const ensure = (m: string) => {
      if (!idx[m]) idx[m] = { month: m, billed: 0, collected: 0, palmIn: 0, expenses: 0, rent: 0, instrPaid: 0, net: 0 }
      return idx[m]
    }

    // Revenue billed (by check_in month)
    for (const b of bookings.filter(b => b.status !== 'cancelled')) {
      const m = b.check_in.slice(0, 7)
      ensure(m).billed += computeBookingTotal(b, data)
    }

    // Cash collected (by payment date)
    for (const p of payments) {
      const m = p.date.slice(0, 7)
      ensure(m).collected += p.amount
    }

    // Palmeiras reversals in
    for (const r of palmeirasReversals) {
      ensure(r.month).palmIn += r.net_amount
    }

    // Expenses out
    for (const e of expenses) {
      const m = e.date.slice(0, 7)
      ensure(m).expenses += e.amount
    }

    // Rent out
    for (const r of palmeirasRents) {
      ensure(r.month).rent += r.amount
    }

    // Instructor payments out
    for (const p of instructorPayments) {
      const m = p.date.slice(0, 7)
      ensure(m).instrPaid += p.amount
    }

    // Compute net for each month
    for (const row of Object.values(idx)) {
      row.net = row.collected + row.palmIn - row.expenses - row.rent - row.instrPaid
    }

    return Object.values(idx).sort((a, b) => b.month.localeCompare(a.month)) // newest first
  }, [bookings, payments, palmeirasReversals, expenses, palmeirasRents, instructorPayments, data])

  // ── Filter by period ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (mode === 'season' && currentSeason) {
      const from = currentSeason.start_date.slice(0, 7)
      const to   = currentSeason.end_date.slice(0, 7)
      return allRows.filter(r => r.month >= from && r.month <= to)
    }
    if (mode === 'custom' && customFrom && customTo) {
      return allRows.filter(r => r.month >= customFrom && r.month <= customTo)
    }
    return allRows
  }, [allRows, mode, currentSeason, customFrom, customTo])

  // ── Totals ──────────────────────────────────────────────────────────────
  const totals = filtered.reduce(
    (acc, r) => ({
      billed:    acc.billed    + r.billed,
      collected: acc.collected + r.collected,
      palmIn:    acc.palmIn    + r.palmIn,
      expenses:  acc.expenses  + r.expenses,
      rent:      acc.rent      + r.rent,
      instrPaid: acc.instrPaid + r.instrPaid,
      net:       acc.net       + r.net,
    }),
    { billed: 0, collected: 0, palmIn: 0, expenses: 0, rent: 0, instrPaid: 0, net: 0 }
  )

  // ── Running balance (cumulative net, oldest→newest) ─────────────────────
  const orderedAsc = [...filtered].sort((a, b) => a.month.localeCompare(b.month))
  const runningBalance: Record<string, number> = {}
  let cumul = 0
  for (const r of orderedAsc) {
    cumul += r.net
    runningBalance[r.month] = cumul
  }

  // ── Bar chart scale ──────────────────────────────────────────────────────
  const maxVal = Math.max(...filtered.map(r => Math.abs(r.net)), 1)

  return (
    <div className="space-y-6">

      {/* Period selector */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1">
          {([
            { id: 'month',  label: 'All time' },
            { id: 'season', label: `Season ${currentSeason?.label ?? ''}` },
            { id: 'custom', label: 'Custom' },
          ] as { id: PeriodMode; label: string }[]).map(opt => (
            <button key={opt.id} onClick={() => setMode(opt.id)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                mode === opt.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>

        {mode === 'custom' && (
          <div className="flex items-center gap-2 text-sm">
            <input type="month" value={customFrom} onChange={e => setFrom(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <span className="text-gray-400">→</span>
            <input type="month" value={customTo} onChange={e => setTo(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
        )}
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Billed',      value: totals.billed,    color: 'text-gray-700',    note: 'Revenue generated' },
          { label: 'Collected',   value: totals.collected, color: 'text-emerald-700', note: 'Cash actually received' },
          { label: 'Total out',   value: -(totals.expenses + totals.rent + totals.instrPaid), color: 'text-red-700', note: 'Expenses + rent + instructors' },
          { label: 'Net cash',    value: totals.net,       color: totals.net >= 0 ? 'text-emerald-700' : 'text-red-700', note: 'Collected − all outflows' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{k.label}</p>
            <p className={`text-xl font-bold ${k.color}`}>{fmtEur(k.value)}</p>
            <p className="text-xs text-gray-400 mt-1">{k.note}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      {filtered.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-600">Monthly net cash</p>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              {([
                { id: 'bars',      label: '▮▮▮' },
                { id: 'diverging', label: '±' },
                { id: 'line',      label: '∿' },
              ] as { id: ChartType; label: string }[]).map(o => (
                <button key={o.id} onClick={() => setChart(o.id)}
                  className={`px-3 py-1 text-xs rounded font-mono font-bold transition-colors ${
                    chartType === o.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  }`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Bars (classic, from bottom) ── */}
          {chartType === 'bars' && (() => {
            const H = 192
            const BAR = H - 20
            const asc = [...filtered].reverse()
            return (
              <div style={{ display: 'flex', gap: '6px', height: `${H}px`, alignItems: 'flex-end' }}>
                {asc.map(r => {
                  const barH = Math.max(Math.round((Math.abs(r.net) / maxVal) * BAR), 3)
                  const color = r.net >= 0 ? '#34d399' : '#f87171'
                  return (
                    <div key={r.month} className="group relative" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: `${H}px` }}>
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                        {fmtMonth(r.month)}: {r.net >= 0 ? '+' : ''}{fmtEur(r.net)}
                      </div>
                      <div style={{ width: '100%', height: `${barH}px`, backgroundColor: color, borderRadius: '3px 3px 0 0' }} />
                      <p style={{ fontSize: '9px', lineHeight: '20px', color: '#9ca3af', width: '100%', textAlign: 'center' }}>
                        {r.month.slice(5)}
                      </p>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* ── Diverging (zero-center) ── */}
          {chartType === 'diverging' && (() => {
            const H = 192
            const HALF = (H - 28) / 2  // usable half-height (label = 20px, axis label = 8px)
            const asc = [...filtered].reverse()
            return (
              <div style={{ position: 'relative', height: `${H}px` }}>
                {/* Zero line */}
                <div style={{ position: 'absolute', top: `${HALF + 4}px`, left: 0, right: 0, height: '1px', backgroundColor: '#d1d5db' }} />
                <p style={{ position: 'absolute', top: `${HALF - 4}px`, right: 0, fontSize: '9px', color: '#9ca3af' }}>0</p>
                {/* Columns */}
                <div style={{ display: 'flex', gap: '6px', position: 'absolute', inset: 0 }}>
                  {asc.map(r => {
                    const barH = Math.max(Math.round((Math.abs(r.net) / maxVal) * HALF), 3)
                    const color = r.net >= 0 ? '#34d399' : '#f87171'
                    const top   = r.net >= 0 ? `${HALF + 4 - barH}px` : `${HALF + 4}px`
                    return (
                      <div key={r.month} className="group relative" style={{ flex: 1 }}>
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                          {fmtMonth(r.month)}: {r.net >= 0 ? '+' : ''}{fmtEur(r.net)}
                        </div>
                        <div style={{ position: 'absolute', left: 0, right: 0, top, height: `${barH}px`, backgroundColor: color, borderRadius: r.net >= 0 ? '3px 3px 0 0' : '0 0 3px 3px' }} />
                        <p style={{ position: 'absolute', bottom: 0, left: 0, right: 0, fontSize: '9px', lineHeight: '20px', color: '#9ca3af', textAlign: 'center' }}>
                          {r.month.slice(5)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* ── Line chart ── */}
          {chartType === 'line' && (() => {
            const H = 192
            const PAD = { top: 12, bottom: 24, left: 8, right: 8 }
            const asc  = [...filtered].reverse()
            const n    = asc.length
            const minV = Math.min(...asc.map(r => r.net))
            const maxV = Math.max(...asc.map(r => r.net))
            const range = maxV - minV || 1
            const toY = (v: number) => PAD.top + ((maxV - v) / range) * (H - PAD.top - PAD.bottom)
            const toX = (i: number) => PAD.left + (i / (n - 1)) * (100 - PAD.left - PAD.right)  // percent
            const pts = asc.map((r, i) => ({ x: toX(i), y: toY(r.net), r }))
            const zeroY = toY(0)
            const polyline = pts.map(p => `${p.x}%,${p.y}`).join(' ')
            return (
              <div style={{ position: 'relative', height: `${H}px` }}>
                <svg width="100%" height={H} style={{ overflow: 'visible' }}>
                  {/* Zero line if in range */}
                  {zeroY >= PAD.top && zeroY <= H - PAD.bottom && (
                    <line x1="0" y1={zeroY} x2="100%" y2={zeroY} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 3" />
                  )}
                  {/* Area fill */}
                  <defs>
                    <linearGradient id="lg-pos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#34d399" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polyline points={polyline} fill="none" stroke="#34d399" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                  {/* Dots */}
                  {pts.map(p => (
                    <circle key={p.r.month} cx={`${p.x}%`} cy={p.y} r={4} fill={p.r.net >= 0 ? '#34d399' : '#f87171'} stroke="white" strokeWidth="1.5" />
                  ))}
                </svg>
                {/* Labels */}
                {pts.map(p => (
                  <p key={p.r.month} className="group/dot absolute" style={{ left: `${p.x}%`, bottom: 0, transform: 'translateX(-50%)', fontSize: '9px', color: '#9ca3af', lineHeight: '20px', whiteSpace: 'nowrap' }}>
                    {p.r.month.slice(5)}
                  </p>
                ))}
                {/* Hover tooltips via transparent overlay rects (SVG) */}
              </div>
            )
          })()}
        </div>
      )}

      {/* Detailed table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Month</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-500">Billed</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Collected</th>
              <th className="px-4 py-3 text-right font-semibold text-blue-600">Palmeiras in</th>
              <th className="px-4 py-3 text-right font-semibold text-red-500">Expenses</th>
              <th className="px-4 py-3 text-right font-semibold text-red-500">Rent</th>
              <th className="px-4 py-3 text-right font-semibold text-red-500">Instructors</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Net cash</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-400">Running</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const running = runningBalance[r.month]
              return (
                <tr key={r.month} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{fmtMonth(r.month)}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{r.billed ? fmtEur(r.billed) : '–'}</td>
                  <td className="px-4 py-3 text-right text-emerald-700 font-medium">
                    {r.collected ? `+ ${fmtEur(r.collected)}` : '–'}
                  </td>
                  <td className="px-4 py-3 text-right text-blue-600">
                    {r.palmIn ? `+ ${fmtEur(r.palmIn)}` : '–'}
                  </td>
                  <td className="px-4 py-3 text-right text-red-500">
                    {r.expenses ? `− ${fmtEur(r.expenses)}` : '–'}
                  </td>
                  <td className="px-4 py-3 text-right text-red-500">
                    {r.rent ? `− ${fmtEur(r.rent)}` : '–'}
                  </td>
                  <td className="px-4 py-3 text-right text-red-500">
                    {r.instrPaid ? `− ${fmtEur(r.instrPaid)}` : '–'}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold ${r.net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {r.net >= 0 ? '+' : ''}{fmtEur(r.net)}
                  </td>
                  <td className={`px-4 py-3 text-right text-xs ${running >= 0 ? 'text-gray-500' : 'text-red-400'}`}>
                    {running >= 0 ? '+' : ''}{fmtEur(running)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="bg-gray-50 border-t">
            <tr className="font-semibold">
              <td className="px-4 py-3 text-gray-700">Total</td>
              <td className="px-4 py-3 text-right text-gray-400">{fmtEur(totals.billed)}</td>
              <td className="px-4 py-3 text-right text-emerald-700">+ {fmtEur(totals.collected)}</td>
              <td className="px-4 py-3 text-right text-blue-600">+ {fmtEur(totals.palmIn)}</td>
              <td className="px-4 py-3 text-right text-red-500">− {fmtEur(totals.expenses)}</td>
              <td className="px-4 py-3 text-right text-red-500">− {fmtEur(totals.rent)}</td>
              <td className="px-4 py-3 text-right text-red-500">− {fmtEur(totals.instrPaid)}</td>
              <td className={`px-4 py-3 text-right ${totals.net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {totals.net >= 0 ? '+' : ''}{fmtEur(totals.net)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-400">
        <span><strong>Billed</strong> = computed total of active bookings (by check-in month)</span>
        <span><strong>Collected</strong> = actual payments received (by payment date)</span>
        <span><strong>Running</strong> = cumulative net cash (oldest → newest)</span>
      </div>
    </div>
  )
}
