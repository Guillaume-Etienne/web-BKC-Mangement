import { useTable } from './useSupabase'
import type { ActivityProvider, ActivityBooking, ActivityPayment } from '../types/database'

export function useActivityProviders() {
  return useTable<ActivityProvider>('activity_providers', { order: 'name' })
}

export function useActivityBookings() {
  return useTable<ActivityBooking>('activity_bookings', { order: 'date', ascending: false })
}

export function useActivityPayments() {
  return useTable<ActivityPayment>('activity_payments', { order: 'date', ascending: false })
}
