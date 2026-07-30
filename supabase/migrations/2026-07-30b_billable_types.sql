-- ═══════════════════════════════════════════════════════════════════════════════
-- 2026-07-30 — UN SEUL LIEN POUR TOUT CE QUE L'APP FACTURE
--
-- Constat de l'audit du 2026-07-30 : sur 11 sources de montants, 4 n'avaient aucun
-- écran de réglage (activités, repas, accès centre, full house non configuré) et
-- deux catégories de `price_items` n'étaient lues par PERSONNE (activity, taxi) —
-- de la donnée morte que l'utilisateur croit modifier.
--
-- Plutôt qu'une colonne de lien par famille (`lesson_type`, `rental_type`, puis
-- `meal_type`…), une seule colonne `billable_type` : une règle de verrouillage, un
-- seul contrôle « tarif manquant », et brancher un nouveau poste demain = ajouter
-- une valeur d'enum. `lesson_type` (appliqué le 2026-07-29) est repris puis supprimé.
--
-- Contenu (fichier 2/2 — voir le prérequis juste en dessous) :
--   1. enum `billable_type` + colonne unique sur price_items
--   2. reprise de lesson_type, rattachement des locations, semis des manquants
--   3. accès centre et repas deviennent réglables (ils vivaient dans le code)
--   4. suppression des lignes fantômes de catégorie 'taxi'
--   5. snapshot de la PAIE moniteur sur la leçon (`lessons.instructor_rate`)
--   6. C3 : room_rates lisible par un lien client, limité à SES chambres
--
-- ⚠️ Fenêtre : la PROD ne contient aucune donnée réelle avant l'ouverture, mi-
-- septembre 2026 — c'est ce qui rend acceptable de supprimer une colonne déjà
-- déployée. Ne pas prendre cette liberté après l'ouverture.
--
-- ROLLBACK : voir en bas du fichier.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ⚠️ PRÉREQUIS : passer d'abord `2026-07-30a_price_category_values.sql` et attendre
-- son « Success ». Il ajoute les catégories 'meal' et 'center_access', que ce
-- fichier-ci utilise. PostgreSQL refuse d'utiliser une valeur d'enum ajoutée dans la
-- même transaction, et l'éditeur SQL du dashboard exécute tout un script dans UNE
-- transaction — d'où deux fichiers. Erreur si on l'oublie :
--   55P04 unsafe use of new value "center_access" of enum type price_category

BEGIN;

-- ── 1. Le lien unique ─────────────────────────────────────────────────────────
-- Préfixé par famille : 'full' ou 'group' tout court seraient ambigus le jour où
-- une autre famille arrive. 'free'/« Other » n'y est pas : 0 par définition.
DO $$ BEGIN
  CREATE TYPE billable_type AS ENUM (
    'lesson_private', 'lesson_group', 'lesson_supervision',
    'rental_kite', 'rental_board', 'rental_full', 'rental_surfboard', 'rental_foilboard',
    'center_access', 'meal'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE price_items ADD COLUMN IF NOT EXISTS billable_type billable_type;

COMMENT ON COLUMN price_items.billable_type IS
  'Ce que cette ligne facture. Le nom est décoratif : ne JAMAIS rapprocher un tarif par son nom.';

-- ── 2. Reprise de l''existant ─────────────────────────────────────────────────

-- 2a. lesson_type → billable_type (colonne posée le 2026-07-29, présente sur les 2 bases)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'price_items' AND column_name = 'lesson_type') THEN
    EXECUTE $sql$
      UPDATE price_items
         SET billable_type = ('lesson_' || lesson_type::text)::billable_type
       WHERE lesson_type IS NOT NULL AND billable_type IS NULL
    $sql$;
  END IF;
END $$;

-- 2b. Locations : rattachement par nom, UNE FOIS et une seule ligne par type.
-- Le row_number() protège des doublons de nom : les suivantes restent NULL et
-- sortent dans la vérification 2 ci-dessous. Sans lui, l'index unique plus bas
-- ferait échouer toute la migration.
WITH ranked AS (
  SELECT id,
         ('rental_' || lower(trim(name)))::billable_type AS bt,
         row_number() OVER (PARTITION BY lower(trim(name)) ORDER BY created_at, id) AS rn
    FROM price_items
   WHERE category = 'rental'
     AND billable_type IS NULL
     AND lower(trim(name)) IN ('kite', 'board', 'full', 'surfboard', 'foilboard')
)
UPDATE price_items p
   SET billable_type = r.bt
  FROM ranked r
 WHERE p.id = r.id AND r.rn = 1;

