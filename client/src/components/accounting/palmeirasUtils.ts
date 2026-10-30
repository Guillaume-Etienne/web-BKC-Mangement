import type { SharedAccountingData } from './types'
import type { PalmeirasRent, PalmeirasReversal, PalmeirasEntry, PalmeirasSettlement } from '../../types/database'
import { countNights, isRoomPaidToOwner } from './utils'
import { PALMEIRAS_COMMISSION_PCT, type StatementInput, type StatementStay } from '../../utils/palmeirasStatement'

/** One bungalow stay, with the margin the centre makes by sub-letting it. */
export interface BungalowRow {
  bungalow: string
  bookingRef: string
  checkIn: string
  checkOut: string
  nights: number
  costRate: number   // €/night paid to the owner
  sellRate: number   // €/night billed to the client (booking snapshot)
  margin: number     // (sell − cost) × nights
  /** The guest paid Palmeiras directly: cost and margin are 0 — our commission
   *  on sellRate × nights is entered by hand as a Reversal. */
  paidToOwner: boolean
  month: string      // YYYY-MM, the booking check-in month
}

export interface PalmeirasTotals {
  rent: number
  reversals: number
  grossReversals: number
  bungalowMargin: number
  bungalowCount: number
  freeIncome: number
  freeExpenses: number
  net: number
}

/** Every bungalow stay, derived from the bookings assigned to bungalow rooms.
 *  Cancelled bookings are skipped. The sell rate comes from the booking price
 *  snapshot (0 if none was taken), the cost from the accommodation record. */
export function buildBungalowRows(data: SharedAccountingData): BungalowRow[] {
  const bungalows = data.accommodations.filter(a => a.type === 'bungalow')
  const bungalowRoomIds = new Set(
    data.rooms.filter(r => bungalows.some(b => b.id === r.accommodation_id)).map(r => r.id)
  )

  const rows: BungalowRow[] = []
  for (const br of data.bookingRooms) {
    if (!bungalowRoomIds.has(br.room_id)) continue
    const booking = data.bookings.find(b => b.id === br.booking_id)
    if (!booking || booking.status === 'cancelled') continue

    const room = data.rooms.find(r => r.id === br.room_id)
    const acc  = bungalows.find(b => b.id === room?.accommodation_id)
    const sellRate = data.bookingRoomPrices
      .find(p => p.booking_id === br.booking_id && p.room_id === br.room_id)?.price_per_night ?? 0
    const paidToOwner = isRoomPaidToOwner(br.booking_id, br.room_id, data)
    const costRate = paidToOwner ? 0 : acc?.cost_per_night ?? 0
    const nights = countNights(booking.check_in, booking.check_out)
    const client = data.clients.find(c => c.id === booking.client_id)

    rows.push({
      bungalow:   acc?.name ?? '?',
      bookingRef: client ? `${client.first_name} ${client.last_name}` : `#${booking.booking_number}`,
      checkIn:    booking.check_in,
      checkOut:   booking.check_out,
      nights,
      costRate,
      sellRate,
      margin: paidToOwner ? 0 : (sellRate - costRate) * nights,
      paidToOwner,
      month:  booking.check_in.slice(0, 7),
    })
  }
  return rows
}

export interface MonthCommission {
  gross: number      // what guests paid the Palmeiras directly that month
  percent: number
  net: number        // what the Palmeiras owes us for it
  /** A palmeiras_reversals row gave the actual figure (exchange-rate gap). */
  actual: boolean
}

/** Our commission on the bungalows paid to the Palmeiras, month by month:
 *  PALMEIRAS_COMMISSION_PCT of each stay, unless the month's actual figure was
 *  entered as a reversal, which then wins. Same rule as the statement. */
export function monthlyCommission(
  rows: BungalowRow[],
  reversals: PalmeirasReversal[],
): Record<string, MonthCommission> {
  const out: Record<string, MonthCommission> = {}
  for (const b of rows.filter(r => r.paidToOwner)) {
    const c = (out[b.month] ??= { gross: 0, percent: PALMEIRAS_COMMISSION_PCT, net: 0, actual: false })
    c.gross += b.sellRate * b.nights
    c.net   += Math.round(b.sellRate * b.nights * PALMEIRAS_COMMISSION_PCT) / 100
  }
  for (const r of reversals) {
    out[r.month] = { gross: r.gross_amount, percent: r.percent, net: r.net_amount, actual: true }
  }
  return out
}

