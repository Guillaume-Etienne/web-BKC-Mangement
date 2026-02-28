import type {
  Booking, Client, Room, BookingRoom, BookingRoomPrice,
  ExternalAccommodationBooking, ExternalAccommodation,
  Lesson, Instructor, EquipmentRental, TaxiTrip, Season,
  Payment, InstructorDebt, InstructorPayment, LessonRateOverride,
  Expense, PalmeirasRent, PalmeirasReversal,
} from '../../types/database'

export interface SharedAccountingData {
  bookings:                  Booking[]
  clients:                   Client[]
  rooms:                     Room[]
  bookingRooms:              BookingRoom[]
  bookingRoomPrices:         BookingRoomPrice[]
  externalAccommodationBkgs: ExternalAccommodationBooking[]
  externalAccommodations:    ExternalAccommodation[]
  lessons:                   Lesson[]
  instructors:               Instructor[]
  equipmentRentals:          EquipmentRental[]
  taxiTrips:                 TaxiTrip[]
  seasons:                   Season[]
  payments:                  Payment[]
  instructorDebts:           InstructorDebt[]
  instructorPayments:        InstructorPayment[]
  lessonRateOverrides:       LessonRateOverride[]
  expenses:                  Expense[]
  palmeirasRents:            PalmeirasRent[]
  palmeirasReversals:        PalmeirasReversal[]
}

export interface AccountingHandlers {
  addPayment:              (p: Payment)           => void
  updatePayment:           (p: Payment)           => void
  deletePayment:           (id: string)           => void
  addInstructorDebt:       (d: InstructorDebt)    => void
  deleteInstructorDebt:    (id: string)           => void
  addInstructorPayment:    (p: InstructorPayment) => void
  deleteInstructorPayment: (id: string)           => void
  setLessonOverride:       (o: LessonRateOverride)=> void
  removeLessonOverride:    (lesson_id: string)    => void
  addExpense:              (e: Expense)           => void
  deleteExpense:           (id: string)           => void
  addPalmeirasRent:        (r: PalmeirasRent)     => void
  updatePalmeirasRent:     (r: PalmeirasRent)     => void
  addPalmeirasReversal:    (r: PalmeirasReversal) => void
  updatePalmeirasReversal: (r: PalmeirasReversal) => void
}
