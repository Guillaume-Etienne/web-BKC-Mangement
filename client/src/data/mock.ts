import type { Accommodation, Room, Booking, BookingRoom, Client, Instructor, Lesson, PriceItem, DayActivity, TaxiDriver, TaxiTrip, Equipment, EquipmentRental, Participant, SharedLink } from '../types/database'

export const mockAccommodations: Accommodation[] = [
  { id: 'h1', name: 'H-1', type: 'house', total_rooms: 2, is_active: true },
  { id: 'h2', name: 'H-2', type: 'house', total_rooms: 2, is_active: true },
  { id: 'h3', name: 'H-3', type: 'house', total_rooms: 2, is_active: true },
  { id: 'b1', name: 'B-1', type: 'bungalow', total_rooms: 1, is_active: true },
  { id: 'b2', name: 'B-2', type: 'bungalow', total_rooms: 1, is_active: true },
  { id: 'b3', name: 'B-3', type: 'bungalow', total_rooms: 1, is_active: true },
]

export const mockRooms: Room[] = [
  { id: 'r1', accommodation_id: 'h1', name: 'F', capacity: 2 },
  { id: 'r2', accommodation_id: 'h1', name: 'B', capacity: 2 },
  { id: 'r3', accommodation_id: 'h2', name: 'F', capacity: 2 },
  { id: 'r4', accommodation_id: 'h2', name: 'B', capacity: 3 },
  { id: 'r5', accommodation_id: 'h3', name: 'F', capacity: 2 },
  { id: 'r6', accommodation_id: 'h3', name: 'B', capacity: 2 },
  { id: 'r7', accommodation_id: 'b1', name: 'Room', capacity: 2 },
  { id: 'r8', accommodation_id: 'b2', name: 'Room', capacity: 2 },
  { id: 'r9', accommodation_id: 'b3', name: 'Room', capacity: 3 },
]

export const mockClients: Client[] = [
  { id: 'c1', first_name: 'Jean', last_name: 'Dupont', email: 'jean@mail.com', phone: null, notes: null, nationality: 'France', passport_number: 'AB123456', birth_date: '1990-05-15', kite_level: 'intermediate' },
  { id: 'c2', first_name: 'Marie', last_name: 'Martin', email: null, phone: '+33612345678', notes: null, nationality: 'Belgique', passport_number: 'BE789012', birth_date: '1985-08-22', kite_level: 'beginner' },
  { id: 'c3', first_name: 'Pierre', last_name: 'Durand', email: 'pierre@mail.com', phone: null, notes: 'Client régulier', nationality: 'Allemagne', passport_number: 'DE345678', birth_date: '1988-03-10', kite_level: 'advanced' },
  { id: 'c4', first_name: 'Sophie', last_name: 'Laurent', email: 'sophie@mail.com', phone: '+33698765432', notes: null, nationality: 'France', passport_number: 'AB234567', birth_date: '1992-12-05', kite_level: 'intermediate' },
  { id: 'c5', first_name: 'Luc', last_name: 'Müller', email: 'luc.muller@mail.com', phone: null, notes: 'Aime les bungalows', nationality: 'Suisse', passport_number: 'CH567890', birth_date: '1995-07-20', kite_level: 'beginner' },
]

const p = (id: string, first_name: string, last_name: string, passport_number: string): Participant =>
  ({ id, first_name, last_name, passport_number })

