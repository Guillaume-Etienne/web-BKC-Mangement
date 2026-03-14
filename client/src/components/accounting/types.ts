import type {
  Accommodation, Booking, BookingParticipant, Client, Room, BookingRoom, BookingRoomPrice,
  ExternalAccommodationBooking, ExternalAccommodation,
  HouseRental, Lesson, Instructor, Equipment, EquipmentRental, TaxiTrip, Season,
  Payment, InstructorDebt, InstructorPayment, LessonRateOverride,
  Expense, PalmeirasRent, PalmeirasReversal, PalmeirasEntry, PalmeirasSubLet,
  DiningEvent,
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
  externalAccommodationBkgs: ExternalAccommodationBooking[]
  externalAccommodations:    ExternalAccommodation[]
  diningEvents:              DiningEvent[]
  lessons:                   Lesson[]
  instructors:               Instructor[]
  equipment:                 Equipment[]
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
  palmeirasEntries:          PalmeirasEntry[]
  palmeirasSubLets:          PalmeirasSubLet[]
}

export interface AccountingHandlers {
  updateRental:            (r: EquipmentRental)    => void
  addPayment:              (p: Payment)            => void
  updatePayment:           (p: Payment)            => void
  deletePayment:           (id: string)            => void
  verifyPayment:           (id: string)            => void
  addInstructorDebt:       (d: InstructorDebt)     => void
  deleteInstructorDebt:    (id: string)            => void
  addInstructorPayment:    (p: InstructorPayment)  => void
  deleteInstructorPayment: (id: string)            => void
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
  addPalmeirasSubLet:      (s: PalmeirasSubLet)    => void
  updatePalmeirasSubLet:   (s: PalmeirasSubLet)    => void
  deletePalmeirasSubLet:   (id: string)            => void
}
