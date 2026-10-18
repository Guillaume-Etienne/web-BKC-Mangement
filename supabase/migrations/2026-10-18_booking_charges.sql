-- 2026-10-18 — Lignes « Extras » d'une résa : un montant dû saisi à la main.
--
-- Le total d'une résa est entièrement CALCULÉ depuis ses sources (chambres, cours, locations,
-- taxis, repas, activités, center access). Il manquait l'inverse du discount : un dû libre
-- (une nuit dans une maison, une casse, des boissons…). Une ligne = date, libellé, catégorie,
-- quantité × prix unitaire en €.
--
-- Décisions gui (2026-10-18) :
--   - prix saisi à la main, en € uniquement ;
--   - visible du client (page partagée, section « Extras ») — sauf `notes`, interne ;
--   - jamais dans une facture agence : sur une résa agence, c'est le client qui paie en direct ;
--   - catégorie `accommodation` : la quantité = des nuits, comptées dans « Nights sold » et dans
--     le revenu hébergement. Pas d'affichage au planning (hors périmètre).
--
-- ⚠️ Strictement additif : une table neuve, AUCUN enum (category = TEXT + CHECK), un seul fichier.
-- ON DELETE RESTRICT vers bookings, comme payments (2026-10-16d) : c'est de l'argent, une
-- suppression de résa ne doit pas l'emporter en silence.
-- À passer en TEST puis en PROD.

CREATE TABLE IF NOT EXISTS booking_charges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  date        DATE NOT NULL,
  label       TEXT NOT NULL CHECK (btrim(label) <> ''),
  category    TEXT NOT NULL DEFAULT 'other'
              CHECK (category IN ('accommodation', 'food', 'equipment', 'other')),
  quantity    NUMERIC(8,2)  NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price  NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_charges_booking ON booking_charges (booking_id);

ALTER TABLE booking_charges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all" ON booking_charges;
CREATE POLICY "admin_all" ON booking_charges FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Supabase accorde par défaut tous les privilèges à anon sur une table neuve : on les retire,
-- PUIS on rouvre les seules colonnes que la page client affiche (jamais `notes`).
REVOKE ALL ON booking_charges FROM anon;
GRANT SELECT (id, booking_id, date, label, category, quantity, unit_price)
  ON booking_charges TO anon;

DROP POLICY IF EXISTS "anon_read_booking_charges" ON booking_charges;
CREATE POLICY "anon_read_booking_charges" ON booking_charges FOR SELECT TO anon USING (
  share_type() = 'client' AND booking_id = share_booking_id()
);

-- ════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION — TEST **et** PROD, par curl anon (clés dans client/.env.local) :
--   sans token :
--     booking_charges?select=id                     → []  (RLS, normal)
--   avec un VRAI token client (Options → Shared Links), après avoir ajouté un extra à sa résa :
--     booking_charges?select=id,label,category,quantity,unit_price → ses lignes seulement
--     booking_charges?select=notes                  → 42501 (colonne fermée)
--     booking_charges?select=*                      → 42501
-- ════════════════════════════════════════════════════════════════════════════