export const mockBookings: Booking[] = [
  { id: 'bk1', client_id: 'c1', check_in: '2026-02-05', check_out: '2026-02-12', status: 'confirmed', notes: null, num_lessons: 3, num_equipment_rentals: 2, num_center_access: 0, client: mockClients[0], arrival_time: '14:30', departure_time: '10:00', luggage_count: 2, boardbag_count: 1, taxi_arrival: true, taxi_departure: true, couples_count: 1, children_count: 0, amount_paid: 500, participants: [p('p1a', 'Jean', 'Dupont', 'AB123456'), p('p1b', 'Camille', 'Dupont', 'AB123457')] },
  { id: 'bk2', client_id: 'c2', check_in: '2026-02-10', check_out: '2026-02-18', status: 'provisional', notes: null, num_lessons: 2, num_equipment_rentals: 3, num_center_access: 1, client: mockClients[1], arrival_time: '16:00', departure_time: '11:00', luggage_count: 1, boardbag_count: 2, taxi_arrival: false, taxi_departure: true, couples_count: 0, children_count: 2, amount_paid: 450, participants: [p('p2a', 'Marie', 'Martin', 'BE789012')] },
  { id: 'bk3', client_id: 'c3', check_in: '2026-02-15', check_out: '2026-02-22', status: 'confirmed', notes: null, num_lessons: 4, num_equipment_rentals: 1, num_center_access: 0, client: mockClients[2], arrival_time: '13:15', departure_time: '09:00', luggage_count: 3, boardbag_count: 1, taxi_arrival: true, taxi_departure: false, couples_count: 0, children_count: 1, amount_paid: 600, participants: [p('p3a', 'Pierre', 'Durand', 'DE345678')] },
  { id: 'bk4', client_id: 'c1', check_in: '2026-02-20', check_out: '2026-02-28', status: 'cancelled', notes: 'Cancelled by client', num_lessons: 0, num_equipment_rentals: 0, num_center_access: 0, client: mockClients[0], arrival_time: null, departure_time: null, luggage_count: 0, boardbag_count: 0, taxi_arrival: false, taxi_departure: false, couples_count: 0, children_count: 0, amount_paid: 0, participants: [] },
  { id: 'bk5', client_id: 'c2', check_in: '2026-02-01', check_out: '2026-02-08', status: 'confirmed', notes: null, num_lessons: 2, num_equipment_rentals: 2, num_center_access: 0, client: mockClients[1], arrival_time: '15:45', departure_time: '10:30', luggage_count: 2, boardbag_count: 0, taxi_arrival: true, taxi_departure: true, couples_count: 1, children_count: 0, amount_paid: 400, participants: [p('p5a', 'Marie', 'Martin', 'BE789012'), p('p5b', 'Tom', 'Martin', 'BE789013')] },
  { id: 'bk6', client_id: 'c3', check_in: '2026-03-01', check_out: '2026-03-10', status: 'provisional', notes: null, num_lessons: 1, num_equipment_rentals: 4, num_center_access: 2, client: mockClients[2], arrival_time: '12:00', departure_time: '12:00', luggage_count: 1, boardbag_count: 3, taxi_arrival: false, taxi_departure: false, couples_count: 0, children_count: 0, amount_paid: 300, participants: [p('p6a', 'Pierre', 'Durand', 'DE345678')] },
]

export const mockBookingRooms: BookingRoom[] = [
  { booking_id: 'bk1', room_id: 'r1' },
  { booking_id: 'bk2', room_id: 'r3' },
  { booking_id: 'bk3', room_id: 'r5' },
  { booking_id: 'bk3', room_id: 'r6' },
  { booking_id: 'bk4', room_id: 'r7' },
  { booking_id: 'bk5', room_id: 'r8' },
  { booking_id: 'bk6', room_id: 'r9' },
]

export const mockInstructors: Instructor[] = [
  { id: 'i1', first_name: 'Pierrot', last_name: 'Renard', email: 'theo@mail.com', phone: '+33612345678', specialties: ['beginner', 'intermediate'], rate_private: 50, rate_group: 35, rate_supervision: 25, notes: 'Excellent avec débutants' },
  { id: 'i2', first_name: 'Mouss', last_name: 'Blanc', email: 'amelie@mail.com', phone: '+33698765432', specialties: ['intermediate', 'advanced', 'wave'], rate_private: 55, rate_group: 40, rate_supervision: 30, notes: 'Spécialiste vagues' },
  { id: 'i3', first_name: 'Tere', last_name: 'Moreau', email: 'lucas@mail.com', phone: null, specialties: ['beginner', 'freestyle'], rate_private: 45, rate_group: 30, rate_supervision: 20, notes: 'Freestyle expert' },
]

