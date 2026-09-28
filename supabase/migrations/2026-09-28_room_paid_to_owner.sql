-- 2026-09-28 — Bungalow paid directly to its owner (Palmeiras)
--
-- Case by case, a guest pays Palmeiras for the bungalow instead of us. The room
-- is then neither owed to us nor a cost to us; our commission is entered by hand
-- in Accounting → Palmeiras → Reversal. Design: .claude/docs/PALMEIRAS_ACCOUNT.md
--
-- Ticked from Accounting → Bookings → the booking → "Paid directly to Palmeiras".
-- Code deployed before this migration: nothing breaks. Ticking the box shows an
-- error and is undone; editing a booking only names the column once it is true;
-- the client share page reads it in a query of its own whose failure is ignored.
--
-- Run on TEST and PROD (Supabase SQL editor), one transaction is fine.

ALTER TABLE booking_room_prices
  ADD COLUMN IF NOT EXISTS paid_to_owner boolean NOT NULL DEFAULT false;

-- The client share page must know the guest does not owe us this room.
-- booking_room_prices is column-restricted for anon since 2026-08-18c (the table
-- GRANT was revoked), so this adds one column to the list; RLS still limits the
-- rows to the token's own booking.
GRANT SELECT (paid_to_owner) ON booking_room_prices TO anon;

-- Check (anon, with a client x-share-token header): expect 200, not 42501
--   curl -s "$URL/rest/v1/booking_room_prices?select=room_id,paid_to_owner" "${H[@]}"
