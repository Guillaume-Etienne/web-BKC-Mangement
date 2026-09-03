-- ============================================================
-- Schema SQL — Kitesurf Center Management
-- Version : mars 2026 — état complet et propre
-- ============================================================


-- ── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE accommodation_type              AS ENUM ('house', 'bungalow', 'other');
CREATE TYPE booking_status                  AS ENUM ('confirmed', 'provisional', 'cancelled');
CREATE TYPE lesson_type                     AS ENUM ('private', 'group', 'supervision');
CREATE TYPE day_slot                        AS ENUM ('morning', 'afternoon', 'evening');
-- 'taxi' retiré le 2026-07-30 : ces lignes n'étaient lues par aucun calcul et ne
-- s'affichaient nulle part (le réglage taxi vit dans taxi_pricing_defaults).
CREATE TYPE price_category                  AS ENUM ('lesson', 'activity', 'rental', 'meal', 'center_access');
CREATE TYPE taxi_trip_type                  AS ENUM ('aero-to-center', 'center-to-aero', 'aero-to-spot', 'spot-to-aero', 'center-to-town', 'town-to-center', 'other');
CREATE TYPE taxi_trip_status                AS ENUM ('confirmed', 'needs_details', 'done');
CREATE TYPE shared_link_type                AS ENUM ('forecast', 'taxi', 'client', 'driver', 'taxi_manager', 'activity_provider', 'booking_form', 'restaurant', 'enquiry_form');
CREATE TYPE equipment_category              AS ENUM ('kite', 'board', 'surfboard', 'foilboard');
-- Tout ce que l'app facture automatiquement : une valeur = un tarif (index unique sur
-- price_items). Brancher un nouveau poste = ajouter une valeur, pas une colonne.
-- ('free'/« Other » en location n'y est pas : 0 par définition.)
CREATE TYPE billable_type                   AS ENUM (
  'lesson_private', 'lesson_group', 'lesson_supervision',
  'rental_kite', 'rental_board', 'rental_full', 'rental_surfboard', 'rental_foilboard',
  'center_access', 'meal'
);
CREATE TYPE equipment_condition             AS ENUM ('new', 'good', 'fair', 'damaged', 'retired');
CREATE TYPE rental_slot                     AS ENUM ('morning', 'afternoon', 'full_day');
CREATE TYPE payment_method                  AS ENUM ('cash_eur', 'cash_mzn', 'transfer', 'card_palmeiras');
CREATE TYPE kite_level                      AS ENUM ('beg-total', 'beg-bodydrag', 'beg-waterstart', 'intermediate', 'advanced');
CREATE TYPE palmeiras_entry_type            AS ENUM ('expense', 'income');
CREATE TYPE event_person_type               AS ENUM ('instructor', 'participant', 'extra');
CREATE TYPE activity_provider_type          AS ENUM ('activity', 'safari');
CREATE TYPE activity_payment_flow           AS ENUM ('we_pay_provider', 'provider_pays_us');
CREATE TYPE activity_payment_direction      AS ENUM ('to_provider', 'from_provider');
CREATE TYPE form_submission_status          AS ENUM ('pending', 'approved', 'rejected');


-- ── Accommodations ────────────────────────────────────────────────────────────

CREATE TABLE accommodations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  type            accommodation_type NOT NULL,
  total_rooms     INTEGER NOT NULL DEFAULT 1,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  cost_per_night  NUMERIC(10,2),   -- what we pay the owner (bungalows); NULL for owned houses
  -- true = carries no room_rate; the amount lives on external_accommodation_bookings,
  -- case by case (San Martinho, the "No accommodation" row). Exempt from the
  -- "no sell price" badge. See 2026-08-11_external_stays_flat_rate.sql.
  external_billing BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
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


-- ── Partner agencies (Fun&Fly & co.) ─────────────────────────────────────────
-- Foundations only, posed 2026-08-16b. See agency_rate_items / agency_billing_lines
-- below (after booking_participants) and .claude/docs/BACKLOG.md for the roadmap
-- (nothing writes agency_billing_lines yet — wizard/planning wiring is Phase 2+).

CREATE TABLE agencies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  commission_percent  NUMERIC(5,2) NOT NULL DEFAULT 0,
  notes               TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT now()
);

