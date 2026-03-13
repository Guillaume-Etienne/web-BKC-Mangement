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
  import_id: string | null                   // Google Forms row timestamp (dedup key)
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_email: string | null
  emergency_contact_relation: string | null
}

export interface Participant {
  id: string
  first_name: string
  last_name: string
  passport_number: string
}

// Participant lié à un booking (nouvelle table booking_participants)
export interface BookingParticipant {
  id: string
  booking_id: string
  first_name: string
  last_name: string | null
  passport_number: string | null
  client_id: string | null   // lien optionnel vers un Client existant
  notes: string | null
  created_at: string
}

export interface Booking {
  id: string
  booking_number: number     // sequential booking number, displayed as #001
  client_id: string
  check_in: string           // actual kite center check-in (ISO date)
  check_out: string          // actual kite center check-out (ISO date)
  visa_entry_date: string | null  // Mozambique entry date for visa letter
  visa_exit_date: string | null   // Mozambique exit date for visa letter
  status: BookingStatus
  notes: string | null
  num_lessons: number        // nb persons wanting lessons
  num_equipment_rentals: number // nb persons wanting equipment rental
  num_center_access: number  // nb persons using center services only (no lesson/rental)
  client?: Client
  arrival_time: string | null
  departure_time: string | null
  luggage_count: number
  boardbag_count: number
  taxi_arrival: boolean
  taxi_departure: boolean
  couples_count: number
  children_count: number
  amount_paid: number
  import_id: string | null                   // Google Forms row timestamp (dedup key)
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_email: string | null
}

export interface BookingRoom {
  booking_id: string
  room_id: string
}

// Dining events ("Now" tab)
export type EventType = 'count' | 'menu'

export interface EventAttendee {
  id: string
  person_id: string
  person_type: 'instructor' | 'participant' | 'extra'
  person_name: string
  room_label: string      // e.g. "H-1/F" for clients, "" for instructors
  is_attending: boolean
  price_override?: number // overrides event-level price_per_person if set
  starter: string
  main: string
  side: string
  dessert: string
}

export interface DiningEvent {
  id: string
  name: string
  date: string            // ISO date
  time: string
  type: EventType
  price_per_person: number
  notes: string
  attendees: EventAttendee[]
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
  participant_ids: string[]  // array of BookingParticipant.id — 1 for private/supervision, N for group
  date: string
  start_time: string
  duration_hours: number
  type: LessonType
  notes: string | null
  kite_id: string | null
  board_id: string | null
  instructor?: Instructor
  clients?: Client[]
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
export type TaxiTripType   = 'aero-to-center' | 'center-to-aero' | 'aero-to-spot' | 'spot-to-aero' | 'center-to-town' | 'town-to-center' | 'other'
export type TaxiTripStatus = 'confirmed' | 'needs_details' | 'done'

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
  status: TaxiTripStatus
  taxi_driver_id: string | null // null si non assigné
  booking_id: string | null
  nb_persons: number
  nb_luggage: number
  nb_boardbags: number
  notes: string | null
  // Financial (all MZN integers except price_eur)
  price_client_mzn: number    // what client pays
  margin_manager_mzn: number  // intermediate manager cut
  margin_centre_mzn: number   // our centre margin
  price_driver_mzn: number    // what driver gets = client - manager - centre
  price_eur: number           // price_client_mzn / exchange_rate (frozen at transaction)
  exchange_rate: number       // EUR/MZN rate at time of transaction
}

export interface TaxiPricingDefaults {
  id: string
  price_client_mzn: number    // default 8000
  margin_manager_mzn: number  // default 1000
  margin_centre_mzn: number   // default 1000
  eur_mzn_rate: number        // default 65
  updated_at: string
}

export interface TaxiManagerPayment {
  id: string
  date: string          // ISO date
  amount_mzn: number
  notes: string | null
}

/** Minimal booking shape used by taxi views for the booking picker */
export interface BookingRef {
  id: string
  booking_number: number
  check_in: string
  check_out: string
  luggage_count: number
  boardbag_count: number
  client?: { first_name: string; last_name: string } | null
}

// Shared public links
export type SharedLinkType = 'forecast' | 'taxi' | 'client'

