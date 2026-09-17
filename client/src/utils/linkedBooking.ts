import type { Booking } from '../types/database'

/** A booking linked to this one, in either direction: the one it points to
 *  (it joined that stay) or the ones pointing to it (they joined its stay).
 *  Star topology (see `bookings.linked_booking_id`) — a booking can be the
 *  target of several joiners, so this can return more than one entry. */
export function getLinkedBookings(booking: Booking, allBookings: Booking[]): Booking[] {
  const linked: Booking[] = []
  if (booking.linked_booking_id) {
    const target = allBookings.find(b => b.id === booking.linked_booking_id)
    if (target) linked.push(target)
  }
  for (const b of allBookings) {
    if (b.id !== booking.id && b.linked_booking_id === booking.id) linked.push(b)
  }
  return linked
}

function ref(b: Booking): string {
  return `#${String(b.booking_number).padStart(3, '0')}`
}

/** "🔗 #044" / "🔗 #044, #046", or null when this booking isn't part of a
 *  linked stay — the small badge shown next to a booking number everywhere
 *  it already appears (BookingsPage, PlanningView, ClientTimeline, Home). */
export function linkedBookingBadge(booking: Booking, allBookings: Booking[]): string | null {
  const linked = getLinkedBookings(booking, allBookings)
  if (linked.length === 0) return null
  return `🔗 ${linked.map(ref).join(', ')}`
}
