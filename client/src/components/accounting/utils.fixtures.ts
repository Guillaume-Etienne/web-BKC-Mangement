/** Typed factories for accounting unit tests.
 *  Every factory returns a fully-valid entity; pass a Partial to override only
 *  what the scenario is about. Test files stay readable and type-safe. */
import type {
  Accommodation, ActivityBooking, Booking, BookingParticipant, BookingRoom, BookingRoomPrice,
  DiningEvent, EquipmentRental, EventAttendee, ExternalAccommodation, ExternalAccommodationBooking,
  Instructor, InstructorDebt, InstructorPayment, Lesson, LessonRateOverride,
  Payment, Room, RoomRate, TaxiTrip,
} from '../../types/database'
import type { SharedAccountingData } from './types'

export function mkAccommodation(over: Partial<Accommodation> = {}): Accommodation {
  return { id: 'acc1', name: 'House 1', type: 'house', total_rooms: 2, is_active: true, cost_per_night: null, ...over }
}

export function mkRoom(over: Partial<Room> = {}): Room {
  return { id: 'room1', accommodation_id: 'acc1', name: 'F', capacity: 2, ...over }
}

export function mkRoomRate(over: Partial<RoomRate> = {}): RoomRate {
  return { id: 'rate1', room_id: 'room1', price_per_night: 50, notes: null, ...over }
}

export function mkBookingRoom(over: Partial<BookingRoom> = {}): BookingRoom {
  return { booking_id: 'bk1', room_id: 'room1', ...over }
}

export function mkBookingRoomPrice(over: Partial<BookingRoomPrice> = {}): BookingRoomPrice {
  return { booking_id: 'bk1', room_id: 'room1', price_per_night: 60, override_note: null, ...over }
}

export function mkBooking(over: Partial<Booking> = {}): Booking {
  return {
    id: 'bk1', booking_number: 1, client_id: 'cli1',
    check_in: '2026-11-01', check_out: '2026-11-08',
    visa_entry_date: null, visa_exit_date: null,
    status: 'confirmed', notes: null,
    num_lessons: 0, num_equipment_rentals: 0, num_wing_lessons: 0,
    num_center_access: 0, center_access_rate: 5,
    arrival_time: null, departure_time: null,
    luggage_count: 0, boardbag_count: 0,
    taxi_arrival: false, taxi_departure: false,
    couples_count: 0, children_count: 0,
    amount_paid: 0, import_id: null,
    emergency_contact_name: null, emergency_contact_phone: null, emergency_contact_email: null,
    has_travel_insurance: false, waiver_accepted_at: null, waiver_version: null,
    referral_source: null,
    ...over,
  }
}

