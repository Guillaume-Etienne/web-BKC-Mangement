import { useTable } from './useSupabase'
import type { TaxiDriver, TaxiTrip } from '../types/database'

export function useTaxiDrivers() {
  return useTable<TaxiDriver>('taxi_drivers', { order: 'name' })
}

export function useTaxiTrips() {
  return useTable<TaxiTrip>('taxi_trips', { order: 'date', ascending: false })
}
