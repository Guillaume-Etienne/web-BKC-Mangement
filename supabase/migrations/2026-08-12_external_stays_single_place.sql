-- 2026-08-12 — Séjours externes : un seul lieu, `accommodations`.
--
-- SUITE DE `2026-08-11_external_stays_flat_rate.sql`, qui est **déjà appliquée sur
-- TEST et PROD** (vérifié par curl anon le 2026-08-12 : `cost_per_night` → 42703,
-- `total_cost` → 42501, `accommodations.external_billing` → 200). On ne réécrit
-- donc pas ce fichier-là : ce qui suit est un second pas, à appliquer par-dessus.
--
-- POURQUOI
-- Le séjour pointait vers `external_accommodations`, un référentiel parallèle à
-- `accommodations`. Or San Martinho doit vivre dans `accommodations` : c'est de là
-- que le planning tire ses lignes, et ses emplacements (une « chambre » par séjour
-- simultané) sont ce qui lui permettra d'accueillir 3-4 réservations à la fois sans
-- toucher au drag & drop. Garder les deux tables imposait deux fiches pour un seul
-- hôtel, à synchroniser à la main — la double source de vérité qui a déjà coûté
-- cher ici (trois définitions de saison, tarifs rapprochés par nom).
--
-- `external_accommodations` est donc supprimée : vide, jamais écrite par le code
-- (aucun `insert` dans tout le repo), et son seul champ propre (`provider`)
-- n'était lu par personne — la compta Palmeiras passe par les bungalows et ses
-- propres tables.
--
-- SANS DANGER POUR LES DONNÉES : les deux tables sont vides sur les deux bases
-- (vérifié le 2026-08-11, et re-vérifié par le garde-fou ci-dessous qui fait
-- échouer la migration plutôt que de détruire une ligne saisie entre-temps).
--
-- ⚠️ Le code qui accompagne cette migration lit `accommodation_id`. Sans elle,
-- `ClientSharePage` demande une colonne inexistante → 42703 et la page client
-- n'affiche plus rien. **Appliquer AVANT ou EN MÊME TEMPS que le déploiement.**

BEGIN;

-- ── 0. Garde-fou : ne rien détruire si quelqu'un a saisi une ligne ──────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM external_accommodation_bookings) THEN
    RAISE EXCEPTION 'external_accommodation_bookings n''est plus vide : cette migration '
      'supprime external_accommodation_id sans back-fill. Rattacher les lignes à la main '
      'avant de rejouer.';
  END IF;
  IF EXISTS (SELECT 1 FROM external_accommodations) THEN
    RAISE EXCEPTION 'external_accommodations n''est plus vide : recréer ces lieux dans '
      '`accommodations` (external_billing = true) avant de rejouer.';
  END IF;
END $$;

-- ── 1. Le séjour se rattache à l'hébergement, plus au référentiel parallèle ──
ALTER TABLE external_accommodation_bookings
  DROP COLUMN IF EXISTS external_accommodation_id;

-- La table est vide (garde-fou ci-dessus) : NOT NULL posable sans back-fill.
ALTER TABLE external_accommodation_bookings
  ADD COLUMN IF NOT EXISTS accommodation_id UUID NOT NULL
    REFERENCES accommodations(id) ON DELETE CASCADE;

COMMENT ON COLUMN external_accommodation_bookings.accommodation_id IS
  'Hébergement (référentiel unique). Attendu external_billing = true : le montant '
  'du séjour vit ici, au cas par cas, et pas dans room_rates.';

-- ── 2. Le référentiel parallèle disparaît ──────────────────────────────────
-- La policy anon part avec la table ; le type d''enum n'a pas d'autre porteur.
DROP TABLE IF EXISTS external_accommodations;
DROP TYPE  IF EXISTS external_accommodation_provider;

-- ── 3. Privilèges de colonnes : la nouvelle colonne remplace l'ancienne ─────
-- Le GRANT de colonne meurt avec la colonne : il faut le reposer sur la nouvelle,
-- sinon la page client repart en 42501. Le REVOKE de table (posé le 2026-08-11)
-- est rejoué par sécurité — il est idempotent, et c'est lui qui rend les GRANT de
-- colonnes efficaces (piège vécu sur `room_rates`).
REVOKE SELECT ON external_accommodation_bookings FROM anon;
GRANT  SELECT (id, booking_id, accommodation_id, check_in, check_out, total_sell_price)
  ON external_accommodation_bookings TO anon;
-- `total_cost` exclu : c'est notre prix d'achat. `notes` exclu : notes internes.

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS — à faire sur TEST **et** PROD, par curl anon direct.
-- Un « j'ai passé la migration » ne prouve rien : le SQL editor peut être ouvert
-- sur le mauvais projet, et tout ici est idempotent (donc silencieux).
--
--   URL=https://<projet>.supabase.co ; ANON=<clé anon>   (client/.env.local)
--
-- 1) Le référentiel parallèle a bien disparu :
--    curl "$URL/rest/v1/external_accommodations?select=id" -H "apikey: $ANON"
--    → 404 « relation ... does not exist »   (c'était 200 [] avant)
--
-- 2) La nouvelle colonne existe et reste fermée aux liens non-client :
--    curl "$URL/rest/v1/external_accommodation_bookings?select=accommodation_id" \
--         -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
--    → 42501 « permission denied »           (c'était 42703 avant)
--
-- 3) L'ancienne colonne a disparu :
--    select=external_accommodation_id        → 42703 (c'était 200 [] avant)
--
-- 4) La marge reste fermée (acquis du 2026-08-11, à ne pas casser) :
--    select=total_cost                       → 42501
--
-- 5) Contrôle négatif — sans lui, un [] pourrait venir d'un champ ignoré :
--    select=colonne_bidon                    → 42703
--
-- 6) Ce que le client doit pouvoir lire passe toujours :
--    select=check_in,total_sell_price        → 200, [] tant qu'aucun séjour n'existe
-- ════════════════════════════════════════════════════════════════════════════
