/* ============================================================================
   Migration : expense_categories -- sous-catégories de dépenses (2 niveaux)
   Date : 2026-09-19

   Demande de gui : pouvoir ranger les dépenses en sous-catégories
   (« Energy » → « Petrol » / « Electricity » / « Gas »).

   Pourquoi une table et pas une convention dans la chaîne : aujourd'hui
   `expenses.category` est un TEXT libre, et le « gestionnaire de catégories »
   de l'onglet Expenses est une ILLUSION DE SESSION (ExpensesTab.tsx, state
   `extraCats`) -- une catégorie ajoutée disparaît au rechargement si aucune
   dépense ne l'utilise. La liste affichée est en réalité DÉDUITE des dépenses
   existantes. La dérive se voit déjà en PROD au 19/09 : « Groseries » (typo),
   « CAR » (casse), « Pièces détachées » (FR alors que l'UI est en EN). Une
   table règle les trois d'un coup : on renomme à UN endroit, sans toucher aux
   lignes de dépense.

   Au passage, elle règle aussi la couleur : `colorOf()` attribue aujourd'hui
   les couleurs par INDEX dans un tableau -- ajouter une catégorie décale la
   couleur de toutes les autres. Ici la couleur est stockée.

   ── GARANTIE « ZÉRO PERTE » ────────────────────────────────────────────────
   Cette migration est STRICTEMENT ADDITIVE. Elle ne contient aucun DROP,
   aucun DELETE, aucun ALTER de colonne existante, aucun NOT NULL ajouté.
   `expenses.category` n'est NI supprimée, NI renommée, NI modifiée : elle
   reste la source de vérité tant que le code ne l'a pas remplacée. La seule
   écriture sur `expenses` remplit `category_id`, une colonne NEUVE et NULLE
   partout -- une valeur ne peut donc écraser aucune donnée existante.
   Le retour arrière tient en deux lignes (bloc ROLLBACK en bas de fichier)
   et rend la base à l'octet près telle qu'elle était.

   Profondeur : 2 niveaux (un parent, ses enfants). Volontairement NON imposé
   par un trigger -- un trigger de validation sur cette table bloquerait des
   INSERT, et la règle du projet est qu'un trigger ne doit jamais bloquer un
   INSERT. C'est l'UI qui n'offre pas de 3e niveau.

   Sécurité : `expenses` est une table PRIVÉE (aucun accès anon, cf.
   security-rls.md § tables non exposées). `expense_categories` hérite du même
   régime : policy admin_all pour `authenticated`, REVOKE explicite pour anon.

   Idempotente : peut être repassée sans dommage (seed en ON CONFLICT, backfill
   qui ne touche QUE les lignes encore NULL). À exécuter en TEST **puis en
   PROD** dans la foulée (Supabase SQL editor).
   ============================================================================ */

BEGIN;

-- ── 1. La table des catégories ──────────────────────────────────────────────
-- `slug` est la clé stable citée par le code (EquipmentPage résout 'equipment'
-- par slug, jamais par un UUID en dur ni par le libellé, qui lui est renommable).
CREATE TABLE IF NOT EXISTS expense_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id  UUID REFERENCES expense_categories(id) ON DELETE RESTRICT,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  color      TEXT,
  sort_order INT     NOT NULL DEFAULT 0,
  archived   BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT expense_categories_no_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE INDEX IF NOT EXISTS idx_expense_categories_parent
  ON expense_categories(parent_id) WHERE parent_id IS NOT NULL;

