import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { addDaysISO, todayISO } from '../../utils/dates'

/** Which screens gui and Teresa actually open — to decide what the menu can lose.
 *
 *  Fed by lib/usageTracker.ts: a count per account, per page (`taxis`) or tab
 *  (`taxis#drivers`), per day. Pages opened, not time spent. Tabs are indented
 *  under their page. */

interface UsageRow { page: string; user_label: string; views: number }

const PERIODS = [
  { id: '7',   label: '7 days',   days: 7 },
  { id: '30',  label: '30 days',  days: 30 },
  { id: '90',  label: '90 days',  days: 90 },
  { id: 'all', label: 'All time', days: null },
] as const

interface Line { key: string; page: string; tab: string | null; total: number; by: Record<string, number> }

export default function UsagePanel() {
  const [period, setPeriod]   = useState<(typeof PERIODS)[number]['id']>('30')
  const [rows, setRows]       = useState<UsageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    setLoading(true)
    const days = PERIODS.find(p => p.id === period)?.days ?? null
    supabase.rpc('get_page_usage', { p_since: days === null ? null : addDaysISO(todayISO(), -days) })
      .then(({ data, error }) => {
        // Migration not run on this database yet: say so, nothing else breaks.
        if (error) { setMissing(true); setRows([]) }
        else { setMissing(false); setRows(((data ?? []) as UsageRow[]).map(r => ({ ...r, views: Number(r.views) }))) }
        setLoading(false)
      })
  }, [period])

  const people = useMemo(() => {
    const t = new Map<string, number>()
    rows.forEach(r => t.set(r.user_label, (t.get(r.user_label) ?? 0) + (r.page.includes('#') ? 0 : r.views)))
    return [...t.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
  }, [rows])

  // Pages by total desc; each page's tabs right below it, also by total desc.
  const lines = useMemo(() => {
    const byKey = new Map<string, Line>()
    for (const r of rows) {
      const [page, tab = null] = r.page.split('#')
      const l = byKey.get(r.page) ?? { key: r.page, page, tab, total: 0, by: {} }
      l.total += r.views
      l.by[r.user_label] = (l.by[r.user_label] ?? 0) + r.views
      byKey.set(r.page, l)
    }
    const all = [...byKey.values()]
    const pages = all.filter(l => !l.tab).sort((a, b) => b.total - a.total)
    const tabsOf = (p: string) => all.filter(l => l.tab && l.page === p).sort((a, b) => b.total - a.total)
    const out: Line[] = []
    for (const p of pages) { out.push(p, ...tabsOf(p.page)) }
    // A tab whose page line is missing (page count lost) still shows.
    const shown = new Set(out.map(l => l.key))
    all.filter(l => !shown.has(l.key)).forEach(l => out.push(l))
    return out
  }, [rows])

  const max = Math.max(1, ...lines.map(l => Math.max(0, ...Object.values(l.by))))
  const COLORS = ['bg-blue-500', 'bg-amber-500', 'bg-emerald-500']

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border shadow-sm p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Usage</h2>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)}
              className={`px-3 py-1 rounded-lg text-sm border ${period === p.id
                ? 'bg-gray-800 text-white border-gray-800 dark:bg-gray-200 dark:text-gray-900 dark:border-gray-200'
                : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Pages and tabs opened by each admin account — opens, not time spent. Shared links are not counted.
      </p>

      {loading ? (
        <p className="text-gray-400 dark:text-gray-400 text-sm py-6 text-center">Loading…</p>
      ) : missing ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
          Not collecting yet — run <code className="font-mono text-xs">2026-11-15c_page_views.sql</code> on
          this database. Everything else keeps working without it.
        </p>
      ) : lines.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">Nothing counted yet for this period.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-4 mb-3 text-xs text-gray-500 dark:text-gray-400">
            {people.map((p, i) => (
              <span key={p} className="flex items-center gap-1.5">
                <span className={`inline-block w-3 h-3 rounded-sm ${COLORS[i % COLORS.length]}`} />{p}
              </span>
            ))}
          </div>
          <div className="space-y-1">
            {lines.map(l => (
              <div key={l.key} className={`flex items-center gap-3 py-1 ${l.tab ? 'pl-6' : 'border-t border-gray-100 dark:border-gray-800 pt-2'}`}>
                <div className={`w-32 sm:w-40 shrink-0 truncate ${l.tab ? 'text-xs text-gray-500 dark:text-gray-400' : 'text-sm font-medium text-gray-800 dark:text-gray-200'}`}>
                  {l.tab ?? l.page}
                </div>
                <div className="flex-1 space-y-0.5">
                  {people.map((p, i) => {
                    const n = l.by[p] ?? 0
                    return (
                      <div key={p} className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden">
                          <div className={`h-full ${COLORS[i % COLORS.length]}`} style={{ width: `${(n / max) * 100}%` }} />
                        </div>
                        <span className="w-10 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">{n}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
