-- ============================================================
-- Schema SQL — Kitesurf Center Management
-- À exécuter dans le SQL Editor de Supabase Dashboard
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE accommodation_type          AS ENUM ('house', 'bungalow', 'other');
CREATE TYPE booking_status              AS ENUM ('confirmed', 'provisional', 'cancelled');
CREATE TYPE lesson_type                 AS ENUM ('private', 'group', 'supervision');
CREATE TYPE day_slot                    AS ENUM ('morning', 'afternoon', 'evening');
CREATE TYPE price_category              AS ENUM ('lesson', 'activity', 'rental', 'taxi');
CREATE TYPE taxi_trip_type              AS ENUM ('aero-to-center', 'center-to-aero', 'aero-to-spot', 'spot-to-aero', 'center-to-town', 'town-to-center', 'other');
CREATE TYPE taxi_trip_status            AS ENUM ('confirmed', 'needs_details', 'done');
CREATE TYPE shared_link_type            AS ENUM ('forecast', 'taxi');
CREATE TYPE equipment_category          AS ENUM ('kite', 'board', 'surfboard', 'foilboard');
CREATE TYPE equipment_condition         AS ENUM ('new', 'good', 'fair', 'damaged', 'retired');
CREATE TYPE rental_slot                 AS ENUM ('morning', 'afternoon', 'full_day');
CREATE TYPE payment_method              AS ENUM ('cash_eur', 'cash_mzn', 'transfer', 'card_palmeiras');
CREATE TYPE consumption_type            AS ENUM ('lesson', 'rental', 'activity', 'center_access');
CREATE TYPE external_accommodation_provider AS ENUM ('palmeiras', 'other');
CREATE TYPE kite_level                  AS ENUM ('beg-total', 'beg-bodydrag', 'beg-waterstart', 'intermediate', 'advanced');
CREATE TYPE palmeiras_entry_type        AS ENUM ('expense', 'income');
CREATE TYPE event_person_type           AS ENUM ('instructor', 'client', 'extra');


-- ── Core — Accommodations ─────────────────────────────────────────────────────

