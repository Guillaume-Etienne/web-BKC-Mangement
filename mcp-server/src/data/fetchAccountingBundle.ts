import { supabase } from '../supabaseClient.js'
import type { SharedAccountingData } from '../../../client/src/components/accounting/types.js'
import type {
  Accommodation, BookingParticipant, HouseRental, Booking, Client, Room, BookingRoom,
  BookingRoomPrice, RoomRate, ExternalAccommodationBooking, DiningEvent, Lesson, Instructor,
  PriceItem, Equipment, EquipmentRental, TaxiTrip, TaxiManagerPayment, Season, Payment,
  InstructorDebt, InstructorPayment, LessonRateOverride, Expense, PalmeirasRent,
  PalmeirasReversal, PalmeirasEntry, ActivityBooking, ActivityPayment, TaxiPricingDefaults,
} from '../../../client/src/types/database.js'

/** Every table `SharedAccountingData` needs, fetched in parallel. This is the
 *  same shape the app assembles client-side in `AccountingPage.tsx` — kept
 *  here as one place so `get_booking` and `get_accounting_summary` build the
 *  bundle identically. `filterDataToSeason` / `computeSeasonTotals` operate on
 *  it unchanged, same code path as the app. */
export async function fetchAccountingBundle(): Promise<SharedAccountingData> {
  const [
    accommodations, bookingParticipants, houseRentals, bookings, clients, rooms, bookingRooms,
    bookingRoomPrices, roomRates, externalAccommodationBkgs, diningEvents, lessons, instructors,
    priceItems, equipment, equipmentRentals, taxiTrips, taxiManagerPayments, taxiPricingDefaults,
    seasons, payments, instructorDebts, instructorPayments, lessonRateOverrides, expenses,
    palmeirasRents, palmeirasReversals, palmeirasEntries, activityBookings, activityPayments,
  ] = await Promise.all([
    selectAll<Accommodation>('accommodations'),
    selectAll<BookingParticipant>('booking_participants'),
    selectAll<HouseRental>('house_rentals'),
    selectAll<Booking>('bookings'),
    selectAll<Client>('clients'),
    selectAll<Room>('rooms'),
    selectAll<BookingRoom>('booking_rooms'),
    selectAll<BookingRoomPrice>('booking_room_prices'),
    selectAll<RoomRate>('room_rates'),
    selectAll<ExternalAccommodationBooking>('external_accommodation_bookings'),
    selectAll<DiningEvent>('dining_events'),
    selectAll<Lesson>('lessons'),
    selectAll<Instructor>('instructors'),
    selectAll<PriceItem>('price_items'),
    selectAll<Equipment>('equipment'),
    selectAll<EquipmentRental>('equipment_rentals'),
    selectAll<TaxiTrip>('taxi_trips'),
    selectAll<TaxiManagerPayment>('taxi_manager_payments'),
    selectAll<TaxiPricingDefaults>('taxi_pricing_defaults'),
    selectAll<Season>('seasons'),
    selectAll<Payment>('payments'),
    selectAll<InstructorDebt>('instructor_debts'),
    selectAll<InstructorPayment>('instructor_payments'),
    selectAll<LessonRateOverride>('lesson_rate_overrides'),
    selectAll<Expense>('expenses'),
    selectAll<PalmeirasRent>('palmeiras_rents'),
    selectAll<PalmeirasReversal>('palmeiras_reversals'),
    selectAll<PalmeirasEntry>('palmeiras_entries'),
    selectAll<ActivityBooking>('activity_bookings'),
    selectAll<ActivityPayment>('activity_payments'),
  ])

  return {
    accommodations, bookingParticipants, houseRentals, bookings, clients, rooms, bookingRooms,
    bookingRoomPrices, roomRates, externalAccommodationBkgs, diningEvents, lessons, instructors,
    priceItems, equipment, equipmentRentals, taxiTrips, taxiManagerPayments,
    eurMznRate: taxiPricingDefaults[0]?.eur_mzn_rate ?? 65,
    seasons, payments, instructorDebts, instructorPayments, lessonRateOverrides, expenses,
    palmeirasRents, palmeirasReversals, palmeirasEntries, activityBookings, activityPayments,
  }
}

async function selectAll<T>(table: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*')
  if (error) throw new Error(`Fetching "${table}": ${error.message}`)
  return (data ?? []) as T[]
}