/** The admin side of the statement: the same shape `palmeiras_statement()`
 *  returns to the share page, built from the accounting data, so both screens
 *  run the very same buildStatement. */
export function statementInputFromData(
  data: SharedAccountingData,
  settlements: PalmeirasSettlement[],
): StatementInput {
  const bungalows = data.accommodations.filter(a => a.type === 'bungalow')
  const guestOf = (bookingId: string | null) => {
    const booking = data.bookings.find(b => b.id === bookingId)
    const client  = data.clients.find(c => c.id === booking?.client_id)
    return { booking, guest: client ? `${client.first_name} ${client.last_name}`.trim() : '' }
  }

  const stays: StatementStay[] = []
  for (const br of data.bookingRooms) {
    const room = data.rooms.find(r => r.id === br.room_id)
    const acc  = bungalows.find(b => b.id === room?.accommodation_id)
    if (!acc) continue
    const { booking, guest } = guestOf(br.booking_id)
    if (!booking || booking.status === 'cancelled') continue
    const direct = isRoomPaidToOwner(br.booking_id, br.room_id, data)
    const price  = data.bookingRoomPrices
      .find(p => p.booking_id === br.booking_id && p.room_id === br.room_id)?.price_per_night ?? 0
    stays.push({
      booking_number: booking.booking_number, guest,
      provisional: booking.status === 'provisional',
      bungalow: acc.name, check_in: booking.check_in, check_out: booking.check_out,
      paid_direct: direct,
      price_per_night: direct ? price : null,
      cost_per_night:  direct ? null : acc.cost_per_night ?? 0,
    })
  }
  stays.sort((a, b) => a.check_in.localeCompare(b.check_in))

  return {
    eur_mzn_rate: data.eurMznRate,
    stays,
    rents: data.palmeirasRents.map(r => ({ month: r.month, amount: r.amount, amount_mzn: r.amount_mzn ?? null })),
    adjustments: data.palmeirasReversals.map(r => ({
      month: r.month, gross_amount: r.gross_amount, percent: r.percent, net_amount: r.net_amount,
    })),
    entries: data.palmeirasEntries.map(e => ({ month: e.month, type: e.type, description: e.description, amount: e.amount })),
    card_payments: data.payments
      .filter(p => p.method === 'card_palmeiras' && !p.is_discount)
      .map(p => {
        const { booking, guest } = guestOf(p.booking_id)
        return { booking_number: booking?.booking_number ?? null, guest, date: p.date, amount: p.amount }
      }),
    settlements: settlements.map(s => ({ id: s.id, date: s.date, direction: s.direction, amount: s.amount, method: s.method })),
  }
}

/** What the Palmeiras relationship yields over a period.
 *
 *  ⚠️ This `net` INCLUDES the bungalow margin, because the question this tab
 *  answers is "what does the partnership bring in?". The dashboard's Palmeiras
 *  KPI deliberately EXCLUDES it and is therefore a smaller number: there, the
 *  bungalow sell price already sits inside accommodation revenue and the cost is
 *  subtracted on its own line, so counting the margin again would double it.
 *  The two figures are both right for their own scope — do not "align" them.
 */
export function computePalmeirasTotals(
  rents: PalmeirasRent[],
  reversals: PalmeirasReversal[],
  entries: PalmeirasEntry[],
  bungalowRows: BungalowRow[],
): PalmeirasTotals {
  const rent           = rents.reduce((s, r) => s + r.amount, 0)
  const commission     = Object.values(monthlyCommission(bungalowRows, reversals))
  const reversalsNet   = commission.reduce((s, c) => s + c.net, 0)
  const grossReversals = commission.reduce((s, c) => s + c.gross, 0)
  const bungalowMargin = bungalowRows.reduce((s, b) => s + b.margin, 0)
  const freeIncome     = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0)
  const freeExpenses   = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0)

  return {
    rent,
    reversals: reversalsNet,
    grossReversals,
    bungalowMargin,
    bungalowCount: bungalowRows.length,
    freeIncome,
    freeExpenses,
    net: reversalsNet + bungalowMargin + freeIncome - rent - freeExpenses,
  }
}
