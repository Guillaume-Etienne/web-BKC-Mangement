-- Real invoices for partner agencies — the document, not just the amounts.
--
-- Until now the app knew WHAT was owed (`agency_billing_lines`) but had no notion
-- of an invoice: no number, no reference, nothing to print. gui writes the Fun & Fly
-- invoice by hand from an Excel template. This adds the missing entity so the app
-- can produce that document.
--
-- Modelled on the real template (`temp/Factu BKC 2025 FFLY Famille Brunet.xlsx`),
-- which carries TWO numbers, and they must not be confused:
--   * `invoice_number` — OURS, "20251029" in the template: the issue date as
--     YYYYMMDD. Two invoices on one day get "-2", "-3"… (gui: "pas grave on
--     incrémente"). UNIQUE, because a duplicate invoice number is an accounting
--     problem, not a cosmetic one.
--   * `agency_ref` — THEIRS, printed as "ref F&Fly : 134606". Fun & Fly hands it
--     to us and expects to see it back on the invoice. Nullable: it may not be
--     known when the lines are first entered.
--
-- ── Why the stamps move here (decision: gui, 2026-08-19) ─────────────────────
-- `invoiced_at` / `paid_at` currently sit on each LINE, which is wrong now that
-- invoices exist: one settles an invoice, never a line. Keeping both would give
-- two sources of truth for "paid" — the exact class of divergence this codebase
-- has already paid for (dashboard vs CashFlow, 2026-08-17). Verified before
-- writing this: **no line on either database carries a stamp**, so nothing is
-- lost. The now-dead columns on `agency_billing_lines` are dropped in a SECOND
-- migration, once the deployed code has stopped reading them — same two-step
-- dance as the Phase 4 redaction, for the same reason.
--
-- ── One invoice per booking, but not enforced ────────────────────────────────
-- gui: "une factu = une résa". Deliberately NOT a UNIQUE (booking_id, agency_id)
-- constraint: booking #022 is getting a second lesson block once its price is
-- decided, and if the first invoice has already gone out that needs a second
-- invoice on the same booking. The constraint would have blocked exactly the case
-- we already know is coming.

CREATE TABLE IF NOT EXISTS agency_invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id      UUID NOT NULL REFERENCES agencies(id),
  booking_id     UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  agency_ref     TEXT,
  issued_on      DATE NOT NULL DEFAULT CURRENT_DATE,
  invoiced_at    TIMESTAMPTZ,
  paid_at        TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agency_invoices_booking ON agency_invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_agency_invoices_agency  ON agency_invoices(agency_id);

COMMENT ON TABLE  agency_invoices IS
  'One invoice sent to a partner agency, for one booking. Carries our number and the agency''s own reference, and the invoiced/paid stamps that used to live on each line.';
COMMENT ON COLUMN agency_invoices.invoice_number IS
  'Our number: issue date as YYYYMMDD, suffixed -2, -3… when several invoices go out the same day.';
COMMENT ON COLUMN agency_invoices.agency_ref IS
  'The reference the agency gives us, printed on the invoice ("ref F&Fly : 134606"). NULL until they provide it.';

-- Lines attach to an invoice. Nullable and ON DELETE SET NULL: a line exists as
-- soon as a service is billed to the agency, well before any invoice is drawn up
-- (that is the state booking #022 has been in since 2026-08-19), and deleting an
-- invoice must return its lines to the "not yet invoiced" pool, never destroy
-- what is owed.
ALTER TABLE agency_billing_lines
  ADD COLUMN IF NOT EXISTS agency_invoice_id UUID REFERENCES agency_invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agency_billing_lines_invoice
  ON agency_billing_lines(agency_invoice_id);

-- Admin-only, like every other agency table (`agencies`, `agency_rate_items`,
-- `agency_billing_lines`): an invoice carries our commercial terms and a partner's
-- billing reference. Not one column goes to anon — the shared Forecast planning is
-- served anonymously.
ALTER TABLE agency_invoices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON agency_invoices FROM anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON agency_invoices TO authenticated;

CREATE POLICY "authenticated_all_agency_invoices" ON agency_invoices
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Vérifications (après avoir passé la migration) ───────────────────────────
--
-- ⚠️ Table admin-only : un curl anon rend 42501 avant comme après, il ne prouve
-- RIEN. Vérifier en service_role (SQL editor, ou les clés de `mcp-server/.env`).
--
-- 1) La table existe et anon n'y a aucun accès — doit répondre 42501 :
--      curl -s "$URL/rest/v1/agency_invoices?select=invoice_number" \
--        -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
--    Contrôle négatif en service_role (doit répondre 42703, pas 42501) :
--      ...?select=colonne_bidon
--
-- 2) Le rattachement existe (service_role) — doit répondre 200 :
--      curl -s "$URL/rest/v1/agency_billing_lines?select=id,agency_invoice_id" \
--        -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE"
--
-- 3) Le numéro est bien unique — doit échouer en 23505 sur le second INSERT :
--      INSERT INTO agency_invoices (agency_id, booking_id, invoice_number)
--      SELECT agency_id, id, '_test_dup' FROM bookings WHERE agency_id IS NOT NULL LIMIT 1;
--      -- rejouer la même ligne → 23505 duplicate key
--      DELETE FROM agency_invoices WHERE invoice_number = '_test_dup';
--
-- 4) Les tampons des LIGNES sont toujours là et toujours vides (ils ne seront
--    supprimés que par la migration suivante, après déploiement) :
--      SELECT count(*) FROM agency_billing_lines
--       WHERE invoiced_at IS NOT NULL OR paid_at IS NOT NULL;   -- attendu : 0
