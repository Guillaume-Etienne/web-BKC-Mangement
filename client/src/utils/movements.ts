/** Home → "Tomorrow" and "This week": who arrives, who leaves, which taxis run.
 *
 *  Pure on purpose: it works on the rows `App.tsx` already loads for the pending
 *  actions (bookings with their client + a light taxi_trips read), so the Home
 *  page gets this for the price of two extra columns, not a new round trip. */
import type { Booking, TaxiTrip } from '../types/database'
import { addDaysISO, type ISODate } from './dates'

export type MovementTaxi = Pick<TaxiTrip,
  'id' | 'date' | 'start_time' | 'type' | 'status' | 'taxi_driver_id' | 'booking_id' | 'nb_persons'>

export interface BookingMove {
  bookingId: string
  number: number
  name: string
  /** Planned time, HH:MM, when the booking has one. */
  time: string | null
  provisional: boolean
}

export interface TaxiMove {
  id: string
  time: string
  direction: 'arrival' | 'departure' | 'other'
  /** Booking's client when the trip is linked, else null. */
  name: string | null
  persons: number
  /** Nobody is assigned yet — the one thing worth turning red. */
  noDriver: boolean
}

export interface DayMovements {
  date: ISODate
  arrivals: BookingMove[]
  departures: BookingMove[]
  taxis: TaxiMove[]
}

const ARRIVAL_TYPES = new Set(['aero-to-center', 'aero-to-spot', 'town-to-center'])
const DEPARTURE_TYPES = new Set(['center-to-aero', 'spot-to-aero', 'center-to-town'])

function clientName(b: Booking | undefined): string | null {
  const c = b?.client
  if (!c) return null
  const full = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()
  return full || null
}

const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : null)

/** Movements for `days` consecutive calendar days starting at `from` (inclusive).
 *  Cancelled bookings and day visitors (no stay to arrive for) are left out;
 *  provisional ones stay, flagged, because the person may well turn up. */
export function computeMovements(
  input: { bookings: Booking[]; taxis: MovementTaxi[] },
  from: ISODate,
  days: number,
): DayMovements[] {
  const stays = input.bookings.filter(b => b.status !== 'cancelled' && b.kind !== 'day_visitor')
  const byId = new Map(input.bookings.map(b => [b.id, b]))

  const result: DayMovements[] = []
  for (let i = 0; i < days; i++) {
    const date = addDaysISO(from, i)
    const toMove = (b: Booking, time: string | null): BookingMove => ({
      bookingId: b.id,
      number: b.booking_number,
      name: clientName(b) ?? `#${b.booking_number}`,
      time: hhmm(time),
      provisional: b.status === 'provisional',
    })
    const byTime = (a: { time: string | null }, b: { time: string | null }) =>
      (a.time ?? '99:99').localeCompare(b.time ?? '99:99')

    const arrivals = stays.filter(b => b.check_in === date).map(b => toMove(b, b.arrival_time)).sort(byTime)
    const departures = stays.filter(b => b.check_out === date).map(b => toMove(b, b.departure_time)).sort(byTime)
    const taxis = input.taxis
      .filter(t => t.date === date)
      .map((t): TaxiMove => ({
        id: t.id,
        time: hhmm(t.start_time) ?? '',
        direction: ARRIVAL_TYPES.has(t.type) ? 'arrival' : DEPARTURE_TYPES.has(t.type) ? 'departure' : 'other',
        name: clientName(t.booking_id ? byId.get(t.booking_id) : undefined),
        persons: t.nb_persons,
        noDriver: !t.taxi_driver_id,
      }))
      .sort((a, b) => a.time.localeCompare(b.time))

    result.push({ date, arrivals, departures, taxis })
  }
  return result
}
