// ── Day by day grid of a booking (2026-11-22, asked by Teresa) ──────────────
//
// Travellers × days of the stay: who had a lesson, a rental, center access, an
// extra (and, behind a switch, a meal or an activity) on which day. It answers
// "was this guest counted as renting a board every day, or only some days?"
// without reading a list of dated lines.
//
// Read-only on purpose (step 1). Rules, decided with gui:
//   · center access stays the booking-level formula (num_center_access × nights
//     × rate): a "C" on every NIGHT of each "own gear" traveller, i.e. check-in
//     to the day before check-out — exactly the days that formula bills. A day
//     to add goes in as an extra, a day to remove as a discount;
//   · a line naming nobody of this booking goes to the "whole group" row — in a
//     booking of one it is simply that person's;
//   · amounts are what the BOOKING is charged, so a line covered by a partner
//     agency is shown at 0 and flagged `covered`.

import type { Booking, RentalSlot } from '../../types/database'
import { lessonDiscipline } from '../../types/database'
import type { SharedAccountingData } from './types'
import { isAgencyBilled, lessonsForBooking, getLessonClientRate, chargeAmount } from './utils'
import { rentalKind, rentalLabel, RENTAL_SLOT_LABEL, type RentalKind } from '../planning/rentalTypes'
import { rentalGearText, lessonGearText, inParens } from '../../utils/gearLabel'
import { addDaysISO } from '../../utils/dates'

/** Row id of the lines that name nobody of the booking. */
export const GROUP_ROW = '__group__'

export type GridKind = 'lesson' | 'rental' | 'center_access' | 'extra' | 'dining' | 'activity'

export interface GridChip {
  kind: GridKind
  /** What the cell prints: "L 2h", "B ½", "C", "+ Drinks". */
  short: string
  /** Full description for the tooltip, without the price. */
  label: string
  /** What the booking is charged for it, € — this traveller's share. 0 when covered. */
  amount: number
  /** Billed to a partner agency, not to the guest. */
  covered: boolean
  /** Lesson hours. */
  hours?: number
  /** Rental: what was rented, and 1 (full day) or 0.5 (half day). */
  rental?: { kind: RentalKind | null; days: number; slot: RentalSlot }
  /** Id of the source row (lesson, rental, charge, event, activity). */
  sourceId: string
}

export interface GridRowTotals {
  lessonHours: number
  /** Rental days per kind ('unknown' = rows from before the type was stored). */
  rentalDays: Partial<Record<RentalKind | 'unknown', number>>
  centerAccessDays: number
  amount: number
}

export interface GridRow {
  /** Participant id, or GROUP_ROW. */
  id: string
  name: string
  /** Rides (does_kite) — an empty past day is worth a glance for them only. */
  rides: boolean
  cells: Record<string, GridChip[]>
  totals: GridRowTotals
}

export type GridWarning =
  /** A kite (or full) rental and center access, same traveller, same day. */
  | { kind: 'rental_and_center_access'; rowId: string; date: string }
  /** Rentals / lessons naming nobody, in a booking of two or more. */
  | { kind: 'unassigned'; count: number }
  /** num_center_access (what is billed) ≠ travellers ticked "own gear". */
  | { kind: 'center_access_count'; billed: number; flagged: number }

export interface DayGrid {
  /** Every day shown, oldest first, no gap. */
  dates: string[]
  /** Nights of the stay (check-in … day before check-out). */
  stayDates: Set<string>
  rows: GridRow[]
  warnings: GridWarning[]
}

export interface DayGridOptions {
  /** Meals and activities (the switch). */
  mealsAndActivities: boolean
  /** Name of the whole-group row, and of the only row when nobody is listed. */
  groupName: string
}

const RENTAL_SHORT: Record<RentalKind, string> = {
  kite: 'K', board: 'B', full: 'F', surfboard: 'Surf', foilboard: 'Foil', free: 'Other',
}
/** Rentals that replace the rider's own gear: with center access the same day,
 *  the day is billed twice. A board alone next to one's own kite is plausible. */
const REPLACES_OWN_GEAR: ReadonlySet<RentalKind> = new Set(['kite', 'full'])

const round2 = (n: number) => Math.round(n * 100) / 100

