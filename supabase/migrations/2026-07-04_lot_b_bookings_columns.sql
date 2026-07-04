-- ============================================================
-- Lot B — anon hardening: column-level SELECT on bookings
-- Apply on TEST **and** PROD in the same task (feedback gui).
-- Idempotent: safe to re-run.
--
-- Before: policy anon_read_bookings USING(true) + full-table SELECT grant
-- exposed EVERY column of bookings to anyone with the (public) anon key:
-- emergency_contact_*, notes, amount_paid, visa_entry/exit_date,
-- waiver_accepted_at/version, referral_source, has_travel_insurance…
--
-- The anon pages only ever need:
--   · ClientSharePage      → id, booking_number, check_in, check_out, status,
--                            client_id (clients embed), num_center_access,
--                            center_access_rate
--   · RestaurantSharePage  → subset of the above (explicit select already)
--   · Driver/TaxiManager   → join columns only (id, client_id) via
--                            taxi_trips → booking:bookings(client:clients(…))
--   · Forecast / TaxiShare / BookingForm → do not read bookings
-- App.tsx pending actions select('*') runs authenticated only (guarded).
--
-- The row policy stays USING(true) — a row policy can't restrict columns;
-- token-scoped ROW filtering is the Phase 2 chantier (see BACKLOG.md).
-- ============================================================

REVOKE SELECT ON bookings FROM anon;
GRANT  SELECT (id, booking_number, check_in, check_out, status, client_id,
               num_center_access, center_access_rate)
  ON bookings TO anon;

-- ── Verify from the outside (pattern Lot A — run for TEST and PROD): ─────────
-- OK (200, rows):
--   curl "$URL/rest/v1/bookings?select=id,booking_number,check_in,check_out,status" \
--        -H "apikey: $ANON_KEY"
-- MUST FAIL (42501 permission denied):
--   curl "$URL/rest/v1/bookings?select=*"                -H "apikey: $ANON_KEY"
--   curl "$URL/rest/v1/bookings?select=notes,amount_paid" -H "apikey: $ANON_KEY"