REVOKE ALL ON agencies FROM anon;  -- admin only, jamais anon


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
  -- Activity counters: denormalized CACHE recomputed from booking_participants flags
  -- on every participant write (source of truth = booking_participants.*). See deriveActivityCounts().
  num_lessons               INTEGER NOT NULL DEFAULT 0,   -- = count(participants.wants_kite_lessons)
  num_equipment_rentals     INTEGER NOT NULL DEFAULT 0,   -- = count(participants.wants_kite_rental)
  num_wing_lessons          INTEGER NOT NULL DEFAULT 0,   -- = count(participants.wants_wing_lessons)
  num_center_access         INTEGER NOT NULL DEFAULT 0,   -- = count(participants.brings_own_gear) — billed via center_access_rate
  center_access_rate        NUMERIC(10,2) NOT NULL DEFAULT 5,  -- €/day per center-access (own-gear) person
  arrival_time              TEXT,     -- HH:MM
  departure_time            TEXT,     -- HH:MM
  luggage_count             INTEGER NOT NULL DEFAULT 0,
  boardbag_count            INTEGER NOT NULL DEFAULT 0,
  taxi_arrival              BOOLEAN NOT NULL DEFAULT false,
  taxi_departure            BOOLEAN NOT NULL DEFAULT false,
  couples_count             INTEGER NOT NULL DEFAULT 0,
  children_count            INTEGER NOT NULL DEFAULT 0,
  amount_paid               NUMERIC(10,2) NOT NULL DEFAULT 0,
  import_id                 TEXT,     -- Google Forms dedup key / form_submission id
  emergency_contact_name    TEXT,
  emergency_contact_phone   TEXT,
  emergency_contact_email   TEXT,
  has_travel_insurance      BOOLEAN NOT NULL DEFAULT false,
  waiver_accepted_at        TIMESTAMPTZ,  -- when client accepted the liability waiver
  waiver_version            TEXT,         -- version string of the accepted waiver text
  referral_source           TEXT,         -- "how did you hear about us"
  agency_id                 UUID REFERENCES agencies(id) ON DELETE SET NULL,  -- 2026-08-16b, foundations only
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
  -- Per-traveler kite activity (source of truth for the booking num_* counters)
  does_kite          BOOLEAN NOT NULL DEFAULT false,
  brings_own_gear    BOOLEAN NOT NULL DEFAULT false,  -- own gear → billed center access
  needs_storage      BOOLEAN NOT NULL DEFAULT false,
  wants_kite_lessons BOOLEAN NOT NULL DEFAULT false,
  wants_kite_rental  BOOLEAN NOT NULL DEFAULT false,
  wants_wing_lessons BOOLEAN NOT NULL DEFAULT false,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_booking_participants_booking ON booking_participants(booking_id);


-- ── Partner agencies, continued (grille tarifaire + lignes facturables) ──────
-- Foundations only, posed 2026-08-16b — nothing writes agency_billing_lines yet.

CREATE TABLE agency_rate_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id    UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  category     TEXT NOT NULL CHECK (category IN ('lesson', 'rental', 'transfer', 'accommodation')),
  label        TEXT NOT NULL,
  unit_hours   NUMERIC(5,2),                    -- package size, category='lesson' only
  price        NUMERIC(10,2) NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,    -- deactivate, never delete — see price_items
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agency_rate_items_agency ON agency_rate_items(agency_id);

-- One invoice sent to a partner agency, for one booking (gui: "une factu = une
-- résa"). Shaped after the real Fun & Fly template, which prints TWO numbers:
-- ours (`invoice_number`, the issue date as YYYYMMDD, suffixed -2 for a second
-- one the same day) and theirs (`agency_ref`, printed as "ref F&Fly : 134606").
-- Deliberately no UNIQUE (booking_id, agency_id): a service added after the first
-- invoice went out needs a second invoice on the same booking.
CREATE TABLE agency_invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id      UUID NOT NULL REFERENCES agencies(id),
  booking_id     UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  agency_ref     TEXT,
  issued_on      DATE NOT NULL DEFAULT CURRENT_DATE,
  invoiced_at    TIMESTAMPTZ,   -- sent
  paid_at        TIMESTAMPTZ,   -- settled; feeds the CashFlow "Agencies" column
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agency_invoices_booking ON agency_invoices(booking_id);
CREATE INDEX idx_agency_invoices_agency  ON agency_invoices(agency_id);

-- One row = one invoice line, even when a 10x2h package becomes 10 separate
-- Lesson rows in the planning. participant_id nullable: a package belongs to
-- one traveler (see the real Fun&Fly invoice: 3 family members, 3 separate
-- "Pack Privé" lines), but stays optional for lines that don't concern one.
CREATE TABLE agency_billing_lines (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id           UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  agency_id            UUID NOT NULL REFERENCES agencies(id),
  participant_id       UUID REFERENCES booking_participants(id) ON DELETE SET NULL,
  agency_rate_item_id  UUID REFERENCES agency_rate_items(id),
  price                NUMERIC(10,2) NOT NULL,   -- frozen at creation, like lessons.price_per_hour
  unit_hours           NUMERIC(5,2),             -- frozen at creation, lesson packages only
  -- The invoice this line was billed on (2026-08-19). NULL = owed by the agency
  -- but not yet drawn up on any document: the normal state between entering a
  -- service and issuing the paper.
  agency_invoice_id    UUID REFERENCES agency_invoices(id) ON DELETE SET NULL,
  -- ⚠️ DEPRECATED, dropped by `2026-08-19b`: the stamps moved to agency_invoices,
  -- because one settles an INVOICE, not a line. Both were empty on TEST and PROD.
  invoiced_at          TIMESTAMPTZ,
  paid_at              TIMESTAMPTZ,
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agency_billing_booking ON agency_billing_lines(booking_id);
CREATE INDEX idx_agency_billing_agency  ON agency_billing_lines(agency_id);
CREATE INDEX idx_agency_billing_lines_invoice ON agency_billing_lines(agency_invoice_id);


REVOKE ALL ON agency_rate_items    FROM anon;  -- admin only, jamais anon
REVOKE ALL ON agency_billing_lines FROM anon;  -- admin only, jamais anon
REVOKE ALL ON agency_invoices      FROM anon;  -- admin only, jamais anon


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
  -- Deux barèmes distincts, tous deux figés à la création (comme booking_room_prices :
  -- changer un tarif ne refacture pas le passé). NULL → repli sur le tarif courant.
  price_per_hour   NUMERIC(8,2),   -- prix CLIENT €/h (source : price_items)
  instructor_rate  NUMERIC(8,2),   -- PAIE moniteur €/h (source : instructors.rate_*)
  notes            TEXT,
  kite_id          UUID,            -- FK to equipment (nullable)
  board_id         UUID,            -- FK to equipment (nullable)
  agency_billing_line_id UUID REFERENCES agency_billing_lines(id) ON DELETE SET NULL,  -- 2026-08-16b, in use since Phases 3+5 (2026-08-17)
  -- Redacted mirror of price_per_hour for shared links (Phase 4, 2026-08-18b/c):
  -- NULL when the lesson is billed to a partner agency. anon reads THIS column and
  -- never price_per_hour, so a covered price never reaches the browser at all.
  share_price_per_hour NUMERIC(8,2) GENERATED ALWAYS AS (
    CASE WHEN agency_billing_line_id IS NULL THEN price_per_hour END
  ) STORED,
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

-- ⚠️ Une ligne de tarif facture par son LIEN (`billable_type`), jamais par son nom :
-- rapprocher par le nom faisait basculer la facturation sur un prix codé en dur dès
-- qu'on renommait la ligne. Payé trois fois (full house, leçons, locations).
-- Une ligne sans lien = catalogue libre, lue par aucun calcul.
CREATE TABLE price_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category      price_category NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  price         NUMERIC(10,2) NOT NULL,
  unit          TEXT,
  billable_type billable_type,
  created_at    TIMESTAMPTZ DEFAULT now(),
  -- La catégorie doit correspondre au poste : une ligne 'meal' ne se range pas
  -- dans les leçons. Le front duplique cette table (CATEGORY_BILLABLES).
  CONSTRAINT price_items_billable_category_chk CHECK (
    billable_type IS NULL OR category = (CASE
      WHEN billable_type IN ('lesson_private', 'lesson_group', 'lesson_supervision') THEN 'lesson'
      WHEN billable_type IN ('rental_kite', 'rental_board', 'rental_full',
                             'rental_surfboard', 'rental_foilboard')                 THEN 'rental'
      WHEN billable_type = 'center_access'                                           THEN 'center_access'
      WHEN billable_type = 'meal'                                                    THEN 'meal'
    END)::price_category
  )
);

-- Un seul tarif par poste facturable, sinon la facturation serait ambiguë
CREATE UNIQUE INDEX idx_price_items_billable_type
  ON price_items(billable_type) WHERE billable_type IS NOT NULL;

-- Tarification dégressive par palier — cours privés et groupe seulement.
-- Posée 2026-08-16c. Le tarif de base (price_items.price ci-dessus) reste le
-- palier "0h+" implicite ; une ligne ici = un palier SUPPLÉMENTAIRE. Le cumul
-- d'heures qui détermine le palier applicable court sur toute la vie du client,
-- jamais remis à zéro (voir client/src/components/accounting/utils.ts).
CREATE TABLE price_tiers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billable_type  TEXT NOT NULL CHECK (billable_type IN ('lesson_private', 'lesson_group')),
  min_hours      NUMERIC(6,2) NOT NULL,
  price_per_hour NUMERIC(8,2) NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (billable_type, min_hours)
);

