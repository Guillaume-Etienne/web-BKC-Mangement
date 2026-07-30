import type { SharedAccountingData } from './types'
import type { PalmeirasRent, PalmeirasReversal, PalmeirasEntry } from '../../types/database'
import { countNights } from './utils'

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
    const costRate = acc?.cost_per_night ?? 0
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
      margin: (sellRate - costRate) * nights,
      month:  booking.check_in.slice(0, 7),
    })
  }
  return rows
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
  const reversalsNet   = reversals.reduce((s, r) => s + r.net_amount, 0)
  const grossReversals = reversals.reduce((s, r) => s + r.gross_amount, 0)
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