-- 2c. Semis de tout ce qui n'a pas de ligne, AUX MONTANTS QUI ÉTAIENT CODÉS EN DUR :
--     locations   → LessonWeekView.FALLBACK_RENTAL_PRICES (40/20/55/25/35)
--     accès centre → BookingsPage, défaut 5 €/jour/personne
--     repas        → NowView créait ses événements à 0 €/personne
-- Rien ne change donc dans ce qui est facturé : ces montants deviennent visibles.
INSERT INTO price_items (category, name, description, price, unit, billable_type)
SELECT v.cat::price_category, v.label, v.descr, v.price, v.unit, v.bt
  FROM (VALUES
    ('rental',        'Kite',          'Kite rental',                     40, '/ session',        'rental_kite'::billable_type),
    ('rental',        'Board',         'Board rental',                    20, '/ session',        'rental_board'),
    ('rental',        'Full',          'Kite + board',                    55, '/ session',        'rental_full'),
    ('rental',        'Surfboard',     'Surfboard rental',                25, '/ session',        'rental_surfboard'),
    ('rental',        'Foilboard',     'Foilboard rental',                35, '/ session',        'rental_foilboard'),
    ('center_access', 'Center access', 'Own-gear guest, per day',          5, '€/day per person', 'center_access'),
    ('meal',          'Meal',          'Default price for a new dinner',   0, '€/person',         'meal')
  ) AS v(cat, label, descr, price, unit, bt)
 WHERE NOT EXISTS (SELECT 1 FROM price_items p WHERE p.billable_type = v.bt);

-- ── 3. Garde-fous ─────────────────────────────────────────────────────────────

-- Un seul tarif par poste facturable, sinon la facturation serait ambiguë
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_items_billable_type
  ON price_items(billable_type) WHERE billable_type IS NOT NULL;

-- La catégorie doit correspondre au poste : une ligne 'meal' ne peut pas se ranger
-- dans les leçons. Explicite plutôt que par préfixe, pour que ça se lise.
ALTER TABLE price_items DROP CONSTRAINT IF EXISTS price_items_billable_category_chk;
ALTER TABLE price_items ADD  CONSTRAINT price_items_billable_category_chk CHECK (
  billable_type IS NULL OR category = (CASE
    WHEN billable_type IN ('lesson_private', 'lesson_group', 'lesson_supervision') THEN 'lesson'
    WHEN billable_type IN ('rental_kite', 'rental_board', 'rental_full',
                           'rental_surfboard', 'rental_foilboard')                 THEN 'rental'
    WHEN billable_type = 'center_access'                                           THEN 'center_access'
    WHEN billable_type = 'meal'                                                    THEN 'meal'
  END)::price_category
);

