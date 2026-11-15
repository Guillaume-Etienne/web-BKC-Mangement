// Items of a booking's bill, priced exactly like `computeBookingTotal` — the
// accounting side of the per-person split (utils/perPersonSplit.ts). Every
// filter below mirrors the matching compute* function in ./utils, so the shares
// add up to the booking total; bookingSplit.test.ts holds that invariant.

import type { Booking } from '../../types/database'
import type { SharedAccountingData } from './types'
import {
  isAgencyBilled, isRoomAgencyBilled, isRoomPaidToOwner, getRoomNightlyRate, countNights,
  lessonsForBooking, getLessonClientRate, computeCenterAccessRevenue, chargeAmount,
} from './utils'
import { rentalKind, rentalLabel } from '../planning/rentalTypes'
import { lessonGearText, rentalGearText, inParens } from '../../utils/gearLabel'
import type { SplitItem } from '../../utils/perPersonSplit'

export interface SplitWords {
  lesson: string        // "lesson"
  rental: string        // "rental" (rental of an unknown kind)
  dining: string        // "dining" (an unnamed event)
  centerAccess: string  // "Center access"
}

export function bookingSplitItems(b: Booking, data: SharedAccountingData, words: SplitWords): SplitItem[] {
  const items: SplitItem[] = []
  const nights = countNights(b.check_in, b.check_out)
  const parts = data.bookingParticipants.filter(p => p.booking_id === b.id)

  // Own rooms — computeAccommodationRevenue: not the agency's, not paid to the owner.
  for (const br of data.bookingRooms.filter(x => x.booking_id === b.id)) {
    if (isRoomAgencyBilled(b.id, br.room_id, data) || isRoomPaidToOwner(b.id, br.room_id, data)) continue
    const amount = getRoomNightlyRate(b.id, br.room_id, data) * nights
    if (amount === 0) continue
    const room = data.rooms.find(r => r.id === br.room_id)
    const acc = room ? data.accommodations.find(a => a.id === room.accommodation_id) : undefined
    const name = acc ? `${acc.name}/${room?.name}` : (room?.name ?? br.room_id)
    items.push({ category: 'accommodation', date: null, label: `${name} × ${nights}N`, amount, beneficiaries: [] })
  }
  // External stays — a lump sum for the whole stay.
  for (const e of data.externalAccommodationBkgs.filter(x => x.booking_id === b.id)) {
    if (e.total_sell_price === 0) continue
    const acc = data.accommodations.find(a => a.id === e.accommodation_id)
    items.push({ category: 'accommodation', date: e.check_in, label: acc?.name ?? '—', amount: e.total_sell_price, beneficiaries: [] })
  }

  // Lessons — computeLessonsRevenue: a group lesson is billed per head sitting on
  // THIS booking (lessonHeadsFor), so each head is its own item; any other lesson
  // is the owner's, once, shared by whoever is listed on it.
  const tierCtx = { tiers: data.priceTiers, allLessons: data.lessons, bookingParticipants: data.bookingParticipants }
  const bookingOf = new Map(data.bookingParticipants.map(p => [p.id, p.booking_id]))
  for (const l of lessonsForBooking(b.id, data.lessons, data.bookingParticipants)) {
    if (isAgencyBilled(l)) continue
    const unit = getLessonClientRate(l, data.priceItems, tierCtx) * l.duration_hours
    const instr = data.instructors.find(i => i.id === l.instructor_id)
    const label = (pid: string | null) =>
      `${l.type} ${words.lesson} ${l.duration_hours}h${instr ? ` (${instr.first_name})` : ''}${inParens(lessonGearText(l, pid, data.equipment))}`
    if (l.type === 'group') {
      for (const pid of l.participant_ids.filter(id => (bookingOf.get(id) ?? l.booking_id) === b.id)) {
        items.push({ category: 'lessons', date: l.date, label: label(pid), amount: unit, beneficiaries: [pid] })
      }
    } else {
      items.push({ category: 'lessons', date: l.date, label: label(l.participant_ids[0] ?? null), amount: unit, beneficiaries: l.participant_ids })
    }
  }

  // Rentals — computeRentalsRevenue.
  for (const r of data.equipmentRentals.filter(x => x.booking_id === b.id && !isAgencyBilled(x))) {
    const kind = rentalKind(r, data.equipment)
    items.push({
      category: 'rentals', date: r.date,
      label: `${kind ? rentalLabel(kind, 'client') : words.rental}${inParens(rentalGearText(r, data.equipment))} · ${r.slot}`,
      amount: r.price, beneficiaries: r.participant_id ? [r.participant_id] : [],
    })
  }

  // Taxis — computeTaxiRevenue. No traveller ↔ trip link: shared equally.
  for (const t of data.taxiTrips.filter(x => x.booking_id === b.id && !isAgencyBilled(x))) {
    if (t.price_eur === 0) continue
    items.push({ category: 'taxis', date: t.date, label: `${t.type} · ${t.nb_persons}p`, amount: t.price_eur, beneficiaries: [] })
  }

  // Dining — computeDiningForBooking, one item per attendee.
  const partIds = new Set(parts.map(p => p.id))
  for (const ev of data.diningEvents) {
    for (const a of ev.attendees ?? []) {
      if (!a.is_attending || a.person_type !== 'participant' || !partIds.has(a.person_id)) continue
      const amount = a.price_override ?? ev.price_per_person
      if (amount === 0) continue
      items.push({ category: 'dining', date: ev.date, label: ev.name || words.dining, amount, beneficiaries: [a.person_id] })
    }
  }

  // Activities — computeActivityRevenueForBooking: the whole price_client.
  for (const a of data.activityBookings.filter(x => x.booking_id === b.id && x.payment_flow === 'we_pay_provider')) {
    items.push({ category: 'activities', date: a.date, label: a.label, amount: a.price_client, beneficiaries: a.participant_ids })
  }

  // Center access — computeCenterAccessRevenue, carried by the "own gear" travellers.
  const centerAccess = computeCenterAccessRevenue(b)
  if (centerAccess !== 0) {
    items.push({
      category: 'center_access', date: null, label: `${words.centerAccess} · ${nights}N`,
      amount: centerAccess, beneficiaries: parts.filter(p => p.brings_own_gear).map(p => p.id),
    })
  }

  // Extras — "for whom" when set, else everyone.
  for (const c of (data.bookingCharges ?? []).filter(x => x.booking_id === b.id)) {
    items.push({ category: 'extras', date: c.date, label: c.label, amount: chargeAmount(c), beneficiaries: c.participant_id ? [c.participant_id] : [] })
  }

  return items
}
