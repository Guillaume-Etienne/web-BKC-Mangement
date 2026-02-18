export type AccommodationType = 'house' | 'bungalow' | 'other'
export type BookingStatus = 'confirmed' | 'provisional' | 'cancelled'

export interface Accommodation {
  id: string
  name: string
  type: AccommodationType
  total_rooms: number
  is_active: boolean
}

export interface Room {
  id: string
  accommodation_id: string
  name: string
  capacity: number
}

export interface Client {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  notes: string | null
}

export interface Booking {
  id: string
  client_id: string
  check_in: string // date ISO
  check_out: string // date ISO
  status: BookingStatus
  notes: string | null
  num_lessons: number // nombre de cours
  num_equipment_rentals: number // nombre de locations de matériel
  client?: Client
}

export interface BookingRoom {
  booking_id: string
  room_id: string
}

// Type enrichi pour le planning
export interface RoomWithBookings extends Room {
  accommodation: Accommodation
  bookings: Booking[]
}
