-- Per-traveler kite activity migration (2026-06-27)
-- Moves "who does what" from anonymous booking counters to per-traveler flags.
-- booking_participants gains 6 activity flags (source of truth).
-- bookings.num_* become a denormalized cache recomputed from those flags on write.
-- New rule: center access (num_center_access) = travelers with brings_own_gear = true.
--
-- Apply on TEST first, then PROD. Idempotent (IF NOT EXISTS).

-- 1. Per-traveler flags
ALTER TABLE booking_participants
  ADD COLUMN IF NOT EXISTS does_kite          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS brings_own_gear    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_storage      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wants_kite_lessons BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wants_kite_rental  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wants_wing_lessons BOOLEAN NOT NULL DEFAULT false;

-- 2. Wing counter cache on bookings (lessons/rentals/center_access already exist)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS num_wing_lessons INTEGER NOT NULL DEFAULT 0;

-- NOTE: existing bookings keep their current num_* values (cache) until next edit.
-- No backfill of per-traveler flags is possible (we don't know which traveler does what),
-- so on the next save of an existing booking the counters recompute from the (initially empty) flags.
