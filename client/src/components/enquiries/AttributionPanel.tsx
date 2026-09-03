import { useMemo, useState } from 'react'
import type { AttributionInput } from '../../utils/attribution'
import { computeAttribution } from '../../utils/attribution'
import type { Season } from '../../types/database'

/** "Où en est la saison, et d'où viennent vraiment les gens ?"
 *
 *  Shown on the archive view, which is where ENQUIRIES.md says this belongs:
 *  "L'archive n'est pas un cimetière : c'est là qu'on lit le taux de
 *  transformation et l'origine réelle des clients en fin de saison." The source
 *  list, its trilingual labels and its never-delete rule were all built for this
 *  screen — it just never existed.
 *
 *  Two numbers per row, never one. Enquiries alone reward whatever channel
 *  produces the most noise; guests alone hide where they were found. Side by
 *  side, a source with twenty enquiries and no guest tells gui something, and so
 *  does one with two enquiries and two guests. */

interface Props {
  data: Omit<AttributionInput, 'range'>
  seasons: Season[]
}

export default function AttributionPanel({ data, seasons }: Props) {
  const [seasonId, setSeasonId] = useState('')   // '' = all time
  const season = seasons.find(s => s.id === seasonId)

  const stats = useMemo(() => computeAttribution({
    ...data,
    range: season ? { start: season.start_date, end: season.end_date } : null,
  }), [data, season])

  const maxBookings = Math.max(1, ...stats.rows.map(r => r.bookings))
  const { open, won, lost, rate } = stats.conversion

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 mb-6">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <div>
          <h2 className="font-bold text-gray-800 dark:text-gray-200">Where they came from</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Enquiries received, and how many of them became guests.
          </p>
        </div>
        <select value={seasonId} onChange={e => setSeasonId(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200">
          <option value="">All time</option>
          {seasons.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      {/* Conversion first: it is the one number that says whether the season is
          going well, and it is computed on settled enquiries only. */}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm mb-3 pb-3 border-b border-gray-100 dark:border-gray-800">
        {rate === null ? (
          <span className="text-gray-500 dark:text-gray-400">
            Nothing settled yet — no conversion rate to show.
          </span>
        ) : (
          <>
            <span className="text-2xl font-bold text-gray-800 dark:text-gray-200">{Math.round(rate * 100)}%</span>
            <span className="text-gray-500 dark:text-gray-400">
              became guests — <strong className="text-emerald-600 dark:text-emerald-400">{won} won</strong>,{' '}
              {lost} lost{open > 0 && `, ${open} still open`}
            </span>
          </>
        )}
      </div>

      {stats.rows.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">
          {season ? 'Nothing in this season yet.' : 'Nothing to attribute yet.'}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 dark:text-gray-400">
              <th className="text-left font-medium pb-1">Source</th>
              <th className="text-right font-medium pb-1 w-24">Enquiries</th>
              <th className="text-right font-medium pb-1 w-20">Guests</th>
              <th className="w-24"></th>
            </tr>
          </thead>
          <tbody>
            {stats.rows.map(r => (
              <tr key={r.key} className="border-t border-gray-100 dark:border-gray-800">
                <td className={`py-1.5 ${r.key === 'unknown' ? 'text-gray-400 dark:text-gray-500 italic' : 'text-gray-800 dark:text-gray-200'}`}>
                  {r.label}
                </td>
                <td className="py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-400">{r.enquiries || '—'}</td>
                <td className="py-1.5 text-right tabular-nums font-semibold text-gray-800 dark:text-gray-200">{r.bookings || '—'}</td>
                <td className="py-1.5 pl-2">
                  <span className="block h-1.5 rounded-full bg-emerald-500/70"
                    style={{ width: `${(r.bookings / maxBookings) * 100}%` }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Said, not dropped: these are usually the ones nobody has qualified, and
          a season view that silently ignores them would flatter itself. */}
      {season && stats.undatedEnquiries > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          {stats.undatedEnquiries} enquir{stats.undatedEnquiries > 1 ? 'ies have' : 'y has'} no arrival month,
          so {stats.undatedEnquiries > 1 ? 'they are' : 'it is'} not counted in a season. They appear under “All time”.
        </p>
      )}
    </div>
  )
}
