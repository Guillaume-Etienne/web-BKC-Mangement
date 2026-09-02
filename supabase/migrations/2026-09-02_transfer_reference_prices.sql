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
-- `page` is the top-level sub-tab this row belongs to under Options → Prices — 'transfers'
-- (this file) or 'kruger' (2026-09-02b, its own tab, gui asked for it separate on 2026-09-02).
-- `section` then groups rows within a page for display; the first section (section_order 0,
-- collapsible false) is shown open, everything else collapsible and closed by default —
-- same UX as the Volume tiers block added earlier the same day.
--
-- No currency-picker column (removed 2026-09-02 per gui): three fixed, independently
-- nullable price columns instead. The 'transfers' page only ever fills price_mzn (+
-- price_eur when gui knows the EUR figure — the source excel never gave one, only MZN
-- and a computed USD via a "Change" rate, so every price_eur below starts NULL for gui
-- to fill in as he learns them). The one USD-only entry (air transfer) uses price_usd.
--
-- A few source rows were ambiguous (merged/shifted cells, a bare "220" with no unit) —
-- kept as best-effort notes, flagged for gui to correct once seen in the UI.
--
-- RLS admin-only, same template as price_tiers (2026-08-16c): no anon use case.
--
-- ⚠️ UPGRADE-SAFE ON PURPOSE: gui ran an earlier version of this file (and of
-- 2026-09-02b) on TEST before the page/price_mzn/price_eur/price_usd redesign above —
-- that base has the table with the old `price`+`currency` columns and the old seed
-- rows already in it (transfers AND the Kruger section, back then stored as a
-- collapsible section of this same page rather than its own `page='kruger'`). PROD
-- has nothing at all yet. This file now detects which of the two it's talking to and
-- does the right thing either way — CREATE fresh on PROD, ALTER + backfill + skip
-- reseeding on TEST — so gui can run the exact same two files on both bases.

-- 1) Fresh install (PROD): create with the current schema straight away.
CREATE TABLE IF NOT EXISTS transfer_reference_prices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page           TEXT NOT NULL DEFAULT 'transfers',
  section        TEXT NOT NULL DEFAULT 'Main routes',
  section_order  INT NOT NULL DEFAULT 0,
  collapsible    BOOLEAN NOT NULL DEFAULT true,
  row_order      INT NOT NULL DEFAULT 0,
  from_label     TEXT,
  to_label       TEXT,
  price_mzn      NUMERIC(10,2),
  price_eur      NUMERIC(10,2),
  price_usd      NUMERIC(10,2),
  detail         TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- 2) Upgrade path (TEST): add whatever the old version didn't have. No-op wherever
--    step 1 just created the table fresh — the columns already exist.
ALTER TABLE transfer_reference_prices ADD COLUMN IF NOT EXISTS page TEXT;
ALTER TABLE transfer_reference_prices ADD COLUMN IF NOT EXISTS price_mzn NUMERIC(10,2);
ALTER TABLE transfer_reference_prices ADD COLUMN IF NOT EXISTS price_eur NUMERIC(10,2);
ALTER TABLE transfer_reference_prices ADD COLUMN IF NOT EXISTS price_usd NUMERIC(10,2);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transfer_reference_prices' AND column_name = 'currency'
  ) THEN
    -- Backfill the new price columns from the old price+currency pair (values were
    -- never touched between versions — same numbers, just split by currency).
    UPDATE transfer_reference_prices SET price_mzn = price WHERE currency = 'MZN';
    UPDATE transfer_reference_prices SET price_eur = price WHERE currency = 'EUR';
    UPDATE transfer_reference_prices SET price_usd = price WHERE currency = 'USD';

    -- The old run of 2026-09-02b seeded Kruger as a collapsible section of THIS page
    -- (section_order 5). Move it to its own page, open by default, matching the
    -- current design — 2026-09-02b's own seed step below then finds it already
    -- there and skips re-inserting.
    UPDATE transfer_reference_prices SET section_order = 0, collapsible = false
      WHERE section = 'Kruger Park & Eswatini tours' AND section_order = 5;
    UPDATE transfer_reference_prices SET page = 'kruger'
      WHERE section = 'Kruger Park & Eswatini tours';

    ALTER TABLE transfer_reference_prices DROP COLUMN price;
    ALTER TABLE transfer_reference_prices DROP COLUMN currency;
  END IF;
END $$;

-- Whatever wasn't already tagged 'kruger' above (i.e. everything, on a fresh PROD
-- install, or the pre-existing transfers rows on TEST) belongs to this page.
UPDATE transfer_reference_prices SET page = 'transfers' WHERE page IS NULL;
ALTER TABLE transfer_reference_prices ALTER COLUMN page SET DEFAULT 'transfers';
ALTER TABLE transfer_reference_prices ALTER COLUMN page SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transfer_reference_prices_page_check') THEN
    ALTER TABLE transfer_reference_prices
      ADD CONSTRAINT transfer_reference_prices_page_check CHECK (page IN ('transfers', 'kruger'));
  END IF;
END $$;

ALTER TABLE transfer_reference_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all" ON transfer_reference_prices;
CREATE POLICY "admin_all" ON transfer_reference_prices FOR ALL TO authenticated USING (true) WITH CHECK (true);

REVOKE ALL ON transfer_reference_prices FROM anon;