export const mockLessons: Lesson[] = [
  { id: 'l1', booking_id: 'bk1', instructor_id: 'i1', client_ids: ['c1'],            date: '2026-02-05', start_time: '09:00', duration_hours: 1,   type: 'private',    notes: null,              kite_id: 'eq1', board_id: 'eq4' },
  { id: 'l2', booking_id: 'bk1', instructor_id: 'i2', client_ids: ['c1'],            date: '2026-02-07', start_time: '14:00', duration_hours: 1.5, type: 'private',    notes: 'Vagues!',         kite_id: 'eq2', board_id: null  },
  { id: 'l3', booking_id: 'bk1', instructor_id: 'i1', client_ids: ['c1','c2','c3'],  date: '2026-02-10', start_time: '10:00', duration_hours: 1,   type: 'group',      notes: null,              kite_id: null,  board_id: null  },
  { id: 'l4', booking_id: 'bk2', instructor_id: 'i3', client_ids: ['c2'],            date: '2026-02-12', start_time: '15:00', duration_hours: 2,   type: 'private',    notes: 'Freestyle basics',kite_id: 'eq3', board_id: 'eq6' },
  { id: 'l5', booking_id: 'bk3', instructor_id: 'i2', client_ids: ['c3'],            date: '2026-02-18', start_time: '09:30', duration_hours: 1.5, type: 'supervision',notes: null,              kite_id: 'eq1', board_id: 'eq5' },
  { id: 'l6', booking_id: 'bk3', instructor_id: 'i1', client_ids: ['c1','c3'],       date: '2026-02-20', start_time: '16:00', duration_hours: 1,   type: 'group',      notes: null,              kite_id: null,  board_id: 'eq4' },
]

export const mockPriceItems: PriceItem[] = [
  // Cours
  { id: 'p1', category: 'lesson', name: 'Cours privé 1h', description: 'Leçon privée 1 heure', price: 50, unit: '/ heure' },
  { id: 'p2', category: 'lesson', name: 'Cours privé 2h', description: 'Leçon privée 2 heures', price: 95, unit: '/ 2 heures' },
  { id: 'p3', category: 'lesson', name: 'Cours groupe 1h', description: 'Cours collectif 1 heure', price: 35, unit: '/ heure' },
  { id: 'p4', category: 'lesson', name: 'Supervision 1h', description: 'Supervision 1 heure', price: 25, unit: '/ heure' },
  // Activités
  { id: 'p5', category: 'activity', name: 'Sortie découverte', description: null, price: 60, unit: '/ personne' },
  { id: 'p6', category: 'activity', name: 'Cours théorie', description: null, price: 20, unit: '/ personne' },
  // Locations
  { id: 'p7', category: 'rental', name: 'Planche + kite', description: null, price: 40, unit: '/ jour' },
  { id: 'p8', category: 'rental', name: 'Kite seul', description: null, price: 20, unit: '/ jour' },
  { id: 'p9', category: 'rental', name: 'Harnais', description: null, price: 10, unit: '/ jour' },
  { id: 'p10', category: 'rental', name: 'Combinaison', description: null, price: 8, unit: '/ jour' },
  // Taxis
  { id: 'p11', category: 'taxi', name: 'Aéroport aller', description: null, price: 35, unit: 'aller simple' },
  { id: 'p12', category: 'taxi', name: 'Aéroport retour', description: null, price: 35, unit: 'retour simple' },
  { id: 'p13', category: 'taxi', name: 'Ville centre', description: null, price: 15, unit: 'aller/retour' },
]

export const mockDayActivities: DayActivity[] = [
  { id: 'a1', date: '2026-02-05', slot: 'morning', name: 'Sortie découverte plage', notes: null },
  { id: 'a2', date: '2026-02-07', slot: 'evening', name: 'BBQ & soirée beach', notes: 'Prévoir boissons' },
  { id: 'a3', date: '2026-02-10', slot: 'morning', name: 'Cours théorie vent', notes: null },
  { id: 'a4', date: '2026-02-18', slot: 'evening', name: 'Projection vidéo kite', notes: null },
  { id: 'a5', date: '2026-02-20', slot: 'morning', name: 'Sortie bateau', notes: '8 personnes max' },
]

export const mockTaxiDrivers: TaxiDriver[] = [
  { id: 'td1', name: 'Hamid Koné', phone: '+225701234567', email: 'hamid@taxi.local', vehicle: 'Toyota Corolla blanc', notes: 'Fiable, parle français/anglais', margin_percent: 30 },
  { id: 'td2', name: 'Koffi Mensah', phone: '+225702345678', email: 'koffi@taxi.local', vehicle: 'Peugeot 307 grise', notes: 'Disponible WE', margin_percent: 25 },
  { id: 'td3', name: 'Bah Ousmane', phone: '+225703456789', email: null, vehicle: 'Nissan Almera bleu', notes: 'Nouveau', margin_percent: 35 },
]

