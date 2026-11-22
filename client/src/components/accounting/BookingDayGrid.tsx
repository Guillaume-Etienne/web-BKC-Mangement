// Day by day grid of a booking — travellers × days (see dayGrid.ts).
// Desktop only for now (gui, 2026-11-22): past four guests a phone cannot hold it.

import { useMemo, useState } from 'react'
import type { Booking } from '../../types/database'
import type { SharedAccountingData } from './types'
import { buildDayGrid, GROUP_ROW, type GridChip, type GridKind, type GridRow } from './dayGrid'
import { fmtEur } from './utils'
import { rentalLabel, type RentalKind } from '../planning/rentalTypes'
import { todayISO, fromISODate, fmtDate, localeTag } from '../../utils/dates'
import { readLocal, writeLocal } from '../../utils/safeStorage'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'

const CHIP_CLASS: Record<GridKind, string> = {
  lesson:        'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  rental:        'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  center_access: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  extra:         'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  dining:        'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  activity:      'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
}

const MEALS_KEY = 'bf_day_grid_meals'

/** A lesson, a rental or center access: the day was counted as a riding day. */
const RIDING: ReadonlySet<GridKind> = new Set(['lesson', 'rental', 'center_access'])

const fmtDays = (n: number) => String(Math.round(n * 10) / 10)

function Chip({ chip, agencyWord }: { chip: GridChip; agencyWord: string }) {
  const title = `${chip.label} · ${fmtEur(chip.amount)}${chip.covered ? ` · ${agencyWord}` : ''}`
  return (
    <span title={title}
      className={`block whitespace-nowrap rounded px-1 leading-5 text-[11px] font-medium ${CHIP_CLASS[chip.kind]} ${chip.covered ? 'border border-dashed border-indigo-400 dark:border-indigo-500 opacity-80' : ''}`}>
      {chip.short}
    </span>
  )
}

function RowTotals({ row, dayUnit }: { row: GridRow; dayUnit: string }) {
  const t = row.totals
  const rentals = Object.entries(t.rentalDays) as [RentalKind | 'unknown', number][]
  return (
    <div className="space-y-0.5 text-[11px] text-gray-600 dark:text-gray-400 whitespace-nowrap">
      {t.lessonHours > 0 && <div>{fmtDays(t.lessonHours)}h</div>}
      {rentals.map(([k, n]) => (
        <div key={k}>{k === 'unknown' ? rentalLabel(null, 'staff') : rentalLabel(k, 'staff')} {fmtDays(n)}{dayUnit}</div>
      ))}
      {t.centerAccessDays > 0 && <div>C {t.centerAccessDays}{dayUnit}</div>}
      {t.amount > 0 && <div className="font-semibold text-gray-800 dark:text-gray-200">{fmtEur(t.amount)}</div>}
    </div>
  )
}

