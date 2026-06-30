-- ============================================================
-- Shared pages — security pass (apply on TEST first, then PROD)
-- Idempotent: safe to re-run.
--
-- Two things in one migration:
--   1. Taxi manager share page needs anon SELECT on taxi_manager_payments.
--   2. HARDENING: clients & booking_participants were fully readable by anon
--      (USING true exposed EVERY column, incl. passport_number, email, phone,
--      birth_date, emergency contacts, notes). The public share pages only ever
--      use id / first_name / last_name. We now restrict anon to those columns
--      via column-level privileges (the real gate — a row policy can't limit
--      columns). The .select() calls in the app were narrowed to match.
--      NOTE: anon can still read those identity columns for ALL rows; closing
--      that (token-scoped access) is the larger Edge Function chantier — see
--      .claude/docs/security-rls.md.
-- ============================================================

-- 1. Manager commission history readable by the taxi_manager share link
DROP POLICY IF EXISTS "anon_read_taxi_manager_payments" ON taxi_manager_payments;
CREATE POLICY "anon_read_taxi_manager_payments" ON taxi_manager_payments
  FOR SELECT TO anon USING (true);

-- 2a. clients: anon may read identity columns only
REVOKE SELECT ON clients FROM anon;
GRANT  SELECT (id, first_name, last_name) ON clients TO anon;

-- 2b. booking_participants: anon may read identity columns only
--     (passport_number, notes, client_id, kite flags stay private)
REVOKE SELECT ON booking_participants FROM anon;
GRANT  SELECT (id, booking_id, first_name, last_name) ON booking_participants TO anon;
