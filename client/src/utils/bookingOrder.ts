import type { AccommodationType, ActivityProvider, Booking, TaxiTripType } from '../types/database'
import type { SharedAccountingData } from '../components/accounting/types'
import {
  chargeAmount, countNights, emptyAccountingData, getRoomNightlyRate,
  isAgencyBilled, isRoomAgencyBilled, isRoomPaidToOwner,
} from '../components/accounting/utils'
import { dossierMoney } from './dossier'

// What a guest has ORDERED on a booking, line by line, with what each costs and
// who settles it — the "Your order" block of the booking confirmation (PDF and
// email, gui 2026-11-08).
//
// The confirmation used to state the amount paid and nothing else (2026-08-02):
// the total then was a hand-typed estimate built on prices that still moved, and
// a client reads a figure on a confirmation as a quote. Every line here is a
// firm price instead — the room's frozen nightly rate, each taxi's own price,
// the frozen center-access rate, the extras as typed — so the total is a sum of
// facts. What is decided on site (lessons, rentals, meals) is left out on
// purpose and the document says so; a package sold in advance is entered as an
// extra (gui, 2026-11-08) and therefore appears.
//
// Each line names who settles it: us (counted in the total), the partner agency
// ("included via Fun & Fly", no price — the agency pays it), the bungalow's
// owner, or an activity provider paid directly. Only the first kind is money the
// guest owes BKC, the same split every accounting total makes.

export type OrderSettledBy =
  | { kind: 'us' }
  | { kind: 'agency'; name: string }
  | { kind: 'owner' }
  | { kind: 'provider'; name: string }

export type OrderItem =
  | { kind: 'room'; accommodationType: AccommodationType; accommodationName: string; roomName: string; nights: number; nightlyRate: number }
  | { kind: 'external_stay'; accommodationName: string; roomNames: string[]; checkIn: string; checkOut: string; nights: number }
  | { kind: 'taxi'; tripType: TaxiTripType; date: string; time: string; persons: number; luggage: number; boardbags: number }
  | { kind: 'activity'; label: string; date: string; endDate: string | null; persons: number }
  | { kind: 'center_access'; persons: number; days: number; rate: number }
  | { kind: 'extra'; label: string; date: string; quantity: number; unitPrice: number }
  | { kind: 'agency_service'; label: string; hours: number | null; travelerName: string | null }

export interface OrderLine {
  item: OrderItem
  /** What the guest owes BKC for it — null when someone else settles it. */
  amount: number | null
  settledBy: OrderSettledBy
}

export interface BookingOrder {
  lines: OrderLine[]
  /** Σ of the lines the guest owes BKC. */
  total: number
  /** Discounts recorded on the booking (`payments.is_discount`). */
  discounts: number
  /** Verified money received — what the confirmation always called "paid". */
  paid: number
  /** Money entered but not reconciled yet: NOT counted as paid, shown to the admin. */
  unverified: number
  /** total − discounts − paid, never below 0: what is paid beyond the order
   *  (lessons, meals already settled) is not a debt of BKC's to announce here. */
  remaining: number
}

export type BookingOrderData = Pick<SharedAccountingData,
  | 'accommodations' | 'rooms' | 'bookingRooms' | 'bookingRoomPrices' | 'roomRates'
  | 'externalAccommodationBkgs' | 'taxiTrips' | 'activityBookings' | 'bookingCharges'
  | 'agencies' | 'agencyBillingLines' | 'agencyRateItems' | 'bookingParticipants' | 'payments'>

const cents = (n: number) => Math.round(n * 100) / 100

