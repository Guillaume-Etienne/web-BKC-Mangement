-- 2026-09-02 — Reference price list for transfers (Options → Prices → Reference info).
--
-- Purely informational: answers client questions about transfer prices (Maputo/Bilene/
-- Tofo/Vilankulo/airport/boat/air transfers...). Not read by any billing code — nothing
-- in taxi_pricing_defaults or price_items depends on this table.
--
-- Seeded from gui's "Trip orga - contacts.xlsx" → tab "Transfers" (first tab), reshaped
-- into one row = one route/entry, since the source sheet mixed several price columns
-- (Price METZ / Price $ / Prize Geraldo / Price Carlos Tofo 2023) and ad-hoc notes in
-- no consistent layout. Kept as: one price + free-text notes for the rest — gui chose
-- this over replicating the multi-column mess (AskUserQuestion, 2026-09-02).
--
-- `section` groups rows for display; the first section (section_order 0, collapsible
-- false) is the main route table shown open. Everything else is a collapsible block,
-- closed by default, same UX as the Volume tiers block added earlier the same day.
--
-- A few source rows were ambiguous (merged/shifted cells, a bare "220" with no unit) —
-- kept as best-effort notes, flagged for gui to correct once seen in the UI.
--
-- RLS admin-only, same template as price_tiers (2026-08-16c): no anon use case.

CREATE TABLE transfer_reference_prices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section        TEXT NOT NULL DEFAULT 'Main routes',
  section_order  INT NOT NULL DEFAULT 0,
  collapsible    BOOLEAN NOT NULL DEFAULT true,
  row_order      INT NOT NULL DEFAULT 0,
  from_label     TEXT,
  to_label       TEXT,
  price          NUMERIC(10,2),
  currency       TEXT CHECK (currency IN ('MZN', 'EUR', 'USD')),
  detail         TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE transfer_reference_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all" ON transfer_reference_prices;
CREATE POLICY "admin_all" ON transfer_reference_prices FOR ALL TO authenticated USING (true) WITH CHECK (true);

REVOKE ALL ON transfer_reference_prices FROM anon;

-- ── Seed: Main routes (section_order 0, always open) ─────────────────────────────────
INSERT INTO transfer_reference_prices
  (section, section_order, collapsible, row_order, from_label, to_label, price, currency, detail, notes)
VALUES
  ('Main routes', 0, false, 0,  'Maputo', 'Bilene',                         8000,  'MZN', '180 km · 3h',
    'Big Taxi: 12000 MZN · Mini Bus: 17000 MZN'),
  ('Main routes', 0, false, 1,  'Bilene', 'Tofo',                           15000, 'MZN', '381 km · 6h',
    'Geraldo quote: 15000 MZN · Carlos (Tofo, 2023): 13000 MZN'),
  ('Main routes', 0, false, 2,  'Tofo', 'Vilankulo',                        12000, 'MZN', '315 km · 4h',
    'Carlos (Tofo, 2023): ~10000 MZN'),
  ('Main routes', 0, false, 3,  'Bilene', 'Vilankulo',                      30000, 'MZN', '585 km · 9h', NULL),
  ('Main routes', 0, false, 4,  'Maputo', 'Vilankulo',                      32000, 'MZN', '715 km · 11h', NULL),
  ('Main routes', 0, false, 5,  'Maputo', 'Punta do Ouro',                  5333,  'MZN', '120 km · 1h50', NULL),
  ('Main routes', 0, false, 6,  'Bilene', 'Punta do Ouro',                  13000, 'MZN', '300 km · 4h30',
    'Big Taxi: 16000 MZN'),
  ('Main routes', 0, false, 7,  'Maputo', 'Blyde River Canyon',             24000, 'MZN', '500 km · 8h', NULL),
  ('Main routes', 0, false, 8,  'Bilene', 'Kruger Park (Crocodile Bridge)', 15000, 'MZN', '268 km · 6h', NULL),
  ('Main routes', 0, false, 9,  'Bilene', 'Komatipoort',                    14000, 'MZN', '254 km · 6h',
    'Geraldo quote: $220 (confirmed Jan 2025) — unit unconfirmed in source, check with gui'),
  ('Main routes', 0, false, 10, 'Bilene', 'Maputo Special Reserve',         12000, 'MZN', '280 km · 5h',
    'No exchange-rate/USD columns filled in the source — likely a newer, unconfirmed entry');

-- ── Seed: Maputo local taxi (collapsible) ─────────────────────────────────────────────
INSERT INTO transfer_reference_prices
  (section, section_order, collapsible, row_order, from_label, to_label, price, currency, detail, notes)
VALUES
  ('Maputo local taxi', 1, true, 0, 'Viva Taxi', NULL, NULL, NULL, 'App',
    'About 30% cheaper than a regular taxi. Needs a Mozambican phone number (local SIM) to use.');

-- ── Seed: Local shuttle (Chappa) (collapsible) ────────────────────────────────────────
INSERT INTO transfer_reference_prices
  (section, section_order, collapsible, row_order, from_label, to_label, price, currency, detail, notes)
VALUES
  ('Local shuttle (Chappa)', 2, true, 0, 'Maputo Airport', 'Junta (Chappa station)', 1000, 'MZN', 'Taxi', NULL),
  ('Local shuttle (Chappa)', 2, true, 1, 'Junta', 'Bilene',                          400,  'MZN', 'Chappa, via Macia', NULL);

-- ── Seed: Air transfer (collapsible) ──────────────────────────────────────────────────
INSERT INTO transfer_reference_prices
  (section, section_order, collapsible, row_order, from_label, to_label, price, currency, detail, notes)
VALUES
  ('Air transfer', 3, true, 0, 'Bilene', 'Maputo', 700, 'USD', 'Cessna, up to 5 people',
    'Contact: Mr Santos, +258 84 608 0241');

-- ── Seed: Boat transfer (Macaneta) (collapsible) ──────────────────────────────────────
INSERT INTO transfer_reference_prices
  (section, section_order, collapsible, row_order, from_label, to_label, price, currency, detail, notes)
VALUES
  ('Boat transfer (Macaneta)', 4, true, 0, 'Airport', 'Boat (Maracuene)',              2000, 'MZN', 'Taxi · 60 min',
    'Alt figure in source: 15000 MZN for the full connection — unclear which, check with gui'),
  ('Boat transfer (Macaneta)', 4, true, 1, 'Maracuene', 'Macaneta',                    500,  'MZN', 'Boat · 30 min', NULL),
  ('Boat transfer (Macaneta)', 4, true, 2, 'Macaneta', 'Bilene',                       5000, 'MZN', '4x4 · 180 min',
    'Row was ambiguous in the source spreadsheet (shifted columns) — verify with gui'),
  ('Boat transfer (Macaneta)', 4, true, 3, 'Full connection', 'Airport → Bilene (via Macaneta)', 7500, 'MZN', 'Total · 270 min (4h30)',
    'Sum of the taxi + boat + 4x4 legs above');

-- ════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION
--
-- 1) La table existe et est fermée à anon :
--    curl "$SUPABASE_URL/rest/v1/transfer_reference_prices?select=id" -H "apikey: $ANON_KEY"
--    → doit répondre 42501 (refusé), jamais [] ni 200.
--
-- 2) Contrôle négatif — une colonne bidon doit donner une erreur différente (42703),
--    pour prouver que le 42501 ci-dessus vient bien de la table :
--    curl "$SUPABASE_URL/rest/v1/transfer_reference_prices?select=colonne_bidon" -H "apikey: $ANON_KEY"
--    → 42703.
-- ════════════════════════════════════════════════════════════════════════════
