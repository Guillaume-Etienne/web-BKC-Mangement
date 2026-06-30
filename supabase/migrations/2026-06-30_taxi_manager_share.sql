-- ============================================================
-- Taxi manager share page — anon read access
-- Apply on TEST first, then PROD.
-- The public "taxi_manager" shared link renders the manager's commission
-- history, so the anon role needs SELECT on taxi_manager_payments
-- (taxi_trips / taxi_drivers already have anon SELECT policies).
-- Idempotent: safe to re-run.
-- ============================================================

DROP POLICY IF EXISTS "anon_read_taxi_manager_payments" ON taxi_manager_payments;
CREATE POLICY "anon_read_taxi_manager_payments" ON taxi_manager_payments
  FOR SELECT TO anon USING (true);