export const mockTaxiTrips: TaxiTrip[] = [
  { id: 'trp1', date: '2026-02-05', start_time: '14:30', type: 'aero-to-center', taxi_driver_id: 'td1', booking_id: 'bk1', nb_persons: 2, nb_luggage: 2, nb_boardbags: 1, notes: null, price_paid_by_client: 50, price_cost_to_driver: 35, taxi_manager_margin: 5, center_margin: 10 },
  { id: 'trp2', date: '2026-02-07', start_time: '10:00', type: 'center-to-aero', taxi_driver_id: 'td2', booking_id: 'bk1', nb_persons: 2, nb_luggage: 2, nb_boardbags: 1, notes: 'Dépêche-toi!', price_paid_by_client: 50, price_cost_to_driver: 35, taxi_manager_margin: 4, center_margin: 11 },
  { id: 'trp3', date: '2026-02-10', start_time: '16:00', type: 'aero-to-spot', taxi_driver_id: null, booking_id: 'bk2', nb_persons: 4, nb_luggage: 3, nb_boardbags: 2, notes: 'Appel confirmé', price_paid_by_client: 70, price_cost_to_driver: 45, taxi_manager_margin: 8, center_margin: 17 },
  { id: 'trp4', date: '2026-02-12', start_time: '08:30', type: 'center-to-aero', taxi_driver_id: 'td3', booking_id: 'bk2', nb_persons: 1, nb_luggage: 1, nb_boardbags: 0, notes: null, price_paid_by_client: 40, price_cost_to_driver: 28, taxi_manager_margin: 3, center_margin: 9 },
  { id: 'trp5', date: '2026-02-18', start_time: '13:00', type: 'aero-to-center', taxi_driver_id: 'td1', booking_id: 'bk3', nb_persons: 3, nb_luggage: 2, nb_boardbags: 1, notes: 'Très volumineux', price_paid_by_client: 55, price_cost_to_driver: 38, taxi_manager_margin: 5, center_margin: 12 },
  { id: 'trp6', date: '2026-02-20', start_time: '11:00', type: 'center-to-town', taxi_driver_id: null, booking_id: 'bk3', nb_persons: 1, nb_luggage: 0, nb_boardbags: 0, notes: null, price_paid_by_client: 15, price_cost_to_driver: 10, taxi_manager_margin: 2, center_margin: 3 },
]

export const mockEquipment: Equipment[] = [
  // Kites
  { id: 'eq1', name: 'Kite 9m - Best Kahoona #2', category: 'kite', brand: 'Best', size: '9m', year: 2022, condition: 'good', notes: 'Excellent pour débutants', is_active: true },
  { id: 'eq2', name: 'Kite 12m - Cabrinha Apex', category: 'kite', brand: 'Cabrinha', size: '12m', year: 2023, condition: 'new', notes: null, is_active: true },
  { id: 'eq3', name: 'Kite 7m - Slingshot RPM', category: 'kite', brand: 'Slingshot', size: '7m', year: 2021, condition: 'good', notes: 'Wave riding', is_active: true },
  { id: 'eq4', name: 'Kite 14m - North Rebel', category: 'kite', brand: 'North', size: '14m', year: 2020, condition: 'fair', notes: 'Léger accroc réparé', is_active: true },
  { id: 'eq5', name: 'Kite 10m - Liquid Waverunner', category: 'kite', brand: 'Liquid', size: '10m', year: 2022, condition: 'good', notes: null, is_active: true },
  // Twintip boards
  { id: 'eq6', name: 'Board 138x41 - Liquid Rookie', category: 'board', brand: 'Liquid', size: '138x41cm', year: 2023, condition: 'new', notes: 'Débutants', is_active: true },
  { id: 'eq7', name: 'Board 136x39 - Best Pro', category: 'board', brand: 'Best', size: '136x39cm', year: 2021, condition: 'good', notes: null, is_active: true },
  { id: 'eq8', name: 'Board 141x43 - Cabrinha Big Air', category: 'board', brand: 'Cabrinha', size: '141x43cm', year: 2022, condition: 'fair', notes: 'Usure normale', is_active: true },
  { id: 'eq9', name: 'Board 135x40 - Slingshot Reflex', category: 'board', brand: 'Slingshot', size: '135x40cm', year: 2020, condition: 'fair', notes: null, is_active: true },
  // Surfboards
  { id: 'eq10', name: 'Surfboard 5\'2" - Ozone Wave', category: 'surfboard', brand: 'Ozone', size: '5\'2"', year: 2022, condition: 'good', notes: 'Vagues petites-moyennes', is_active: true },
  { id: 'eq11', name: 'Surfboard 5\'10" - Liquid Shredder', category: 'surfboard', brand: 'Liquid', size: '5\'10"', year: 2023, condition: 'new', notes: null, is_active: true },
  // Foilboard
  { id: 'eq12', name: 'Foilboard 90L - Best Aero', category: 'foilboard', brand: 'Best', size: '90L', year: 2023, condition: 'good', notes: 'Foil en excellent état', is_active: true },
]

