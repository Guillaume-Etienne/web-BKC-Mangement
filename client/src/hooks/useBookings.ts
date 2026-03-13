import { useTable } from './useSupabase'
import type { Booking, BookingParticipant, BookingRoom, BookingRoomPrice, Payment } from '../types/database'

export function useBookings() {
  return useTable<Booking>('bookings', { order: 'check_in', ascending: false, select: '*, client:clients(first_name, last_name)' })
}

export function useBookingParticipants() {
  return useTable<BookingParticipant>('booking_participants', { order: 'created_at', ascending: true })
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