CREATE TABLE accommodations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  type         accommodation_type NOT NULL,
  total_rooms  INTEGER NOT NULL DEFAULT 1,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE rooms (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accommodation_id   UUID NOT NULL REFERENCES accommodations(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  capacity           INTEGER NOT NULL DEFAULT 2,
  created_at         TIMESTAMPTZ DEFAULT now()
);


-- ── Clients ───────────────────────────────────────────────────────────────────

CREATE TABLE clients (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name                  TEXT NOT NULL,
  last_name                   TEXT NOT NULL,
  email                       TEXT,
  phone                       TEXT,
  notes                       TEXT,
  nationality                 TEXT,
  passport_number             TEXT,
  birth_date                  DATE,
  kite_level                  kite_level,
  import_id                   TEXT,           -- Google Forms dedup key
  emergency_contact_name      TEXT,
  emergency_contact_phone     TEXT,
  emergency_contact_email     TEXT,
  emergency_contact_relation  TEXT,
  created_at                  TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_clients_import_id ON clients(import_id) WHERE import_id IS NOT NULL;


-- ── Bookings ──────────────────────────────────────────────────────────────────

CREATE SEQUENCE booking_number_seq START 1;

CREATE TABLE bookings (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number              INTEGER NOT NULL DEFAULT nextval('booking_number_seq') UNIQUE,
  client_id                   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  check_in                    DATE NOT NULL,
  check_out                   DATE NOT NULL,
  visa_entry_date             DATE,
  visa_exit_date              DATE,
  status                      booking_status NOT NULL DEFAULT 'provisional',
  notes                       TEXT,
  num_lessons                 INTEGER NOT NULL DEFAULT 0,
  num_equipment_rentals       INTEGER NOT NULL DEFAULT 0,
  num_center_access           INTEGER NOT NULL DEFAULT 0,
  arrival_time                TEXT,
  departure_time              TEXT,
  luggage_count               INTEGER NOT NULL DEFAULT 0,
  boardbag_count              INTEGER NOT NULL DEFAULT 0,
  taxi_arrival                BOOLEAN NOT NULL DEFAULT false,
  taxi_departure              BOOLEAN NOT NULL DEFAULT false,
  couples_count               INTEGER NOT NULL DEFAULT 0,
  children_count              INTEGER NOT NULL DEFAULT 0,
  amount_paid                 NUMERIC(10,2) NOT NULL DEFAULT 0,
  import_id                   TEXT,           -- Google Forms dedup key
  emergency_contact_name      TEXT,
  emergency_contact_phone     TEXT,
  emergency_contact_email     TEXT,
  created_at                  TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT check_dates CHECK (check_out > check_in)
);

CREATE UNIQUE INDEX idx_bookings_import_id ON bookings(import_id) WHERE import_id IS NOT NULL;
CREATE INDEX idx_bookings_dates    ON bookings(check_in, check_out);
CREATE INDEX idx_bookings_client   ON bookings(client_id);
CREATE INDEX idx_bookings_status   ON bookings(status);

-- Booking ↔ Rooms
CREATE TABLE booking_rooms (
  booking_id  UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  PRIMARY KEY (booking_id, room_id)
);

-- Participants (travelling companions on a booking)
CREATE TABLE participants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  passport_number  TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_participants_booking ON participants(booking_id);


-- ── Instructors & Lessons ─────────────────────────────────────────────────────

CREATE TABLE instructors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  email             TEXT,
  phone             TEXT,
  specialties       TEXT[] NOT NULL DEFAULT '{}',
  rate_private      NUMERIC(8,2) NOT NULL DEFAULT 0,
  rate_group        NUMERIC(8,2) NOT NULL DEFAULT 0,
  rate_supervision  NUMERIC(8,2) NOT NULL DEFAULT 0,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lessons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  instructor_id   UUID NOT NULL REFERENCES instructors(id),
  date            DATE NOT NULL,
  start_time      TEXT NOT NULL,    -- HH:MM
  duration_hours  NUMERIC(4,2) NOT NULL DEFAULT 1,
  type            lesson_type NOT NULL,
  notes           TEXT,
  kite_id         UUID,             -- FK to equipment (nullable)
  board_id        UUID,             -- FK to equipment (nullable)
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lessons_booking    ON lessons(booking_id);
CREATE INDEX idx_lessons_instructor ON lessons(instructor_id);
CREATE INDEX idx_lessons_date       ON lessons(date);

-- Lesson ↔ Clients (1 private/supervision → 1, group → N)
CREATE TABLE lesson_clients (
  lesson_id   UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  PRIMARY KEY (lesson_id, client_id)
);


-- ── Day Activities (Now tab) ───────────────────────────────────────────────────

CREATE TABLE day_activities (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date   DATE NOT NULL,
  slot   day_slot NOT NULL,
  name   TEXT NOT NULL,
  notes  TEXT
);

-- Dining events
CREATE TABLE dining_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  date              DATE NOT NULL,
  time              TEXT NOT NULL,
  type              TEXT NOT NULL CHECK (type IN ('count', 'menu')),
  price_per_person  NUMERIC(8,2) NOT NULL DEFAULT 0,
  notes             TEXT,
  -- Attendees stored as JSONB array (denormalized for simplicity)
  attendees         JSONB NOT NULL DEFAULT '[]',
  created_at        TIMESTAMPTZ DEFAULT now()
);


-- ── Pricing ───────────────────────────────────────────────────────────────────

CREATE TABLE price_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category     price_category NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  price        NUMERIC(10,2) NOT NULL,
  unit         TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);


-- ── Equipment ─────────────────────────────────────────────────────────────────

