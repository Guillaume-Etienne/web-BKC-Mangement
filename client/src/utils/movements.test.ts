import { describe, it, expect } from 'vitest'
import { computeMovements, type MovementTaxi } from './movements'
import type { Booking } from '../types/database'

function mkBooking(over: Partial<Booking> = {}): Booking {
  return {
    id: 'b1', booking_number: 23, client_id: 'c1',
    check_in: '2026-11-07', check_out: '2026-11-21', status: 'confirmed',
    arrival_time: null, departure_time: null,
    client: { first_name: 'Michel', last_name: 'Rulliat' },
    ...over,
  } as Booking
}

function mkTaxi(over: Partial<MovementTaxi> = {}): MovementTaxi {
  return {
    id: 't1', date: '2026-11-07', start_time: '14:00:00', type: 'aero-to-center',
    status: 'confirmed', taxi_driver_id: 'd1', booking_id: 'b1', nb_persons: 2,
    ...over,
  }
}

describe('computeMovements', () => {
  it('lists arrivals, departures and taxis on the right day', () => {
    const [d] = computeMovements({
      bookings: [mkBooking({ arrival_time: '13:30' }), mkBooking({ id: 'b2', booking_number: 24, check_in: '2026-11-01', check_out: '2026-11-07' })],
      taxis: [mkTaxi()],
    }, '2026-11-07', 1)
    expect(d.arrivals.map(a => a.number)).toEqual([23])
    expect(d.arrivals[0].time).toBe('13:30')
    expect(d.departures.map(a => a.number)).toEqual([24])
    expect(d.taxis[0]).toMatchObject({ time: '14:00', direction: 'arrival', name: 'Michel Rulliat', noDriver: false })
  })

  it('skips cancelled bookings and day visitors, keeps provisional flagged', () => {
    const [d] = computeMovements({
      bookings: [
        mkBooking({ id: 'x', status: 'cancelled' }),
        mkBooking({ id: 'y', kind: 'day_visitor' }),
        mkBooking({ id: 'z', booking_number: 30, status: 'provisional' }),
      ],
      taxis: [],
    }, '2026-11-07', 1)
    expect(d.arrivals).toHaveLength(1)
    expect(d.arrivals[0]).toMatchObject({ number: 30, provisional: true })
  })

  it('flags a taxi with no driver and tolerates an unlinked one', () => {
    const [d] = computeMovements({
      bookings: [],
      taxis: [mkTaxi({ taxi_driver_id: null, booking_id: null, type: 'center-to-aero' })],
    }, '2026-11-07', 1)
    expect(d.taxis[0]).toMatchObject({ noDriver: true, name: null, direction: 'departure' })
  })

  it('covers consecutive days, across a month end', () => {
    const days = computeMovements({ bookings: [], taxis: [] }, '2026-10-30', 4)
    expect(days.map(d => d.date)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
  })
})
