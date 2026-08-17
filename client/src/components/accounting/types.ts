import type {
  Accommodation, Booking, BookingParticipant, Client, Room, RoomRate, BookingRoom, BookingRoomPrice,
  ExternalAccommodationBooking,
  HouseRental, Lesson, Instructor, Equipment, EquipmentRental, TaxiTrip, TaxiManagerPayment, Season, PriceItem, PriceTier,
  Payment, InstructorDebt, InstructorPayment, LessonRateOverride,
  Expense, PalmeirasRent, PalmeirasReversal, PalmeirasEntry,
  DiningEvent, ActivityBooking, ActivityPayment,
  Agency, AgencyRateItem, AgencyBillingLine,
} from '../../types/database'

export interface SharedAccountingData {
  accommodations:            Accommodation[]
  bookingParticipants:       BookingParticipant[]
  houseRentals:              HouseRental[]
  bookings:                  Booking[]
  clients:                   Client[]
  rooms:                     Room[]
  bookingRooms:              BookingRoom[]
  bookingRoomPrices:         BookingRoomPrice[]
  roomRates:                 RoomRate[]   // base rates, incl. `full_{accId}` full-house price
  externalAccommodationBkgs: ExternalAccommodationBooking[]  // name resolved via `accommodations`
  diningEvents:              DiningEvent[]
  lessons:                   Lesson[]
  instructors:               Instructor[]
  priceItems:                PriceItem[]  // client-facing rates; lesson rows keyed by lesson_type
  priceTiers:                PriceTier[]  // volume discount steps on top of lesson_private/lesson_group
  equipment:                 Equipment[]
  equipmentRentals:          EquipmentRental[]
  taxiTrips:                 TaxiTrip[]
  taxiManagerPayments:       TaxiManagerPayment[]
  eurMznRate:                number    // global EUR/MZN rate (taxi_pricing_defaults)
  seasons:                   Season[]
  payments:                  Payment[]
  instructorDebts:           InstructorDebt[]
  instructorPayments:        InstructorPayment[]
  lessonRateOverrides:       LessonRateOverride[]
  expenses:                  Expense[]
  palmeirasRents:            PalmeirasRent[]
  palmeirasReversals:        PalmeirasReversal[]
  palmeirasEntries:          PalmeirasEntry[]
  activityBookings:          ActivityBooking[]
  activityPayments:          ActivityPayment[]
  agencies:                  Agency[]
  agencyRateItems:           AgencyRateItem[]   // per-agency catalogue, priced at line creation
  agencyBillingLines:        AgencyBillingLine[]  // what a partner agency owes us, not the client
}

export interface AccountingHandlers {
  upsertBookingRoomPrice:  (p: BookingRoomPrice)   => void
  deleteBookingRoomPrice:  (bookingId: string, roomId: string) => void
  updateRental:            (r: EquipmentRental)    => void
  addPayment:              (p: Payment)            => void
  updatePayment:           (p: Payment)            => void
  deletePayment:           (id: string)            => void
  verifyPayment:           (id: string)            => void
  addInstructorDebt:       (d: InstructorDebt)     => void
  deleteInstructorDebt:    (id: string)            => void
  addInstructorPayment:    (p: InstructorPayment)  => void
  deleteInstructorPayment: (id: string)            => void
  /** Client price €/h billed for one lesson; null → back to the price list */
  setLessonPrice:          (lesson_id: string, price_per_hour: number | null) => void
  /** Instructor payout exception on one lesson (Instructors tab only) */
  setLessonOverride:       (o: LessonRateOverride) => void
  removeLessonOverride:    (lesson_id: string)     => void
  addExpense:              (e: Expense)            => void
  deleteExpense:           (id: string)            => void
  addPalmeirasRent:        (r: PalmeirasRent)      => void
  updatePalmeirasRent:     (r: PalmeirasRent)      => void
  addPalmeirasReversal:    (r: PalmeirasReversal)  => void
  updatePalmeirasReversal: (r: PalmeirasReversal)  => void
  addPalmeirasEntry:       (e: PalmeirasEntry)     => void
  deletePalmeirasEntry:    (id: string)            => void
  /** Partner-agency invoice lines (Phase 3). `price`/`unit_hours` are frozen by
   *  the caller at creation, like every other snapshot in the app. */
  addAgencyBillingLine:    (l: AgencyBillingLine)  => void
  updateAgencyBillingLine: (l: AgencyBillingLine)  => void
  deleteAgencyBillingLine: (id: string)            => void
  /** Attach/detach one service row to an invoice line. `lineId === null` gives it
   *  back to the client. The room variant is keyed by (booking, room) because
   *  booking_room_prices has no id of its own. */
  setLessonAgencyLine:     (lesson_id: string, lineId: string | null) => void
  setRentalAgencyLine:     (rental_id: string, lineId: string | null) => void
  setTaxiAgencyLine:       (trip_id: string,   lineId: string | null) => void
  setRoomAgencyLine:       (booking_id: string, room_id: string, lineId: string | null) => void
}