CREATE TABLE equipment (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  category   equipment_category NOT NULL,
  brand      TEXT,
  size       TEXT,
  year       INTEGER,
  condition  equipment_condition NOT NULL DEFAULT 'good',
  notes      TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE equipment_rentals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id  UUID NOT NULL REFERENCES equipment(id),
  booking_id    UUID REFERENCES bookings(id) ON DELETE SET NULL,
  client_id     UUID REFERENCES clients(id) ON DELETE SET NULL,
  date          DATE NOT NULL,
  slot          rental_slot NOT NULL,
  price         NUMERIC(8,2) NOT NULL DEFAULT 0,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rentals_date     ON equipment_rentals(date);
CREATE INDEX idx_rentals_booking  ON equipment_rentals(booking_id);


-- ── Taxis ─────────────────────────────────────────────────────────────────────

CREATE TABLE taxi_drivers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  vehicle         TEXT,
  notes           TEXT,
  margin_percent  NUMERIC(5,2) NOT NULL DEFAULT 30,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE taxi_trips (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                    DATE NOT NULL,
  start_time              TEXT NOT NULL,  -- HH:MM
  type                    taxi_trip_type NOT NULL,
  status                  taxi_trip_status NOT NULL DEFAULT 'confirmed',
  taxi_driver_id          UUID REFERENCES taxi_drivers(id) ON DELETE SET NULL,
  booking_id              UUID REFERENCES bookings(id) ON DELETE SET NULL,
  nb_persons              INTEGER NOT NULL DEFAULT 1,
  nb_luggage              INTEGER NOT NULL DEFAULT 0,
  nb_boardbags            INTEGER NOT NULL DEFAULT 0,
  notes                   TEXT,
  price_client_mzn        INTEGER NOT NULL DEFAULT 8000,
  margin_manager_mzn      INTEGER NOT NULL DEFAULT 1000,
  margin_centre_mzn       INTEGER NOT NULL DEFAULT 1000,
  price_driver_mzn        INTEGER NOT NULL DEFAULT 6000,
  price_eur               NUMERIC(10,2) NOT NULL DEFAULT 0,
  exchange_rate           NUMERIC(10,4) NOT NULL DEFAULT 65.0,
  created_at              TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE taxi_pricing_defaults (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_client_mzn    INTEGER NOT NULL DEFAULT 8000,
  margin_manager_mzn  INTEGER NOT NULL DEFAULT 1000,
  margin_centre_mzn   INTEGER NOT NULL DEFAULT 1000,
  eur_mzn_rate        NUMERIC(10,4) NOT NULL DEFAULT 65.0,
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_taxi_trips_date    ON taxi_trips(date);
CREATE INDEX idx_taxi_trips_driver  ON taxi_trips(taxi_driver_id);
CREATE INDEX idx_taxi_trips_booking ON taxi_trips(booking_id);


-- ── Shared Public Links ───────────────────────────────────────────────────────

CREATE TABLE shared_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token       TEXT NOT NULL UNIQUE,
  type        shared_link_type NOT NULL,
  label       TEXT NOT NULL,
  params      JSONB NOT NULL DEFAULT '{}',
  created_at  DATE NOT NULL DEFAULT CURRENT_DATE,
  expires_at  DATE,
  is_active   BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_shared_links_token ON shared_links(token);


-- ── Accounting ────────────────────────────────────────────────────────────────

CREATE TABLE seasons (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT NOT NULL,       -- e.g. "2025-2026"
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL
);

CREATE TABLE room_rates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id          TEXT NOT NULL,  -- room UUID or 'full_{accommodation_id}'
  price_per_night  NUMERIC(8,2) NOT NULL,
  notes            TEXT
);

CREATE TABLE booking_room_prices (
  booking_id       UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  room_id          UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  price_per_night  NUMERIC(8,2) NOT NULL,
  override_note    TEXT,
  PRIMARY KEY (booking_id, room_id)
);

CREATE TABLE external_accommodations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  provider             external_accommodation_provider NOT NULL,
  cost_per_night       NUMERIC(8,2) NOT NULL DEFAULT 0,
  sell_price_per_night NUMERIC(8,2) NOT NULL DEFAULT 0,
  notes                TEXT,
  is_active            BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE external_accommodation_bookings (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id                 UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  external_accommodation_id  UUID NOT NULL REFERENCES external_accommodations(id),
  check_in                   DATE NOT NULL,
  check_out                  DATE NOT NULL,
  cost_per_night             NUMERIC(8,2) NOT NULL,   -- snapshot
  sell_price_per_night       NUMERIC(8,2) NOT NULL,   -- snapshot
  notes                      TEXT
);

CREATE TABLE payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  amount      NUMERIC(10,2) NOT NULL,
  method      payment_method NOT NULL,
  is_deposit   BOOLEAN NOT NULL DEFAULT false,
  is_verified  BOOLEAN NOT NULL DEFAULT false,
  is_discount  BOOLEAN NOT NULL DEFAULT false,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payments_booking ON payments(booking_id);

CREATE TABLE participant_consumptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  participant_id  UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  type            consumption_type NOT NULL,
  quantity        NUMERIC(8,2) NOT NULL DEFAULT 1,
  unit_price      NUMERIC(8,2) NOT NULL DEFAULT 0,
  notes           TEXT
);

CREATE TABLE instructor_debts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id  UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  date           DATE NOT NULL,
  amount         NUMERIC(10,2) NOT NULL,
  description    TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE instructor_payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id  UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  date           DATE NOT NULL,
  amount         NUMERIC(10,2) NOT NULL,
  method         payment_method NOT NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_instructor_debts_instructor    ON instructor_debts(instructor_id);
CREATE INDEX idx_instructor_payments_instructor ON instructor_payments(instructor_id);

CREATE TABLE lesson_rate_overrides (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id  UUID NOT NULL UNIQUE REFERENCES lessons(id) ON DELETE CASCADE,
  rate       NUMERIC(8,2) NOT NULL,
  note       TEXT NOT NULL
);

CREATE TABLE expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date         DATE NOT NULL,
  category     TEXT NOT NULL,
  amount       NUMERIC(10,2) NOT NULL,
  description  TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_expenses_date ON expenses(date);


-- ── Palmeiras ─────────────────────────────────────────────────────────────────

CREATE TABLE palmeiras_rents (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month   TEXT NOT NULL UNIQUE,   -- YYYY-MM
  amount  NUMERIC(10,2) NOT NULL,
  notes   TEXT
);

CREATE TABLE palmeiras_reversals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month         TEXT NOT NULL UNIQUE,   -- YYYY-MM
  gross_amount  NUMERIC(10,2) NOT NULL,
  percent       NUMERIC(5,2) NOT NULL,
  net_amount    NUMERIC(10,2) NOT NULL,
  notes         TEXT
);

