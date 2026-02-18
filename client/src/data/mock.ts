import type { Accommodation, Room, Booking, BookingRoom, Client } from '../types/database'

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
  { id: 'c1', first_name: 'Jean', last_name: 'Dupont', email: 'jean@mail.com', phone: null, notes: null },
  { id: 'c2', first_name: 'Marie', last_name: 'Martin', email: null, phone: '+33612345678', notes: null },
  { id: 'c3', first_name: 'Pierre', last_name: 'Durand', email: 'pierre@mail.com', phone: null, notes: 'Client régulier' },
]

export const mockBookings: Booking[] = [
  { id: 'bk1', client_id: 'c1', check_in: '2026-02-05', check_out: '2026-02-12', status: 'confirmed', notes: null, num_lessons: 3, num_equipment_rentals: 2, client: mockClients[0] },
  { id: 'bk2', client_id: 'c2', check_in: '2026-02-10', check_out: '2026-02-18', status: 'provisional', notes: null, num_lessons: 2, num_equipment_rentals: 3, client: mockClients[1] },
  { id: 'bk3', client_id: 'c3', check_in: '2026-02-15', check_out: '2026-02-22', status: 'confirmed', notes: null, num_lessons: 4, num_equipment_rentals: 1, client: mockClients[2] },
  { id: 'bk4', client_id: 'c1', check_in: '2026-02-20', check_out: '2026-02-28', status: 'cancelled', notes: 'Annulé par le client', num_lessons: 0, num_equipment_rentals: 0, client: mockClients[0] },
  { id: 'bk5', client_id: 'c2', check_in: '2026-02-01', check_out: '2026-02-08', status: 'confirmed', notes: null, num_lessons: 2, num_equipment_rentals: 2, client: mockClients[1] },
  { id: 'bk6', client_id: 'c3', check_in: '2026-03-01', check_out: '2026-03-10', status: 'provisional', notes: null, num_lessons: 1, num_equipment_rentals: 4, client: mockClients[2] },
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
