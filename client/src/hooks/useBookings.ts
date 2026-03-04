import { useTable } from './useSupabase'
import type { Booking, BookingRoom, BookingRoomPrice, Payment } from '../types/database'

export function useBookings() {
  return useTable<Booking>('bookings', { order: 'check_in', ascending: false })
}

export function useBookingRooms() {
  return useTable<BookingRoom>('booking_rooms')
}

export function useBookingRoomPrices() {
  return useTable<BookingRoomPrice>('booking_room_prices')
}

export function usePayments() {
  return useTable<Payment>('payments', { order: 'date', ascending: false })
}
