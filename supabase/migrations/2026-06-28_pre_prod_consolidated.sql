-- ============================================================
-- PRE-PROD CONSOLIDATED MIGRATION (2026-06-28)
-- Run once on TEST, verify, then on PROD before going live.
-- Idempotent where possible (IF NOT EXISTS / IF EXISTS / NOT EXISTS guard).
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Per-traveler kite activity
--    Move "who does what" from anonymous booking counters to
--    per-traveler flags on booking_participants (source of truth).
--    bookings.num_* become a denormalized cache (deriveActivityCounts).
--    New rule: center access = travelers with brings_own_gear = true.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE booking_participants
  ADD COLUMN IF NOT EXISTS does_kite          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS brings_own_gear    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_storage      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wants_kite_lessons BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wants_kite_rental  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wants_wing_lessons BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS num_wing_lessons INTEGER NOT NULL DEFAULT 0;

-- NOTE: existing bookings keep their current num_* (cache) until next edit.
-- No backfill of per-traveler flags is possible (we don't know who does what).

-- ─────────────────────────────────────────────────────────────
-- 2. Drop orphan tables (never read/written by the app)
--    - participant_consumptions: superseded by source tables (lessons/rentals/...)
--    - travel_guide_sections: guide lives in localStorage (data/travelGuide.ts)
-- ─────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS participant_consumptions;   -- policies drop with the table
DROP TYPE  IF EXISTS consumption_type;           -- enum only used by that table
DROP TABLE IF EXISTS travel_guide_sections;

-- ─────────────────────────────────────────────────────────────
-- 3. Seed the current operating season (enables the "Season" period filter)
--    A season is just a named date window used to scope accounting tabs.
--    Operating window ~ mid-September → mid-March (exact days don't matter,
--    it's only a filter boundary and editable later). Bookings arriving now
--    (mid-2026) belong to the 2026-2027 season.
--    Guard: only inserts if the table is empty (won't duplicate).
-- ─────────────────────────────────────────────────────────────
INSERT INTO seasons (label, start_date, end_date)
SELECT '2026-2027', DATE '2026-09-15', DATE '2027-03-15'
WHERE NOT EXISTS (SELECT 1 FROM seasons);
