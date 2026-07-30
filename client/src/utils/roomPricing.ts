import type { Accommodation, Room, RoomRate } from '../types/database'

/** Flat nightly price of a whole house — Management → "Full house (€/night)",
 *  stored in room_rates with room_id = `full_{accommodation_id}`.
 *  It is a single price, NOT the sum of the two room rates. */
export function getFullHouseRate(accommodationId: string, roomRates: RoomRate[]): number | null {
  return roomRates.find(r => r.room_id === `full_${accommodationId}`)?.price_per_night ?? null
}

/** Base nightly rate for a room, used when a booking has no price snapshot
 *  (booking_room_prices). A house with ALL its rooms booked is one "full house"
 *  unit: its flat price is split evenly across the rooms, so summing the rooms
 *  gives back the house price. Any other case → the room's own base rate. */
export function getBaseNightlyRate(
  roomId: string,
  bookedRoomIds: string[],
  rooms: Room[],
  accommodations: Accommodation[],
  roomRates: RoomRate[]
): number {
  const room = rooms.find(r => r.id === roomId)
  const acc  = room ? accommodations.find(a => a.id === room.accommodation_id) : undefined
  if (acc?.type === 'house') {
    const houseRoomIds = rooms.filter(r => r.accommodation_id === acc.id).map(r => r.id)
    const isFullHouse  = houseRoomIds.length > 0 && houseRoomIds.every(id => bookedRoomIds.includes(id))
    if (isFullHouse) {
      const full = getFullHouseRate(acc.id, roomRates)
      if (full !== null) return full / houseRoomIds.length
    }
  }
  return roomRates.find(r => r.room_id === roomId)?.price_per_night ?? 0
}
