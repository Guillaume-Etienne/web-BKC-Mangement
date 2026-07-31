import type { SharedAccountingData } from './types'
import { computeDiningRevenue, fmtEur } from './utils'
import type { DiningEvent } from '../../types/database'

interface Props { data: SharedAccountingData }

function eventRevenue(ev: DiningEvent): number {
  return (ev.attendees ?? [])
    .filter(a => a.is_attending)
    .reduce((s, a) => s + (a.price_override ?? ev.price_per_person), 0)
}

export default function EventsTab({ data }: Props) {
  const { diningEvents } = data

  const total = computeDiningRevenue(diningEvents)

  const sorted = [...diningEvents]
    .filter(ev => ev.price_per_person > 0 || (ev.attendees ?? []).some(a => a.is_attending && (a.price_override ?? 0) > 0))
    .sort((a, b) => b.date.localeCompare(a.date))

  const freeEvents = diningEvents.filter(ev =>
    ev.price_per_person === 0 && !(ev.attendees ?? []).some(a => a.price_override && a.price_override > 0)
  ).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="space-y-6">

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-1">Total events revenue</p>
          <p className="text-3xl font-bold text-emerald-800 dark:text-emerald-400">{fmtEur(total)}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{sorted.length} paid event{sorted.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Total events</p>
          <p className="text-3xl font-bold text-gray-700 dark:text-gray-300">{diningEvents.length}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{freeEvents.length} free (no charge)</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-1">Avg per paid event</p>
          <p className="text-3xl font-bold text-blue-800 dark:text-blue-400">
            {sorted.length > 0 ? fmtEur(total / sorted.length) : '—'}
          </p>
        </div>
      </div>

      {/* Paid events list */}
      {sorted.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b bg-gray-50 dark:bg-gray-800">
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300">Paid events</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Event</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">Type</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">Attendees</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">€/pers</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(ev => {
                const attending = (ev.attendees ?? []).filter(a => a.is_attending).length
                const rev = eventRevenue(ev)
                return (
                  <tr key={ev.id} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">{ev.date}</td>
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{ev.name || <span className="italic text-gray-400 dark:text-gray-500">(unnamed)</span>}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                        {ev.type === 'menu' ? '🍽️ Menu' : '🔢 Count'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{attending}</td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{fmtEur(ev.price_per_person)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700 dark:text-emerald-400">{fmtEur(rev)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t bg-gray-50 dark:bg-gray-800">
              <tr>
                <td colSpan={5} className="px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-300 text-right">Total</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-700 dark:text-emerald-400">{fmtEur(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Free events list */}
      {freeEvents.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b bg-gray-50 dark:bg-gray-800">
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 text-gray-400 dark:text-gray-500">Free events (no charge)</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Event</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">Attendees</th>
              </tr>
            </thead>
            <tbody>
              {freeEvents.map(ev => (
                <tr key={ev.id} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 opacity-60">
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">{ev.date}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{ev.name || <span className="italic text-gray-400 dark:text-gray-500">(unnamed)</span>}</td>
                  <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">{(ev.attendees ?? []).filter(a => a.is_attending).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {diningEvents.length === 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-12 text-center text-gray-400 dark:text-gray-500">
          No events recorded yet. Create events from the Now tab in Planning.
        </div>
      )}
    </div>
  )
}
