-- ============================================================
-- 2026-11-08b — How the guest arrives / leaves: flight number, car, other
--
-- The public form now asks for the FLIGHT NUMBER of the arrival and of the
-- return (required), unless the guest says they come by car or another way.
-- A hand-typed date + hour goes wrong (AM/PM, the departure city's time, a
-- 00:30 landing); a flight number can be checked, by us and by the driver.
--
--   arrival_by   / departure_by     'flight' | 'car' | 'other'   (NULL = not asked: older bookings)
--   arrival_detail / departure_detail  flight number when 'flight', the guest's
--                                      own words when 'other', NULL when 'car'
-- Meaning of the pair: client/src/utils/travelMode.ts (one place).
--
-- Granted to anon (decision gui, 2026-11-08): the driver's page shows the flight
-- of each airport trip so he can follow a delay himself. Rows stay scoped by
-- the existing policies; only these 4 columns are added to the anon list.
--
-- Strictly additive. ⚠️ Pass BEFORE pushing the code: the admin Taxi page and
-- the driver page name these columns in their select, and PostgREST rejects the
-- WHOLE query on an unknown column (guest names would vanish from both).
--
-- Idempotent. Apply on TEST and PROD. One transaction is fine.
-- ============================================================

BEGIN;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS arrival_by       TEXT,
  ADD COLUMN IF NOT EXISTS arrival_detail   TEXT,
  ADD COLUMN IF NOT EXISTS departure_by     TEXT,
  ADD COLUMN IF NOT EXISTS departure_detail TEXT;

DO $$ BEGIN
  ALTER TABLE bookings ADD CONSTRAINT bookings_arrival_by_check
    CHECK (arrival_by IS NULL OR arrival_by IN ('flight', 'car', 'other'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE bookings ADD CONSTRAINT bookings_departure_by_check
    CHECK (departure_by IS NULL OR departure_by IN ('flight', 'car', 'other'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT (arrival_by, arrival_detail, departure_by, departure_detail) ON bookings TO anon;

COMMIT;

-- Check (anon): expect [] 200, not 42501 / 42703
--   curl -s "$URL/rest/v1/bookings?select=id,arrival_by,arrival_detail,departure_by,departure_detail&limit=1" -H "apikey: $ANON"
-- and still closed: select=notes → 42501
