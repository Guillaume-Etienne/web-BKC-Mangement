-- ═══════════════════════════════════════════════════════════════════════════════
-- Tarification des leçons — séparer le PRIX CLIENT de la PAIE MONITEUR
-- (2026-07-29, décisions gui)
--
-- Avant : instructors.rate_private/group/supervision servait aux DEUX côtés —
-- le client était facturé au tarif du moniteur, et le moniteur crédité du prix
-- client. Impossible d'avoir une marge, et les tarifs saisis dans
-- Options → Pricing (category='lesson') n'étaient lus par AUCUN calcul.
--
-- Après :
--   • prix client  = price_items (category='lesson'), figé sur la leçon à sa création
--   • paie moniteur = instructors.rate_* × durée, à plat (jamais × nb élèves)
--
-- ⚠️ SÉCURITÉ : instructors.rate_* devient de la donnée de PAIE. Ces colonnes
-- étaient lisibles par anon (Lot C, 2026-07-06) parce que ClientSharePage s'en
-- servait pour afficher le prix des leçons. Elles sont révoquées ici — sinon un
-- client muni d'un lien de partage lirait les salaires. La page client lit
-- désormais lessons.price_per_hour.
--
-- Sans risque sur l'historique : 0 leçon et 0 override en base au moment du
-- passage (vérifié sur PROD le 2026-07-29).
--
-- ROLLBACK :
--   DROP INDEX idx_price_items_lesson_type;
--   ALTER TABLE price_items DROP COLUMN lesson_type;
--   ALTER TABLE lessons     DROP COLUMN price_per_hour;
--   REVOKE SELECT ON instructors FROM anon;
--   GRANT  SELECT (id, first_name, last_name, rate_private, rate_group, rate_supervision)
--     ON instructors TO anon;
--   GRANT  SELECT ON lesson_rate_overrides TO anon;  -- + recréer la policy Phase 2
--     (voir 2026-07-06_phase2_token_rls.sql, "anon_read_lesson_rate_overrides")
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Lien explicite price_items → type de leçon ────────────────────────────
-- Volontairement PAS un rapprochement par nom : renommer « Private » ferait
-- basculer la facturation sur un prix par défaut, sans le dire.
ALTER TABLE price_items ADD COLUMN IF NOT EXISTS lesson_type lesson_type;

-- Un lesson_type n'a de sens que sur une ligne de la catégorie 'lesson'
ALTER TABLE price_items DROP CONSTRAINT IF EXISTS price_items_lesson_type_category_chk;
ALTER TABLE price_items ADD  CONSTRAINT price_items_lesson_type_category_chk
  CHECK (lesson_type IS NULL OR category = 'lesson');

-- Rattache les lignes existantes (PROD : Private 60 / Group 36 / Supervision 40)
UPDATE price_items
   SET lesson_type = lower(trim(name))::lesson_type
 WHERE category = 'lesson'
   AND lesson_type IS NULL
   AND lower(trim(name)) IN ('private', 'group', 'supervision');

-- Un seul tarif par type — sinon la facturation serait ambiguë
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_items_lesson_type
  ON price_items(lesson_type) WHERE lesson_type IS NOT NULL;

-- ── 2. Snapshot du prix client sur la leçon ─────────────────────────────────
-- Même principe que booking_room_prices : changer un tarif ne doit pas
-- refacturer le passé. NULL = repli sur price_items (leçons d'avant la migration).
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS price_per_hour NUMERIC(8,2);

COMMENT ON COLUMN lessons.price_per_hour IS
  'Prix client €/h figé à la création (source: price_items.lesson_type). Éditable par leçon. NULL → repli sur price_items.';

-- ── 3. Les tarifs moniteur ne sont plus lisibles par les clients ────────────
-- Lot C exposait rate_* à anon parce que ClientSharePage s'en servait pour le
-- prix des leçons. Ces colonnes sont désormais de la PAIE → identité seule.
REVOKE SELECT ON instructors FROM anon;
GRANT  SELECT (id, first_name, last_name) ON instructors TO anon;

-- Même raison : un override est une exception sur la paie d'un moniteur.
-- La page client lit lessons.price_per_hour et n'en a plus besoin.
DROP POLICY IF EXISTS "anon_read_lesson_rate_overrides" ON lesson_rate_overrides;
REVOKE SELECT ON lesson_rate_overrides FROM anon;

COMMIT;

-- ── Vérifications (à passer après, sur CHAQUE base) ─────────────────────────
-- 1) Les 3 tarifs sont rattachés :
--    SELECT name, price, lesson_type FROM price_items WHERE category='lesson';
--    → PROD attendu : Private/60/private, Group/36/group, Supervision/40/supervision
--
--    ⚠️ Le rattachement automatique ne marche que si le nom vaut exactement
--    'private'/'group'/'supervision' (insensible à la casse). Sur une base dont
--    les libellés diffèrent (TEST, seed en français…), la colonne restera NULL
--    et CES LEÇONS SERONT FACTURÉES 0. Repérer les orphelines :
--      SELECT name, price FROM price_items WHERE category='lesson' AND lesson_type IS NULL;
--    puis rattacher à la main, p. ex. :
--      UPDATE price_items SET lesson_type='private' WHERE name='Cours privé 1h';
--    (l'index unique n'autorise qu'UNE ligne par type — supprimer ou laisser à
--     NULL les tarifs forfaitaires en double type « Cours privé 2h »)
--
-- 2) La colonne snapshot existe :
--    SELECT column_name FROM information_schema.columns
--     WHERE table_name='lessons' AND column_name='price_per_hour';
--
-- 3) anon ne lit plus les tarifs moniteur — curl avec la clé anon :
--    curl "$URL/rest/v1/instructors?select=rate_private" -H "apikey: $ANON"
--    → attendu : 42501 (permission denied), PAS une liste de nombres
--    curl "$URL/rest/v1/instructors?select=id,first_name" -H "apikey: $ANON"
--    → attendu : [] (RLS Phase 2 : rien sans x-share-token valide), PAS 42501