-- ── 2. Le lien sur expenses ─────────────────────────────────────────────────
-- NULLABLE exprès : le code actuel, qui ignore cette colonne, continue
-- d'insérer sans être rejeté. Le NOT NULL viendra en phase 3, après vérif.
-- ON DELETE RESTRICT : on ne peut pas supprimer une catégorie utilisée
-- (c'est `archived` qui sert à la retirer de la saisie sans perdre l'histoire).
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES expense_categories(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_expenses_category_id
  ON expenses(category_id) WHERE category_id IS NOT NULL;

-- ── 3. Les catégories par défaut ────────────────────────────────────────────
-- Ce sont exactement les 6 valeurs de DEFAULT_CATEGORIES dans ExpensesTab.tsx :
-- la liste proposée à l'écran reste identique à aujourd'hui.
-- ⚠️ 'equipment' DOIT exister : EquipmentPage l'utilise pour la dépense d'achat
-- et la dépense de revente d'un matériel.
-- Couleurs = les 6 premières de PALETTE, désormais figées.
INSERT INTO expense_categories (slug, name, color, sort_order) VALUES
  ('equipment',   'Equipment',   '#60a5fa', 10),
  ('maintenance', 'Maintenance', '#34d399', 20),
  ('transport',   'Transport',   '#f97316', 30),
  ('staff',       'Staff',       '#a78bfa', 40),
  ('admin',       'Admin',       '#facc15', 50),
  ('other',       'Other',       '#f472b6', 60)
ON CONFLICT (slug) DO NOTHING;

-- ── 4. Backfill : une catégorie par valeur distincte DÉJÀ en base ───────────
-- Le libellé d'origine est repris TEL QUEL dans `name` : la migration ne
-- renomme rien et ne devine rien. « Groseries » reste « Groseries », « CAR »
-- reste « CAR » -- gui les corrige ensuite depuis l'écran, en un clic, sans
-- que les lignes de dépense bougent.
-- Aucune hiérarchie n'est inventée ici : tout arrive à plat, au niveau 1.
-- C'est gui qui décidera que « CAR » et « Pièces détachées » vivent sous un
-- parent « Vehicle » -- pas cette migration.
INSERT INTO expense_categories (slug, name, sort_order)
SELECT DISTINCT
  btrim(regexp_replace(
    lower(translate(e.category,
      'àâäãéèêëíìîïóòôöõúùûüçñÀÂÄÃÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÇÑ',
      'aaaaeeeeiiiiooooouuuucnAAAAEEEEIIIIOOOOOUUUUCN')),
    '[^a-z0-9]+', '-', 'g'), '-') AS slug,
  e.category,
  100
FROM expenses e
WHERE e.category IS NOT NULL
  AND btrim(e.category) <> ''
  AND btrim(regexp_replace(
        lower(translate(e.category,
          'àâäãéèêëíìîïóòôöõúùûüçñÀÂÄÃÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÇÑ',
          'aaaaeeeeiiiiooooouuuucnAAAAEEEEIIIIOOOOOUUUUCN')),
        '[^a-z0-9]+', '-', 'g'), '-') <> ''
ON CONFLICT (slug) DO NOTHING;

-- ── 5. Rattachement des dépenses existantes ────────────────────────────────
-- Ne touche QUE les lignes encore NULL : repasser la migration ne défait
-- jamais un rangement fait à la main entre-temps.
UPDATE expenses e
SET category_id = c.id
FROM expense_categories c
WHERE e.category_id IS NULL
  AND c.slug = btrim(regexp_replace(
        lower(translate(e.category,
          'àâäãéèêëíìîïóòôöõúùûüçñÀÂÄÃÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÇÑ',
          'aaaaeeeeiiiiooooouuuucnAAAAEEEEIIIIOOOOOUUUUCN')),
        '[^a-z0-9]+', '-', 'g'), '-');

-- ── 6. RLS : même régime que `expenses` (privée, admin uniquement) ─────────
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'expense_categories'
      AND policyname = 'admin_all'
  ) THEN
    CREATE POLICY "admin_all" ON expense_categories
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Ceinture ET bretelles : la RLS suffirait (aucune policy anon = aucune ligne),
-- mais un REVOKE explicite ferme aussi la lecture du SCHÉMA de la table.
REVOKE ALL ON expense_categories FROM anon;

COMMIT;


/* ============================================================================
   VÉRIFICATION -- à passer après, SUR CHAQUE BASE.
   Les 4 premières sont les preuves de non-perte. Attendu en PROD : 12 lignes.

   1. AUCUNE dépense n'est restée orpheline :
      SELECT count(*) AS orphelines FROM expenses WHERE category_id IS NULL;
      -- attendu : 0

   2. Rien n'a bougé sur les données d'origine (à comparer au relevé d'avant) :
      SELECT count(*) AS lignes, sum(amount) AS total, count(DISTINCT category) AS cats
      FROM expenses;
      -- attendu PROD : 12 lignes | 3844.35 | 6 cats
      -- attendu TEST :  2 lignes |            2 cats

   3. AUCUNE fusion silencieuse -- deux libellés différents qui tomberaient
      sur le même slug et seraient rangés dans la même catégorie :
      SELECT c.slug, count(DISTINCT e.category) AS libelles
      FROM expenses e JOIN expense_categories c ON c.id = e.category_id
      GROUP BY c.slug HAVING count(DISTINCT e.category) > 1;
      -- attendu : 0 ligne

   4. Chaque dépense pointe vers une catégorie qui porte bien SON libellé :
      SELECT e.category, c.name, count(*)
      FROM expenses e JOIN expense_categories c ON c.id = e.category_id
      GROUP BY 1, 2 ORDER BY 1;
      -- attendu : e.category = c.name sur chaque ligne

   5. La catégorie dont le code a besoin existe :
      SELECT id, name FROM expense_categories WHERE slug = 'equipment';
      -- attendu : 1 ligne

   6. Une catégorie utilisée ne peut pas être supprimée :
      DELETE FROM expense_categories WHERE slug = 'transport';
      -- attendu : ERROR violation de contrainte de clé étrangère

   7. anon ne voit rien (curl nu, sans jeton -- cette table n'en a aucun) :
      curl "$SUPABASE_URL/rest/v1/expense_categories?select=id" -H "apikey: $ANON_KEY"
      -- attendu : erreur de permission. ⚠️ un `[]` serait ANORMAL ici
      --           (contrairement aux tables à jeton de partage).
   ============================================================================ */

/* ============================================================================
   ROLLBACK -- rend la base exactement à son état d'avant.
   `expenses.category` n'ayant jamais été touchée, il n'y a RIEN à restaurer.

      BEGIN;
      ALTER TABLE expenses DROP COLUMN IF EXISTS category_id;
      DROP TABLE IF EXISTS expense_categories;
      COMMIT;
   ============================================================================ */

/* ============================================================================
   SUITE -- ne PAS passer maintenant, et pas avant plusieurs semaines de
   fonctionnement vérifié. Une fois le code en service, `category` devient une
   redondance qu'il faudra supprimer pour qu'elle ne dérive pas en silence :

      ALTER TABLE expenses ALTER COLUMN category_id SET NOT NULL;
      ALTER TABLE expenses DROP COLUMN category;   -- destructif, sauvegarde d'abord

   Celle-là, elle, supprime des données. Migration séparée, décision séparée.
   ============================================================================ */