-- ── 4. Lignes fantômes ────────────────────────────────────────────────────────
-- Les lignes category='taxi' ne sont lues par AUCUN calcul et ne s'affichent même
-- pas (l'écran ne rend que lesson/activity/rental) : le vrai réglage taxi vit dans
-- taxi_pricing_defaults et sur chaque chauffeur. On les supprime plutôt que de
-- laisser croire qu'elles servent.
DELETE FROM price_items WHERE category = 'taxi';

-- ── 5. L''ancien lien disparaît ───────────────────────────────────────────────
DROP INDEX IF EXISTS idx_price_items_lesson_type;
ALTER TABLE price_items DROP CONSTRAINT IF EXISTS price_items_lesson_type_category_chk;
ALTER TABLE price_items DROP COLUMN IF EXISTS lesson_type;
-- (rental_type n'a jamais été appliqué nulle part ; au cas où, on nettoie aussi)
DROP INDEX IF EXISTS idx_price_items_rental_type;
ALTER TABLE price_items DROP CONSTRAINT IF EXISTS price_items_rental_type_category_chk;
ALTER TABLE price_items DROP COLUMN IF EXISTS rental_type;

-- ── 6. Snapshot de la PAIE moniteur ───────────────────────────────────────────
-- Jusqu'ici la paie était lue au tarif COURANT : monter le tarif d'un moniteur en
-- octobre augmentait rétroactivement ce qu'on lui devait pour juillet. Même
-- principe que lessons.price_per_hour côté client, mais sur l'autre barème.
-- NULL = leçons d'avant cette migration → repli sur le tarif courant (comportement
-- inchangé pour elles). L'override par leçon reste prioritaire : c'est une décision
-- explicite prise sur CETTE leçon.
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS instructor_rate NUMERIC(8,2);

COMMENT ON COLUMN lessons.instructor_rate IS
  'Paie moniteur €/h figée à la création (source: instructors.rate_*). NULL → repli sur le tarif courant. Un lesson_rate_overrides sur cette leçon reste prioritaire.';

-- ── 7. Tarif de base lisible depuis un lien client (C3) ───────────────────────

-- Garde-fou : sans RLS active, le GRANT ci-dessous exposerait TOUTE la grille.
ALTER TABLE room_rates ENABLE ROW LEVEL SECURITY;

-- Les clés room_rates auxquelles le token client courant a droit : les chambres de
-- SA réservation + la clé maison entière ('full_{accommodation_id}') de leurs
-- hébergements. SECURITY DEFINER comme les helpers de la Phase 2 : les sous-requêtes
-- ne doivent pas repasser par les policies de booking_rooms/rooms (poule et œuf).
CREATE OR REPLACE FUNCTION share_room_keys() RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT br.room_id::text
    FROM booking_rooms br
   WHERE br.booking_id = share_booking_id()
  UNION
  SELECT 'full_' || r.accommodation_id::text
    FROM booking_rooms br
    JOIN rooms r ON r.id = br.room_id
   WHERE br.booking_id = share_booking_id();
$$;

REVOKE EXECUTE ON FUNCTION share_room_keys() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION share_room_keys() TO anon, authenticated;

-- Colonnes narrowées comme au Lot C : surtout PAS `notes` (commentaires internes).
-- ⚠️ Le REVOKE est INDISPENSABLE : Supabase pose un GRANT SELECT de table à anon sur
-- tout le schéma public. Sans le retirer, ajouter des privilèges de colonne ne
-- restreint RIEN — `notes` resterait lisible dès qu'une ligne passe la policy.
-- Vérifié le 2026-07-30 sur TEST : `select=notes` répondait `[]` au lieu de 42501.
REVOKE SELECT ON room_rates FROM anon;
GRANT  SELECT (room_id, price_per_night) ON room_rates TO anon;

DROP POLICY IF EXISTS "anon_read_room_rates" ON room_rates;
CREATE POLICY "anon_read_room_rates" ON room_rates FOR SELECT TO anon USING (
  share_type() = 'client'
  AND room_id IN (SELECT share_room_keys())
);

COMMIT;

-- ── Vérifications (à passer après, sur CHAQUE base) ──────────────────────────
--
-- 1) Les 10 postes facturables ont un tarif, et un seul :
--    SELECT billable_type, category, name, price FROM price_items
--     WHERE billable_type IS NOT NULL ORDER BY billable_type;
--    → attendu : les 3 lesson_*, les 5 rental_*, center_access (5), meal (0).
--      Les 3 lesson_* gardent LEURS prix (60/36/40 en PROD), pas des défauts.
--
-- 2) Lignes non rattachées (doublons de nom, libellés maison…) :
--    SELECT category, name, price FROM price_items WHERE billable_type IS NULL;
--    → les 'activity' sont NORMALES (catalogue libre, aucun calcul ne les lit).
--      Une 'rental' ou 'lesson' ici ne facture RIEN : la rattacher ou la supprimer.
--
-- 3) L''ancienne colonne a bien disparu, et les lignes fantômes aussi :
--    SELECT count(*) FROM information_schema.columns
--     WHERE table_name='price_items' AND column_name IN ('lesson_type','rental_type');  → 0
--    SELECT count(*) FROM price_items WHERE category='taxi';                            → 0
--
-- 4) Le snapshot de paie existe :
--    SELECT column_name FROM information_schema.columns
--     WHERE table_name='lessons' AND column_name='instructor_rate';                     → 1 ligne
--
-- 5) room_rates fermé sans token — curl avec la clé anon :
--    curl "$URL/rest/v1/room_rates?select=room_id,price_per_night" -H "apikey: $ANON"
--    → attendu : []
--
-- 6) …et ouvert AVEC un token client, sur ses chambres seulement :
--    curl "$URL/rest/v1/room_rates?select=room_id,price_per_night" \
--         -H "apikey: $ANON" -H "x-share-token: <token client>"
--    → attendu : 1 à 3 lignes (ses chambres + la clé full_ de sa maison), pas la grille.
--
-- 7) La colonne interne reste interdite, et les autres liens n''ont rien :
--    curl "$URL/rest/v1/room_rates?select=notes"   -H "apikey: $ANON" -H "x-share-token: <client>" → 42501
--    curl "$URL/rest/v1/room_rates?select=room_id" -H "apikey: $ANON" -H "x-share-token: <taxi>"   → []
--
-- ── ROLLBACK ────────────────────────────────────────────────────────────────
--   ALTER TABLE price_items DROP COLUMN billable_type;      -- les prix semés restent
--   ALTER TABLE lessons     DROP COLUMN instructor_rate;
--   DROP POLICY "anon_read_room_rates" ON room_rates;
--   REVOKE SELECT ON room_rates FROM anon;
--   DROP FUNCTION share_room_keys();
--   (les lignes category='taxi' supprimées ne reviennent pas — elles ne servaient à rien,
--    et le réglage taxi n''a jamais cessé de vivre dans taxi_pricing_defaults)
