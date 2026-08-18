-- Phase 4 of the partner-agency work, step 1 of 2 — ADD the redacted price
-- columns. Nothing is revoked here, so this file is safe to run at any time,
-- before or after the front-end is deployed: it only adds columns.
--
-- ⚠️ Step 2 (`2026-08-18c_agency_price_revoke.sql`) is the one that actually
-- closes the leak, and it MUST run only once Vercel has deployed the commit
-- that narrows the shared pages' `select()` calls. Running them in the wrong
-- order breaks the shared pages in one direction or the other:
--   * revoke before deploy → the pages still ask for `*` → 42501, blank page;
--   * deploy before this file → the pages ask for a column that doesn't
--     exist yet → 42703, blank page.
-- Two files, one order, no window where a client link is broken.
--
-- ── Why this instead of the SECURITY DEFINER function the BACKLOG proposed ──
--
-- The problem: a service billed to a partner agency must show no price on the
-- guest's shared page. Since 2026-08-17 that is a DISPLAY rule only — the page
-- draws "—" while `price_per_hour` still travels in the same JSON row, so
-- anyone opening devtools (or replaying the request with the public anon key
-- and a valid share token) reads the price we meant to hide.
--
-- A plain column GRANT cannot express it: privileges are per column, and the
-- condition here depends on ANOTHER column of the same row
-- (`agency_billing_line_id`). Hence the BACKLOG's idea of a SECURITY DEFINER
-- function returning the rows with the price nulled out.
--
-- A GENERATED column does the same job with strictly less risk. A SECURITY
-- DEFINER function (or a non-`security_invoker` view) runs as the owner and
-- therefore BYPASSES row-level security: the row scoping that today lives in
-- the `anon_read_*` policies would have to be rewritten inside it, and a single
-- mistake in that WHERE clause leaks every row of the table to any token
-- holder. The generated column touches no policy at all: RLS keeps scoping the
-- rows exactly as it does now, and the value itself is already redacted before
-- any privilege is even considered. It is also a normal column, so PostgREST
-- can alias it (`select=price_per_hour:share_price_per_hour`) and the pages'
-- own logic needs no change.
--
-- Read-only by construction: a GENERATED ALWAYS column cannot be written to,
-- so no screen can ever set it out of sync with the real price. The expression
-- is immutable and single-row, which is what Postgres requires.

-- ── The four sources of a guest's bill ────────────────────────────────────────
-- Same shape four times: NULL when the line is billed to an agency, the real
-- client price otherwise. NULL and not 0 on purpose — 0 is a legitimate price
-- (a free rental, a comped transfer) and the two must stay distinguishable.

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS share_price_per_hour NUMERIC(8,2)
  GENERATED ALWAYS AS (
    CASE WHEN agency_billing_line_id IS NULL THEN price_per_hour END
  ) STORED;

ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS share_price NUMERIC(8,2)
  GENERATED ALWAYS AS (
    CASE WHEN agency_billing_line_id IS NULL THEN price END
  ) STORED;

ALTER TABLE taxi_trips ADD COLUMN IF NOT EXISTS share_price_eur INTEGER
  GENERATED ALWAYS AS (
    CASE WHEN agency_billing_line_id IS NULL THEN price_eur END
  ) STORED;

ALTER TABLE booking_room_prices ADD COLUMN IF NOT EXISTS share_price_per_night NUMERIC(8,2)
  GENERATED ALWAYS AS (
    CASE WHEN agency_billing_line_id IS NULL THEN price_per_night END
  ) STORED;

COMMENT ON COLUMN lessons.share_price_per_hour IS
  'Client €/h as shown on shared links: NULL when the lesson is billed to a partner agency. Read-only mirror of price_per_hour — admin screens use price_per_hour.';
COMMENT ON COLUMN equipment_rentals.share_price IS
  'Rental price as shown on shared links: NULL when billed to a partner agency.';
COMMENT ON COLUMN taxi_trips.share_price_eur IS
  'Client transfer price as shown on shared links: NULL when billed to a partner agency. The driver cost and manager margin are untouched — the agency pays the trip, the driver is still owed.';
COMMENT ON COLUMN booking_room_prices.share_price_per_night IS
  'Room price as shown on shared links: NULL when billed to a partner agency.';

-- No GRANT needed here: `anon` still holds table-level SELECT on these four
-- tables (the column narrowing happens in step 2), so the new columns are
-- readable the moment they exist. That is exactly what makes this file safe to
-- run before the deploy.

-- ── Vérifications (après avoir passé CE fichier) ─────────────────────────────
--
-- 1) Les 4 colonnes existent (SQL editor, connecté) :
--      SELECT table_name, column_name, is_generated
--        FROM information_schema.columns
--       WHERE column_name LIKE 'share_price%'
--       ORDER BY table_name;
--    → 4 lignes, is_generated = 'ALWAYS'.
--
-- 2) La rédaction est effective — sur une base qui a des lignes agence :
--      SELECT price_per_hour, share_price_per_hour, agency_billing_line_id
--        FROM lessons WHERE agency_billing_line_id IS NOT NULL LIMIT 5;
--    → share_price_per_hour NULL alors que price_per_hour a une valeur.
--    Et le contrôle inverse (lignes normales) : les deux colonnes égales.
--      SELECT count(*) FROM lessons
--       WHERE agency_billing_line_id IS NULL
--         AND share_price_per_hour IS DISTINCT FROM price_per_hour;
--    → 0.
--
-- 3) On ne peut PAS écrire dedans (garde-fou du design) :
--      UPDATE lessons SET share_price_per_hour = 1 WHERE false;
--    → erreur 428C9 « cannot insert a non-DEFAULT value into column ».
--
-- 4) Rien n'est encore protégé à cette étape, et c'est normal : un curl anon
--    avec un token client valide lit toujours `price_per_hour`. C'est le
--    fichier `c` qui ferme la porte.
