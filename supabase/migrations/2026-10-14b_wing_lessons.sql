/* ============================================================================
   Migration : cours de wing  (2/2 — après 2026-10-14_wing_enum_values.sql)
   Date : 2026-10-14

   À exécuter en TEST **puis en PROD** dans la foulée.

   1. lessons.discipline : 'kite' (défaut, tout l'existant) | 'wing' |
      'wing_discovery'. Le kitefoil N'EST PAS une discipline : il se vend au
      tarif du kite. La paie moniteur ne dépend pas de la discipline.
   2. Le CHECK price_items_billable_category_chk reconnaît les 4 postes wing.
   3. 4 lignes de tarif, aux prix du site (les 2h : privé 100/110, groupe 80/85) :
        discovery privé 50 €/h · discovery groupe 40 €/h (par élève)
        normal    privé 55 €/h · normal    groupe 42,50 €/h (par élève)
      Éditables ensuite dans Options → Pricing. Pas de paliers dégressifs en wing.

   Rien n'est recalculé : les leçons existantes restent 'kite' à leur prix figé.
   Fun & Fly n'est pas touché (grille agence inchangée).
   ============================================================================ */

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS discipline TEXT NOT NULL DEFAULT 'kite';

ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_discipline_chk;
ALTER TABLE lessons ADD CONSTRAINT lessons_discipline_chk
  CHECK (discipline IN ('kite', 'wing', 'wing_discovery'));

ALTER TABLE price_items DROP CONSTRAINT IF EXISTS price_items_billable_category_chk;
ALTER TABLE price_items ADD CONSTRAINT price_items_billable_category_chk CHECK (
  billable_type IS NULL OR category = (CASE
    WHEN billable_type IN ('lesson_private', 'lesson_group', 'lesson_supervision',
                           'lesson_wing_private', 'lesson_wing_group',
                           'lesson_wing_discovery_private', 'lesson_wing_discovery_group') THEN 'lesson'
    WHEN billable_type IN ('rental_kite', 'rental_board', 'rental_full',
                           'rental_surfboard', 'rental_foilboard')                         THEN 'rental'
    WHEN billable_type = 'center_access'                                                   THEN 'center_access'
    WHEN billable_type = 'meal'                                                            THEN 'meal'
  END)::price_category
);

INSERT INTO price_items (category, name, description, price, unit, billable_type)
SELECT 'lesson', v.name, v.descr, v.price, '€/hour', v.bt::billable_type
FROM (VALUES
  ('Wing lesson — private',             'With foil board',                  55.00, 'lesson_wing_private'),
  ('Wing lesson — group (per student)', 'With foil board',                  42.50, 'lesson_wing_group'),
  ('Wing discovery — private',          'No foil board (first hours)',      50.00, 'lesson_wing_discovery_private'),
  ('Wing discovery — group (per student)', 'No foil board (first hours)',   40.00, 'lesson_wing_discovery_group')
) AS v(name, descr, price, bt)
WHERE NOT EXISTS (
  SELECT 1 FROM price_items p WHERE p.billable_type = v.bt::billable_type
);

/* ── VÉRIFICATION (après, sur chaque base) ───────────────────────────────────
   SELECT billable_type, price FROM price_items WHERE billable_type::text LIKE 'lesson_wing%';
   attendu : 4 lignes (55 / 42,5 / 50 / 40)
   SELECT discipline, count(*) FROM lessons GROUP BY 1;
   attendu : tout en 'kite'
   curl anon sur lessons (header x-share-token valide) : ne doit PAS lister
   `discipline` (la colonne n'est dans aucun GRANT anon — rien à faire, à constater).
   ──────────────────────────────────────────────────────────────────────────── */
