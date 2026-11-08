import { describe, it, expect } from 'vitest'
import { suggestTripTime, tripSyncProposals, type BookingTransferFields } from './taxiBookingSync'
import type { TaxiTrip } from '../types/database'

function mkTrip(over: Partial<TaxiTrip> = {}): TaxiTrip {
  return {
    id: 't1', date: '2026-11-12', start_time: '10:00', type: 'aero-to-center', status: 'confirmed',
    taxi_driver_id: null, booking_id: 'b1', nb_persons: 2, nb_luggage: 2, nb_boardbags: 1, notes: null,
    price_eur: 120, price_driver_mzn: 6500, margin_manager_mzn: 1000,
    ...over,
  }
}

const before: BookingTransferFields = { arrival_time: '10:00', departure_time: '14:00', luggage_count: 2, boardbag_count: 1 }

describe('suggestTripTime', () => {
  it('moves the trip by as much as the flight moved', () => {
    expect(suggestTripTime('10:00', '10:00', '11:30')).toBe('11:30')
    // departure taxi leaves 5h before the flight: it still does
    expect(suggestTripTime('09:00', '14:00', '16:00')).toBe('11:00')
  })
  it('takes the new time when there was nothing to measure from', () => {
    expect(suggestTripTime('10:00', null, '12:15')).toBe('12:15')
    expect(suggestTripTime('00:00', '10:00', '12:15')).toBe('12:15')
  })
  it('wraps around midnight', () => {
    expect(suggestTripTime('23:00', '10:00', '12:00')).toBe('01:00')
    expect(suggestTripTime('01:00', '12:00', '10:00')).toBe('23:00')
  })
  it('leaves the trip alone when the new time is cleared', () => {
    expect(suggestTripTime('10:00', '10:00', null)).toBe('10:00')
  })
})

describe('tripSyncProposals', () => {
  it('proposes the arrival trip when the arrival time changes, not the departure one', () => {
    const trips = [mkTrip(), mkTrip({ id: 't2', type: 'center-to-aero', start_time: '09:00' })]
    expect(tripSyncProposals(trips, before, { ...before, arrival_time: '11:30' }))
      .toEqual([{ tripId: 't1', start_time: '11:30' }])
  })
  it('proposes the bags on both legs when they change', () => {
    const trips = [mkTrip(), mkTrip({ id: 't2', type: 'center-to-aero', start_time: '09:00' })]
    expect(tripSyncProposals(trips, before, { ...before, luggage_count: 3 }))
      .toEqual([{ tripId: 't1', nb_luggage: 3 }, { tripId: 't2', nb_luggage: 3 }])
  })
  it('skips paid trips, Maputo legs, and trips already right', () => {
    const trips = [
      mkTrip({ status: 'done' }),
      mkTrip({ id: 't2', type: 'town-to-center' }),
      mkTrip({ id: 't3', start_time: '11:30', nb_luggage: 3 }),
    ]
    expect(tripSyncProposals(trips, before, { ...before, arrival_time: '11:30', luggage_count: 3 })).toEqual([])
  })
  it('proposes nothing when only the notes changed', () => {
    expect(tripSyncProposals([mkTrip()], before, { ...before })).toEqual([])
  })
})
