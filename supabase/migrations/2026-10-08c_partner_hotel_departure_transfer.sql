-- ============================================================
-- 2026-10-08c — Airport drop-off on partner-hotel nights
--
-- A night had ONE airport transfer, shown on its arrival day. But the hotel
-- also drives guests back to the airport, on their DEPARTURE day (typically
-- the morning after the return night). Two distinct transfers per night now:
--   airport_transfer   / transfer_time            → pick-up,  on check_in
--   departure_transfer / departure_transfer_time  → drop-off, on check_out
-- Existing rows keep their transfer as a pick-up (what it meant so far).
--
-- Both new columns are granted to anon: the hotel's page shows each transfer
-- on its own day. Strictly additive.
--
-- Code deployed before this migration: saving a reservation fails (alert);
-- the hotel page falls back to reading without the new columns.
--
-- Idempotent. Apply on TEST and PROD. One transaction is fine.
-- ============================================================

BEGIN;

ALTER TABLE partner_hotel_stays
  ADD COLUMN IF NOT EXISTS departure_transfer      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS departure_transfer_time TEXT;

GRANT SELECT (departure_transfer, departure_transfer_time) ON partner_hotel_stays TO anon;

COMMIT;

-- Check (anon): expect [] 200, not 42501 / 42703
--   curl -s "$URL/rest/v1/partner_hotel_stays?select=id,departure_transfer,departure_transfer_time" -H "apikey: $ANON"