REVOKE ALL ON price_tiers FROM anon;  -- admin only, jamais anon


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
  agency_billing_line_id UUID REFERENCES agency_billing_lines(id) ON DELETE SET NULL,  -- 2026-08-16b, in use since Phases 3+5 (2026-08-17)
  -- Redacted mirror for shared links (Phase 4) — see lessons.share_price_per_hour.
  share_price NUMERIC(8,2) GENERATED ALWAYS AS (
    CASE WHEN agency_billing_line_id IS NULL THEN price END
  ) STORED,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rentals_date    ON equipment_rentals(date);
CREATE INDEX idx_rentals_booking ON equipment_rentals(booking_id);

-- A lesson never bills gear separately, so the "value" a kite/board brings to a
-- lesson is estimated from the lesson's real margin (client price − instructor
-- pay). These three knobs tune that estimate — see EquipmentPage's revenue tab.
-- Single row, same pattern as taxi_pricing_defaults.
CREATE TABLE equipment_pricing_defaults (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_share   NUMERIC(4,3) NOT NULL DEFAULT 0.35,  -- of the lesson's margin, attributed to gear overall
  other_gear_share  NUMERIC(4,3) NOT NULL DEFAULT 0.30,  -- of that, reserved for untracked accessories (bar, helmet, harness, vest, radio)
  kite_board_ratio  NUMERIC(4,2) NOT NULL DEFAULT 2.0,   -- kite weight vs board in what's left
  updated_at        TIMESTAMPTZ DEFAULT now()
);


-- ── Taxis ─────────────────────────────────────────────────────────────────────

