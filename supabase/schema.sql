-- ============================================================
-- Schema SQL — Kitesurf Center Management
-- Version : mars 2026 — état complet et propre
-- ============================================================


-- ── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE accommodation_type              AS ENUM ('house', 'bungalow', 'other');
CREATE TYPE booking_status                  AS ENUM ('confirmed', 'provisional', 'cancelled');
CREATE TYPE lesson_type                     AS ENUM ('private', 'group', 'supervision');
CREATE TYPE day_slot                        AS ENUM ('morning', 'afternoon', 'evening');
CREATE TYPE price_category                  AS ENUM ('lesson', 'activity', 'rental', 'taxi');
CREATE TYPE taxi_trip_type                  AS ENUM ('aero-to-center', 'center-to-aero', 'aero-to-spot', 'spot-to-aero', 'center-to-town', 'town-to-center', 'other');
CREATE TYPE taxi_trip_status                AS ENUM ('confirmed', 'needs_details', 'done');
CREATE TYPE shared_link_type                AS ENUM ('forecast', 'taxi', 'client', 'driver', 'activity_provider');
CREATE TYPE equipment_category              AS ENUM ('kite', 'board', 'surfboard', 'foilboard');
CREATE TYPE equipment_condition             AS ENUM ('new', 'good', 'fair', 'damaged', 'retired');
CREATE TYPE rental_slot                     AS ENUM ('morning', 'afternoon', 'full_day');
CREATE TYPE payment_method                  AS ENUM ('cash_eur', 'cash_mzn', 'transfer', 'card_palmeiras');
CREATE TYPE consumption_type                AS ENUM ('lesson', 'rental', 'activity', 'center_access');
CREATE TYPE external_accommodation_provider AS ENUM ('palmeiras', 'other');
CREATE TYPE kite_level                      AS ENUM ('beg-total', 'beg-bodydrag', 'beg-waterstart', 'intermediate', 'advanced');
CREATE TYPE palmeiras_entry_type            AS ENUM ('expense', 'income');
CREATE TYPE event_person_type               AS ENUM ('instructor', 'participant', 'extra');
CREATE TYPE activity_provider_type          AS ENUM ('activity', 'safari');
CREATE TYPE activity_payment_flow           AS ENUM ('we_pay_provider', 'provider_pays_us');
CREATE TYPE activity_payment_direction      AS ENUM ('to_provider', 'from_provider');


-- ── Accommodations ────────────────────────────────────────────────────────────