export interface SharedLink {
  id: string
  token: string
  type: SharedLinkType
  label: string
  params: Record<string, string> // e.g. { date: '2026-02-23' }
  created_at: string             // ISO date
  expires_at: string | null      // ISO date, null = never
  is_active: boolean
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
  equipment_id: string | null
  booking_id: string | null
  participant_id: string | null  // BookingParticipant.id
  date: string
  slot: RentalSlot
  price: number
  notes: string | null
}

// ─── Accounting ───────────────────────────────────────────────────────────────

// Season (mid-Sept → mid-March, one per year, variable dates)
export interface Season {
  id: string
  label: string        // e.g. "2025-2026"
  start_date: string   // ISO date
  end_date: string     // ISO date
}

export interface HouseRental {
  id: string
  accommodation_id: string
  start_date: string   // ISO date
  end_date: string     // ISO date
  total_cost: number   // EUR
  notes: string | null
}

// Base nightly rates per room (or full house)
// room_id = actual room id, or 'full_{accommodation_id}' for full-house rate
export interface RoomRate {
  id: string
  room_id: string
  price_per_night: number
  notes: string | null
}

// Snapshot of price at time of booking (allows overrides / promos)
export interface BookingRoomPrice {
  booking_id: string
  room_id: string
  price_per_night: number
  override_note: string | null
}

// External accommodation (Palmeiras bungalows, other hotels)
export type ExternalAccommodationProvider = 'palmeiras' | 'other'

export interface ExternalAccommodation {
  id: string
  name: string
  provider: ExternalAccommodationProvider
  cost_per_night: number        // what we pay
  sell_price_per_night: number  // what we charge the client
  notes: string | null
  is_active: boolean
}

// Booking using an external accommodation
export interface ExternalAccommodationBooking {
  id: string
  booking_id: string
  external_accommodation_id: string
  check_in: string
  check_out: string
  cost_per_night: number        // snapshot at time of booking
  sell_price_per_night: number  // snapshot at time of booking
  notes: string | null
}

// Client payments (deposit + balance payments, any method)
export type PaymentMethod = 'cash_eur' | 'cash_mzn' | 'transfer' | 'card_palmeiras'

export interface Payment {
  id: string
  booking_id: string
  date: string
  amount: number                // always in EUR
  method: PaymentMethod
  is_deposit: boolean
  notes: string | null
}

// Per-participant consumption tracking (optional, for detailed breakdowns)
export type ConsumptionType = 'lesson' | 'rental' | 'activity' | 'center_access'

export interface ParticipantConsumption {
  id: string
  booking_id: string
  participant_id: string        // references Participant.id
  type: ConsumptionType
  quantity: number
  unit_price: number
  notes: string | null
}

// Instructor payroll — debt (advance on dinner, outing, etc.)
export interface InstructorDebt {
  id: string
  instructor_id: string
  date: string
  amount: number
  description: string
}

// Instructor payroll — payment from centre to instructor
export interface InstructorPayment {
  id: string
  instructor_id: string
  date: string
  amount: number
  method: PaymentMethod
  notes: string | null
}

// Override on a specific lesson rate (for accounting purposes)
export interface LessonRateOverride {
  id: string
  lesson_id: string
  rate: number
  note: string                  // required — must justify override
}

// Manual expenses — category is a free string, managed in UI
export interface Expense {
  id: string
  date: string
  category: string
  amount: number
  description: string
}

// Palmeiras — monthly rent we pay them
export interface PalmeirasRent {
  id: string
  month: string                 // YYYY-MM
  amount: number
  notes: string | null
}

// Palmeiras — monthly % reversal they owe us on direct bookings
export interface PalmeirasReversal {
  id: string
  month: string                 // YYYY-MM
  gross_amount: number          // total Palmeiras collected
  percent: number               // % owed to us
  net_amount: number            // calculated: gross × percent / 100
  notes: string | null
}

// Free expense or income line for a given month
export interface PalmeirasEntry {
  id: string
  month: string       // YYYY-MM
  type: 'expense' | 'income'
  description: string
  amount: number
}

// Bungalow we sub-let to a client (we pay Palmeiras cost, client pays sell price)
export interface PalmeirasSubLet {
  id: string
  month: string          // YYYY-MM (derived from check_in, for filtering)
  bungalow: string       // e.g. "Bungalow 1", "#3"
  check_in: string       // YYYY-MM-DD
  check_out: string      // YYYY-MM-DD
  nights: number
  cost_per_night: number // what we pay Palmeiras
  sell_per_night: number // what we charge the client
  booking_ref: string | null  // optional booking number / name
  notes: string | null
}
