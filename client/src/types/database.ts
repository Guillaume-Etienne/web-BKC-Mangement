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
  nationality: string | null
  passport_number: string | null
  birth_date: string | null
  kite_level: 'beginner' | 'intermediate' | 'advanced' | null
}

export interface Participant {
  id: string
  first_name: string
  last_name: string
  passport_number: string
}

export interface Booking {
  id: string
  client_id: string
  check_in: string // date ISO
  check_out: string // date ISO
  status: BookingStatus
  notes: string | null
  num_lessons: number
  num_equipment_rentals: number
  client?: Client
  arrival_time: string | null
  departure_time: string | null
  luggage_count: number
  boardbag_count: number
  taxi_arrival: boolean
  taxi_departure: boolean
  couples_count: number
  children_count: number
  participants: Participant[]
  amount_paid: number
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

// Instructors & Lessons
export type LessonType = 'private' | 'group' | 'supervision'

export interface Instructor {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  specialties: string[]
  rate_private: number
  rate_group: number
  rate_supervision: number
  notes: string | null
}

export interface Lesson {
  id: string
  booking_id: string
  instructor_id: string
  client_id: string
  date: string
  start_time: string
  duration_hours: number
  type: LessonType
  notes: string | null
  kite_id: string | null
  board_id: string | null
  instructor?: Instructor
  client?: Client
}

// Pricing
export type DaySlot = 'morning' | 'afternoon' | 'evening'

export interface DayActivity {
  id: string
  date: string
  slot: DaySlot
  name: string
  notes: string | null
}

export type PriceCategory = 'lesson' | 'activity' | 'rental' | 'taxi'

export interface PriceItem {
  id: string
  category: PriceCategory
  name: string
  description: string | null
  price: number
  unit: string | null
}

// Taxis
export type TaxiTripType = 'aero-to-center' | 'center-to-aero' | 'aero-to-spot' | 'spot-to-aero' | 'center-to-town' | 'town-to-center' | 'other'

export interface TaxiDriver {
  id: string
  name: string
  phone: string | null
  email: string | null
  vehicle: string | null // marque/modèle
  notes: string | null
  margin_percent: number // % marge du driver (ex: 30 pour 30%)
}

export interface TaxiTrip {
  id: string
  date: string // ISO date
  start_time: string // HH:MM
  type: TaxiTripType
  taxi_driver_id: string | null // null si non assigné
  booking_id: string | null
  nb_persons: number
  nb_luggage: number
  nb_boardbags: number
  notes: string | null
  // Financial
  price_paid_by_client: number
  price_cost_to_driver: number // ce qu'on paie au driver
  taxi_manager_margin: number // marge du responsable taxis
  center_margin: number // notre marge centre (calculée: client - driver - manager)
}

export interface TaxiMargin {
  id: string
  trip_id: string
  driver_id: string
  client_price: number
  driver_cost: number
  center_margin: number
  driver_margin: number
}

// Equipment
export type EquipmentCategory = 'kite' | 'board' | 'surfboard' | 'foilboard'
export type EquipmentCondition = 'new' | 'good' | 'fair' | 'damaged' | 'retired'
export type RentalSlot = 'morning' | 'afternoon' | 'full_day'

export interface Equipment {
  id: string
  name: string
  category: EquipmentCategory
  brand: string | null
  size: string | null
  year: number | null
  condition: EquipmentCondition
  notes: string | null
  is_active: boolean
}

export interface EquipmentRental {
  id: string
  equipment_id: string
  booking_id: string | null
  client_id: string | null
  date: string
  slot: RentalSlot
  price: number
  notes: string | null
}
