-- 2026-08-16 (c) — Tarification dégressive par palier (cours privés et groupe).
--
-- Conçu en discussion avec gui le 2026-08-16, en creusant la facturation agences :
-- aujourd'hui, 2h ou 20h de cours coûtent le même prix à l'heure, pour tout le
-- monde. Décisions :
--   - Prix/h par palier (pas un pourcentage), pour lesson_private et lesson_group
--     seulement (jamais lesson_supervision).
--   - Le palier se cale sur le cumul d'heures **avant** la leçon du jour : la
--     leçon qui franchit le seuil reste à l'ancien tarif, la suivante passe au
--     nouveau.
--   - Le cumul court sur toute la vie du client, jamais remis à zéro.
--   - Un client agence qui a épuisé son forfait (chantier séparé) retombe sur ce
--     même mécanisme pour son surplus.
--
-- Le tarif de base existant (price_items.price) reste le palier "0h+" implicite —
-- pas besoin de le dupliquer ici, une ligne par palier SUPPLÉMENTAIRE suffit.
--
-- RLS admin-only, même gabarit que agencies/agency_rate_items (2026-08-16b) et
-- document_templates (2026-07-09) : aucun cas d'usage anon aujourd'hui.
-- ClientSharePage ne lit que lessons.price_per_hour déjà figé — jamais cette
-- table ni price_items en direct.

CREATE TABLE price_tiers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billable_type  TEXT NOT NULL CHECK (billable_type IN ('lesson_private', 'lesson_group')),
  min_hours      NUMERIC(6,2) NOT NULL,
  price_per_hour NUMERIC(8,2) NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (billable_type, min_hours)
);

ALTER TABLE price_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all" ON price_tiers;
CREATE POLICY "admin_all" ON price_tiers FOR ALL TO authenticated USING (true) WITH CHECK (true);

REVOKE ALL ON price_tiers FROM anon;

-- ════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION
--
-- 1) La table existe et est fermée à anon :
--    curl "$SUPABASE_URL/rest/v1/price_tiers?select=id" -H "apikey: $ANON_KEY"
--    → doit répondre 42501 (refusé), jamais [] ni 200.
--
-- 2) Contrôle négatif — une colonne bidon doit donner une erreur différente
--    (42703), pour prouver que le 42501 ci-dessus vient bien de la table :
--    curl "$SUPABASE_URL/rest/v1/price_tiers?select=colonne_bidon" -H "apikey: $ANON_KEY"
--    → 42703.
-- ════════════════════════════════════════════════════════════════════════════
