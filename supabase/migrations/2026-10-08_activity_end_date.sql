-- ============================================================
-- 2026-10-08 — End date on activity bookings (multi-day safaris)
--
-- An activity had a single `date`. A safari lasts several days, and the new
-- Safaris tab of /activities checks it against the Maputo partner-hotel nights
-- before and after it — which needs to know when it ends.
-- NULL = a one-day activity (end = date). Strictly additive.
--
-- Anon: activity_bookings is NOT column-restricted (whole-table grant, rows
-- scoped by Phase 2 policies), so the provider and client share pages can read
-- it like every other column. Non-sensitive.
--
-- Code deployed before this migration: nothing breaks — the form only names
-- end_date once one is entered (that save fails with an alert until migrated).
--
-- Idempotent. Apply on TEST and PROD. One transaction is fine.
-- ============================================================

ALTER TABLE activity_bookings
  ADD COLUMN IF NOT EXISTS end_date DATE;

DO $$ BEGIN
  ALTER TABLE activity_bookings
    ADD CONSTRAINT activity_bookings_end_after_start CHECK (end_date IS NULL OR end_date >= date);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Check (as admin): SELECT id, date, end_date FROM activity_bookings LIMIT 1;  → no error
