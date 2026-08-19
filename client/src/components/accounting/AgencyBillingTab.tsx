import { useState, useMemo } from 'react'
import type { SharedAccountingData } from './types'
import { buildAgencyInvoiceRows, computeAgencyTotals, fmtEur } from './utils'
import { filterDataToSeason } from './seasonFilter'
import { fmtDate } from '../../utils/dates'

// Read-only screen: it reports, it never stamps. The invoice — number, agency
// ref, stamps, printable document — is handled from the booking it belongs to.
interface Props { data: SharedAccountingData }

/** Invoice lines carry no date of their own — they belong to a booking, and a
 *  booking belongs to the season containing its check-in. So the period filter
 *  reuses `filterDataToSeason` rather than inventing a second rule: the figures
 *  here and on the dashboard must always come from the same slice of data. */
type Period = 'all' | 'season'

export default function AgencyBillingTab({ data }: Props) {
  const [period, setPeriod]     = useState<Period>('all')
  const [agencyId, setAgencyId] = useState<string>('')

  const currentSeason = data.seasons[data.seasons.length - 1]
  const scoped = useMemo(
    () => (period === 'season' && currentSeason ? filterDataToSeason(data, currentSeason) : data),
    [data, period, currentSeason]
  )

  const filter = agencyId ? { agencyId } : undefined
  const rows   = useMemo(() => buildAgencyInvoiceRows(scoped, filter), [scoped, agencyId])
  const totals = useMemo(() => computeAgencyTotals(scoped, filter), [scoped, agencyId])

  const day = (ts: string | null) => (ts ? fmtDate(ts.slice(0, 10)) : null)

  // Agencies with no line at all in the current period would make the picker
  // look broken ("I select them and the table is empty"), so it only lists
  // agencies actually present, plus whichever one is selected.
  const presentIds = new Set(buildAgencyInvoiceRows(scoped).map(r => r.line.agency_id))
  const pickable = data.agencies.filter(a => presentIds.has(a.id) || a.id === agencyId)

  return (
    <div className="space-y-6">

      {/* Period + agency filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-1">
          {([
            { id: 'all',    label: 'All time' },
            { id: 'season', label: `Season ${currentSeason?.label ?? ''}` },
          ] as { id: Period; label: string }[]).map(opt => (
            <button key={opt.id} onClick={() => setPeriod(opt.id)}
              disabled={opt.id === 'season' && !currentSeason}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-40 ${
                period === opt.id ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
        <select value={agencyId} onChange={e => setAgencyId(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300">
          <option value="">All agencies</option>
          {pickable.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Gross billed', value: totals.gross,       hint: 'at the agency’s own rates', color: 'text-gray-800 dark:text-gray-200' },
          { label: 'Commission',   value: -totals.commission, hint: 'retained by the agency',    color: 'text-purple-700 dark:text-purple-400' },
          { label: 'Net for us',   value: totals.net,         hint: 'what reaches the centre',   color: 'text-emerald-700 dark:text-emerald-400' },
          { label: 'Still owed',   value: totals.outstanding, hint: 'net billed, not yet paid',  color: totals.outstanding > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-5 py-4">
            <p className="text-xs text-gray-400 dark:text-gray-400 uppercase tracking-wide mb-1">{kpi.label}</p>
            <p className={`text-xl font-bold ${kpi.color}`}>{fmtEur(kpi.value)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{kpi.hint}</p>
          </div>
        ))}
      </div>

      {/* Invoice lines */}
      {rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
          <p className="text-4xl mb-2">🤝</p>
          <p className="text-sm">Nothing billed to an agency{period === 'season' ? ' this season' : ''} yet.</p>
          <p className="text-xs mt-1">
            Invoice lines are created from a booking, in Accounting → Bookings → 🤝 Agency billing.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">Agency</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">Booking</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">Line</th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-500 dark:text-gray-400">Used</th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-500 dark:text-gray-400">Gross</th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-500 dark:text-gray-400">Net</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const over = r.line.unit_hours != null && r.hoursUsed > r.line.unit_hours
                  return (
                    <tr key={r.line.id} className="border-b border-gray-50 dark:border-gray-800">
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">🤝 {r.agencyName}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {r.bookingNumber != null ? `#${String(r.bookingNumber).padStart(3, '0')}` : '—'}
                        <span className="ml-1.5 text-blue-500 dark:text-blue-400 text-xs">{r.guestName}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.label}</td>
                      <td className={`px-4 py-3 text-right tabular-nums whitespace-nowrap ${over ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                        {r.line.unit_hours != null ? `${r.hoursUsed}h / ${r.line.unit_hours}h${over ? ' ⚠' : ''}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">{fmtEur(r.line.price)}</td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {fmtEur(r.net)}
                        <span className="block text-xs text-purple-500 dark:text-purple-400">−{fmtEur(r.commission)} ({r.commissionPercent}%)</span>
                      </td>
                      {/* Read-only since 2026-08-19: the stamps belong to the
                          invoice, and an invoice is drawn up from the booking
                          (Accounting → Bookings → 🤝 Agency billing), where the
                          number, the agency ref and the printable document live.
                          Stamping from here would have meant guessing which
                          invoice a line belongs to. */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {!r.invoice ? (
                          <span className="text-xs text-gray-400 dark:text-gray-500 italic">not invoiced</span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                              🧾 {r.invoice.invoice_number}
                              {r.invoice.agency_ref && (
                                <span className="ml-1 text-gray-400 dark:text-gray-500">· ref {r.invoice.agency_ref}</span>
                              )}
                            </span>
                            <span className="flex gap-1">
                              {r.invoice.invoiced_at && (
                                <span className="px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                  sent {day(r.invoice.invoiced_at)}
                                </span>
                              )}
                              {r.invoice.paid_at
                                ? <span className="px-1.5 py-0.5 rounded text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                                    paid {day(r.invoice.paid_at)}
                                  </span>
                                : <span className="px-1.5 py-0.5 rounded text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                                    unpaid
                                  </span>}
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-800">
                <tr>
                  <td colSpan={4} className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">
                    {rows.length} line{rows.length > 1 ? 's' : ''}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-800 dark:text-gray-200">{fmtEur(totals.gross)}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-800 dark:text-gray-200">{fmtEur(totals.net)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {fmtEur(totals.paid)} paid · {fmtEur(totals.outstanding)} due
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500 italic">
        Invoicing stays manual and reviewed before sending — this screen only records what has
        gone out and what has come back. “Used” counts the hours taught against a package;
        rentals, transfers and rooms have no hours, so they show “—”.
      </p>
    </div>
  )
}