CREATE TABLE taxi_drivers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  vehicle         TEXT,
  seats           INTEGER NOT NULL DEFAULT 3,  -- vehicle capacity → free seats on the public schedule
  notes           TEXT,
  margin_percent  NUMERIC(5,2) NOT NULL DEFAULT 30,
  default_price_eur   INTEGER NOT NULL DEFAULT 120,   -- EUR charged to client when this driver is assigned
  default_driver_mzn  INTEGER NOT NULL DEFAULT 6000,  -- MZN paid to driver
  default_manager_mzn INTEGER NOT NULL DEFAULT 1000,  -- MZN manager commission
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
  -- Financials: client pays EUR, driver & manager paid MZN
  price_eur           INTEGER NOT NULL DEFAULT 120,       -- fixed EUR price charged to client
  price_driver_mzn    INTEGER NOT NULL DEFAULT 6000,      -- what driver gets (MZN)
  margin_manager_mzn  INTEGER NOT NULL DEFAULT 1000,      -- manager commission (MZN)
  agency_billing_line_id UUID REFERENCES agency_billing_lines(id) ON DELETE SET NULL,  -- 2026-08-16b, in use since Phases 3+5 (2026-08-17)
  -- Redacted mirror for shared links (Phase 4) — see lessons.share_price_per_hour.
  -- Only the CLIENT price is redacted: the driver is still owed his fee and the
  -- manager his commission when an agency pays for the trip.
  share_price_eur INTEGER GENERATED ALWAYS AS (
    CASE WHEN agency_billing_line_id IS NULL THEN price_eur END
  ) STORED,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE taxi_pricing_defaults (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  default_price_eur   INTEGER NOT NULL DEFAULT 120,       -- default EUR price for new trips
  default_driver_mzn  INTEGER NOT NULL DEFAULT 6000,      -- default driver payment MZN
  default_manager_mzn INTEGER NOT NULL DEFAULT 1000,      -- default manager commission MZN
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
-- Types : forecast | taxi | client | driver | taxi_manager | activity_provider | booking_form | restaurant
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


-- ── Public Booking Form Submissions ───────────────────────────────────────────
-- Buffer/queue for the public booking intake form (FR/EN/ES wizard).
-- Anon clients INSERT here (status='pending'); admins review and turn an approved
-- submission into a real client + booking + booking_participants.
-- `payload` holds the full raw answers; the denormalized columns let the admin
-- review queue render without parsing JSON.

CREATE TABLE form_submissions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  status             form_submission_status NOT NULL DEFAULT 'pending',
  language           TEXT NOT NULL DEFAULT 'en',   -- 'fr' | 'en' | 'es'
  reference_name     TEXT,                          -- denormalized for the queue list
  email              TEXT,
  num_travelers      INTEGER,
  arrival_date       DATE,
  payload            JSONB NOT NULL,                -- full raw answers
  reviewed_at        TIMESTAMPTZ,
  created_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL
);

CREATE INDEX idx_form_submissions_status ON form_submissions(status);


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
  agency_billing_line_id UUID REFERENCES agency_billing_lines(id) ON DELETE SET NULL,  -- 2026-08-16b, in use since Phases 3+5 (2026-08-17)
  -- Redacted mirror for shared links (Phase 4) — see lessons.share_price_per_hour.
  share_price_per_night NUMERIC(8,2) GENERATED ALWAYS AS (
    CASE WHEN agency_billing_line_id IS NULL THEN price_per_night END
  ) STORED,
  PRIMARY KEY (booking_id, room_id)
);

