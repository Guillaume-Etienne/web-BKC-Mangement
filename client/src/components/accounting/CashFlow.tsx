import { useState, useMemo } from 'react'
import type { SharedAccountingData } from './types'
import { fmtEur, fmtMonth } from './utils'
import { buildCashFlowRows, filterRowsByPeriod, sumCashFlowRows, runningBalances } from './cashFlowUtils'
import MonthInput from '../common/MonthInput'

interface Props { data: SharedAccountingData }

type PeriodMode  = 'month' | 'season' | 'custom'
type ChartType   = 'bars' | 'diverging' | 'line'

export default function CashFlow({ data }: Props) {
  const { seasons } = data

  const currentSeason = seasons[seasons.length - 1]

  const [mode,      setMode]  = useState<PeriodMode>('season')
  const [chartType, setChart] = useState<ChartType>('bars')
  const [customFrom, setFrom] = useState(currentSeason?.start_date.slice(0, 7) ?? '')
  const [customTo,   setTo]   = useState(currentSeason?.end_date.slice(0, 7)   ?? '')

  // All the money maths lives in ./cashFlowUtils — pure and unit-tested. The
  // conventions (cash basis, check-in month, done-trips only) are documented there.
  const allRows = useMemo(() => buildCashFlowRows(data), [data])

  const filtered = useMemo(() => {
    if (mode === 'season' && currentSeason) {
      return filterRowsByPeriod(allRows, currentSeason.start_date.slice(0, 7), currentSeason.end_date.slice(0, 7))
    }
    if (mode === 'custom' && customFrom && customTo) {
      return filterRowsByPeriod(allRows, customFrom, customTo)
    }
    return allRows
  }, [allRows, mode, currentSeason, customFrom, customTo])

  const totals = sumCashFlowRows(filtered)
  const runningBalance = runningBalances(filtered)

  // ── Bar chart scale ──────────────────────────────────────────────────────
  const maxVal = Math.max(...filtered.map(r => Math.abs(r.net)), 1)

  return (
    <div className="space-y-6">

      {/* Period selector */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-1">
          {([
            { id: 'month',  label: 'All time' },
            { id: 'season', label: `Season ${currentSeason?.label ?? ''}` },
            { id: 'custom', label: 'Custom' },
          ] as { id: PeriodMode; label: string }[]).map(opt => (
            <button key={opt.id} onClick={() => setMode(opt.id)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                mode === opt.id ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>

        {mode === 'custom' && (
          <div className="flex items-center gap-2 text-sm">
            <MonthInput value={customFrom} onChange={setFrom} allowEmpty />
            <span className="text-gray-400 dark:text-gray-400">→</span>
            <MonthInput value={customTo} onChange={setTo} allowEmpty />
          </div>
        )}
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Billed',      value: totals.billed,    color: 'text-gray-700 dark:text-gray-300',    note: 'Revenue generated' },
          { label: 'Collected',   value: totals.collected, color: 'text-emerald-700 dark:text-emerald-400', note: 'Cash received',
            warn: totals.unverified > 0 ? `⚠ ${fmtEur(totals.unverified)} still to verify` : null },
          // Must list every outflow `net` subtracts, or this card and the table disagree.
          { label: 'Total out',   value: -(totals.expenses + totals.rent + totals.instrPaid + totals.taxiOut + totals.providersOut), color: 'text-red-700 dark:text-red-400', note: 'Expenses + rent + instructors + taxi + providers' },
          { label: 'Net cash',    value: totals.net,       color: totals.net >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400', note: 'Collected − all outflows' },
        ].map(k => (
          <div key={k.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-5 py-4">
            <p className="text-xs text-gray-400 dark:text-gray-400 uppercase tracking-wide mb-1">{k.label}</p>
            <p className={`text-xl font-bold ${k.color}`}>{fmtEur(k.value)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-400 mt-1">{k.note}</p>
            {'warn' in k && k.warn && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{k.warn}</p>}
          </div>
        ))}
      </div>

      {/* Chart */}
      {filtered.length > 1 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Monthly net cash</p>
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
              {([
                { id: 'bars',      label: '▮▮▮' },
                { id: 'diverging', label: '±' },
                { id: 'line',      label: '∿' },
              ] as { id: ChartType; label: string }[]).map(o => (
                <button key={o.id} onClick={() => setChart(o.id)}
                  className={`px-3 py-1 text-xs rounded font-mono font-bold transition-colors ${
                    chartType === o.id ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-400'
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
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Month</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-500 dark:text-gray-400">Billed</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Collected</th>
              <th className="px-4 py-3 text-right font-semibold text-blue-600 dark:text-blue-400"
                  title="Reversals owed to us + free income − free expenses. Rent is the next column.">
                Palmeiras net
              </th>
              <th className="px-4 py-3 text-right font-semibold text-red-500 dark:text-red-400">Expenses</th>
              <th className="px-4 py-3 text-right font-semibold text-red-500 dark:text-red-400">Rent</th>
              <th className="px-4 py-3 text-right font-semibold text-red-500 dark:text-red-400">Instructors</th>
              <th className="px-4 py-3 text-right font-semibold text-red-500 dark:text-red-400">Taxi out</th>
              <th className="px-4 py-3 text-right font-semibold text-red-500 dark:text-red-400"
                  title="Activity providers settled this month: cash paid to them minus cash they paid us.">
                Providers
              </th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Net cash</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-400 dark:text-gray-400">Running</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const running = runningBalance[r.month]
              return (
                <tr key={r.month} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{fmtMonth(r.month)}</td>
                  <td className="px-4 py-3 text-right text-gray-400 dark:text-gray-400">{r.billed ? fmtEur(r.billed) : '–'}</td>
                  <td className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-400 font-medium">
                    {r.collected ? `+ ${fmtEur(r.collected)}` : '–'}
                  </td>
                  {/* Now a net (reversals + free income − free expenses), so it can
                      be negative — the sign follows the value instead of a hardcoded +. */}
                  <td className={`px-4 py-3 text-right ${r.palmIn < 0 ? 'text-red-500 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                    {r.palmIn ? `${r.palmIn < 0 ? '−' : '+'} ${fmtEur(Math.abs(r.palmIn))}` : '–'}
                  </td>
                  <td className="px-4 py-3 text-right text-red-500 dark:text-red-400">
                    {r.expenses ? `− ${fmtEur(r.expenses)}` : '–'}
                  </td>
                  <td className="px-4 py-3 text-right text-red-500 dark:text-red-400">
                    {r.rent ? `− ${fmtEur(r.rent)}` : '–'}
                  </td>
                  <td className="px-4 py-3 text-right text-red-500 dark:text-red-400">
                    {r.instrPaid ? `− ${fmtEur(r.instrPaid)}` : '–'}
                  </td>
                  <td className="px-4 py-3 text-right text-red-500 dark:text-red-400">
                    {r.taxiOut ? `− ${fmtEur(r.taxiOut)}` : '–'}
                  </td>
                  {/* Net of both directions, so it flips to a "+" on a provider who
                      pays us more than we pay them. */}
                  <td className={`px-4 py-3 text-right ${r.providersOut < 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                    {r.providersOut ? `${r.providersOut < 0 ? '+' : '−'} ${fmtEur(Math.abs(r.providersOut))}` : '–'}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold ${r.net >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                    {r.net >= 0 ? '+' : ''}{fmtEur(r.net)}
                  </td>
                  <td className={`px-4 py-3 text-right text-xs ${running >= 0 ? 'text-gray-500 dark:text-gray-400' : 'text-red-400 dark:text-red-300'}`}>
                    {running >= 0 ? '+' : ''}{fmtEur(running)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="bg-gray-50 dark:bg-gray-800 border-t">
            <tr className="font-semibold">
              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">Total</td>
              <td className="px-4 py-3 text-right text-gray-400 dark:text-gray-400">{fmtEur(totals.billed)}</td>
              <td className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-400">+ {fmtEur(totals.collected)}</td>
              <td className={`px-4 py-3 text-right ${totals.palmIn < 0 ? 'text-red-500 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                {totals.palmIn < 0 ? '−' : '+'} {fmtEur(Math.abs(totals.palmIn))}
              </td>
              <td className="px-4 py-3 text-right text-red-500 dark:text-red-400">− {fmtEur(totals.expenses)}</td>
              <td className="px-4 py-3 text-right text-red-500 dark:text-red-400">− {fmtEur(totals.rent)}</td>
              <td className="px-4 py-3 text-right text-red-500 dark:text-red-400">− {fmtEur(totals.instrPaid)}</td>
              <td className="px-4 py-3 text-right text-red-500 dark:text-red-400">− {fmtEur(totals.taxiOut)}</td>
              <td className={`px-4 py-3 text-right ${totals.providersOut < 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                {totals.providersOut < 0 ? '+' : '−'} {fmtEur(Math.abs(totals.providersOut))}
              </td>
              <td className={`px-4 py-3 text-right ${totals.net >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                {totals.net >= 0 ? '+' : ''}{fmtEur(totals.net)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-400 dark:text-gray-400">
        <span><strong>Billed</strong> = computed total of active bookings (by check-in month)</span>
        <span><strong>Collected</strong> = actual payments received (by payment date)</span>
        <span><strong>Taxi out</strong> = drivers (paid per done trip) + manager payments, MZN→€ at global rate</span>
        <span><strong>Running</strong> = cumulative net cash (oldest → newest)</span>
      </div>
    </div>
  )
}
