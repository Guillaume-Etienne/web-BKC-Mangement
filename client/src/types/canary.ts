/**  Canari de types — remplace l'ancien `data/mock.ts` (310 lignes de fausses
 *   données de démo dont plus rien ne lisait le contenu).
 *
 *   Ce fichier n'est importé nulle part et ne finit dans aucun bundle. Son seul
 *   rôle est de **casser `npm run build`** le jour où un champ obligatoire est
 *   ajouté (ou renommé, ou retiré) dans `types/database.ts` : le `satisfies`
 *   ci-dessous ne colle plus, `tsc -b` s'arrête, et on est obligé de se
 *   souvenir qu'une colonne se propage aussi dans les écrans et les formulaires.
 *
 *   Quand le build casse ici : **ne pas contourner.** Ajouter le champ à
 *   l'exemplaire concerné, puis remonter la chaîne du runbook « Ajouter une
 *   colonne » de `.claude/docs/INDEX.md`.
 *
 *   Un seul exemplaire par type suffit — le compilateur ne compte pas les
 *   enregistrements, il vérifie la forme. Les valeurs n'ont aucune importance
 *   et ne doivent ressembler à aucun vrai client.
 *
 *   ⚠️ Couverture partielle, héritée de `mock.ts` : 28 types sur les 53 de
 *   `types/database.ts`. Les types récents (Enquiry, ClientNote,
 *   FormSubmission, EmailLog…) ne sont surveillés nulle part.
 *
 *   ℹ️ Ce fichier n'est pas le seul canari : `components/accounting/utils.fixtures.ts`
 *   couvre déjà 18 de ces 28 types (et en plus Agency, AgencyInvoice, PriceTier,
 *   ActivityBooking, BookingParticipant), et casse le build de la même façon —
 *   vérifié. Les 10 types que lui seul ici protège : Season, SharedLink,
 *   TaxiDriver, TaxiPricingDefaults, Equipment, DayActivity, Expense et les
 *   trois Palmeiras. Le reste est une redondance assumée : trois lignes par type
 *   coûtent moins cher qu'un trou le jour où les fixtures bougent.
 */
import type {
  Accommodation, Room, Client, Booking, BookingRoom, Instructor, Lesson,
  PriceItem, DayActivity, TaxiDriver, TaxiTrip, TaxiPricingDefaults,
  Equipment, EquipmentRental, DiningEvent, SharedLink, Season, RoomRate,
  BookingRoomPrice, ExternalAccommodationBooking, Payment, InstructorDebt,
  InstructorPayment, LessonRateOverride, Expense, PalmeirasRent,
  PalmeirasReversal, PalmeirasEntry,
} from './database'

// ── Hébergement ──────────────────────────────────────────────────────────────

export const _accommodation = {
  id: 'x', name: 'X', type: 'house', total_rooms: 1, is_active: true,
  cost_per_night: null, external_billing: false,
} satisfies Accommodation

export const _room = {
  id: 'x', accommodation_id: 'x', name: 'X', capacity: 2,
} satisfies Room

export const _roomRate = {
  id: 'x', room_id: 'x', price_per_night: 0, notes: null,
} satisfies RoomRate

export const _externalAccommodationBooking = {
  id: 'x', booking_id: 'x', accommodation_id: 'x', check_in: '2026-01-01',
  check_out: '2026-01-02', total_cost: 0, total_sell_price: 0, notes: null,
} satisfies ExternalAccommodationBooking

// ── Clients et réservations ──────────────────────────────────────────────────

export const _client = {
  id: 'x', first_name: 'X', last_name: 'X', email: null, phone: null,
  notes: null, nationality: null, passport_number: null, birth_date: null,
  kite_level: 'beg-total', import_id: null, emergency_contact_name: null,
  emergency_contact_phone: null, emergency_contact_email: null,
  emergency_contact_relation: null,
} satisfies Client

export const _booking = {
  id: 'x', booking_number: 0, client_id: 'x',
  check_in: '2026-01-01', check_out: '2026-01-02',
  visa_entry_date: null, visa_exit_date: null,
  status: 'provisional', notes: null,
  num_lessons: 0, num_equipment_rentals: 0, num_center_access: 0,
  center_access_rate: 0, client: _client,
  arrival_time: null, departure_time: null,
  luggage_count: 0, boardbag_count: 0,
  taxi_arrival: false, taxi_departure: false,
  couples_count: 0, children_count: 0, amount_paid: 0,
  num_wing_lessons: 0, import_id: null,
  emergency_contact_name: null, emergency_contact_phone: null,
  emergency_contact_email: null, has_travel_insurance: false,
  waiver_accepted_at: null, waiver_version: null, referral_source: null,
} satisfies Booking

export const _bookingRoom = {
  booking_id: 'x', room_id: 'x',
} satisfies BookingRoom

