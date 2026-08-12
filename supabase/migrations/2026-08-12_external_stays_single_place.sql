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
-- simultané) sont ce qui lui permet d'accueillir 3-4 réservations à la fois sans
-- toucher au drag & drop. Garder les deux tables imposait deux fiches pour un seul
-- hôtel, à synchroniser à la main — la double source de vérité qui a déjà coûté
-- cher ici (trois définitions de saison, tarifs rapprochés par nom).
--
-- ⚠️ RÉÉCRITE APRÈS UN ÉCHEC — et c'est la partie intéressante.
-- La première version supprimait `external_accommodation_id` sans back-fill, en
-- s'appuyant sur « les deux tables sont vides » (affirmation héritée du 2026-08-11).
-- Son garde-fou a refusé de tourner sur TEST le 2026-08-12 : la table contenait une
-- ligne. **La croyance venait d'un curl anon qui renvoyait `[]`** — or depuis la
-- Phase 2, RLS masque les lignes en anon : `[]` prouve « rien de lisible sans
-- token », JAMAIS « table vide ». Le comptage réel se fait connecté.
-- Conséquence directe, visible sur TEST : la migration du 11 a remplacé les
-- colonnes par-nuit par les colonnes de forfait `DEFAULT 0`, donc **les montants de
-- la ligne existante ont été mis à zéro**. Sur TEST c'était du seed (0 € perdu) ;
-- avec de vraies données ç'aurait été un prix client effacé en silence.
-- Cette version-ci **rattache** au lieu de refuser, et ne détruit rien.
--
-- SANS PERTE : chaque lieu externe encore porteur d'un séjour est recréé dans
-- `accommodations` (external_billing = true) avec autant d'emplacements que de
-- séjours simultanés, les séjours sont re-pointés dessus, et le `NOT NULL` n'est
-- posé qu'APRÈS le back-fill — si une ligne échappait au rattachement, la
-- migration échouerait au lieu de la perdre.
--
-- ⚠️ Le code qui accompagne cette migration lit `accommodation_id`. Sans elle,
-- `ClientSharePage` demande une colonne inexistante → 42703 et la page client
-- n'affiche plus rien. **Appliquer AVANT ou EN MÊME TEMPS que le déploiement.**

BEGIN;

-- ── 1. La colonne cible, d'abord nullable (le temps du back-fill) ───────────
ALTER TABLE external_accommodation_bookings
  ADD COLUMN IF NOT EXISTS accommodation_id UUID REFERENCES accommodations(id) ON DELETE CASCADE;

-- ── 2. Back-fill : un lieu externe porteur de séjours devient un hébergement ─
DO $$
DECLARE
  r        RECORD;
  new_acc  UUID;
  spots    INT;
  i        INT;
BEGIN
  FOR r IN
    SELECT ea.* FROM external_accommodations ea
    WHERE EXISTS (SELECT 1 FROM external_accommodation_bookings e
                   WHERE e.external_accommodation_id = ea.id)
  LOOP
    -- Combien d'emplacements ? Le plus grand nombre de séjours qui se chevauchent
    -- sur ce lieu. Majorant volontaire : un emplacement en trop ne coûte rien,
    -- un emplacement manquant rendrait deux séjours impossibles à poser au planning.
    -- ⚠️ Ne PAS nommer cette colonne `overlaps` : c'est un mot réservé
    -- (l'opérateur standard `(a, b) OVERLAPS (c, d)`), et `MAX(overlaps)` casse
    -- le parseur — « syntax error at or near ")" », vécu le 2026-08-12.
    SELECT GREATEST(1, MAX(concurrent_stays)) INTO spots
    FROM (
      SELECT (SELECT COUNT(*) FROM external_accommodation_bookings o
               WHERE o.external_accommodation_id = r.id
                 AND o.check_in  < e.check_out
                 AND o.check_out > e.check_in) AS concurrent_stays
      FROM external_accommodation_bookings e
      WHERE e.external_accommodation_id = r.id
    ) AS counts;

    INSERT INTO accommodations (name, type, total_rooms, external_billing, is_active)
    VALUES (r.name, 'other', spots, true, r.is_active)
    RETURNING id INTO new_acc;

    FOR i IN 1..spots LOOP
      INSERT INTO rooms (accommodation_id, name, capacity)
      VALUES (new_acc, 'Spot ' || i, 2);
    END LOOP;

    UPDATE external_accommodation_bookings
       SET accommodation_id = new_acc
     WHERE external_accommodation_id = r.id;

    RAISE NOTICE 'Rattaché : % (% emplacement(s))', r.name, spots;
  END LOOP;
END $$;

-- ── 3. Garde-fou : rien ne doit rester orphelin ─────────────────────────────
DO $$
DECLARE orphans INT;
BEGIN
  SELECT COUNT(*) INTO orphans
  FROM external_accommodation_bookings WHERE accommodation_id IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION '% séjour(s) non rattaché(s) : la migration s''arrête plutôt '
      'que de les perdre. Vérifier external_accommodation_id.', orphans;
  END IF;
END $$;

ALTER TABLE external_accommodation_bookings
  ALTER COLUMN accommodation_id SET NOT NULL;

COMMENT ON COLUMN external_accommodation_bookings.accommodation_id IS
  'Hébergement (référentiel unique). Attendu external_billing = true : le montant '
  'du séjour vit ici, au cas par cas, et pas dans room_rates.';

-- ── 4. L'ancienne colonne et le référentiel parallèle disparaissent ─────────
-- Dans cet ordre : la colonne porte la FK, la table ne peut pas partir avant.
ALTER TABLE external_accommodation_bookings
  DROP COLUMN IF EXISTS external_accommodation_id;

DROP TABLE IF EXISTS external_accommodations;   -- emporte sa policy anon
DROP TYPE  IF EXISTS external_accommodation_provider;

-- ── 5. Privilèges de colonnes : la nouvelle colonne remplace l'ancienne ─────
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
--    select=check_in,total_sell_price        → 200 (les lignes restent masquées
--                                            sans x-share-token — c'est RLS, pas
--                                            une table vide : cf. l'erreur du jour)
--
-- 7) ⚠️ CONNECTÉ, pas en anon — le back-fill a bien eu lieu :
--    SELECT a.name, a.external_billing, COUNT(r.id) AS spots, COUNT(e.id) AS stays
--    FROM accommodations a
--    LEFT JOIN rooms r ON r.accommodation_id = a.id
--    LEFT JOIN external_accommodation_bookings e ON e.accommodation_id = a.id
--    WHERE a.external_billing GROUP BY a.id, a.name, a.external_billing;
--    → une ligne par lieu repris, avec ses emplacements et ses séjours.
-- ════════════════════════════════════════════════════════════════════════════
