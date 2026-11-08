import type { TaxiTrip, TaxiTripType } from '../types/database'

// A booking and its taxi transfers each keep their own time and bag counts:
// BookingsPage copies the booking's values into the trips when it creates them,
// then nothing ties them together. When the booking panel of the Taxis page
// changes the booking, this says which trips still carry the old values, so the
// panel can PROPOSE to update them (gui, 2026-11-08) — never silently.

/** The booking time a trip follows — the pairing BookingsPage uses when it
 *  creates the transfers. Maputo legs and "other" follow no flight. */
const FOLLOWS: Partial<Record<TaxiTripType, 'arrival_time' | 'departure_time'>> = {
  'aero-to-center': 'arrival_time',
  'center-to-aero': 'departure_time',
}

export interface BookingTransferFields {
  arrival_time: string | null
  departure_time: string | null
  luggage_count: number
  boardbag_count: number
}

export interface TripProposal {
  tripId: string
  start_time?: string
  nb_luggage?: number
  nb_boardbags?: number
}

function toMinutes(hhmm: string | null): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

function fromMinutes(min: number): string {
  const m = ((min % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** Where a trip should go when its booking's flight time moves: by the same
 *  amount, so a departure taxi keeps leaving the same while before the flight.
 *  With nothing to measure from (no old time, or the trip still on the 00:00
 *  placeholder of a booking saved without a time), onto the new time itself. */
export function suggestTripTime(tripTime: string, oldTime: string | null, newTime: string | null): string {
  const n = toMinutes(newTime)
  if (n === null) return tripTime
  const t = toMinutes(tripTime)
  const o = toMinutes(oldTime)
  if (t === null || o === null || tripTime === '00:00') return fromMinutes(n)
  return fromMinutes(t + n - o)
}

/** The trips that still show what the booking said before `after` was saved.
 *  A paid trip ("done") is history: it is never proposed. */
export function tripSyncProposals(trips: TaxiTrip[], before: BookingTransferFields, after: BookingTransferFields): TripProposal[] {
  return trips.flatMap(trip => {
    const field = FOLLOWS[trip.type]
    if (!field || trip.status === 'done') return []
    const p: TripProposal = { tripId: trip.id }
    const oldTime = before[field] || null
    const newTime = after[field] || null
    // A trip already on the new time was moved by hand first: shifting it by
    // the difference again would push it past the flight.
    if (newTime && newTime !== oldTime && trip.start_time !== newTime) {
      const s = suggestTripTime(trip.start_time, oldTime, newTime)
      if (s !== trip.start_time) p.start_time = s
    }
    if (after.luggage_count !== before.luggage_count && trip.nb_luggage !== after.luggage_count) p.nb_luggage = after.luggage_count
    if (after.boardbag_count !== before.boardbag_count && trip.nb_boardbags !== after.boardbag_count) p.nb_boardbags = after.boardbag_count
    return Object.keys(p).length > 1 ? [p] : []
  })
}