CREATE TABLE palmeiras_entries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month        TEXT NOT NULL,   -- YYYY-MM
  type         palmeiras_entry_type NOT NULL,
  description  TEXT NOT NULL,
  amount       NUMERIC(10,2) NOT NULL
);

CREATE TABLE palmeiras_sub_lets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month           TEXT NOT NULL,   -- YYYY-MM
  bungalow        TEXT NOT NULL,
  check_in        DATE NOT NULL,
  check_out       DATE NOT NULL,
  nights          INTEGER NOT NULL,
  cost_per_night  NUMERIC(8,2) NOT NULL,
  sell_per_night  NUMERIC(8,2) NOT NULL,
  booking_ref     TEXT,
  notes           TEXT
);


-- ── Travel Guide ──────────────────────────────────────────────────────────────

CREATE TABLE travel_guide_sections (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key      TEXT NOT NULL UNIQUE,   -- e.g. 'weather', 'transport'
  title_fr TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_es TEXT NOT NULL,
  body_fr  TEXT NOT NULL DEFAULT '',
  body_en  TEXT NOT NULL DEFAULT '',
  body_es  TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- RLS — Row Level Security
-- Règle : authentifié = accès complet / anonyme = rien
-- (Les liens publics seront gérés avec des policies dédiées)
-- ============================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'accommodations', 'rooms',
    'clients', 'bookings', 'booking_rooms', 'participants',
    'instructors', 'lessons', 'lesson_clients',
    'day_activities', 'dining_events',
    'price_items',
    'equipment', 'equipment_rentals',
    'taxi_drivers', 'taxi_trips',
    'shared_links',
    'seasons', 'room_rates', 'booking_room_prices',
    'external_accommodations', 'external_accommodation_bookings',
    'payments', 'participant_consumptions',
    'instructor_debts', 'instructor_payments', 'lesson_rate_overrides',
    'expenses',
    'palmeiras_rents', 'palmeiras_reversals', 'palmeiras_entries', 'palmeiras_sub_lets',
    'travel_guide_sections'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY "admin_all" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;

-- Accès anonyme en lecture seule sur shared_links (pour valider un token)
CREATE POLICY "anon_read_shared_links" ON shared_links
  FOR SELECT TO anon
  USING (is_active = true AND (expires_at IS NULL OR expires_at >= CURRENT_DATE));

-- Accès anonyme en lecture sur taxi_trips (pour la page publique taxi)
CREATE POLICY "anon_read_taxi_trips" ON taxi_trips
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_taxi_drivers" ON taxi_drivers
  FOR SELECT TO anon USING (true);

-- Accès anonyme en lecture sur les données nécessaires au forecast public
CREATE POLICY "anon_read_lessons" ON lessons
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_instructors" ON instructors
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_bookings" ON bookings
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_clients" ON clients
  FOR SELECT TO anon USING (true);

-- ── À exécuter dans SQL Editor (Supabase dashboard) ────────────────────────
-- Taxi manager payments — track advances paid to the intermediate manager
CREATE TABLE taxi_manager_payments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date       DATE NOT NULL,
  amount_mzn INTEGER NOT NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE taxi_manager_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth" ON taxi_manager_payments
  FOR ALL USING (auth.role() = 'authenticated');
