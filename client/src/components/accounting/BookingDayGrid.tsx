// Day by day grid of a booking — travellers × days (see dayGrid.ts).
// Desktop only for now (gui, 2026-11-22): past four guests a phone cannot hold it.
//
// Step 2 (same day): things are added and edited from the grid itself — click a
// day (or drag across several) for a menu, click an item to edit it. Every form
// is the one the Planning and the bill already use, so a lesson or a rental is
// priced and frozen exactly the same way wherever it is entered.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Booking, BookingCharge, EquipmentRental, Lesson } from '../../types/database'
import type { AccountingHandlers, SharedAccountingData } from './types'
import { buildDayGrid, GROUP_ROW, type GridChip, type GridKind, type GridRow } from './dayGrid'
import { daysBetweenInclusive, newLessonDraft, newRentalDraft, rentalsForDates, chargesForDates } from './gridDrafts'
import { fmtEur } from './utils'
import { rentalLabel, type RentalKind } from '../planning/rentalTypes'
import EditLessonModal from '../planning/EditLessonModal'
import EditRentalModal from '../planning/EditRentalModal'
import ExtraLineForm from './ExtraLineForm'
import Modal from '../common/Modal'
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

/** Cells picked with the mouse: one row, from `anchor` to `end` (either order). */
interface CellPick { rowId: string; anchor: string; end: string }
/** The menu, opened where the mouse was released. Fixed-positioned: the grid
 *  scrolls sideways, and an absolute menu would be clipped by it. */
interface CellMenu extends CellPick { x: number; y: number }

type ExtraPreset = Partial<Pick<BookingCharge, 'label' | 'unit_price' | 'participant_id' | 'category'>>
type Dialog =
  | { kind: 'lesson'; lesson: Lesson; isNew: boolean }
  | { kind: 'rental'; rental: EquipmentRental; dates: string[]; isNew: boolean }
  | { kind: 'extra'; initial?: BookingCharge; preset?: ExtraPreset; dates: string[] }

