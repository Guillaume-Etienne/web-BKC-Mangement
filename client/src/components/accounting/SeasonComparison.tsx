import { useMemo } from 'react'
import type { SharedAccountingData } from './types'
import type { Season } from '../../types/database'
import { filterDataToSeason } from './seasonFilter'
import { computeSeasonTotals, fmtEur } from './utils'
import type { SeasonTotals } from './utils'
import { fmtDate } from '../../utils/dates'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'
import type { Tr } from '../../data/i18n/types'

/** Season against season, one column each.
 *
 *  Each column is `computeSeasonTotals` run over a dataset narrowed by
 *  `filterDataToSeason` — the same function the single-season view uses, so a
 *  column here always matches what you see when you select that season alone. */

interface Props { data: SharedAccountingData; seasons: Season[] }

interface Line {
  label: Tr
  pick: (t: SeasonTotals) => number
  /** A cost: bigger is worse, so the delta colours flip. */
  cost?: boolean
  strong?: boolean
}

const REVENUE: Line[] = [
  { label: i18n.accounting.rev_accommodation, pick: t => t.accomRev },
  { label: i18n.accounting.rev_lessons,       pick: t => t.lessonsRev },
  { label: i18n.accounting.rev_equipment,     pick: t => t.rentalsRev },
  { label: i18n.accounting.rev_taxi_margin,   pick: t => t.taxiMargin },
  { label: i18n.accounting.rev_activities,    pick: t => t.activitiesRev },
  { label: i18n.accounting.rev_events,        pick: t => t.eventsRev },
  { label: i18n.accounting.rev_center_access, pick: t => t.centerAccessRev },
  { label: i18n.accounting.dash_total_revenue, pick: t => t.totalRevenue, strong: true },
]

const COSTS: Line[] = [
  { label: i18n.accounting.sc_instructors,          pick: t => t.instructorCosts,  cost: true },
  { label: i18n.accounting.tab_houses,              pick: t => t.houseRentalCosts, cost: true },
  { label: i18n.accounting.dash_bungalow_owners,    pick: t => t.bungalowCosts,    cost: true },
  { label: i18n.accounting.dash_external_stays,     pick: t => t.externalStayCosts, cost: true },
  { label: i18n.accounting.dash_activity_providers, pick: t => t.activityCosts,   cost: true },
  { label: i18n.accounting.dash_expenses,           pick: t => t.totalExpenses,    cost: true },
]

const BOTTOM: Line[] = [
  { label: i18n.accounting.dash_palmeiras_net, pick: t => t.palmeirasNet },
  { label: i18n.accounting.sc_net_result,      pick: t => t.netResult, strong: true },
]

export default function SeasonComparison({ data, seasons }: Props) {
  const { lang } = useLanguage()
  const columns = useMemo(
    () => seasons.map(s => ({ season: s, totals: computeSeasonTotals(filterDataToSeason(data, s)) })),
    [data, seasons],
  )

  if (seasons.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 italic">
        {i18n.accounting.sc_no_season_yet[lang]}
      </p>
    )
  }
  if (seasons.length === 1) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 italic">
        {i18n.accounting.sc_only_one_season[lang].replace('{label}', seasons[0].label)}
      </p>
    )
  }

  // The two most recent seasons are the comparison that gets looked at.
  const prev = columns[columns.length - 2]
  const last = columns[columns.length - 1]

  const delta = (line: Line) => {
    const d = line.pick(last.totals) - line.pick(prev.totals)
    if (Math.abs(d) < 0.5) return { text: '–', cls: 'text-gray-400 dark:text-gray-500' }
    // Spending more is not an improvement, so a cost line reads the other way.
    const good = line.cost ? d < 0 : d > 0
    return {
      text: `${d > 0 ? '+' : '−'}${fmtEur(Math.abs(d))}`,
      cls: good ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
    }
  }

  const Section = ({ title, lines }: { title: string; lines: Line[] }) => (
    <>
      <tr className="bg-gray-50 dark:bg-gray-800/60">
        <td colSpan={columns.length + 2}
          className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {title}
        </td>
      </tr>
      {lines.map(line => {
        const d = delta(line)
        return (
          <tr key={line.label.en} className="border-b border-gray-100 dark:border-gray-800">
            <td className={`px-4 py-2 ${line.strong ? 'font-bold text-gray-800 dark:text-gray-200' : 'text-gray-600 dark:text-gray-400'}`}>
              {line.label[lang]}
            </td>
            {columns.map(c => (
              <td key={c.season.id}
                className={`px-4 py-2 text-right tabular-nums ${line.strong ? 'font-bold text-gray-800 dark:text-gray-200' : 'text-gray-700 dark:text-gray-300'}`}>
                {line.cost ? '−' : ''}{fmtEur(line.pick(c.totals))}
              </td>
            ))}
            <td className={`px-4 py-2 text-right tabular-nums font-medium ${d.cls}`}>{d.text}</td>
          </tr>
        )
      })}
    </>
  )

  return (
    <div className="space-y-3">
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-800">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">{i18n.accounting.sc_figure_col[lang]}</th>
              {columns.map(c => (
                <th key={c.season.id} className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">
                  {c.season.label}
                  <span className="block text-[11px] font-normal text-gray-400 dark:text-gray-500">
                    {fmtDate(c.season.start_date)} → {fmtDate(c.season.end_date)}
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400"
                  title={`${last.season.label} compared with ${prev.season.label}`}>
                Δ
                <span className="block text-[11px] font-normal text-gray-400 dark:text-gray-500">
                  {i18n.accounting.sc_vs[lang].replace('{label}', prev.season.label)}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <Section title={i18n.accounting.section_revenue[lang]} lines={REVENUE} />
            <Section title={i18n.accounting.sc_costs_header[lang]}   lines={COSTS} />
            <Section title={i18n.accounting.sc_result_header[lang]}  lines={BOTTOM} />
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">
        A booking counts in the season containing its check-in, so a stay is never split
        across two. Costs are shown as the amounts they subtract; on those lines a drop is
        the good direction.
      </p>
    </div>
  )
}
