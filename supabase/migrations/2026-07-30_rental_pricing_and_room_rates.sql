-- ═══════════════════════════════════════════════════════════════════════════════
-- 2026-07-30 — Deux sujets groupés (décision gui : pas de migration pour rien)
--
-- 1. price_items.rental_type — les locations étaient tarifées en cherchant la
--    ligne de prix PAR SON NOM (`p.name.toLowerCase() === 'kite'`), avec des prix
--    codés en dur en repli. Renommer « Kite » en « Kite rental » basculait donc la
--    facturation sur un prix qu'aucun écran ne montre. Même correctif que les
--    leçons le 2026-07-29 : un lien explicite, et plus aucun prix caché dans le code.
--
-- 2. room_rates lisible depuis un lien client (finding C3 de l'audit 2026-07-25) —
--    sans prix figé sur la réservation, la page client affiche 0 €/nuit. Le repli
--    sur le tarif de base existe déjà côté admin depuis le 2026-07-28, mais anon
--    ne peut pas lire room_rates. On ouvre le strict nécessaire.
--
-- ROLLBACK :
--   1. ALTER TABLE price_items DROP COLUMN rental_type;  (les prix semés restent,
--      la facturation retombe sur le rapprochement par nom si le code est revenu en
--      arrière aussi — sinon les locations se facturent 0)
--   2. DROP POLICY "anon_read_room_rates" ON room_rates;
--      REVOKE SELECT ON room_rates FROM anon;
--      DROP FUNCTION share_room_keys();
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Lien explicite price_items → type de location ─────────────────────────

-- 'free' (« Other » dans l'écran) n'est PAS dans l'enum : c'est 0 par définition,
-- pas un tarif à configurer. Le code le traite comme tel, sans aller en base.
DO $$ BEGIN
  CREATE TYPE rental_price_type AS ENUM ('kite', 'board', 'full', 'surfboard', 'foilboard');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE price_items ADD COLUMN IF NOT EXISTS rental_type rental_price_type;

-- Un rental_type n'a de sens que sur une ligne de la catégorie 'rental'
ALTER TABLE price_items DROP CONSTRAINT IF EXISTS price_items_rental_type_category_chk;
ALTER TABLE price_items ADD  CONSTRAINT price_items_rental_type_category_chk
  CHECK (rental_type IS NULL OR category = 'rental');

-- Rattache les lignes existantes dont le nom correspond exactement au type.
-- Le row_number() garantit UNE seule ligne par type même si la base contient des
-- doublons de nom : les suivantes restent NULL et sortent dans la vérification 2
-- ci-dessous, à rattacher (ou supprimer) à la main. Sans ça, l'index unique plus
-- bas ferait échouer toute la migration.
WITH ranked AS (
  SELECT id,
         lower(trim(name))::rental_price_type AS rt,
         row_number() OVER (PARTITION BY lower(trim(name)) ORDER BY created_at, id) AS rn
    FROM price_items
   WHERE category = 'rental'
     AND rental_type IS NULL
     AND lower(trim(name)) IN ('kite', 'board', 'full', 'surfboard', 'foilboard')
)
UPDATE price_items p
   SET rental_type = r.rt
  FROM ranked r
 WHERE p.id = r.id AND r.rn = 1;

-- Sème les types qui n'ont aucune ligne, AUX PRIX QUI ÉTAIENT CODÉS EN DUR dans
-- LessonWeekView.tsx (kite 40 / board 20 / full 55 / surfboard 25 / foilboard 35).
-- Rien ne change donc dans ce qui est facturé aujourd'hui ; la différence est que
-- ces prix deviennent visibles et modifiables dans Options → Pricing, et que le
-- code n'en connaît plus aucun.
INSERT INTO price_items (category, name, description, price, unit, rental_type)
SELECT 'rental', v.label, NULL, v.price, '/ session', v.rt
  FROM (VALUES
    ('kite'::rental_price_type,      'Kite',      40),
    ('board'::rental_price_type,     'Board',     20),
    ('full'::rental_price_type,      'Full',      55),
    ('surfboard'::rental_price_type, 'Surfboard', 25),
    ('foilboard'::rental_price_type, 'Foilboard', 35)
  ) AS v(rt, label, price)
 WHERE NOT EXISTS (SELECT 1 FROM price_items p WHERE p.rental_type = v.rt);

-- Un seul tarif par type — sinon la facturation serait ambiguë
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_items_rental_type
  ON price_items(rental_type) WHERE rental_type IS NOT NULL;

COMMENT ON COLUMN price_items.rental_type IS
  'Type de location facturé par cette ligne. Le nom est décoratif : ne JAMAIS rapprocher un tarif par son nom.';

-- ── 2. Tarif de base lisible depuis un lien client (C3) ──────────────────────

-- Garde-fou : sans RLS active, le GRANT ci-dessous exposerait TOUTE la grille.
-- La table est déjà dans la boucle de schema.sql ; on ne prend pas le risque.
ALTER TABLE room_rates ENABLE ROW LEVEL SECURITY;

-- Les clés room_rates auxquelles le token client courant a droit : les chambres de
-- SA réservation, plus la clé maison entière ('full_{accommodation_id}') des
-- hébergements concernés — ce que getBaseNightlyRate() a besoin de lire, rien de plus.
-- SECURITY DEFINER, comme les helpers de la Phase 2 : les sous-requêtes ne doivent
-- pas repasser par les policies de booking_rooms/rooms (poule et œuf).
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
GRANT SELECT (room_id, price_per_night) ON room_rates TO anon;

DROP POLICY IF EXISTS "anon_read_room_rates" ON room_rates;
CREATE POLICY "anon_read_room_rates" ON room_rates FOR SELECT TO anon USING (
  share_type() = 'client'
  AND room_id IN (SELECT share_room_keys())
);

COMMIT;

-- ── Vérifications (à passer après, sur CHAQUE base) ──────────────────────────
--
-- 1) Les 5 types ont un tarif, et un seul :
--    SELECT rental_type, name, price FROM price_items
--     WHERE category='rental' ORDER BY rental_type NULLS LAST;
--    → attendu : kite/board/full/surfboard/foilboard présents une fois chacun.
--
-- 2) Lignes de location non rattachées (doublons de nom, libellés maison…) :
--    SELECT name, price FROM price_items WHERE category='rental' AND rental_type IS NULL;
--    → ces lignes ne facturent RIEN : soit les rattacher, soit les supprimer.
--      UPDATE price_items SET rental_type='kite' WHERE name='Location aile';
--
-- 3) room_rates reste fermé sans token — curl avec la clé anon :
--    curl "$URL/rest/v1/room_rates?select=room_id,price_per_night" -H "apikey: $ANON"
--    → attendu : [] (aucun token présenté)
--
-- 4) …et ouvert AVEC un token client, sur ses chambres seulement :
--    curl "$URL/rest/v1/room_rates?select=room_id,price_per_night" \
--         -H "apikey: $ANON" -H "x-share-token: <token client>"
--    → attendu : 1 à 3 lignes (les chambres de CETTE résa + la clé full_ de sa maison),
--      surtout pas toute la grille.
--
-- 5) La colonne interne reste interdite :
--    curl "$URL/rest/v1/room_rates?select=notes" -H "apikey: $ANON" -H "x-share-token: <token client>"
--    → attendu : 42501 (permission denied for table room_rates)
--
-- 6) Un autre type de lien n'y a pas droit :
--    curl "$URL/rest/v1/room_rates?select=room_id" -H "apikey: $ANON" -H "x-share-token: <token taxi>"
--    → attendu : []
