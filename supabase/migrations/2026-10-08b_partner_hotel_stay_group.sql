-- ============================================================
-- 2026-10-08b — Group the nights of one partner-hotel reservation
--
-- A CasaMoz reservation is most often two separate nights on one booking: the
-- arrival night, an absence (safari), the return night. They stay two rows —
-- each night has its own dates, confirmation and transfer — and `group_id`
-- says they belong together, so the admin tab and the hotel's page show ONE
-- reservation with its absence in between.
--
-- The hotel page needs the link but must not read booking_id (closed on
-- purpose), hence a dedicated, meaningless UUID granted to anon instead.
--
-- Backfill: existing rows of the same (hotel, booking) share a new group; rows
-- without a booking are their own group. NULL stays allowed — the code falls
-- back to the row's own id.
--
-- ⚠️ Run BEFORE deploying the code that uses it: the hotel page lists its
-- columns, and saving a reservation writes group_id.
--
-- Idempotent. Apply on TEST and PROD. One transaction is fine.
-- ============================================================

BEGIN;

ALTER TABLE partner_hotel_stays
  ADD COLUMN IF NOT EXISTS group_id UUID;

UPDATE partner_hotel_stays s
SET group_id = g.gid
FROM (
  SELECT hotel_id, booking_id, gen_random_uuid() AS gid
  FROM partner_hotel_stays
  WHERE booking_id IS NOT NULL AND group_id IS NULL
  GROUP BY hotel_id, booking_id
) g
WHERE s.group_id IS NULL
  AND s.hotel_id = g.hotel_id
  AND s.booking_id = g.booking_id;

UPDATE partner_hotel_stays SET group_id = id WHERE group_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_partner_hotel_stays_group ON partner_hotel_stays(group_id);

GRANT SELECT (group_id) ON partner_hotel_stays TO anon;

COMMIT;

-- Checks (anon): expect [] 200 (not 42501, not 42703)
--   curl -s "$URL/rest/v1/partner_hotel_stays?select=id,group_id" -H "apikey: $ANON"
-- booking_id must still be closed: select=booking_id → 42501