export function mkParticipant(over: Partial<BookingParticipant> = {}): BookingParticipant {
  return {
    id: 'p1', booking_id: 'bk1', first_name: 'Alice', last_name: null,
    passport_number: null, client_id: null, kite_level: null,
    does_kite: true, brings_own_gear: false, needs_storage: false,
    wants_kite_lessons: false, wants_kite_rental: false, wants_wing_lessons: false,
    notes: null, created_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

export function mkInstructor(over: Partial<Instructor> = {}): Instructor {
  return {
    id: 'ins1', first_name: 'Geraldo', last_name: 'M', email: null, phone: null,
    specialties: [], rate_private: 40, rate_group: 25, rate_supervision: 15, notes: null,
    ...over,
  }
}

export function mkLesson(over: Partial<Lesson> = {}): Lesson {
  return {
    id: 'les1', booking_id: 'bk1', instructor_id: 'ins1', participant_ids: ['p1'],
    date: '2026-11-02', start_time: '09:00', duration_hours: 2, type: 'private',
    notes: null, kite_id: null, board_id: null,
    ...over,
  }
}

export function mkLessonOverride(over: Partial<LessonRateOverride> = {}): LessonRateOverride {
  return { id: 'ovr1', lesson_id: 'les1', rate: 60, note: 'promo', ...over }
}

export function mkRental(over: Partial<EquipmentRental> = {}): EquipmentRental {
  return {
    id: 'rent1', equipment_id: 'eq1', booking_id: 'bk1', participant_id: 'p1',
    date: '2026-11-02', slot: 'full_day', price: 45, notes: null,
    ...over,
  }
}

export function mkTaxiTrip(over: Partial<TaxiTrip> = {}): TaxiTrip {
  return {
    id: 'taxi1', date: '2026-11-01', start_time: '10:00', type: 'aero-to-center',
    status: 'confirmed', taxi_driver_id: 'drv1', booking_id: 'bk1',
    nb_persons: 2, nb_luggage: 2, nb_boardbags: 1, notes: null,
    price_eur: 120, price_driver_mzn: 6000, margin_manager_mzn: 1000,
    ...over,
  }
}

export function mkExternalAccommodation(over: Partial<ExternalAccommodation> = {}): ExternalAccommodation {
  return {
    id: 'ext1', name: 'Palmeiras', provider: 'palmeiras',
    cost_per_night: 80, sell_price_per_night: 150, notes: null, is_active: true,
    ...over,
  }
}

export function mkExternalBooking(over: Partial<ExternalAccommodationBooking> = {}): ExternalAccommodationBooking {
  return {
    id: 'extbk1', booking_id: 'bk1', external_accommodation_id: 'ext1',
    check_in: '2026-11-01', check_out: '2026-11-05',
    cost_per_night: 80, sell_price_per_night: 150, notes: null,
    ...over,
  }
}

export function mkPayment(over: Partial<Payment> = {}): Payment {
  return {
    id: 'pay1', booking_id: 'bk1', date: '2026-10-01', amount: 300,
    method: 'transfer', is_deposit: false, is_verified: true, is_discount: false, notes: null,
    ...over,
  }
}

export function mkInstructorDebt(over: Partial<InstructorDebt> = {}): InstructorDebt {
  return { id: 'debt1', instructor_id: 'ins1', date: '2026-11-03', amount: 20, description: 'advance', ...over }
}

export function mkInstructorPayment(over: Partial<InstructorPayment> = {}): InstructorPayment {
  return { id: 'ipay1', instructor_id: 'ins1', date: '2026-11-30', amount: 100, method: 'cash_eur', notes: null, ...over }
}

export function mkAttendee(over: Partial<EventAttendee> = {}): EventAttendee {
  return {
    id: 'att1', person_id: 'p1', person_type: 'participant', person_name: 'Alice',
    room_label: 'H1/F', is_attending: true,
    starter: '', main: '', side: '', dessert: '',
    ...over,
  }
}

export function mkDiningEvent(over: Partial<DiningEvent> = {}): DiningEvent {
  return {
    id: 'din1', name: 'Dinner', date: '2026-11-03', time: '19:30',
    type: 'count', price_per_person: 12, notes: '', attendees: [],
    ...over,
  }
}

export function mkActivityBooking(over: Partial<ActivityBooking> = {}): ActivityBooking {
  return {
    id: 'act1', provider_id: 'prov1', booking_id: 'bk1', date: '2026-11-04',
    label: 'Safari', nb_persons: 2, participant_ids: ['p1'],
    price_client: 100, price_provider: 70, payment_flow: 'we_pay_provider',
    notes: null, created_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

/** Empty accounting dataset — spread overrides on top for each scenario. */
export function mkData(over: Partial<SharedAccountingData> = {}): SharedAccountingData {
  return {
    accommodations: [], bookingParticipants: [], houseRentals: [], bookings: [], clients: [],
    rooms: [], bookingRooms: [], bookingRoomPrices: [], roomRates: [],
    externalAccommodationBkgs: [], externalAccommodations: [], diningEvents: [],
    lessons: [], instructors: [], equipment: [], equipmentRentals: [],
    taxiTrips: [], taxiManagerPayments: [], eurMznRate: 73, seasons: [],
    payments: [], instructorDebts: [], instructorPayments: [], lessonRateOverrides: [],
    expenses: [], palmeirasRents: [], palmeirasReversals: [], palmeirasEntries: [],
    activityBookings: [], activityPayments: [],
    ...over,
  }
}

/** A two-room house (F + B) with base rates and a full-house rate. */
export function mkHouseSetup(fullHouseRate: number | null = 100) {
  const acc = mkAccommodation({ id: 'accH', name: 'H1', type: 'house', total_rooms: 2 })
  const roomF = mkRoom({ id: 'roomF', accommodation_id: 'accH', name: 'F' })
  const roomB = mkRoom({ id: 'roomB', accommodation_id: 'accH', name: 'B' })
  const rates = [
    mkRoomRate({ id: 'rF', room_id: 'roomF', price_per_night: 55 }),
    mkRoomRate({ id: 'rB', room_id: 'roomB', price_per_night: 55 }),
    ...(fullHouseRate === null ? [] : [mkRoomRate({ id: 'rFull', room_id: 'full_accH', price_per_night: fullHouseRate })]),
  ]
  return { acc, roomF, roomB, rates }
}