export function buildDayGrid(b: Booking, data: SharedAccountingData, opts: DayGridOptions): DayGrid {
  const parts = data.bookingParticipants.filter(p => p.booking_id === b.id)
  const partIds = new Set(parts.map(p => p.id))
  const single = parts.length === 1 ? parts[0].id : null

  const rows = new Map<string, GridRow>()
  const newRow = (id: string, name: string, rides: boolean): GridRow =>
    ({ id, name, rides, cells: {}, totals: { lessonHours: 0, rentalDays: {}, centerAccessDays: 0, amount: 0 } })
  for (const p of parts) rows.set(p.id, newRow(p.id, `${p.first_name} ${p.last_name ?? ''}`.trim(), p.does_kite))
  const groupRow = () => {
    if (!rows.has(GROUP_ROW)) rows.set(GROUP_ROW, newRow(GROUP_ROW, opts.groupName, parts.length === 0))
    return rows.get(GROUP_ROW)!
  }
  /** Rows a line goes to: the named travellers of this booking, else the group (or the only traveller). */
  const targets = (named: readonly string[]): GridRow[] => {
    const ours = named.filter(id => partIds.has(id))
    if (ours.length > 0) return ours.map(id => rows.get(id)!)
    return [single ? rows.get(single)! : groupRow()]
  }
  let unassigned = 0
  const isUnassigned = (named: readonly string[]) => parts.length >= 2 && !named.some(id => partIds.has(id))

  const put = (row: GridRow, date: string, chip: GridChip) => {
    ;(row.cells[date] ??= []).push(chip)
    const t = row.totals
    t.amount = round2(t.amount + chip.amount)
    if (chip.hours) t.lessonHours += chip.hours
    if (chip.rental) {
      const k = chip.rental.kind ?? 'unknown'
      t.rentalDays[k] = (t.rentalDays[k] ?? 0) + chip.rental.days
    }
    if (chip.kind === 'center_access') t.centerAccessDays += 1
  }

  // Lessons — a group lesson is charged per head of this booking; any other is
  // charged once, shared by whoever of ours is on it.
  const tierCtx = { tiers: data.priceTiers, allLessons: data.lessons, bookingParticipants: data.bookingParticipants }
  const bookingOf = new Map(data.bookingParticipants.map(p => [p.id, p.booking_id]))
  for (const l of lessonsForBooking(b.id, data.lessons, data.bookingParticipants)) {
    const covered = isAgencyBilled(l)
    const unit = covered ? 0 : getLessonClientRate(l, data.priceItems, tierCtx) * l.duration_hours
    const named = l.participant_ids.filter(id => (bookingOf.get(id) ?? l.booking_id) === b.id)
    // A group lesson owned by another booking only concerns our riders on it.
    if (l.booking_id !== b.id && named.length === 0) continue
    if (isUnassigned(named)) unassigned++
    const instr = data.instructors.find(i => i.id === l.instructor_id)
    const letter = lessonDiscipline(l) !== 'kite' ? 'W' : l.type === 'supervision' ? 'S' : 'L'
    const to = targets(named)
    const share = l.type === 'group' ? unit : unit / to.length
    for (const row of to) {
      const pid = row.id === GROUP_ROW ? null : row.id
      put(row, l.date, {
        kind: 'lesson', short: `${letter} ${l.duration_hours}h`,
        label: `${lessonDiscipline(l) !== 'kite' ? 'Wing ' : ''}${l.type} lesson ${l.duration_hours}h · ${l.start_time.slice(0, 5)}${instr ? ` · ${instr.first_name}` : ''}${inParens(lessonGearText(l, pid, data.equipment))}`,
        amount: round2(share), covered, hours: l.duration_hours, sourceId: l.id,
      })
    }
  }

  // Rentals.
  for (const r of data.equipmentRentals.filter(x => x.booking_id === b.id)) {
    const covered = isAgencyBilled(r)
    const kind = rentalKind(r, data.equipment)
    const named = r.participant_id ? [r.participant_id] : []
    if (isUnassigned(named)) unassigned++
    const half = r.slot !== 'full_day'
    for (const row of targets(named)) {
      put(row, r.date, {
        kind: 'rental', short: `${kind ? RENTAL_SHORT[kind] : '?'}${half ? ' ½' : ''}`,
        label: `${rentalLabel(kind, 'staff')}${inParens(rentalGearText(r, data.equipment))} · ${RENTAL_SLOT_LABEL[r.slot]}`,
        amount: covered ? 0 : r.price, covered,
        rental: { kind, days: half ? 0.5 : 1, slot: r.slot }, sourceId: r.id,
      })
    }
  }

  // Center access — the booking-level formula, laid out on its nights.
  const stayDates = new Set<string>()
  for (let d = b.check_in; d < b.check_out; d = addDaysISO(d, 1)) stayDates.add(d)
  const rate = b.center_access_rate ?? 0
  const flagged = parts.filter(p => p.brings_own_gear)
  const billed = b.num_center_access ?? 0
  if (billed > 0) {
    const caRows = flagged.length > 0 ? flagged.map(p => rows.get(p.id)!) : [single ? rows.get(single)! : groupRow()]
    const each = flagged.length > 0 ? 1 : billed
    for (const row of caRows) {
      for (const d of stayDates) {
        put(row, d, {
          kind: 'center_access', short: each > 1 ? `C ×${each}` : 'C',
          label: each > 1 ? `Center access × ${each}` : 'Center access',
          amount: round2(rate * each), covered: false, sourceId: `ca:${d}`,
        })
      }
    }
  }

  // Extras — dated, "for whom" when set. An extra named "center access" is the
  // agreed way to add a day of it (gui): it reads "C+" and counts as one.
  for (const c of (data.bookingCharges ?? []).filter(x => x.booking_id === b.id)) {
    const named = c.participant_id ? [c.participant_id] : []
    const to = targets(named)
    const amount = chargeAmount(c)
    const isCenterAccess = /center\s*access/i.test(c.label)
    for (const row of to) {
      if (isCenterAccess) row.totals.centerAccessDays += c.quantity
      put(row, c.date, {
        kind: 'extra', short: isCenterAccess ? 'C+' : `+ ${c.label.length > 10 ? `${c.label.slice(0, 9)}…` : c.label}`,
        label: `${c.label}${c.quantity !== 1 ? ` × ${c.quantity}` : ''}`,
        amount: round2(amount / to.length), covered: false, sourceId: c.id,
      })
    }
  }

  if (opts.mealsAndActivities) {
    for (const ev of data.diningEvents) {
      for (const a of ev.attendees ?? []) {
        if (!a.is_attending || a.person_type !== 'participant' || !partIds.has(a.person_id)) continue
        put(rows.get(a.person_id)!, ev.date, {
          kind: 'dining', short: '🍽', label: ev.name || 'Meal',
          amount: a.price_override ?? ev.price_per_person, covered: false, sourceId: ev.id,
        })
      }
    }
    // Activities — every one of the booking; only "we pay the provider" is on
    // the bill, the others are shown at 0. A safari spans its days, charged on the first.
    for (const act of data.activityBookings.filter(x => x.booking_id === b.id)) {
      const billedHere = act.payment_flow === 'we_pay_provider'
      const to = targets(act.participant_ids)
      const last = act.end_date && act.end_date > act.date ? act.end_date : act.date
      for (let d = act.date; d <= last; d = addDaysISO(d, 1)) {
        for (const row of to) {
          put(row, d, {
            kind: 'activity', short: '🎯',
            label: `${act.label}${billedHere ? '' : ' (paid to the provider)'}`,
            amount: billedHere && d === act.date ? round2(act.price_client / to.length) : 0,
            covered: false, sourceId: act.id,
          })
        }
      }
    }
  }

  // Days: the whole stay (check-out day included — lessons happen on it), plus
  // any day a line sits on outside it.
  const all = new Set<string>()
  for (let d = b.check_in; d <= b.check_out; d = addDaysISO(d, 1)) all.add(d)
  for (const row of rows.values()) for (const d of Object.keys(row.cells)) all.add(d)
  const sorted = [...all].sort()
  const dates: string[] = []
  if (sorted.length > 0) {
    for (let d = sorted[0]; d <= sorted[sorted.length - 1]; d = addDaysISO(d, 1)) dates.push(d)
  }

  const warnings: GridWarning[] = []
  if (parts.length > 0 && billed !== flagged.length && (billed > 0 || flagged.length > 0)) {
    warnings.push({ kind: 'center_access_count', billed, flagged: flagged.length })
  }
  if (unassigned > 0) warnings.push({ kind: 'unassigned', count: unassigned })
  for (const row of rows.values()) {
    for (const d of dates) {
      const cell = row.cells[d] ?? []
      const rentsGear = cell.some(c => c.rental?.kind != null && REPLACES_OWN_GEAR.has(c.rental.kind) && !c.covered)
      if (rentsGear && cell.some(c => c.kind === 'center_access')) {
        warnings.push({ kind: 'rental_and_center_access', rowId: row.id, date: d })
      }
    }
  }

  // Travellers in booking order, the whole group last.
  const ordered = [...rows.values()].sort((x, y) => (x.id === GROUP_ROW ? 1 : 0) - (y.id === GROUP_ROW ? 1 : 0))
  return { dates, stayDates, rows: ordered, warnings }
}