export const mockEquipmentRentals: EquipmentRental[] = [
  { id: 'er1', equipment_id: 'eq1', booking_id: 'bk1', client_id: null, date: '2026-02-05', slot: 'morning', price: 25, notes: null },
  { id: 'er2', equipment_id: 'eq6', booking_id: 'bk1', client_id: null, date: '2026-02-05', slot: 'morning', price: 15, notes: null },
  { id: 'er3', equipment_id: 'eq2', booking_id: 'bk2', client_id: null, date: '2026-02-10', slot: 'full_day', price: 45, notes: null },
  { id: 'er4', equipment_id: 'eq7', booking_id: 'bk2', client_id: null, date: '2026-02-10', slot: 'full_day', price: 30, notes: null },
  { id: 'er5', equipment_id: 'eq10', booking_id: 'bk3', client_id: null, date: '2026-02-18', slot: 'afternoon', price: 20, notes: null },
  { id: 'er6', equipment_id: 'eq1', booking_id: null, client_id: 'c4', date: '2026-02-15', slot: 'morning', price: 25, notes: null },
  { id: 'er7', equipment_id: 'eq12', booking_id: null, client_id: 'c5', date: '2026-02-16', slot: 'full_day', price: 50, notes: 'Foil trial' },
  { id: 'er8', equipment_id: 'eq3', booking_id: 'bk1', client_id: null, date: '2026-02-07', slot: 'afternoon', price: 25, notes: null },
]


export const mockDiningEvents: import('../types/database').DiningEvent[] = [
  {
    id: 'ev1',
    name: 'Beach BBQ',
    date: '2026-02-18',
    time: '19:30',
    type: 'count',
    price_per_person: 15,
    notes: 'Bring your own drinks',
    attendees: [
      { id: 'ea1', person_id: 'i1', person_type: 'instructor', person_name: 'Pierrot Renard', room_label: '', is_attending: true, starter: '', main: '', side: '', dessert: '' },
      { id: 'ea2', person_id: 'i2', person_type: 'instructor', person_name: 'Mouss Blanc', room_label: '', is_attending: true, starter: '', main: '', side: '', dessert: '' },
      { id: 'ea3', person_id: 'p1a', person_type: 'client', person_name: 'Jean Dupont', room_label: 'H-1/F', is_attending: true, starter: '', main: '', side: '', dessert: '' },
      { id: 'ea4', person_id: 'p1b', person_type: 'client', person_name: 'Camille Dupont', room_label: 'H-1/F', is_attending: false, starter: '', main: '', side: '', dessert: '' },
    ],
  },
  {
    id: 'ev2',
    name: 'Restaurant Al-Farouk',
    date: '2026-02-10',
    time: '20:00',
    type: 'menu',
    price_per_person: 28,
    notes: 'Order by 17:00',
    attendees: [
      { id: 'eb1', person_id: 'i1', person_type: 'instructor', person_name: 'Pierrot Renard', room_label: '', is_attending: true, starter: 'Soup', main: 'Grilled fish', side: 'Rice', dessert: 'Cake' },
      { id: 'eb2', person_id: 'i3', person_type: 'instructor', person_name: 'Tere Moreau', room_label: '', is_attending: true, starter: 'Salad', main: 'Chicken', side: 'Fries', dessert: '' },
      { id: 'eb3', person_id: 'p2a', person_type: 'client', person_name: 'Marie Martin', room_label: 'H-2/F', is_attending: true, starter: '', main: 'Lamb', side: 'Couscous', dessert: 'Ice cream' },
    ],
  },
]

export const mockSharedLinks: SharedLink[] = [
  {
    id: 'sl1',
    token: 'forecast_abc123xyz',
    type: 'forecast',
    label: 'Forecast – Clients',
    params: {},
    created_at: '2026-02-22',
    expires_at: null,
    is_active: true,
  },
]
