import type { SharedAccountingData } from './types'
import { computeDiningRevenue, fmtEur } from './utils'
import type { DiningEvent } from '../../types/database'

interface Props { data: SharedAccountingData }

function eventRevenue(ev: DiningEvent): number {
  if (ev.price_per_person === 0) return 0
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
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-1">Total events revenue</p>
          <p className="text-3xl font-bold text-emerald-800">{fmtEur(total)}</p>
          <p className="text-xs text-emerald-600 mt-1">{sorted.length} paid event{sorted.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Total events</p>
          <p className="text-3xl font-bold text-gray-700">{diningEvents.length}</p>
          <p className="text-xs text-gray-400 mt-1">{freeEvents.length} free (no charge)</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-1">Avg per paid event</p>
          <p className="text-3xl font-bold text-blue-800">
            {sorted.length > 0 ? fmtEur(total / sorted.length) : '—'}
          </p>
        </div>
      </div>

      {/* Paid events list */}
      {sorted.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b bg-gray-50">
            <h2 className="text-sm font-bold text-gray-700">Paid events</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Event</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Type</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Attendees</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">€/pers</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(ev => {
                const attending = (ev.attendees ?? []).filter(a => a.is_attending).length
                const rev = eventRevenue(ev)
                return (
                  <tr key={ev.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{ev.date}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{ev.name || <span className="italic text-gray-400">(unnamed)</span>}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {ev.type === 'menu' ? '🍽️ Menu' : '🔢 Count'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{attending}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{fmtEur(ev.price_per_person)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">{fmtEur(rev)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t bg-gray-50">
              <tr>
                <td colSpan={5} className="px-4 py-3 text-sm font-bold text-gray-700 text-right">Total</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-700">{fmtEur(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Free events list */}
      {freeEvents.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b bg-gray-50">
            <h2 className="text-sm font-bold text-gray-700 text-gray-400">Free events (no charge)</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Event</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Attendees</th>
              </tr>
            </thead>
            <tbody>
              {freeEvents.map(ev => (
                <tr key={ev.id} className="border-b last:border-0 hover:bg-gray-50 opacity-60">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{ev.date}</td>
                  <td className="px-4 py-3 text-gray-600">{ev.name || <span className="italic text-gray-400">(unnamed)</span>}</td>
                  <td className="px-4 py-3 text-center text-gray-500">{(ev.attendees ?? []).filter(a => a.is_attending).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {diningEvents.length === 0 && (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-12 text-center text-gray-400">
          No events recorded yet. Create events from the Now tab in Planning.
        </div>
      )}
    </div>
  )
}
