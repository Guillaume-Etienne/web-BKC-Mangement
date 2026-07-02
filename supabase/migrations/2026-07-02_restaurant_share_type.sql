-- ============================================================
-- Add 'restaurant' to the shared_link_type enum (apply TEST then PROD)
-- Needed by the "Hotel Restaurant Planning" shared link (RestaurantSharePage):
-- read-only guest stay timeline (names + arrival/departure) for the hotel
-- restaurant manager. Without it, creating that link fails:
-- invalid input value for enum shared_link_type.
-- Idempotent. Run on its own (ALTER TYPE ... ADD VALUE can't share a txn
-- with statements that use the new value).
-- No new RLS needed: the page only reads bookings + clients identity columns,
-- both already exposed to anon (see security-rls.md).
-- ============================================================

ALTER TYPE shared_link_type ADD VALUE IF NOT EXISTS 'restaurant';