export default function BookingDayGrid({ booking, data }: { booking: Booking; data: SharedAccountingData }) {
  const { lang } = useLanguage()
  const tr = i18n.accounting
  const [meals, setMeals] = useState(() => readLocal(MEALS_KEY) === '1')
  const toggleMeals = () => { setMeals(m => { writeLocal(MEALS_KEY, m ? '0' : '1'); return !m }) }

  const grid = useMemo(
    () => buildDayGrid(booking, data, { mealsAndActivities: meals, groupName: tr.bf_grid_group[lang] }),
    [booking, data, meals, lang, tr],
  )
  const today = todayISO()
  const doubles = new Set(grid.warnings.flatMap(w => w.kind === 'rental_and_center_access' ? [`${w.rowId}|${w.date}`] : []))
  const nameOf = (id: string) => grid.rows.find(r => r.id === id)?.name ?? id
  const dayUnit = tr.bf_grid_day_unit[lang]
  const weekday = (d: string) => fromISODate(d).toLocaleDateString(localeTag(lang), { weekday: 'short' })

  if (grid.dates.length === 0 || grid.rows.length === 0) return null

  return (
    <div className="hidden md:block">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">{tr.bf_grid_title[lang]}</p>
        <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
          <input type="checkbox" checked={meals} onChange={toggleMeals} className="accent-blue-600" />
          {tr.bf_grid_meals[lang]}
        </label>
      </div>

      {grid.warnings.length > 0 && (
        <ul className="mb-2 space-y-0.5 text-xs text-amber-700 dark:text-amber-400">
          {grid.warnings.map((w, i) => (
            <li key={i}>⚠ {
              w.kind === 'rental_and_center_access'
                ? tr.bf_grid_warn_double[lang].replace('{name}', nameOf(w.rowId)).replace('{date}', fmtDate(w.date))
                : w.kind === 'unassigned'
                  ? tr.bf_grid_warn_unassigned[lang].replace('{count}', String(w.count))
                  : tr.bf_grid_warn_ca_count[lang].replace('{billed}', String(w.billed)).replace('{flagged}', String(w.flagged))
            }</li>
          ))}
        </ul>
      )}

      {/* w-0 min-w-full: the panel sits in a <td>, and a table cell grows to its
          content's width whatever overflow says. A long stay (84 days = ~4,000 px)
          then stretched the whole panel and pushed every right-aligned button
          (+ Payment, + Discount, + Extra) out of sight. Zero width = no pull on the
          cell; min-w-full = as wide as the panel; the days scroll inside. */}
      <div className="w-0 min-w-full overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
        <table className="text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
              <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800 px-2 py-1 text-left font-medium">{tr.bf_grid_guest[lang]}</th>
              {grid.dates.map(d => {
                const inStay = d >= booking.check_in && d <= booking.check_out
                return (
                  <th key={d}
                    className={`px-1 py-1 font-medium text-center min-w-[3rem] ${d === today ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : ''} ${inStay ? '' : 'opacity-50'}`}>
                    <div className="capitalize">{weekday(d)}</div>
                    <div>{d.slice(8, 10)}/{d.slice(5, 7)}</div>
                  </th>
                )
              })}
              <th className="px-2 py-1 text-left font-medium">{tr.bf_grid_total[lang]}</th>
            </tr>
          </thead>
          <tbody>
            {grid.rows.map(row => (
              <tr key={row.id} className="border-t border-gray-100 dark:border-gray-800 align-top">
                <td className={`sticky left-0 z-10 bg-white dark:bg-gray-900 px-2 py-1 font-medium whitespace-nowrap ${row.id === GROUP_ROW ? 'italic text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
                  {row.name}
                </td>
                {grid.dates.map(d => {
                  const cell = row.cells[d] ?? []
                  const isDouble = doubles.has(`${row.id}|${d}`)
                  // A rider's past day of the stay with no lesson, rental nor
                  // center access: maybe no wind, maybe forgotten.
                  const quiet = row.rides && row.id !== GROUP_ROW && d < today && grid.stayDates.has(d)
                    && !cell.some(c => RIDING.has(c.kind))
                  return (
                    <td key={d}
                      className={`px-0.5 py-0.5 ${d === today ? 'bg-blue-50/60 dark:bg-blue-950/30' : ''} ${isDouble ? 'bg-red-100 dark:bg-red-900/40 ring-1 ring-inset ring-red-400' : ''}`}>
                      <div className="flex flex-col gap-0.5 items-stretch">
                        {cell.map((c, i) => <Chip key={`${c.sourceId}-${i}`} chip={c} agencyWord={tr.bf_grid_agency[lang]} />)}
                        {quiet && cell.length === 0 && (
                          <span title={tr.bf_grid_nothing[lang]} className="block text-center text-gray-300 dark:text-gray-600">–</span>
                        )}
                      </div>
                    </td>
                  )
                })}
                <td className="px-2 py-1"><RowTotals row={row} dayUnit={dayUnit} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">{tr.bf_grid_legend[lang]}</p>
    </div>
  )
}