-- Un séjour dans un hébergement qu'on ne tarife pas soi-même (external_billing).
-- Il pointe sur `accommodations` : un seul lieu, celui d'où le planning tire ses
-- lignes. Le référentiel parallèle `external_accommodations` a été supprimé le
-- 2026-08-12 — vide, jamais écrit, et il imposait deux fiches par hôtel.
CREATE TABLE external_accommodation_bookings (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id                 UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  accommodation_id           UUID NOT NULL REFERENCES accommodations(id) ON DELETE CASCADE,
  check_in                   DATE NOT NULL,
  check_out                  DATE NOT NULL,
  total_cost                 NUMERIC(10,2) NOT NULL DEFAULT 0,  -- forfait payé à l'hébergeur, jamais anon
  total_sell_price           NUMERIC(10,2) NOT NULL DEFAULT 0,  -- forfait facturé au client
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

-- palmeiras_sub_lets — REMOVED (avril 2026)
-- Bungalow sub-lets are now tracked via accommodations (type='bungalow', cost_per_night)
-- and booking_rooms / booking_room_prices. Margin auto-calculated in Palmeiras accounting.


-- ── Email Logs ───────────────────────────────────────────────────────────────

CREATE TYPE email_log_type   AS ENUM ('booking_confirmation', 'visa_letter', 'travel_guide', 'welcome_guide');
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


-- ── Document templates ───────────────────────────────────────────────────────
-- Editable sections of the client-facing guides (Travel Guide + Welcome Guide),
-- edited in DocumentsPage. Defaults live in client/src/data/travelGuide.ts /
-- welcomeGuide.ts; the app seeds this table on first Save.
-- (History: sections lived in localStorage until 2026-07-09; the former
-- travel_guide_sections table was dropped 2026-06-28 as it was never read.)

CREATE TABLE document_templates (
  id         TEXT NOT NULL,                -- section id ('tg1'…, 'wg1'…)
  doc_type   TEXT NOT NULL CHECK (doc_type IN ('travel_guide', 'welcome_guide')),
  sort_order INT  NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  title      JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { fr, en, es }
  content    JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { fr, en, es }
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (doc_type, id)
);

REVOKE ALL ON document_templates FROM anon;  -- admin only, jamais anon


-- ── Enquiry sources ──────────────────────────────────────────────────────────
-- The "how did you hear about us?" choices on the public form, edited in
-- Options → Sources. In the database rather than the code so gui can add one
-- without a deployment; trilingual because the public form is.
-- Deactivate, never delete: past enquiries point here and the end-of-season
-- attribution stats depend on it. "Other" is deliberately NOT a row — the form
-- always appends it, so it cannot be removed and force someone who came through
-- a friend into a box that makes the statistic look clean and lie.

CREATE TABLE enquiry_sources (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label      JSONB   NOT NULL DEFAULT '{}'::jsonb,  -- { fr, en, es }
  sort_order INT     NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Readable by any valid share link (the public form needs the list), labels only.
REVOKE ALL ON enquiry_sources FROM anon;
GRANT  SELECT (id, label, sort_order, is_active) ON enquiry_sources TO anon;


-- ── Enquiries ────────────────────────────────────────────────────────────────
-- Someone who wrote in but has not booked. Deliberately touches neither the
-- planning nor the accounts: no room, no money, nothing computeSeasonTotals can
-- read — a prospect modelled as a `provisional` booking would inflate revenue by
-- everything that never shows up. Design: .claude/docs/ENQUIRIES.md
--
-- Absent on purpose: no season_id (derived from arrival_month at display time,
-- as accounting derives it from check-in) and no archived_at ("archived" is
-- simply status won/lost — a second way to say the same thing ends up
-- contradicting the first).

CREATE TABLE enquiries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- how the record entered the app; NOT what the visitor answered to
  -- "how did you hear about us?" (that is source_id)
  channel         TEXT NOT NULL DEFAULT 'form' CHECK (channel IN ('form', 'manual')),

  name            TEXT NOT NULL,          -- the only required field
  email           TEXT,
  phone           TEXT,
  language        TEXT NOT NULL DEFAULT 'en',
  message         TEXT,                   -- what they wrote, verbatim

  source_id       UUID REFERENCES enquiry_sources(id) ON DELETE RESTRICT,
  source_other    TEXT,

  -- qualification, filled by gui while reading the message; all nullable
  party_size      INTEGER CHECK (party_size IS NULL OR party_size > 0),
  arrival_month   TEXT CHECK (arrival_month IS NULL OR arrival_month ~ '^\d{4}-\d{2}$'),
  wants_lessons       BOOLEAN NOT NULL DEFAULT false,
  wants_rental        BOOLEAN NOT NULL DEFAULT false,
  wants_accommodation BOOLEAN NOT NULL DEFAULT false,
  budget_eur      NUMERIC(10,2) CHECK (budget_eur IS NULL OR budget_eur >= 0),  -- whole party

  -- TEXT + CHECK, not an enum: adding a status mid-season must not require the
  -- two-file enum dance.
  status          TEXT NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new', 'talking', 'waiting', 'won', 'lost')),
  lost_reason     TEXT,
  last_contact_at TIMESTAMPTZ NOT NULL DEFAULT now(),   -- drives the "silence" column

  client_id          UUID REFERENCES clients(id)          ON DELETE SET NULL,
  booking_id         UUID REFERENCES bookings(id)         ON DELETE SET NULL,
  form_submission_id UUID REFERENCES form_submissions(id) ON DELETE SET NULL,

  crm_synced_at   TIMESTAMPTZ,   -- HubSpot / Brevo; never blocks the insert
  crm_error       TEXT
);

-- The conversation, appended. A table rather than jsonb: searched by keyword,
-- and one more line must not rewrite the whole history.
CREATE TABLE enquiry_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id  UUID NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  body        TEXT NOT NULL
);

-- What is written about a PERSON, as opposed to enquiry_notes which is about a
-- conversation in progress. Deliberately not tied to a booking: a note belongs
-- to someone, and hanging it off a stay would hide it the following season.
-- Read together with enquiry_notes in the client dossier (utils/dossier.ts).
-- Added 2026-09-03 — migration 2026-09-03_client_notes.sql.
CREATE TABLE client_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  body        TEXT NOT NULL
);

CREATE INDEX idx_enquiries_status        ON enquiries(status);
CREATE INDEX idx_enquiries_arrival_month ON enquiries(arrival_month);
CREATE INDEX idx_enquiry_notes_enquiry   ON enquiry_notes(enquiry_id);
CREATE INDEX idx_client_notes_client     ON client_notes(client_id, created_at DESC);

-- The public form writes and never reads back. No anon SELECT policy at all, so
-- RLS refuses reads by default; the column GRANT bounds what may be written.
REVOKE ALL ON enquiries FROM anon;
GRANT  INSERT (name, email, phone, language, message, source_id, source_other)
  ON enquiries TO anon;
-- Left out on purpose: party_size, arrival_month, budget_eur, the wants_*, the
-- links and the sync columns. Those are qualification — gui's, not the visitor's.

REVOKE ALL ON enquiry_notes FROM anon;   -- what gui thinks of a client
REVOKE ALL ON client_notes  FROM anon;   -- idem


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
    'equipment', 'equipment_rentals', 'equipment_pricing_defaults',
    'taxi_drivers', 'taxi_trips', 'taxi_pricing_defaults', 'taxi_manager_payments',
    'shared_links', 'form_submissions',
    'activity_providers', 'activity_bookings', 'activity_payments',
    'seasons', 'house_rentals', 'room_rates', 'booking_room_prices',
    'external_accommodation_bookings',
    'payments',
    'instructor_debts', 'instructor_payments', 'lesson_rate_overrides',
    'expenses',
    'palmeiras_rents', 'palmeiras_reversals', 'palmeiras_entries',
    'email_logs', 'document_templates',
    'enquiry_sources', 'enquiries', 'enquiry_notes', 'client_notes',
    'agencies', 'agency_rate_items', 'agency_billing_lines', 'agency_invoices',
    'price_tiers'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY "admin_all" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t
    );
  END LOOP;
