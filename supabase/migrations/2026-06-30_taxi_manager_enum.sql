-- ============================================================
-- Add 'taxi_manager' to the shared_link_type enum (apply TEST then PROD)
-- Needed by the "Taxi Manager GERALDO schedule" shared link. Without it,
-- creating that link fails: invalid input value for enum shared_link_type.
-- Idempotent. Run on its own (ALTER TYPE ... ADD VALUE can't share a txn
-- with statements that use the new value).
-- ============================================================

ALTER TYPE shared_link_type ADD VALUE IF NOT EXISTS 'taxi_manager';
