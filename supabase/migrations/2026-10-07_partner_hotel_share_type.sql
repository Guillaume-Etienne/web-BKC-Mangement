-- ============================================================
-- 2026-10-07 — Add 'partner_hotel' to the shared_link_type enum
--
-- FILE 1 OF 2. Run it ALONE, first (the Supabase SQL editor wraps a script in
-- one transaction, and a new enum value cannot be used in the transaction that
-- adds it → 55P04). Then run 2026-10-07b_partner_hotels.sql.
--
-- Needed by the read-only page given to a partner hotel (Hotel CasaMoz,
-- Maputo): PartnerHotelSharePage. Without it, creating the link fails with
-- "invalid input value for enum shared_link_type".
--
-- Idempotent. Apply on TEST and PROD.
-- ============================================================

ALTER TYPE shared_link_type ADD VALUE IF NOT EXISTS 'partner_hotel';