function Chip({ chip, agencyWord, onOpen }: { chip: GridChip; agencyWord: string; onOpen: (() => void) | null }) {
  const title = `${chip.label} · ${fmtEur(chip.amount)}${chip.covered ? ` · ${agencyWord}` : ''}`
  return (
    <span title={title}
      // Clicking an item edits it — it must not start a pick in the cell under it.
      onMouseDown={e => { if (onOpen) e.stopPropagation() }}
      onClick={onOpen ?? undefined}
      className={`block whitespace-nowrap rounded px-1 leading-5 text-[11px] font-medium ${CHIP_CLASS[chip.kind]} ${chip.covered ? 'border border-dashed border-indigo-400 dark:border-indigo-500 opacity-80' : ''} ${onOpen ? 'cursor-pointer hover:ring-1 hover:ring-blue-400' : ''}`}>
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

interface Props {
  booking: Booking
  data: SharedAccountingData
  handlers: AccountingHandlers
}

export default function BookingDayGrid({ booking, data, handlers }: Props) {
  const { lang } = useLanguage()
  const tr = i18n.accounting
  const [meals, setMeals] = useState(() => readLocal(MEALS_KEY) === '1')
  const toggleMeals = () => { setMeals(m => { writeLocal(MEALS_KEY, m ? '0' : '1'); return !m }) }
  const [drag, setDrag] = useState<CellPick | null>(null)
  const [menu, setMenu] = useState<CellMenu | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const grid = useMemo(
    () => buildDayGrid(booking, data, { mealsAndActivities: meals, groupName: tr.bf_grid_group[lang] }),
    [booking, data, meals, lang, tr],
  )

  // Releasing the mouse anywhere ends the pick and opens the menu there.
  useEffect(() => {
    if (!drag) return
    const up = (e: MouseEvent) => { setMenu({ ...drag, x: e.clientX, y: e.clientY }); setDrag(null) }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [drag])
  // A click elsewhere, Esc, or scrolling the page closes the menu.
  useEffect(() => {
    if (!menu) return
    const down = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(null) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null) }
    const close = () => setMenu(null)
    window.addEventListener('mousedown', down)
    window.addEventListener('keydown', key)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('mousedown', down)
      window.removeEventListener('keydown', key)
      window.removeEventListener('scroll', close, true)
    }
  }, [menu])

  const today = todayISO()
  const doubles = new Set(grid.warnings.flatMap(w => w.kind === 'rental_and_center_access' ? [`${w.rowId}|${w.date}`] : []))
  const nameOf = (id: string) => grid.rows.find(r => r.id === id)?.name ?? id
  const dayUnit = tr.bf_grid_day_unit[lang]
  const weekday = (d: string) => fromISODate(d).toLocaleDateString(localeTag(lang), { weekday: 'short' })
  const parts = data.bookingParticipants.filter(p => p.booking_id === booking.id)

  const picked = drag ?? menu
  const inPick = (rowId: string, d: string) => {
    if (!picked || picked.rowId !== rowId) return false
    const [a, z] = picked.anchor <= picked.end ? [picked.anchor, picked.end] : [picked.end, picked.anchor]
    return d >= a && d <= z
  }
  const menuDays = menu ? daysBetweenInclusive(menu.anchor, menu.end) : []

  /** What clicking an item opens, or null when it is not edited from here. */
  function opener(chip: GridChip): (() => void) | null {
    if (chip.kind === 'lesson') {
      const l = data.lessons.find(x => x.id === chip.sourceId)
      // A group lesson owned by another booking is edited there (as on the bill).
      if (!l || l.booking_id !== booking.id) return null
      return () => setDialog({ kind: 'lesson', lesson: l, isNew: false })
    }
    if (chip.kind === 'rental') {
      const r = data.equipmentRentals.find(x => x.id === chip.sourceId)
      return r ? () => setDialog({ kind: 'rental', rental: r, dates: [r.date], isNew: false }) : null
    }
    if (chip.kind === 'extra') {
      const c = (data.bookingCharges ?? []).find(x => x.id === chip.sourceId)
      return c ? () => setDialog({ kind: 'extra', initial: c, dates: [c.date] }) : null
    }
    return null
  }

  function add(kind: 'lesson' | 'rental' | 'center_access' | 'extra') {
    if (!menu) return
    const dates = menuDays
    const pid = menu.rowId === GROUP_ROW ? null : menu.rowId
    setMenu(null)
    if (kind === 'lesson') {
      setDialog({ kind: 'lesson', isNew: true, lesson: newLessonDraft(booking, menu.rowId, dates[0], data.instructors, data.lessons) })
    } else if (kind === 'rental') {
      setDialog({ kind: 'rental', isNew: true, dates, rental: newRentalDraft(booking, menu.rowId, dates[0], data.priceItems) })
    } else if (kind === 'center_access') {
      // The agreed way to add a day of it (gui): an extra, read "C+" by the grid.
      setDialog({ kind: 'extra', dates, preset: { label: 'Center access', unit_price: booking.center_access_rate ?? 0, participant_id: pid, category: 'other' } })
    } else {
      setDialog({ kind: 'extra', dates, preset: { participant_id: pid } })
    }
  }

  const rangeTitle = (base: string, dates: string[]) =>
    dates.length > 1
      ? `${base} · ${tr.bf_grid_days_range[lang].replace('{count}', String(dates.length)).replace('{from}', fmtDate(dates[0])).replace('{to}', fmtDate(dates[dates.length - 1]))}`
      : `${base} · ${fmtDate(dates[0])}`

  if (grid.dates.length === 0 || grid.rows.length === 0) return null

  const menuItem = 'block w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800'
  const times = menuDays.length > 1 ? ` × ${menuDays.length}` : ''

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
        <table className="text-xs border-collapse select-none">
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
                      onMouseDown={e => {
                        if (e.button !== 0) return
                        e.preventDefault()
                        setMenu(null)
                        setDrag({ rowId: row.id, anchor: d, end: d })
                      }}
                      onMouseEnter={() => { if (drag && drag.rowId === row.id) setDrag({ ...drag, end: d }) }}
                      className={`px-0.5 py-0.5 cursor-cell hover:bg-gray-50 dark:hover:bg-gray-800/60 ${d === today ? 'bg-blue-50/60 dark:bg-blue-950/30' : ''} ${isDouble ? 'bg-red-100 dark:bg-red-900/40 ring-1 ring-inset ring-red-400' : ''} ${inPick(row.id, d) ? '!bg-blue-200/70 dark:!bg-blue-800/50' : ''}`}>
                      <div className="flex flex-col gap-0.5 items-stretch min-h-[1.25rem]">
                        {cell.map((c, i) => <Chip key={`${c.sourceId}-${i}`} chip={c} agencyWord={tr.bf_grid_agency[lang]} onOpen={opener(c)} />)}
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
      <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">{tr.bf_grid_hint[lang]}</p>
      <p className="text-[11px] text-gray-400 dark:text-gray-500">{tr.bf_grid_legend[lang]}</p>

      {menu && (
        <div ref={menuRef} style={{ left: menu.x + 4, top: menu.y + 4 }}
          className="fixed z-50 w-44 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1 text-xs text-gray-700 dark:text-gray-300">
          <p className="px-3 pt-1 pb-1.5 text-[11px] text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
            {nameOf(menu.rowId)} · {menuDays.length > 1 ? `${fmtDate(menuDays[0])} → ${fmtDate(menuDays[menuDays.length - 1])}` : fmtDate(menuDays[0])}
          </p>
          {menuDays.length === 1 && (
            <button type="button" onClick={() => add('lesson')} className={menuItem}>🏄 {tr.bf_grid_add_lesson[lang]}</button>
          )}
          <button type="button" onClick={() => add('rental')} className={menuItem}>🎿 {tr.bf_grid_add_rental[lang]}{times}</button>
          <button type="button" onClick={() => add('center_access')} className={menuItem}>🏖️ {tr.bf_grid_add_ca[lang]}{times}</button>
          <button type="button" onClick={() => add('extra')} className={menuItem}>➕ {tr.bf_grid_add_extra[lang]}{times}</button>
        </div>
      )}

      {dialog?.kind === 'lesson' && (
        <EditLessonModal
          lesson={dialog.lesson}
          isNew={dialog.isNew}
          title={dialog.isNew ? rangeTitle(tr.bf_grid_new_lesson[lang], [dialog.lesson.date]) : undefined}
          lessons={data.lessons} instructors={data.instructors} equipment={data.equipment}
          bookings={data.bookings} bookingParticipants={data.bookingParticipants} clients={data.clients}
          priceItems={data.priceItems} priceTiers={data.priceTiers}
          onSave={l => { if (dialog.isNew) handlers.addLesson(l); else handlers.updateLesson(l); setDialog(null) }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'rental' && (
        <EditRentalModal
          rental={dialog.rental}
          title={dialog.isNew ? rangeTitle(tr.bf_grid_new_rental[lang], dialog.dates) : undefined}
          equipment={data.equipment} bookings={data.bookings} bookingParticipants={data.bookingParticipants}
          clients={data.clients} priceItems={data.priceItems}
          onSave={r => {
            if (dialog.isNew) handlers.addRentals(rentalsForDates(r, dialog.dates))
            else handlers.updateRental(r)
            setDialog(null)
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'extra' && (
        <Modal onClose={() => setDialog(null)} label={dialog.initial ? tr.bf_grid_edit_extra[lang] : tr.bf_grid_new_extra[lang]}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md p-4">
            <h3 className="font-bold text-gray-800 dark:text-gray-200">
              {dialog.initial ? tr.bf_grid_edit_extra[lang] : rangeTitle(tr.bf_grid_new_extra[lang], dialog.dates)}
            </h3>
            <ExtraLineForm
              bookingId={booking.id}
              initial={dialog.initial}
              preset={dialog.preset}
              dates={dialog.dates}
              defaultDate={dialog.dates[0]}
              participants={parts}
              onSave={c => {
                if (dialog.initial) handlers.updateBookingCharge(c)
                // One day: the form's own date (it may have been changed there).
                else handlers.addBookingCharges(dialog.dates.length > 1 ? chargesForDates(c, dialog.dates) : [c])
                setDialog(null)
              }}
              onCancel={() => setDialog(null)}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