-- 3) Seed — skipped on TEST, which already has these rows (step 2 just migrated
--    their columns in place); runs on a fresh PROD install.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM transfer_reference_prices WHERE page = 'transfers' AND section = 'Main routes') THEN

    -- ── Main routes (section_order 0, always open) ─────────────────────────────────
    INSERT INTO transfer_reference_prices
      (page, section, section_order, collapsible, row_order, from_label, to_label, price_mzn, detail, notes)
    VALUES
      ('transfers', 'Main routes', 0, false, 0,  'Maputo', 'Bilene',                         8000,  '180 km · 3h',
        'Big Taxi: 12000 MZN · Mini Bus: 17000 MZN'),
      ('transfers', 'Main routes', 0, false, 1,  'Bilene', 'Tofo',                           15000, '381 km · 6h',
        'Geraldo quote: 15000 MZN · Carlos (Tofo, 2023): 13000 MZN'),
      ('transfers', 'Main routes', 0, false, 2,  'Tofo', 'Vilankulo',                        12000, '315 km · 4h',
        'Carlos (Tofo, 2023): ~10000 MZN'),
      ('transfers', 'Main routes', 0, false, 3,  'Bilene', 'Vilankulo',                      30000, '585 km · 9h', NULL),
      ('transfers', 'Main routes', 0, false, 4,  'Maputo', 'Vilankulo',                      32000, '715 km · 11h', NULL),
      ('transfers', 'Main routes', 0, false, 5,  'Maputo', 'Punta do Ouro',                  5333,  '120 km · 1h50', NULL),
      ('transfers', 'Main routes', 0, false, 6,  'Bilene', 'Punta do Ouro',                  13000, '300 km · 4h30',
        'Big Taxi: 16000 MZN'),
      ('transfers', 'Main routes', 0, false, 7,  'Maputo', 'Blyde River Canyon',             24000, '500 km · 8h', NULL),
      ('transfers', 'Main routes', 0, false, 8,  'Bilene', 'Kruger Park (Crocodile Bridge)', 15000, '268 km · 6h', NULL),
      ('transfers', 'Main routes', 0, false, 9,  'Bilene', 'Komatipoort',                    14000, '254 km · 6h',
        'Geraldo quote: $220 (confirmed Jan 2025) — unit unconfirmed in source, check with gui'),
      ('transfers', 'Main routes', 0, false, 10, 'Bilene', 'Maputo Special Reserve',         12000, '280 km · 5h',
        'No exchange-rate/USD columns filled in the source — likely a newer, unconfirmed entry');

    -- ── Maputo local taxi (collapsible) ─────────────────────────────────────────────
    INSERT INTO transfer_reference_prices
      (page, section, section_order, collapsible, row_order, from_label, to_label, detail, notes)
    VALUES
      ('transfers', 'Maputo local taxi', 1, true, 0, 'Viva Taxi', NULL, 'App',
        'About 30% cheaper than a regular taxi. Needs a Mozambican phone number (local SIM) to use.');

    -- ── Local shuttle (Chappa) (collapsible) ────────────────────────────────────────
    INSERT INTO transfer_reference_prices
      (page, section, section_order, collapsible, row_order, from_label, to_label, price_mzn, detail, notes)
    VALUES
      ('transfers', 'Local shuttle (Chappa)', 2, true, 0, 'Maputo Airport', 'Junta (Chappa station)', 1000, 'Taxi', NULL),
      ('transfers', 'Local shuttle (Chappa)', 2, true, 1, 'Junta', 'Bilene',                          400,  'Chappa, via Macia', NULL);

    -- ── Air transfer (collapsible) ──────────────────────────────────────────────────
    INSERT INTO transfer_reference_prices
      (page, section, section_order, collapsible, row_order, from_label, to_label, price_usd, detail, notes)
    VALUES
      ('transfers', 'Air transfer', 3, true, 0, 'Bilene', 'Maputo', 700, 'Cessna, up to 5 people',
        'Contact: Mr Santos, +258 84 608 0241');

    -- ── Boat transfer (Macaneta) (collapsible) ──────────────────────────────────────
    INSERT INTO transfer_reference_prices
      (page, section, section_order, collapsible, row_order, from_label, to_label, price_mzn, detail, notes)
    VALUES
      ('transfers', 'Boat transfer (Macaneta)', 4, true, 0, 'Airport', 'Boat (Maracuene)',              2000, 'Taxi · 60 min',
        'Alt figure in source: 15000 MZN for the full connection — unclear which, check with gui'),
      ('transfers', 'Boat transfer (Macaneta)', 4, true, 1, 'Maracuene', 'Macaneta',                    500,  'Boat · 30 min', NULL),
      ('transfers', 'Boat transfer (Macaneta)', 4, true, 2, 'Macaneta', 'Bilene',                       5000, '4x4 · 180 min',
        'Row was ambiguous in the source spreadsheet (shifted columns) — verify with gui'),
      ('transfers', 'Boat transfer (Macaneta)', 4, true, 3, 'Full connection', 'Airport → Bilene (via Macaneta)', 7500, 'Total · 270 min (4h30)',
        'Sum of the taxi + boat + 4x4 legs above');

  END IF;
END $$;

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
--
-- 3) Sur TEST (upgrade path), en service_role : `price`/`currency` n'existent plus
--    (`select price` → 42703), `price_mzn` porte les anciennes valeurs MZN, `page`
--    vaut 'transfers' partout sauf les lignes Kruger.
-- ════════════════════════════════════════════════════════════════════════════
