import { useTable } from './useSupabase'
import type {
  ActivityProvider, ActivityBooking, ActivityPayment,
  PartnerHotel, PartnerHotelStay, PartnerHotelPayment,
} from '../types/database'

export function useActivityProviders() {
  return useTable<ActivityProvider>('activity_providers', { order: 'name' })
}

export function useActivityBookings() {
  return useTable<ActivityBooking>('activity_bookings', { order: 'date', ascending: false })
}

export function useActivityPayments() {
  return useTable<ActivityPayment>('activity_payments', { order: 'date', ascending: false })
}

export function usePartnerHotels() {
  return useTable<PartnerHotel>('partner_hotels', { order: 'name' })
}

export function usePartnerHotelStays() {
  return useTable<PartnerHotelStay>('partner_hotel_stays', { order: 'check_in' })
}

export function usePartnerHotelPayments() {
  return useTable<PartnerHotelPayment>('partner_hotel_payments', { order: 'date', ascending: false })
}
