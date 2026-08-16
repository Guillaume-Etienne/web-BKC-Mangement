-- 2026-08-16 (b) — Fondations de la facturation aux agences partenaires.
--
-- Fun&Fly (et d'autres agences comme elle) envoient des clients à BKC. Le
-- centre rend le service (cours, location, transfert, parfois hébergement
-- en maison/bungalow) mais c'est l'AGENCE qui doit être facturée, pas le
-- client — à un tarif catalogue propre à chaque agence, moins une commission
-- qu'elle retient. Repéré le 2026-08-16 en convertissant une vraie demande
-- Fun&Fly en réservation, confirmé sur une facture réelle fournie par gui
-- (temp/Factu BKC 2025 FFLY Famille Brunet.xlsx) : catalogue fixe par agence
-- (ex. "Pack cours Privé 10x 2h" = 450€), commission % retenue sur le total
-- (20% chez Fun&Fly), facturation au fil de l'eau revue avec gui avant envoi.
--
-- ⚠️ CE FICHIER POSE LES FONDATIONS SEULEMENT (schéma + écran de gestion,
-- voir AgenciesTab.tsx). Rien ne remplit encore `agency_billing_lines` ni
-- les colonnes `agency_billing_line_id` — elles attendent la Phase 2
-- (brancher le wizard, le planning, masquer les prix côté client). Voir
-- `.claude/docs/BACKLOG.md` § Agences partenaires pour la suite.
--
-- Design :
-- - `agencies` : le registre des partenaires (nom, commission %, actif).
-- - `agency_rate_items` : la grille tarifaire, une ligne par agence et par
--   type de prestation (mirroring price_items, mais couvre aussi transfert
--   et hébergement que price_items ne couvre pas). TEXT+CHECK plutôt qu'un
--   enum Postgres — évite le piège "ALTER TYPE ADD VALUE dans la même
--   transaction que son usage" déjà rencontré (billable_type, 2026-07-30).
--   Comme les tarifs verrouillés d'Options → Pricing : on désactive, on ne
--   supprime pas — une ligne déjà facturée doit rester lisible dans
--   l'historique.
-- - `agency_billing_lines` : l'unité facturable réelle — UNE ligne = UNE
--   ligne de facture, même quand un forfait de 10×2h se traduit par 10
--   séances dans le planning. Découplé des leçons individuelles exprès.
--   `participant_id` nullable : un forfait est attaché à une personne
--   précise (la facture Brunet a 3 lignes "Pack Privé" identiques, une par
--   membre de la famille — chacun son propre compteur), mais reste
--   optionnel pour les lignes qui ne concernent pas un participant précis.
--   `price`/`unit_hours` figés à la création — même logique que
--   `lessons.price_per_hour` ou `external_accommodation_bookings.total_cost` :
--   changer un tarif demain ne doit pas rouvrir une ligne déjà facturée.
--   `invoiced_at`/`paid_at` nullables plutôt qu'un statut enum : même idiome
--   que `waiver_accepted_at`/`crm_synced_at` ailleurs dans le schéma.
--
-- RLS : admin-only, aucun cas d'usage anon aujourd'hui — même gabarit que
-- `document_templates` (2026-07-09) : policy `authenticated` + REVOKE anon
-- explicite (les GRANT par défaut de Supabase laisseraient sinon passer un
-- curl anon avec un `[]` silencieux plutôt qu'un vrai refus).
--
-- Les 4 colonnes `agency_billing_line_id` ajoutées à des tables déjà
-- lisibles en anon (lessons, notamment) ne changent rien à leur exposition
-- actuelle : ce sont de simples FK nullables, pas des montants. Masquer
-- `lessons.price_per_hour` quand la leçon est facturée à une agence est un
-- sujet à part (fonction SECURITY DEFINER, pas un GRANT de colonne — un
-- GRANT ne peut pas cacher une valeur seulement pour certaines lignes), posé
-- pour la Phase 4 dans le BACKLOG.

CREATE TABLE agencies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  commission_percent  NUMERIC(5,2) NOT NULL DEFAULT 0,
  notes               TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE agency_rate_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id    UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  category     TEXT NOT NULL CHECK (category IN ('lesson', 'rental', 'transfer', 'accommodation')),
  label        TEXT NOT NULL,
  unit_hours   NUMERIC(5,2),                    -- taille du forfait, category='lesson' seulement
  price        NUMERIC(10,2) NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,    -- on désactive, on ne supprime pas
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE agency_billing_lines (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id           UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  agency_id            UUID NOT NULL REFERENCES agencies(id),
  participant_id       UUID REFERENCES booking_participants(id) ON DELETE SET NULL,
  agency_rate_item_id  UUID REFERENCES agency_rate_items(id),
  price                NUMERIC(10,2) NOT NULL,   -- figé à la création
  unit_hours           NUMERIC(5,2),             -- figé à la création, forfaits cours seulement
  invoiced_at          TIMESTAMPTZ,
  paid_at              TIMESTAMPTZ,
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agency_rate_items_agency  ON agency_rate_items(agency_id);
CREATE INDEX idx_agency_billing_booking    ON agency_billing_lines(booking_id);
CREATE INDEX idx_agency_billing_agency     ON agency_billing_lines(agency_id);

ALTER TABLE bookings           ADD COLUMN agency_id             UUID REFERENCES agencies(id) ON DELETE SET NULL;
ALTER TABLE lessons            ADD COLUMN agency_billing_line_id UUID REFERENCES agency_billing_lines(id) ON DELETE SET NULL;
ALTER TABLE equipment_rentals  ADD COLUMN agency_billing_line_id UUID REFERENCES agency_billing_lines(id) ON DELETE SET NULL;
ALTER TABLE taxi_trips         ADD COLUMN agency_billing_line_id UUID REFERENCES agency_billing_lines(id) ON DELETE SET NULL;
ALTER TABLE booking_room_prices ADD COLUMN agency_billing_line_id UUID REFERENCES agency_billing_lines(id) ON DELETE SET NULL;

-- RLS admin-only, même gabarit que document_templates (2026-07-09).
ALTER TABLE agencies             ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_rate_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_billing_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all" ON agencies;
CREATE POLICY "admin_all" ON agencies FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin_all" ON agency_rate_items;
CREATE POLICY "admin_all" ON agency_rate_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin_all" ON agency_billing_lines;
CREATE POLICY "admin_all" ON agency_billing_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Ceinture et bretelles : sans policy anon de toute façon, mais le GRANT par
-- défaut de Supabase sur tout le schéma public laisserait sinon un curl anon
-- recevoir un `[]` silencieux plutôt qu'un vrai refus.
REVOKE ALL ON agencies             FROM anon;
REVOKE ALL ON agency_rate_items    FROM anon;
REVOKE ALL ON agency_billing_lines FROM anon;

-- ════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION
--
-- 1) Les 3 tables existent et sont bien fermées à anon :
--    curl "$SUPABASE_URL/rest/v1/agencies?select=id" -H "apikey: $ANON_KEY"
--    curl "$SUPABASE_URL/rest/v1/agency_rate_items?select=id" -H "apikey: $ANON_KEY"
--    curl "$SUPABASE_URL/rest/v1/agency_billing_lines?select=id" -H "apikey: $ANON_KEY"
--    → doivent répondre 42501 (refusé), jamais [] ni 200.
--
-- 2) Contrôle négatif — une colonne bidon doit donner une erreur différente
--    (42703), pour prouver que le 42501 ci-dessus vient bien de la table et
--    pas d'une faute de frappe dans son nom :
--    curl "$SUPABASE_URL/rest/v1/agencies?select=colonne_bidon" -H "apikey: $ANON_KEY"
--    → 42703.
--
-- 3) Les colonnes agency_billing_line_id existent sur les 4 tables et
--    n'ouvrent rien de nouveau à anon (elles héritent du GRANT déjà en place
--    sur ces tables — pas de régression à vérifier ici, juste leur présence) :
--    SELECT column_name FROM information_schema.columns
--     WHERE table_name IN ('lessons','equipment_rentals','taxi_trips','booking_room_prices')
--       AND column_name = 'agency_billing_line_id';
--    → 4 lignes.
-- ════════════════════════════════════════════════════════════════════════════
