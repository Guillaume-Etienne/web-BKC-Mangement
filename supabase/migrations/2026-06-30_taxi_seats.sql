-- ============================================================
-- Taxi driver vehicle capacity (apply on TEST first, then PROD)
-- Adds the number of seats per driver's vehicle, used by the Public Taxi
-- Schedule to show free seats = seats - nb_persons per trip.
-- Idempotent.
-- ============================================================

ALTER TABLE taxi_drivers ADD COLUMN IF NOT EXISTS seats INT NOT NULL DEFAULT 3;
