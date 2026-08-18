-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 4 of the partner-agency work, step 2 of 2 — CLOSE the leak.
--
-- 🚦 ORDER MATTERS. Run this file ONLY after:
--    1. `2026-08-18b_agency_price_redaction_columns.sql` has run on this same
--       database (the `share_price*` columns must exist), AND
--    2. Vercel has deployed the commit that narrows the shared pages'
--       `select()` calls (they must have stopped asking for `*`).
--    Running it earlier turns every shared page into 42501 — a blank page for
--    guests, drivers and the taxi manager alike.
--
-- Same pattern as Lots B and C (2026-07-04 / 2026-07-06): the token-aware RLS
-- policies scope the ROWS, these GRANTs scope the COLUMNS. What changes here is
-- that the client price is no longer served raw — the shared pages read the
-- redacted `share_price*` mirror instead, so a service billed to a partner
-- agency carries no price over the wire at all, not merely a "—" drawn on top
-- of one.
--
-- Two columns are closed as a side effect, and deliberately:
--   * `lessons.instructor_rate` — instructor PAYROLL, frozen per lesson. The
--     2026-07-29 hardening revoked `instructors.rate_*` and dropped every anon
--     policy on `lesson_rate_overrides`, but this third copy of the same figure
--     was missed: until today any share token could read what we pay each
--     instructor. No shared page ever used it.
--   * `taxi_trips.price_eur` — no taxi page displays it (checked: taxi, driver
--     and manager pages read only the driver cost and the manager margin), so
--     the client transfer price stops being visible to those tokens entirely.
--
-- ⚠️ STILL OPEN, on purpose, and needs a decision from gui (see BACKLOG):
-- `taxi_trips.price_driver_mzn` and `margin_manager_mzn` stay readable by ANY
-- valid token, including a client one — so a guest can still see what we pay
-- their driver, i.e. our margin. Column privileges are per ROLE, not per token
-- type, and the driver and manager pages genuinely need those two figures, so
-- closing this needs a per-token surface (a view or function per share type),
-- not a GRANT. Out of scope for Phase 4, not forgotten.
--
-- ROLLBACK (restores the previous, wide-open state):
--   GRANT SELECT ON lessons, equipment_rentals, taxi_trips, booking_room_prices TO anon;
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Lessons — what a guest needs to recognise their own lesson, plus the redacted
-- price. Blocked: price_per_hour (raw client price, now served redacted),
-- instructor_rate (payroll, see above), kite_id / board_id / created_at (never
-- displayed on any shared page).
REVOKE SELECT ON lessons FROM anon;
GRANT  SELECT (id, booking_id, instructor_id, participant_ids, date, start_time,
               duration_hours, type, notes, share_price_per_hour,
               agency_billing_line_id)
  ON lessons TO anon;

-- Equipment rentals — the Forecast page shows the rental price publicly (it
-- always has), so it gets the redacted column too. Blocked: price (raw),
-- notes (internal), created_at.
REVOKE SELECT ON equipment_rentals FROM anon;
GRANT  SELECT (id, equipment_id, booking_id, participant_id, date, slot,
               share_price, agency_billing_line_id)
  ON equipment_rentals TO anon;

-- Taxi trips — driver cost and manager margin stay (the driver and manager
-- pages are built on them). Blocked: price_eur (raw client price), created_at.
REVOKE SELECT ON taxi_trips FROM anon;
GRANT  SELECT (id, date, start_time, type, status, taxi_driver_id, booking_id,
               nb_persons, nb_luggage, nb_boardbags, notes,
               price_driver_mzn, margin_manager_mzn,
               share_price_eur, agency_billing_line_id)
  ON taxi_trips TO anon;

-- Room prices — `override_note` is kept: it is written to be shown to the guest
-- ("negotiated rate", "long-stay discount") and the page already displays it.
-- Blocked: price_per_night (raw).
REVOKE SELECT ON booking_room_prices FROM anon;
GRANT  SELECT (booking_id, room_id, override_note, share_price_per_night,
               agency_billing_line_id)
  ON booking_room_prices TO anon;

COMMIT;

-- ── Vérifications ─────────────────────────────────────────────────────────────
--
-- ⚠️ Un curl anon « nu » ne prouve RIEN ici : depuis la Phase 2, sans header
-- `x-share-token` valide, ces tables rendent `[]` quoi qu'il arrive. Il faut un
-- VRAI token client, sinon on ne teste que la RLS de ligne.
--
--   TOKEN=<token d'un shared_link actif de type 'client'>   # Options → Shared Links
--   URL=https://<ref>.supabase.co ; KEY=<clé anon>
--   H=(-H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "x-share-token: $TOKEN")
--
-- 1) La colonne brute est FERMÉE — doit répondre 42501 :
--      curl -s "$URL/rest/v1/lessons?select=price_per_hour"           "${H[@]}"
--      curl -s "$URL/rest/v1/lessons?select=instructor_rate"          "${H[@]}"
--      curl -s "$URL/rest/v1/equipment_rentals?select=price"          "${H[@]}"
--      curl -s "$URL/rest/v1/taxi_trips?select=price_eur"             "${H[@]}"
--      curl -s "$URL/rest/v1/booking_room_prices?select=price_per_night" "${H[@]}"
--    Et `select=*` doit répondre 42501 aussi sur les 4 (c'est le piège du
--    2026-07-29 : une page qui demande encore `*` se vide).
--
-- 2) La colonne rédigée est OUVERTE et rend des lignes — doit répondre 200 :
--      curl -s "$URL/rest/v1/lessons?select=id,date,share_price_per_hour,agency_billing_line_id" "${H[@]}"
--    Sur une résa avec au moins une ligne agence : `share_price_per_hour` est
--    **null** exactement là où `agency_billing_line_id` est non nul, et porte le
--    prix partout ailleurs. C'est LA preuve que la Phase 4 fait ce qu'elle dit —
--    la lire sur une résa sans ligne agence ne prouve rien.
--
-- 3) Contrôle négatif (la colonne n'existe pas) → 42703, pas 42501 :
--      curl -s "$URL/rest/v1/lessons?select=colonne_bidon" "${H[@]}"
--
-- 4) Les pages partagées répondent encore : ouvrir un lien client, un lien
--    driver et le lien Forecast dans le navigateur. Une page blanche = un
--    `select()` non narrowé qui traîne.
