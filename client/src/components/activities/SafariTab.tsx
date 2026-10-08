// /activities → Safaris: every booking with a safari-type provider, lined up
// with the Maputo partner-hotel nights before and after it, so a missing or
// mismatched night shows before the guests land. Logic: utils/safariChain.ts.
// Creating / editing reuses the activity booking form of ActivitiesPage.
import { useState } from 'react'
import type { ActivityBooking, ActivityProvider, BookingRef, PartnerHotel, PartnerHotelStay } from '../../types/database'
import { todayISO, fmtDate, daysBetween } from '../../utils/dates'
import { chainSafari, issueLabel } from '../../utils/safariChain'

interface Props {
  safaris:     ActivityBooking[]   // activity bookings of safari-type providers only
  providers:   ActivityProvider[]
  stays:       PartnerHotelStay[]  // all partner hotels
  hotels:      PartnerHotel[]
  bookingRefs: BookingRef[]
  onAdd:       () => void
  onEdit:      (b: ActivityBooking) => void
  onDelete:    (id: string) => void
}

type Period = 'upcoming' | 'past' | 'all'

function StayCell({ s, hotels }: { s: PartnerHotelStay | null; hotels: PartnerHotel[] }) {
  if (!s) return <span className="text-gray-300 dark:text-gray-600">–</span>
  const hotel = hotels.find(h => h.id === s.hotel_id)?.name.replace(/^Hotel\s+/i, '') ?? 'Hotel'
  return (
    <div className="whitespace-nowrap">
      <div className="text-gray-700 dark:text-gray-300">{fmtDate(s.check_in)} → {fmtDate(s.check_out)}</div>
      <div className="text-xs text-gray-400">
        {hotel} · {s.hotel_confirmed
          ? <span className="text-emerald-600 dark:text-emerald-400">✓ confirmed</span>
          : <span className="text-amber-600 dark:text-amber-400">to confirm</span>}
      </div>
    </div>
  )
}

export default function SafariTab({ safaris, providers, stays, hotels, bookingRefs, onAdd, onEdit, onDelete }: Props) {
  const [period, setPeriod] = useState<Period>('upcoming')
  const today = todayISO()

  const chains = safaris
    .map(s => chainSafari(s, stays))
    .filter(c => period === 'all' || (period === 'upcoming' ? c.end >= today : c.end < today))
    .sort((a, b) => period === 'past' ? b.start.localeCompare(a.start) : a.start.localeCompare(b.start))

  const withIssues = chains.filter(c => c.issues.length > 0).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 flex-1">🦁 Safaris</h2>
        {withIssues > 0 && (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
            ⚠️ {withIssues} to check
          </span>
        )}
        <button onClick={onAdd}
          className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold text-sm">+ Add safari</button>
      </div>

      <div className="flex gap-2">
        {(['upcoming', 'past', 'all'] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${period === p
              ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
            {p === 'upcoming' ? 'Upcoming' : p === 'past' ? 'Past' : 'All'}
          </button>
        ))}
      </div>

      {chains.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-8 text-center">No safaris.</p>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 border-b text-gray-500 dark:text-gray-400 text-xs text-left whitespace-nowrap">
                <th className="px-3 py-3 font-medium">Booking</th>
                <th className="px-3 py-3 font-medium">Safari</th>
                <th className="px-3 py-3 font-medium">Dates</th>
                <th className="px-3 py-3 font-medium text-center">Pax</th>
                <th className="px-3 py-3 font-medium">Maputo before</th>
                <th className="px-3 py-3 font-medium">Maputo after</th>
                <th className="px-3 py-3 font-medium">Check</th>
                <th className="px-3 py-3 font-medium">Flow</th>
                <th className="px-3 py-3 font-medium text-right">Client €</th>
                <th className="px-3 py-3 font-medium text-right">Provider €</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {chains.map(c => {
                const s = c.safari
                const ref = bookingRefs.find(r => r.id === s.booking_id)
                const days = daysBetween(c.start, c.end) + 1
                return (
                  <tr key={s.id} className={`border-b hover:bg-gray-50 dark:hover:bg-gray-800 align-top ${c.issues.length ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''}`}>
                    <td className="px-3 py-2">
                      {ref ? (
                        <>
                          <div className="font-medium text-gray-800 dark:text-gray-200">{ref.client ? `${ref.client.first_name} ${ref.client.last_name}` : '–'}</div>
                          <div className="text-xs text-gray-400">#{ref.booking_number}</div>
                        </>
                      ) : <span className="text-gray-400 italic">No booking</span>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-gray-800 dark:text-gray-200">{s.label}</div>
                      <div className="text-xs text-gray-400">{providers.find(p => p.id === s.provider_id)?.name ?? '–'}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">
                      {c.start === c.end ? fmtDate(c.start) : `${fmtDate(c.start)} → ${fmtDate(c.end)}`}
                      <div className="text-xs text-gray-400">{days} day{days > 1 ? 's' : ''}{!s.end_date && ' · no end date'}</div>
                    </td>
                    <td className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">{s.nb_persons}</td>
                    <td className="px-3 py-2"><StayCell s={c.before} hotels={hotels} /></td>
                    <td className="px-3 py-2"><StayCell s={c.after} hotels={hotels} /></td>
                    <td className="px-3 py-2 text-xs">
                      {!s.booking_id ? <span className="text-gray-400">–</span>
                        : c.issues.length === 0 ? <span className="text-emerald-600 dark:text-emerald-400">✓ OK</span>
                        : c.issues.map((i, k) => <div key={k} className="text-amber-700 dark:text-amber-400 whitespace-nowrap">⚠️ {issueLabel(i)}</div>)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
                        s.payment_flow === 'we_pay_provider'
                          ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      }`}>{s.payment_flow === 'we_pay_provider' ? '→ them' : '← us'}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{s.price_client > 0 ? `${s.price_client}€` : '–'}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-800 dark:text-gray-200">{s.price_provider > 0 ? `${s.price_provider}€` : '–'}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => onEdit(s)} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 px-1">✏️</button>
                        <button onClick={() => onDelete(s.id)} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 px-1">✕</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-400">
        Expected chain: the Maputo stay before ends the day the safari starts, the one after begins the day it ends.
      </p>
    </div>
  )
}
