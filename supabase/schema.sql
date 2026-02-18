-- Schema SQL pour Supabase — Kitesurf Center Management
-- À exécuter manuellement dans le SQL Editor de Supabase Dashboard

-- Types enum
CREATE TYPE accommodation_type AS ENUM ('house', 'bungalow', 'other');
CREATE TYPE booking_status AS ENUM ('confirmed', 'provisional', 'cancelled');

-- Hébergements
CREATE TABLE accommodations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type accommodation_type NOT NULL,
  total_rooms INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Chambres
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accommodation_id UUID NOT NULL REFERENCES accommodations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Clients
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Réservations
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  status booking_status NOT NULL DEFAULT 'provisional',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT check_dates CHECK (check_out > check_in)
);

-- Table de liaison booking <-> rooms
CREATE TABLE booking_rooms (
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  PRIMARY KEY (booking_id, room_id)
);

-- Index
CREATE INDEX idx_bookings_dates ON bookings(check_in, check_out);
CREATE INDEX idx_bookings_client ON bookings(client_id);
CREATE INDEX idx_rooms_accommodation ON rooms(accommodation_id);

-- RLS : accès complet pour les utilisateurs authentifiés (2 admins)
ALTER TABLE accommodations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access" ON accommodations FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access" ON rooms FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access" ON clients FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access" ON bookings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access" ON booking_rooms FOR ALL USING (auth.role() = 'authenticated');