export const _bookingRoomPrice = {
  booking_id: 'x', room_id: 'x', price_per_night: 0, override_note: null,
} satisfies BookingRoomPrice

// ── Cours et moniteurs ───────────────────────────────────────────────────────

export const _instructor = {
  id: 'x', first_name: 'X', last_name: 'X', email: null, phone: null,
  specialties: [], rate_private: 0, rate_group: 0, rate_supervision: 0,
  notes: null,
} satisfies Instructor

export const _lesson = {
  id: 'x', booking_id: 'x', instructor_id: 'x', participant_ids: [],
  date: '2026-01-01', start_time: '09:00', duration_hours: 1,
  type: 'private', notes: null, kite_id: null, board_id: null,
  price_per_hour: null, instructor_rate: null,
} satisfies Lesson

export const _lessonRateOverride = {
  id: 'x', lesson_id: 'x', rate: 0, note: 'x',   // note obligatoire : justifie la dérogation
} satisfies LessonRateOverride

export const _instructorDebt = {
  id: 'x', instructor_id: 'x', date: '2026-01-01', amount: 0, description: 'x',
} satisfies InstructorDebt

export const _instructorPayment = {
  id: 'x', instructor_id: 'x', date: '2026-01-01', amount: 0,
  method: 'cash_eur', notes: null,
} satisfies InstructorPayment

// ── Matériel ─────────────────────────────────────────────────────────────────

export const _equipment = {
  id: 'x', name: 'X', category: 'kite', brand: null, size: null, year: null,
  condition: 'good', notes: null, is_active: true,
} satisfies Equipment

export const _equipmentRental = {
  id: 'x', equipment_id: 'x', booking_id: 'x', participant_id: null,
  date: '2026-01-01', slot: 'morning', price: 0, notes: null,
} satisfies EquipmentRental

// ── Taxi ─────────────────────────────────────────────────────────────────────

export const _taxiDriver = {
  id: 'x', name: 'X', phone: null, email: null, vehicle: null, seats: 1,
  notes: null, margin_percent: 0, default_price_eur: 0,
  default_driver_mzn: 0, default_manager_mzn: 0,
} satisfies TaxiDriver

export const _taxiTrip = {
  id: 'x', date: '2026-01-01', start_time: '09:00', type: 'aero-to-center',
  status: 'confirmed', taxi_driver_id: null, booking_id: null,
  nb_persons: 1, nb_luggage: 0, nb_boardbags: 0, notes: null,
  price_eur: 0, price_driver_mzn: 0, margin_manager_mzn: 0,
} satisfies TaxiTrip

export const _taxiPricingDefaults = {
  id: 'x', default_price_eur: 0, default_driver_mzn: 0,
  default_manager_mzn: 0, eur_mzn_rate: 1, updated_at: '2026-01-01',
} satisfies TaxiPricingDefaults

// ── Activités, repas, tarifs ─────────────────────────────────────────────────

export const _dayActivity = {
  id: 'x', date: '2026-01-01', slot: 'morning', name: 'X', notes: null,
} satisfies DayActivity

export const _diningEvent = {
  id: 'x', name: 'X', date: '2026-01-01', time: '19:00', type: 'count',
  price_per_person: 0, notes: '',
  attendees: [{
    id: 'x', person_id: 'x', person_type: 'instructor', person_name: 'X',
    room_label: '', is_attending: true,
    starter: '', main: '', side: '', dessert: '',
  }],
} satisfies DiningEvent

export const _priceItem = {
  id: 'x', category: 'lesson', name: 'X', description: null, price: 0,
  unit: 'x', billable_type: 'lesson_private',
} satisfies PriceItem

// ── Argent ───────────────────────────────────────────────────────────────────

export const _payment = {
  id: 'x', booking_id: 'x', date: '2026-01-01', amount: 0, method: 'transfer',
  is_deposit: false, is_verified: false, is_discount: false, notes: null,
} satisfies Payment

export const _expense = {
  id: 'x', date: '2026-01-01', category: 'x', amount: 0, description: 'x',
} satisfies Expense

export const _palmeirasRent = {
  id: 'x', month: '2026-01', amount: 0, notes: null,
} satisfies PalmeirasRent

export const _palmeirasReversal = {
  id: 'x', month: '2026-01', gross_amount: 0, percent: 0, net_amount: 0,
  notes: null,
} satisfies PalmeirasReversal

export const _palmeirasEntry = {
  id: 'x', month: '2026-01', type: 'expense', description: 'x', amount: 0,
} satisfies PalmeirasEntry

// ── Divers ───────────────────────────────────────────────────────────────────

export const _season = {
  id: 'x', label: 'x', start_date: '2026-01-01', end_date: '2026-01-02',
} satisfies Season

export const _sharedLink = {
  id: 'x', token: 'x', type: 'forecast', label: 'x', params: {},
  created_at: '2026-01-01', expires_at: null, is_active: true,
} satisfies SharedLink
