import type { DayMovements } from '../../utils/movements'
import { fromISODate, fmtDateShort } from '../../utils/dates'

const DIRECTION_ICON = { arrival: '🛬', departure: '🛫', other: '🚕' } as const

function dayLabel(iso: string): string {
  return `${fromISODate(iso).toLocaleDateString('en-GB', { weekday: 'short' })} ${fmtDateShort(iso)}`
}

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`

/** Home → what moves tomorrow, and the shape of the next seven days.
 *  `days[0]` is today, `days[1]` tomorrow. Movements only — arrivals, departures,
 *  taxis; nothing else on purpose. */
export default function MovementsPanel({ days, onOpenTaxis }: { days: DayMovements[]; onOpenTaxis: () => void }) {
  const tomorrow = days[1]
  if (!tomorrow) return null
  const quiet = tomorrow.arrivals.length + tomorrow.departures.length + tomorrow.taxis.length === 0

  return (
    <div className="mb-10 grid gap-4 md:grid-cols-2">
      {/* Tomorrow — the detail */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">Tomorrow</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">{dayLabel(tomorrow.date)}</span>
        </div>
        {quiet ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No arrival, departure or taxi.</p>
        ) : (
          <div className="space-y-4">
            <Section title={plural(tomorrow.arrivals.length, 'arrival')} icon="🛬" rows={tomorrow.arrivals} />
            <Section title={plural(tomorrow.departures.length, 'departure')} icon="🛫" rows={tomorrow.departures} />
            {tomorrow.taxis.length > 0 && (
              <div>
                <button onClick={onOpenTaxis} className="text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                  🚕 {plural(tomorrow.taxis.length, 'taxi')} →
                </button>
                <ul className="mt-1 space-y-1">
                  {tomorrow.taxis.map(t => (
                    <li key={t.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <span className="w-12 tabular-nums text-gray-500 dark:text-gray-400">{t.time || '—'}</span>
                      <span>{DIRECTION_ICON[t.direction]}</span>
                      <span className="min-w-0 flex-1 truncate">{t.name ?? 'Unlinked trip'} · {plural(t.persons, 'pax', 'pax')}</span>
                      {t.noDriver && <span className="flex-shrink-0 rounded bg-red-100 dark:bg-red-950/60 px-1.5 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">no driver</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* This week — the shape */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">Next 7 days</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 dark:text-gray-400">
              <th className="text-left font-medium pb-1" />
              <th className="font-medium pb-1" title="Arrivals">🛬</th>
              <th className="font-medium pb-1" title="Departures">🛫</th>
              <th className="font-medium pb-1" title="Taxis">🚕</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d, i) => (
              <tr key={d.date} className={`border-t border-gray-100 dark:border-gray-800 ${i === 1 ? 'bg-blue-50/60 dark:bg-blue-950/30 font-semibold' : ''}`}>
                <td className="py-1 text-gray-700 dark:text-gray-300">{i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dayLabel(d.date)}</td>
                <Count n={d.arrivals.length} />
                <Count n={d.departures.length} />
                <Count n={d.taxis.length} alert={d.taxis.some(t => t.noDriver)} />
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Red taxi count = a trip has no driver yet.</p>
      </div>
    </div>
  )
}

function Count({ n, alert = false }: { n: number; alert?: boolean }) {
  return (
    <td className={`text-center tabular-nums ${alert ? 'text-red-600 dark:text-red-400 font-bold' : n === 0 ? 'text-gray-300 dark:text-gray-700' : 'text-gray-800 dark:text-gray-200'}`}>
      {n}
    </td>
  )
}

function Section({ title, icon, rows }: { title: string; icon: string; rows: DayMovements['arrivals'] }) {
  if (rows.length === 0) return null
  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{icon} {title}</p>
      <ul className="mt-1 space-y-1">
        {rows.map(r => (
          <li key={r.bookingId} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <span className="w-12 tabular-nums text-gray-500 dark:text-gray-400">{r.time ?? '—'}</span>
            <span className="min-w-0 flex-1 truncate">{r.name} <span className="text-gray-400 dark:text-gray-500">#{r.number}</span></span>
            {r.provisional && <span className="flex-shrink-0 rounded bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">provisional</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
