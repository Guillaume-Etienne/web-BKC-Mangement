-- ============================================================
-- 2026-10-07b — Partner hotels (Hotel CasaMoz, Maputo)
--
-- FILE 2 OF 2 — run AFTER 2026-10-07_partner_hotel_share_type.sql.
--
-- Guests often spend a night or two in Maputo before and after a safari. We
-- book them into a partner hotel, which usually collects the money itself and
-- owes us a commission (10 % of the room price). Sometimes the guest pays us
-- instead, and we owe the hotel the rest.
--
--   partner_hotels          one row per hotel (one tab each in /activities)
--   partner_hotel_stays     one row per stay — the night(s) before the safari
--                           and the night(s) after are two rows on one booking
--   partner_hotel_payments  settlements between the hotel and us, both ways
--
-- Money is in MZN. The accounting converts our commission to EUR at the
-- current global rate (taxi_pricing_defaults.eur_mzn_rate).
--
-- Anon: the hotel gets a read-only link (type 'partner_hotel', params.hotel_id)
-- and sees ITS rows only, money included (decision gui 2026-10-07).
-- Never exposed: stays.internal_notes, stays.booking_id, hotels.notes.
--
-- Idempotent. Apply on TEST and PROD. One transaction is fine.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS partner_hotels (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT NOT NULL,
  default_room_rate_mzn  NUMERIC(12,2) NOT NULL DEFAULT 3500,  -- per room per night
  commission_pct         NUMERIC(5,2)  NOT NULL DEFAULT 10,
  is_active              BOOLEAN NOT NULL DEFAULT true,
  notes                  TEXT,                                 -- internal, never shared
  created_at             TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS partner_hotel_stays (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id         UUID NOT NULL REFERENCES partner_hotels(id) ON DELETE CASCADE,
  booking_id       UUID REFERENCES bookings(id) ON DELETE SET NULL,
  display_name     TEXT NOT NULL,          -- what the hotel reads; defaults to the booking name
  check_in         DATE NOT NULL,
  check_out        DATE NOT NULL,
  nb_persons       INTEGER NOT NULL DEFAULT 1,
  couples_count    INTEGER NOT NULL DEFAULT 0,
  children_count   INTEGER NOT NULL DEFAULT 0,
  rooms            JSONB NOT NULL DEFAULT '[]',   -- [{ "label": "Double", "rate_mzn": 3500 }]
  commission_pct   NUMERIC(5,2) NOT NULL DEFAULT 10,  -- frozen from the hotel at creation
  airport_transfer BOOLEAN NOT NULL DEFAULT false,
  transfer_time    TEXT,                   -- HH:MM
  big_bags         INTEGER NOT NULL DEFAULT 0,
  hotel_confirmed  BOOLEAN NOT NULL DEFAULT false,
  guests_paid      BOOLEAN NOT NULL DEFAULT false,
  paid_by          TEXT NOT NULL DEFAULT 'guest_to_hotel'
                   CHECK (paid_by IN ('guest_to_hotel', 'guest_to_us')),
  notes            TEXT,                   -- shown to the hotel
  internal_notes   TEXT,                   -- never shown to the hotel
  created_at       TIMESTAMPTZ DEFAULT now(),
  CHECK (check_out > check_in)
);

CREATE TABLE IF NOT EXISTS partner_hotel_payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    UUID NOT NULL REFERENCES partner_hotels(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  amount_mzn  NUMERIC(12,2) NOT NULL CHECK (amount_mzn > 0),
  direction   TEXT NOT NULL CHECK (direction IN ('hotel_to_us', 'us_to_hotel')),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_hotel_stays_hotel    ON partner_hotel_stays(hotel_id);
CREATE INDEX IF NOT EXISTS idx_partner_hotel_stays_booking  ON partner_hotel_stays(booking_id);
CREATE INDEX IF NOT EXISTS idx_partner_hotel_payments_hotel ON partner_hotel_payments(hotel_id);

-- ── RLS: admins everything ────────────────────────────────────────────────────

ALTER TABLE partner_hotels         ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_hotel_stays    ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_hotel_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all" ON partner_hotels;
CREATE POLICY "admin_all" ON partner_hotels
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin_all" ON partner_hotel_stays;
CREATE POLICY "admin_all" ON partner_hotel_stays
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin_all" ON partner_hotel_payments;
CREATE POLICY "admin_all" ON partner_hotel_payments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── RLS: anon = a 'partner_hotel' token, its own hotel only ──────────────────

DROP POLICY IF EXISTS "anon_read_partner_hotels" ON partner_hotels;
CREATE POLICY "anon_read_partner_hotels" ON partner_hotels
  FOR SELECT TO anon USING (
    share_type() = 'partner_hotel' AND id = share_param('hotel_id')::uuid
  );

DROP POLICY IF EXISTS "anon_read_partner_hotel_stays" ON partner_hotel_stays;
CREATE POLICY "anon_read_partner_hotel_stays" ON partner_hotel_stays
  FOR SELECT TO anon USING (
    share_type() = 'partner_hotel' AND hotel_id = share_param('hotel_id')::uuid
  );

DROP POLICY IF EXISTS "anon_read_partner_hotel_payments" ON partner_hotel_payments;
CREATE POLICY "anon_read_partner_hotel_payments" ON partner_hotel_payments
  FOR SELECT TO anon USING (
    share_type() = 'partner_hotel' AND hotel_id = share_param('hotel_id')::uuid
  );

-- ── Column privileges for anon ────────────────────────────────────────────────
-- Supabase grants anon the whole table by default; a column GRANT restricts
-- nothing until that table grant is revoked (see security-rls.md).

REVOKE ALL ON partner_hotels, partner_hotel_stays, partner_hotel_payments FROM anon;

GRANT SELECT (id, name, commission_pct) ON partner_hotels TO anon;
GRANT SELECT (id, hotel_id, display_name, check_in, check_out,
              nb_persons, couples_count, children_count, rooms, commission_pct,
              airport_transfer, transfer_time, big_bags,
              hotel_confirmed, guests_paid, paid_by, notes)
  ON partner_hotel_stays TO anon;
GRANT SELECT (id, hotel_id, date, amount_mzn, direction, notes)
  ON partner_hotel_payments TO anon;

-- ── Seed: the first partner ───────────────────────────────────────────────────

INSERT INTO partner_hotels (name, default_room_rate_mzn, commission_pct)
SELECT 'Hotel CasaMoz', 3500, 10
WHERE NOT EXISTS (SELECT 1 FROM partner_hotels WHERE name = 'Hotel CasaMoz');

COMMIT;

-- ── Checks ────────────────────────────────────────────────────────────────────
-- 1. Anon without token: expect [] (RLS), not an error
--    curl -s "$URL/rest/v1/partner_hotel_stays?select=id" -H "apikey: $ANON"
-- 2. Anon asking for a hidden column: expect 42501
--    curl -s "$URL/rest/v1/partner_hotel_stays?select=internal_notes" -H "apikey: $ANON"
-- 3. The seed is there (as admin, SQL editor):
--    SELECT name, default_room_rate_mzn, commission_pct FROM partner_hotels;
