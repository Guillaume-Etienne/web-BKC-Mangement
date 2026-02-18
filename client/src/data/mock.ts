import type { Accommodation, Room, Booking, BookingRoom, Client, Instructor, Lesson, PriceItem, DayActivity, TaxiDriver, TaxiTrip } from '../types/database'

export const mockAccommodations: Accommodation[] = [
  { id: 'h1', name: 'Maison 1', type: 'house', total_rooms: 2, is_active: true },
  { id: 'h2', name: 'Maison 2', type: 'house', total_rooms: 2, is_active: true },
  { id: 'h3', name: 'Maison 3', type: 'house', total_rooms: 2, is_active: true },
  { id: 'b1', name: 'Bungalow 1', type: 'bungalow', total_rooms: 1, is_active: true },
  { id: 'b2', name: 'Bungalow 2', type: 'bungalow', total_rooms: 1, is_active: true },
  { id: 'b3', name: 'Bungalow 3', type: 'bungalow', total_rooms: 1, is_active: true },
]

export const mockRooms: Room[] = [
  { id: 'r1', accommodation_id: 'h1', name: 'Chambre 1', capacity: 2 },
  { id: 'r2', accommodation_id: 'h1', name: 'Chambre 2', capacity: 2 },
  { id: 'r3', accommodation_id: 'h2', name: 'Chambre 1', capacity: 2 },
  { id: 'r4', accommodation_id: 'h2', name: 'Chambre 2', capacity: 3 },
  { id: 'r5', accommodation_id: 'h3', name: 'Chambre 1', capacity: 2 },
  { id: 'r6', accommodation_id: 'h3', name: 'Chambre 2', capacity: 2 },
  { id: 'r7', accommodation_id: 'b1', name: 'Chambre', capacity: 2 },
  { id: 'r8', accommodation_id: 'b2', name: 'Chambre', capacity: 2 },
  { id: 'r9', accommodation_id: 'b3', name: 'Chambre', capacity: 3 },
]

export const mockClients: Client[] = [
  { id: 'c1', first_name: 'Jean', last_name: 'Dupont', email: 'jean@mail.com', phone: null, notes: null, nationality: 'France', passport_number: 'AB123456', birth_date: '1990-05-15', kite_level: 'intermediate' },
  { id: 'c2', first_name: 'Marie', last_name: 'Martin', email: null, phone: '+33612345678', notes: null, nationality: 'Belgique', passport_number: 'BE789012', birth_date: '1985-08-22', kite_level: 'beginner' },
  { id: 'c3', first_name: 'Pierre', last_name: 'Durand', email: 'pierre@mail.com', phone: null, notes: 'Client régulier', nationality: 'Allemagne', passport_number: 'DE345678', birth_date: '1988-03-10', kite_level: 'advanced' },
  { id: 'c4', first_name: 'Sophie', last_name: 'Laurent', email: 'sophie@mail.com', phone: '+33698765432', notes: null, nationality: 'France', passport_number: 'AB234567', birth_date: '1992-12-05', kite_level: 'intermediate' },
  { id: 'c5', first_name: 'Luc', last_name: 'Müller', email: 'luc.muller@mail.com', phone: null, notes: 'Aime les bungalows', nationality: 'Suisse', passport_number: 'CH567890', birth_date: '1995-07-20', kite_level: 'beginner' },
]

export const mockBookings: Booking[] = [
  { id: 'bk1', client_id: 'c1', check_in: '2026-02-05', check_out: '2026-02-12', status: 'confirmed', notes: null, num_lessons: 3, num_equipment_rentals: 2, client: mockClients[0], arrival_time: '14:30', departure_time: '10:00', luggage_count: 2, boardbag_count: 1, taxi_arrival: true, taxi_departure: true, has_couple: true, children_count: 0, amount_paid: 500 },
  { id: 'bk2', client_id: 'c2', check_in: '2026-02-10', check_out: '2026-02-18', status: 'provisional', notes: null, num_lessons: 2, num_equipment_rentals: 3, client: mockClients[1], arrival_time: '16:00', departure_time: '11:00', luggage_count: 1, boardbag_count: 2, taxi_arrival: false, taxi_departure: true, has_couple: false, children_count: 2, amount_paid: 450 },
  { id: 'bk3', client_id: 'c3', check_in: '2026-02-15', check_out: '2026-02-22', status: 'confirmed', notes: null, num_lessons: 4, num_equipment_rentals: 1, client: mockClients[2], arrival_time: '13:15', departure_time: '09:00', luggage_count: 3, boardbag_count: 1, taxi_arrival: true, taxi_departure: false, has_couple: false, children_count: 1, amount_paid: 600 },
  { id: 'bk4', client_id: 'c1', check_in: '2026-02-20', check_out: '2026-02-28', status: 'cancelled', notes: 'Annulé par le client', num_lessons: 0, num_equipment_rentals: 0, client: mockClients[0], arrival_time: null, departure_time: null, luggage_count: 0, boardbag_count: 0, taxi_arrival: false, taxi_departure: false, has_couple: false, children_count: 0, amount_paid: 0 },
  { id: 'bk5', client_id: 'c2', check_in: '2026-02-01', check_out: '2026-02-08', status: 'confirmed', notes: null, num_lessons: 2, num_equipment_rentals: 2, client: mockClients[1], arrival_time: '15:45', departure_time: '10:30', luggage_count: 2, boardbag_count: 0, taxi_arrival: true, taxi_departure: true, has_couple: true, children_count: 0, amount_paid: 400 },
  { id: 'bk6', client_id: 'c3', check_in: '2026-03-01', check_out: '2026-03-10', status: 'provisional', notes: null, num_lessons: 1, num_equipment_rentals: 4, client: mockClients[2], arrival_time: '12:00', departure_time: '12:00', luggage_count: 1, boardbag_count: 3, taxi_arrival: false, taxi_departure: false, has_couple: false, children_count: 0, amount_paid: 300 },
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
  { id: 'l1', booking_id: 'bk1', instructor_id: 'i1', client_id: 'c1', date: '2026-02-05', start_time: '09:00', duration_hours: 1, type: 'private', notes: null },
  { id: 'l2', booking_id: 'bk1', instructor_id: 'i2', client_id: 'c1', date: '2026-02-07', start_time: '14:00', duration_hours: 1.5, type: 'private', notes: 'Vagues!' },
  { id: 'l3', booking_id: 'bk1', instructor_id: 'i1', client_id: 'c1', date: '2026-02-10', start_time: '10:00', duration_hours: 1, type: 'group', notes: null },
  { id: 'l4', booking_id: 'bk2', instructor_id: 'i3', client_id: 'c2', date: '2026-02-12', start_time: '15:00', duration_hours: 2, type: 'private', notes: 'Freestyle basics' },
  { id: 'l5', booking_id: 'bk3', instructor_id: 'i2', client_id: 'c3', date: '2026-02-18', start_time: '09:30', duration_hours: 1.5, type: 'supervision', notes: null },
  { id: 'l6', booking_id: 'bk3', instructor_id: 'i1', client_id: 'c3', date: '2026-02-20', start_time: '16:00', duration_hours: 1, type: 'private', notes: null },
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