export function buildBookingOrder(booking: Booking, input: BookingOrderData, providers: ActivityProvider[]): BookingOrder {
  // The accounting helpers take a full dataset; the slices they read are here.
  const data: SharedAccountingData = { ...emptyAccountingData(), ...input }
  const nights = countNights(booking.check_in, booking.check_out)

  const agencyNameOfLine = (lineId: string | null | undefined): string => {
    const line = data.agencyBillingLines.find(l => l.id === lineId)
    const agencyId = line?.agency_id ?? booking.agency_id
    return data.agencies.find(a => a.id === agencyId)?.name ?? '—'
  }

  const rooms: OrderLine[] = []
  const stays: OrderLine[] = []

  // ── Accommodation ──
  // A room in an accommodation priced per stay (San Martinho: `external_billing`)
  // carries no nightly rate: its price lives on the external stay, listed below.
  const bookedRooms = data.bookingRooms.filter(br => br.booking_id === booking.id)
  for (const br of bookedRooms) {
    const room = data.rooms.find(r => r.id === br.room_id)
    const acc  = room ? data.accommodations.find(a => a.id === room.accommodation_id) : undefined
    if (!room || !acc || acc.external_billing) continue
    const nightlyRate = getRoomNightlyRate(booking.id, br.room_id, data)
    const item: OrderItem = { kind: 'room', accommodationType: acc.type, accommodationName: acc.name, roomName: room.name, nights, nightlyRate }
    if (isRoomAgencyBilled(booking.id, br.room_id, data)) {
      const snap = data.bookingRoomPrices.find(p => p.booking_id === booking.id && p.room_id === br.room_id)
      rooms.push({ item, amount: null, settledBy: { kind: 'agency', name: agencyNameOfLine(snap?.agency_billing_line_id) } })
    } else if (isRoomPaidToOwner(booking.id, br.room_id, data)) {
      rooms.push({ item, amount: null, settledBy: { kind: 'owner' } })
    } else {
      rooms.push({ item, amount: cents(nightlyRate * nights), settledBy: { kind: 'us' } })
    }
  }
  rooms.sort((a, b) => roomKey(a).localeCompare(roomKey(b), undefined, { numeric: true }))

  for (const e of data.externalAccommodationBkgs.filter(x => x.booking_id === booking.id)) {
    const acc = data.accommodations.find(a => a.id === e.accommodation_id)
    const roomNames = bookedRooms
      .map(br => data.rooms.find(r => r.id === br.room_id))
      .filter(r => r?.accommodation_id === e.accommodation_id)
      .map(r => r!.name)
    stays.push({
      item: { kind: 'external_stay', accommodationName: acc?.name ?? '—', roomNames, checkIn: e.check_in, checkOut: e.check_out, nights: countNights(e.check_in, e.check_out) },
      amount: cents(e.total_sell_price),
      settledBy: { kind: 'us' },
    })
  }
  // A room booked there with no stay entered yet (#026, seen 2026-11-08): the
  // client still sleeps somewhere, so the line stays, at 0 € — which the check
  // under "Generate PDF" reports as a price not entered.
  const staysAt = new Set(data.externalAccommodationBkgs.filter(x => x.booking_id === booking.id).map(x => x.accommodation_id))
  const unpricedStays = new Map<string, string[]>()
  for (const br of bookedRooms) {
    const room = data.rooms.find(r => r.id === br.room_id)
    const acc  = room ? data.accommodations.find(a => a.id === room.accommodation_id) : undefined
    if (!room || !acc?.external_billing || staysAt.has(acc.id)) continue
    unpricedStays.set(acc.id, [...(unpricedStays.get(acc.id) ?? []), room.name])
  }
  for (const [accId, roomNames] of unpricedStays) {
    stays.push({
      item: { kind: 'external_stay', accommodationName: data.accommodations.find(a => a.id === accId)?.name ?? '—', roomNames, checkIn: booking.check_in, checkOut: booking.check_out, nights },
      amount: 0,
      settledBy: { kind: 'us' },
    })
  }

  // ── Transfers: the real trips, with their own time and price ──
  const taxis: OrderLine[] = data.taxiTrips
    .filter(t => t.booking_id === booking.id)
    .sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`))
    .map(t => ({
      item: { kind: 'taxi', tripType: t.type, date: t.date, time: t.start_time, persons: t.nb_persons, luggage: t.nb_luggage, boardbags: t.nb_boardbags },
      amount: isAgencyBilled(t) ? null : cents(t.price_eur),
      settledBy: isAgencyBilled(t) ? { kind: 'agency', name: agencyNameOfLine(t.agency_billing_line_id) } : { kind: 'us' },
    }))

  // ── Activities: billed by us, or paid to the provider on the spot ──
  const activities: OrderLine[] = data.activityBookings
    .filter(a => a.booking_id === booking.id)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(a => {
      const item: OrderItem = { kind: 'activity', label: a.label, date: a.date, endDate: a.end_date ?? null, persons: a.nb_persons }
      return a.payment_flow === 'we_pay_provider'
        ? { item, amount: cents(a.price_client), settledBy: { kind: 'us' } }
        : { item, amount: null, settledBy: { kind: 'provider', name: providers.find(p => p.id === a.provider_id)?.name ?? '—' } }
    })

  // ── Center access (own gear), at the rate frozen on the booking ──
  const centerAccess: OrderLine[] = booking.num_center_access > 0 && nights > 0
    ? [{
        item: { kind: 'center_access', persons: booking.num_center_access, days: nights, rate: booking.center_access_rate ?? 0 },
        amount: cents(booking.num_center_access * nights * (booking.center_access_rate ?? 0)),
        settledBy: { kind: 'us' },
      }]
    : []

  // ── Extras, packages sold in advance included ──
  const extras: OrderLine[] = (data.bookingCharges ?? [])
    .filter(c => c.booking_id === booking.id)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(c => ({
      item: { kind: 'extra', label: c.label, date: c.date, quantity: c.quantity, unitPrice: c.unit_price },
      amount: chargeAmount(c),
      settledBy: { kind: 'us' },
    }))

  // ── What the agency sold that no line above already shows ──
  // A trip or a room on an agency line is listed above as itself; the lines
  // nobody points at — lesson packages, storage, a transfer not yet booked —
  // are listed by their name on the agency's rate card.
  const shownLineIds = new Set<string>([
    ...data.taxiTrips.filter(t => t.booking_id === booking.id).map(t => t.agency_billing_line_id),
    ...data.bookingRoomPrices.filter(p => p.booking_id === booking.id).map(p => p.agency_billing_line_id),
  ].filter((id): id is string => !!id))
  const agencyServices: OrderLine[] = data.agencyBillingLines
    .filter(l => l.booking_id === booking.id && !shownLineIds.has(l.id))
    .map(l => {
      const rateItem = data.agencyRateItems.find(r => r.id === l.agency_rate_item_id)
      const traveler = data.bookingParticipants.find(p => p.id === l.participant_id)
      return {
        item: { kind: 'agency_service', label: rateItem?.label ?? '—', hours: l.unit_hours, travelerName: traveler?.first_name ?? null },
        amount: null,
        settledBy: { kind: 'agency', name: agencyNameOfLine(l.id) },
      }
    })

  const lines = [...rooms, ...stays, ...taxis, ...activities, ...centerAccess, ...extras, ...agencyServices]
  const total = cents(lines.reduce((s, l) => s + (l.settledBy.kind === 'us' ? l.amount ?? 0 : 0), 0))
  const money = dossierMoney(data.payments.filter(p => p.booking_id === booking.id))
  return {
    lines,
    total,
    discounts: cents(money.discounts),
    paid: cents(money.paid),
    unverified: cents(money.unverified),
    remaining: Math.max(0, cents(total - money.discounts - money.paid)),
  }
}

function roomKey(l: OrderLine): string {
  return l.item.kind === 'room' ? `${l.item.accommodationName} ${l.item.roomName}` : ''
}

/** Lines the guest owes BKC at 0 € — almost always a price nobody entered yet.
 *  The Documents page warns about them before the confirmation goes out. */
export function zeroPricedLines(order: BookingOrder): OrderLine[] {
  return order.lines.filter(l => l.settledBy.kind === 'us' && l.amount === 0)
}