CREATE TABLE accommodations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  type         accommodation_type NOT NULL,
  total_rooms  INTEGER NOT NULL DEFAULT 1,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE rooms (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accommodation_id  UUID NOT NULL REFERENCES accommodations(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  capacity          INTEGER NOT NULL DEFAULT 2,
  created_at        TIMESTAMPTZ DEFAULT now()
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
  import_id                   TEXT,   -- Google Forms dedup key
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
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number            INTEGER NOT NULL DEFAULT nextval('booking_number_seq') UNIQUE,
  client_id                 UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  check_in                  DATE NOT NULL,
  check_out                 DATE NOT NULL,
  visa_entry_date           DATE,
  visa_exit_date            DATE,
  status                    booking_status NOT NULL DEFAULT 'provisional',
  notes                     TEXT,
  num_lessons               INTEGER NOT NULL DEFAULT 0,
  num_equipment_rentals     INTEGER NOT NULL DEFAULT 0,
  num_center_access         INTEGER NOT NULL DEFAULT 0,
  arrival_time              TEXT,     -- HH:MM
  departure_time            TEXT,     -- HH:MM
  luggage_count             INTEGER NOT NULL DEFAULT 0,
  boardbag_count            INTEGER NOT NULL DEFAULT 0,
  taxi_arrival              BOOLEAN NOT NULL DEFAULT false,
  taxi_departure            BOOLEAN NOT NULL DEFAULT false,
  couples_count             INTEGER NOT NULL DEFAULT 0,
  children_count            INTEGER NOT NULL DEFAULT 0,
  amount_paid               NUMERIC(10,2) NOT NULL DEFAULT 0,
  import_id                 TEXT,     -- Google Forms dedup key
  emergency_contact_name    TEXT,
  emergency_contact_phone   TEXT,
  emergency_contact_email   TEXT,
  created_at                TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT check_dates CHECK (check_out > check_in)
);

CREATE UNIQUE INDEX idx_bookings_import_id ON bookings(import_id) WHERE import_id IS NOT NULL;
CREATE INDEX idx_bookings_dates   ON bookings(check_in, check_out);
CREATE INDEX idx_bookings_client  ON bookings(client_id);
CREATE INDEX idx_bookings_status  ON bookings(status);

-- Booking ↔ Rooms (many-to-many)
CREATE TABLE booking_rooms (
  booking_id  UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  PRIMARY KEY (booking_id, room_id)
);

-- Participants d'un booking (visa, leçons, location)
-- Remplace l'ancienne table `participants` (supprimée)
CREATE TABLE booking_participants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  first_name       TEXT NOT NULL,
  last_name        TEXT,
  passport_number  TEXT,
  client_id        UUID REFERENCES clients(id) ON DELETE SET NULL,
  kite_level       kite_level,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_booking_participants_booking ON booking_participants(booking_id);


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
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  instructor_id    UUID NOT NULL REFERENCES instructors(id),
  participant_ids  UUID[] NOT NULL DEFAULT '{}',  -- booking_participants.id[]
  date             DATE NOT NULL,
  start_time       TEXT NOT NULL,   -- HH:MM
  duration_hours   NUMERIC(4,2) NOT NULL DEFAULT 1,
  type             lesson_type NOT NULL,
  notes            TEXT,
  kite_id          UUID,            -- FK to equipment (nullable)
  board_id         UUID,            -- FK to equipment (nullable)
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lessons_booking    ON lessons(booking_id);
CREATE INDEX idx_lessons_instructor ON lessons(instructor_id);
CREATE INDEX idx_lessons_date       ON lessons(date);


-- ── Day Activities & Dining ───────────────────────────────────────────────────

CREATE TABLE day_activities (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date   DATE NOT NULL,
  slot   day_slot NOT NULL,
  name   TEXT NOT NULL,
  notes  TEXT
);

CREATE TABLE dining_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  date              DATE NOT NULL,
  time              TEXT NOT NULL,   -- HH:MM
  type              TEXT NOT NULL CHECK (type IN ('count', 'menu')),
  price_per_person  NUMERIC(8,2) NOT NULL DEFAULT 0,
  notes             TEXT,
  attendees         JSONB NOT NULL DEFAULT '[]',  -- EventAttendee[] dénormalisé
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
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id    UUID REFERENCES equipment(id),
  booking_id      UUID REFERENCES bookings(id) ON DELETE SET NULL,
  participant_id  UUID REFERENCES booking_participants(id) ON DELETE SET NULL,
  date            DATE NOT NULL,
  slot            rental_slot NOT NULL,
  price           NUMERIC(8,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rentals_date    ON equipment_rentals(date);
CREATE INDEX idx_rentals_booking ON equipment_rentals(booking_id);


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
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                DATE NOT NULL,
  start_time          TEXT NOT NULL,   -- HH:MM
  type                taxi_trip_type NOT NULL,
  status              taxi_trip_status NOT NULL DEFAULT 'confirmed',
  taxi_driver_id      UUID REFERENCES taxi_drivers(id) ON DELETE SET NULL,
  booking_id          UUID REFERENCES bookings(id) ON DELETE SET NULL,
  nb_persons          INTEGER NOT NULL DEFAULT 1,
  nb_luggage          INTEGER NOT NULL DEFAULT 0,
  nb_boardbags        INTEGER NOT NULL DEFAULT 0,
  notes               TEXT,
  -- Financials (MZN integers)
  price_client_mzn    INTEGER NOT NULL DEFAULT 8000,   -- what client pays
  margin_manager_mzn  INTEGER NOT NULL DEFAULT 1000,   -- intermediate manager cut
  margin_centre_mzn   INTEGER NOT NULL DEFAULT 1000,   -- our centre margin
  price_driver_mzn    INTEGER NOT NULL DEFAULT 6000,   -- = client - manager - centre
  price_eur           NUMERIC(10,2) NOT NULL DEFAULT 0,  -- frozen at save time
  exchange_rate       NUMERIC(10,4) NOT NULL DEFAULT 65.0,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE taxi_pricing_defaults (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_client_mzn    INTEGER NOT NULL DEFAULT 8000,
  margin_manager_mzn  INTEGER NOT NULL DEFAULT 1000,
  margin_centre_mzn   INTEGER NOT NULL DEFAULT 1000,
  eur_mzn_rate        NUMERIC(10,4) NOT NULL DEFAULT 65.0,
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Suivi des avances versées au manager intermédiaire
CREATE TABLE taxi_manager_payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL,
  amount_mzn  INTEGER NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_taxi_trips_date    ON taxi_trips(date);
CREATE INDEX idx_taxi_trips_driver  ON taxi_trips(taxi_driver_id);
CREATE INDEX idx_taxi_trips_booking ON taxi_trips(booking_id);


-- ── Shared Public Links ───────────────────────────────────────────────────────
-- Types : forecast | taxi | client | driver | activity_provider
-- token : '{type}_{10 random chars}'
-- params : { booking_number } pour client, { driver_id } pour driver, { provider_id } pour activity_provider

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


-- ── Activities & Safaris ──────────────────────────────────────────────────────
-- Prestataires externes (activités / safaris)
-- Modèle bidirectionnel : we_pay_provider ou provider_pays_us
-- Lien public par prestataire avec toggle show_prices

CREATE TABLE activity_providers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  type         activity_provider_type NOT NULL DEFAULT 'activity',
  phone        TEXT,
  email        TEXT,
  website      TEXT,
  notes        TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  show_prices  BOOLEAN NOT NULL DEFAULT false,  -- affiche onglet compta sur page publique
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE activity_bookings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id      UUID NOT NULL REFERENCES activity_providers(id) ON DELETE CASCADE,
  booking_id       UUID REFERENCES bookings(id) ON DELETE SET NULL,
  date             DATE NOT NULL,
  label            TEXT NOT NULL,
  nb_persons       INTEGER NOT NULL DEFAULT 1,
  participant_ids  UUID[] NOT NULL DEFAULT '{}',  -- booking_participants.id[]
  price_client     NUMERIC(8,2) NOT NULL DEFAULT 0,   -- ce que paie le client au centre
  price_provider   NUMERIC(8,2) NOT NULL DEFAULT 0,   -- ce que paie/reçoit le prestataire
  payment_flow     activity_payment_flow NOT NULL DEFAULT 'we_pay_provider',
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE activity_payments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id  UUID NOT NULL REFERENCES activity_providers(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  amount       NUMERIC(8,2) NOT NULL,
  direction    activity_payment_direction NOT NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activity_bookings_provider ON activity_bookings(provider_id);
CREATE INDEX idx_activity_bookings_date     ON activity_bookings(date);
CREATE INDEX idx_activity_payments_provider ON activity_payments(provider_id);


-- ── Accounting ────────────────────────────────────────────────────────────────

CREATE TABLE seasons (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT NOT NULL,       -- e.g. "2025-2026"
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL
);

CREATE TABLE house_rentals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accommodation_id   UUID NOT NULL REFERENCES accommodations(id) ON DELETE CASCADE,
  start_date         DATE NOT NULL,
  end_date           DATE NOT NULL,
  total_cost         NUMERIC(10,2) NOT NULL,
  notes              TEXT
);

CREATE TABLE room_rates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id          TEXT NOT NULL,  -- room UUID ou 'full_{accommodation_id}'
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
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  provider              external_accommodation_provider NOT NULL,
  cost_per_night        NUMERIC(8,2) NOT NULL DEFAULT 0,
  sell_price_per_night  NUMERIC(8,2) NOT NULL DEFAULT 0,
  notes                 TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE external_accommodation_bookings (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id                 UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  external_accommodation_id  UUID NOT NULL REFERENCES external_accommodations(id),
  check_in                   DATE NOT NULL,
  check_out                  DATE NOT NULL,
  cost_per_night             NUMERIC(8,2) NOT NULL,  -- snapshot
  sell_price_per_night       NUMERIC(8,2) NOT NULL,  -- snapshot
  notes                      TEXT
);

CREATE TABLE payments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  amount       NUMERIC(10,2) NOT NULL,
  method       payment_method NOT NULL,
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
  participant_id  UUID NOT NULL REFERENCES booking_participants(id) ON DELETE CASCADE,
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


-- ── Email Logs ───────────────────────────────────────────────────────────────

CREATE TYPE email_log_type   AS ENUM ('booking_confirmation', 'visa_letter', 'travel_guide');
CREATE TYPE email_log_status AS ENUM ('pending', 'sent', 'delivered', 'opened', 'failed');

CREATE TABLE email_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  type            email_log_type   NOT NULL,
  status          email_log_status NOT NULL DEFAULT 'pending',
  recipient_email TEXT NOT NULL,
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  error           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_email_logs_booking ON email_logs(booking_id);


-- ── Travel Guide ──────────────────────────────────────────────────────────────

CREATE TABLE travel_guide_sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,   -- e.g. 'weather', 'transport'
  title_fr    TEXT NOT NULL,
  title_en    TEXT NOT NULL,
  title_es    TEXT NOT NULL,
  body_fr     TEXT NOT NULL DEFAULT '',
  body_en     TEXT NOT NULL DEFAULT '',
  body_es     TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- RLS — Row Level Security
-- Règle de base : authentifié = accès complet, anon = rien
-- Exceptions : tables avec accès public en lecture (pages partagées)
-- ============================================================

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'accommodations', 'rooms',
    'clients', 'bookings', 'booking_rooms', 'booking_participants',
    'instructors', 'lessons',
    'day_activities', 'dining_events',
    'price_items',
    'equipment', 'equipment_rentals',
    'taxi_drivers', 'taxi_trips', 'taxi_pricing_defaults', 'taxi_manager_payments',
    'shared_links',
    'activity_providers', 'activity_bookings', 'activity_payments',
    'seasons', 'house_rentals', 'room_rates', 'booking_room_prices',
    'external_accommodations', 'external_accommodation_bookings',
    'payments', 'participant_consumptions',
    'instructor_debts', 'instructor_payments', 'lesson_rate_overrides',
    'expenses',
    'palmeiras_rents', 'palmeiras_reversals', 'palmeiras_entries', 'palmeiras_sub_lets',
    'travel_guide_sections',
    'email_logs'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY "admin_all" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t
    );
  END LOOP;
END $$;

-- Accès anon : shared_links (validation token)
CREATE POLICY "anon_read_shared_links" ON shared_links
  FOR SELECT TO anon
  USING (is_active = true AND (expires_at IS NULL OR expires_at >= CURRENT_DATE));

-- Accès anon : données nécessaires aux pages publiques (forecast, taxi, client, driver, activity)
CREATE POLICY "anon_read_taxi_trips"    ON taxi_trips     FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_taxi_drivers"  ON taxi_drivers   FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_lessons"       ON lessons        FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_instructors"   ON instructors    FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_bookings"      ON bookings       FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_clients"       ON clients        FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_activity_providers"    ON activity_providers    FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_activity_bookings"     ON activity_bookings     FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_activity_payments"     ON activity_payments     FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_equipment"             ON equipment             FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_equipment_rentals"     ON equipment_rentals     FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_participant_consumptions" ON participant_consumptions FOR SELECT TO anon USING (true);

-- Accès anon : données supplémentaires pour ClientSharePage
CREATE POLICY "anon_read_booking_participants"  ON booking_participants  FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_dining_events"         ON dining_events         FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_lesson_rate_overrides" ON lesson_rate_overrides FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_ext_accom_bookings"    ON external_accommodation_bookings FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_ext_accommodations"    ON external_accommodations FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_booking_rooms"         ON booking_rooms         FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_booking_room_prices"   ON booking_room_prices   FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_rooms"                 ON rooms                 FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_accommodations"        ON accommodations        FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_payments"              ON payments              FOR SELECT TO anon USING (true);