END $$;

-- Accès anon : shared_links — AUCUNE lecture directe (sinon on peut énumérer
-- tous les tokens actifs). La validation passe par resolve_share_token() :
-- il faut déjà connaître un token pour le résoudre (App.tsx via supabase.rpc).
REVOKE SELECT ON shared_links FROM anon;

CREATE OR REPLACE FUNCTION resolve_share_token(p_token TEXT)
RETURNS SETOF shared_links
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM shared_links
  WHERE token = p_token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at >= CURRENT_DATE);
$$;

REVOKE EXECUTE ON FUNCTION resolve_share_token(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION resolve_share_token(TEXT) TO anon, authenticated;

-- Accès anon : le formulaire public peut INSÉRER une soumission, uniquement en 'pending'.
-- Pas de SELECT/UPDATE/DELETE anon : le client ne relit jamais la file.
CREATE POLICY "anon_insert_form_submissions" ON form_submissions
  FOR INSERT TO anon
  WITH CHECK (status = 'pending');

-- Idem pour le formulaire léger de demande : il insère, il ne relit jamais.
-- Le WITH CHECK verrouille les deux champs qui ne doivent pas venir du dehors —
-- personne ne s'auto-déclare « gagnée » ni ne se fait passer pour une saisie
-- manuelle ; les colonnes accordées bornent le reste.
CREATE POLICY "anon_insert_enquiries" ON enquiries
  FOR INSERT TO anon
  WITH CHECK (status = 'new' AND channel = 'form');

-- ── Accès anon : RLS token-aware (Phase 2, 2026-07-06) ────────────────────────
-- Le front des pages partagées (?share=<token>) envoie le token dans le header
-- `x-share-token` (client/src/lib/supabase.ts). Les policies anon ne laissent
-- passer une ligne QUE si le header correspond à un shared_link actif dont le
-- type donne droit à cette ligne. Sans token valide → 0 ligne partout.
-- Design + matrice d'accès : .claude/docs/phase2-rls-token-aware.md.

-- Helpers (share_ctx/share_booking_id/share_client_id sont SECURITY DEFINER :
-- ils lisent shared_links/bookings hors policy).
CREATE OR REPLACE FUNCTION share_ctx() RETURNS shared_links
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.* FROM shared_links s
  WHERE s.token = current_setting('request.headers', true)::json->>'x-share-token'
    AND s.is_active
    AND (s.expires_at IS NULL OR s.expires_at >= CURRENT_DATE)
  LIMIT 1;
$$;

-- Type du token présenté, ou NULL. (Test scalaire sûr — ne PAS tester
-- share_ctx() IS NOT NULL : composite avec expires_at NULL → toujours faux.)
CREATE OR REPLACE FUNCTION share_type() RETURNS shared_link_type
LANGUAGE sql STABLE AS $$ SELECT (share_ctx()).type $$;

CREATE OR REPLACE FUNCTION share_param(p_key TEXT) RETURNS TEXT
LANGUAGE sql STABLE AS $$ SELECT (share_ctx()).params->>p_key $$;

-- L'id (resp. le client) du booking ciblé par un token 'client', sinon NULL.
CREATE OR REPLACE FUNCTION share_booking_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id FROM bookings b
  WHERE (share_ctx()).type = 'client'
    AND b.booking_number = ((share_ctx()).params->>'booking_number')::int;
$$;

CREATE OR REPLACE FUNCTION share_client_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.client_id FROM bookings b WHERE b.id = share_booking_id();
$$;

-- Clés room_rates auxquelles un token 'client' a droit (2026-07-30) : les chambres de
-- SA réservation + la clé maison entière de leurs hébergements. Sert au repli tarifaire
-- quand la résa n'a pas de prix figé — jamais toute la grille.
CREATE OR REPLACE FUNCTION share_room_keys() RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT br.room_id::text FROM booking_rooms br WHERE br.booking_id = share_booking_id()
  UNION
  SELECT 'full_' || r.accommodation_id::text
    FROM booking_rooms br JOIN rooms r ON r.id = br.room_id
   WHERE br.booking_id = share_booking_id();
$$;

REVOKE EXECUTE ON FUNCTION share_ctx(), share_type(), share_param(TEXT),
                           share_booking_id(), share_client_id(), share_room_keys() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION share_ctx(), share_type(), share_param(TEXT),
                           share_booking_id(), share_client_id(), share_room_keys() TO anon, authenticated;

-- Cœur booking : token client → uniquement le booking du token ;
-- taxi/driver/manager/restaurant → toutes les lignes (embeds de noms).
CREATE POLICY "anon_read_bookings" ON bookings FOR SELECT TO anon USING (
  share_type() IN ('taxi', 'driver', 'taxi_manager', 'restaurant')
  OR (share_type() = 'client' AND id = share_booking_id())
);
CREATE POLICY "anon_read_clients" ON clients FOR SELECT TO anon USING (
  share_type() IN ('forecast', 'taxi', 'driver', 'taxi_manager', 'restaurant')
  OR (share_type() = 'client' AND id = share_client_id())
);
CREATE POLICY "anon_read_booking_participants" ON booking_participants
  FOR SELECT TO anon USING (share_type() = 'client' AND booking_id = share_booking_id());
CREATE POLICY "anon_read_booking_rooms" ON booking_rooms
  FOR SELECT TO anon USING (share_type() = 'client' AND booking_id = share_booking_id());
CREATE POLICY "anon_read_booking_room_prices" ON booking_room_prices
  FOR SELECT TO anon USING (share_type() = 'client' AND booking_id = share_booking_id());
CREATE POLICY "anon_read_payments" ON payments
  FOR SELECT TO anon USING (share_type() = 'client' AND booking_id = share_booking_id());
CREATE POLICY "anon_read_ext_accom_bookings" ON external_accommodation_bookings
  FOR SELECT TO anon USING (share_type() = 'client' AND booking_id = share_booking_id());

-- Cours & matériel : client → son booking ; forecast → tout (raison d'être de la page).
CREATE POLICY "anon_read_lessons" ON lessons FOR SELECT TO anon USING (
  share_type() = 'forecast'
  OR (share_type() = 'client' AND booking_id = share_booking_id())
);
CREATE POLICY "anon_read_equipment_rentals" ON equipment_rentals FOR SELECT TO anon USING (
  share_type() = 'forecast'
  OR (share_type() = 'client' AND booking_id = share_booking_id())
);
-- (lesson_rate_overrides : plus AUCUNE policy anon depuis le 2026-07-29 — c'est de la
--  paie moniteur. La page client lit lessons.price_per_hour, pas les overrides.)
-- Repas : uniquement ceux où participe un participant du booking (match JSONB attendees).
CREATE POLICY "anon_read_dining_events" ON dining_events FOR SELECT TO anon USING (
  share_type() = 'client'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(attendees) AS a
    JOIN booking_participants bp ON bp.id::text = a->>'person_id'
    WHERE bp.booking_id = share_booking_id()
      AND a->>'person_type' = 'participant'
      AND (a->>'is_attending')::boolean
  )
);

-- Taxi : le manager ne voit que les trajets avec commission ; le driver, les siens.
CREATE POLICY "anon_read_taxi_trips" ON taxi_trips FOR SELECT TO anon USING (
  share_type() = 'taxi'
  OR (share_type() = 'taxi_manager' AND margin_manager_mzn > 0)
  OR (share_type() = 'driver' AND taxi_driver_id = share_param('driver_id')::uuid)
  OR (share_type() = 'client' AND booking_id = share_booking_id())
);
CREATE POLICY "anon_read_taxi_drivers" ON taxi_drivers FOR SELECT TO anon USING (
  share_type() IN ('taxi', 'taxi_manager')
  OR (share_type() = 'driver' AND id = share_param('driver_id')::uuid)
);
CREATE POLICY "anon_read_taxi_manager_payments" ON taxi_manager_payments
  FOR SELECT TO anon USING (share_type() = 'taxi_manager');

-- Activités : chaque provider ne voit que ses lignes.
CREATE POLICY "anon_read_activity_providers" ON activity_providers
  FOR SELECT TO anon USING (
    share_type() = 'activity_provider' AND id = share_param('provider_id')::uuid
  );
CREATE POLICY "anon_read_activity_bookings" ON activity_bookings
  FOR SELECT TO anon USING (
    (share_type() = 'activity_provider' AND provider_id = share_param('provider_id')::uuid)
    OR (share_type() = 'client' AND booking_id = share_booking_id())
  );
CREATE POLICY "anon_read_activity_payments" ON activity_payments
  FOR SELECT TO anon USING (
    share_type() = 'activity_provider' AND provider_id = share_param('provider_id')::uuid
  );

-- Tarifs de base (C3, 2026-07-30) : un lien CLIENT seulement, et uniquement les clés
-- de sa propre réservation — sert au repli quand la résa n'a pas de prix figé, sinon
-- le client verrait 0 €/nuit. Colonnes narrowées plus bas (jamais `notes`).
CREATE POLICY "anon_read_room_rates" ON room_rates FOR SELECT TO anon USING (
  share_type() = 'client'
  AND room_id IN (SELECT share_room_keys())
);

-- Référentiel : lisible avec n'importe quel token valide.
CREATE POLICY "anon_read_rooms" ON rooms
  FOR SELECT TO anon USING (share_type() IS NOT NULL);
CREATE POLICY "anon_read_accommodations" ON accommodations
  FOR SELECT TO anon USING (share_type() IS NOT NULL);
CREATE POLICY "anon_read_instructors" ON instructors
  FOR SELECT TO anon USING (share_type() IS NOT NULL);
CREATE POLICY "anon_read_equipment" ON equipment
  FOR SELECT TO anon USING (share_type() IS NOT NULL);
-- The public form's "how did you hear about us?" list. Only the active entries:
-- a source gui retired stays in the table for past statistics, not on the form.
CREATE POLICY "anon_read_enquiry_sources" ON enquiry_sources
  FOR SELECT TO anon USING (share_type() IS NOT NULL AND is_active);

-- Column-level hardening: anon may read ONLY identity columns of clients /
-- booking_participants (never passport_number, email, phone, birth_date,
-- emergency contacts, notes). A row policy can't restrict columns, so we use
-- column privileges. The share pages select() only these columns.
-- See .claude/docs/security-rls.md.
REVOKE SELECT ON clients FROM anon;
GRANT  SELECT (id, first_name, last_name) ON clients TO anon;
REVOKE SELECT ON booking_participants FROM anon;
GRANT  SELECT (id, booking_id, first_name, last_name) ON booking_participants TO anon;
-- bookings: anon only reads scheduling/identity columns (Lot B 2026-07-04) —
-- never emergency contacts, notes, amount_paid, visa dates, waiver, referral.
REVOKE SELECT ON bookings FROM anon;
GRANT  SELECT (id, booking_number, check_in, check_out, status, client_id,
               num_center_access, center_access_rate)
  ON bookings TO anon;
-- Lot C (2026-07-06) puis resserré le 2026-07-29 : instructors → IDENTITÉ SEULE.
-- Les rate_* sont devenus de la paie (le prix client vient de price_items et est figé
-- sur lessons.price_per_hour), donc plus aucune raison de les exposer : c'était une
-- fuite de salaires lisible depuis n'importe quel lien client.
REVOKE SELECT ON instructors FROM anon;
GRANT  SELECT (id, first_name, last_name) ON instructors TO anon;
-- Même raison : un override est une exception sur la paie d'un moniteur (2026-07-29).
REVOKE SELECT ON lesson_rate_overrides FROM anon;
-- room_rates (2026-07-30) : le prix, jamais les notes internes. La policy ci-dessus
-- limite déjà les lignes aux chambres du booking porté par le token client.
-- Le REVOKE d'abord, sinon le GRANT de table posé par Supabase laisse tout lisible.
REVOKE SELECT ON room_rates FROM anon;
GRANT  SELECT (room_id, price_per_night) ON room_rates TO anon;
-- Séjours externes → le client voit ce qu'il paie, jamais ce que NOUS payons.
-- `total_cost` est notre prix d'achat : le laisser lisible exposait la marge à
-- tout porteur de lien client (fermé le 2026-08-11, cf. migration du même jour).
REVOKE SELECT ON external_accommodation_bookings FROM anon;
GRANT  SELECT (id, booking_id, accommodation_id, check_in, check_out, total_sell_price)
  ON external_accommodation_bookings TO anon;
-- taxi_drivers → identity + contact + vehicle (phone kept on purpose: guests can
-- call their taxi); never email/notes/margin_percent/default pricing.
REVOKE SELECT ON taxi_drivers FROM anon;
GRANT  SELECT (id, name, phone, vehicle, seats) ON taxi_drivers TO anon;
-- activity_providers → own public sheet (rows already scoped by Phase 2);
-- never internal notes.
REVOKE SELECT ON activity_providers FROM anon;
GRANT  SELECT (id, name, type, phone, email, website, show_prices)
  ON activity_providers TO anon;
-- ── Phase 4 des agences (2026-08-18c) : les 4 sources d'une facture client ────
-- anon ne lit plus AUCUN prix client brut, seulement le miroir `share_price*`
-- (colonne générée) que la base met à NULL quand la ligne est facturée à une
-- agence partenaire. Avant ça, la page client dessinait « — » par-dessus un prix
-- qui voyageait quand même dans la réponse réseau.
-- Fermé au passage, volontairement : `lessons.instructor_rate` (la PAIE moniteur,
-- 3ᵉ copie du chiffre que le durcissement du 2026-07-29 avait manquée) et
-- `taxi_trips.price_eur` (aucune page taxi ne l'affiche).
-- ⚠️ Restent ouverts et attendent une décision : `taxi_trips.price_driver_mzn` et
-- `margin_manager_mzn`, lisibles par TOUT token valide — un client peut donc voir
-- ce qu'on paie son chauffeur. Un privilège de colonne est par RÔLE, pas par type
-- de token, et les pages driver/manager en ont réellement besoin.
REVOKE SELECT ON lessons FROM anon;
GRANT  SELECT (id, booking_id, instructor_id, participant_ids, date, start_time,
               duration_hours, type, notes, share_price_per_hour,
               agency_billing_line_id)
  ON lessons TO anon;
REVOKE SELECT ON equipment_rentals FROM anon;
GRANT  SELECT (id, equipment_id, booking_id, participant_id, date, slot,
               share_price, agency_billing_line_id)
  ON equipment_rentals TO anon;
REVOKE SELECT ON taxi_trips FROM anon;
GRANT  SELECT (id, date, start_time, type, status, taxi_driver_id, booking_id,
               nb_persons, nb_luggage, nb_boardbags, notes,
               price_driver_mzn, margin_manager_mzn,
               share_price_eur, agency_billing_line_id)
  ON taxi_trips TO anon;
REVOKE SELECT ON booking_room_prices FROM anon;
GRANT  SELECT (booking_id, room_id, override_note, share_price_per_night,
               agency_billing_line_id)
  ON booking_room_prices TO anon;



-- ── DB Stats function ─────────────────────────────────────────────────────────
-- Returns per-table row counts + sizes. Callable by authenticated admins only.

CREATE OR REPLACE FUNCTION get_db_stats()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'db_size', pg_size_pretty(pg_database_size(current_database())),
    'tables', (
      SELECT json_agg(t ORDER BY total_bytes DESC)
      FROM (
        SELECT
          c.relname                                        AS table_name,
          greatest(c.reltuples::bigint, 0)                AS row_count,
          pg_size_pretty(pg_total_relation_size(c.oid))   AS total_size,
          pg_size_pretty(pg_relation_size(c.oid))         AS table_size,
          pg_size_pretty(pg_indexes_size(c.oid))          AS index_size,
          pg_total_relation_size(c.oid)                   AS total_bytes
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
      ) t
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION get_db_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_db_stats() TO authenticated;
