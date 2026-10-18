/* ============================================================================
   Migration : une location sait ce qu'elle est  (2/2 — après 2026-10-18b)
   Date : 2026-10-18

   À exécuter en TEST **puis en PROD** dans la foulée.

   Constat (résa #051) : le sélecteur Kite / Board / Full / … du formulaire de
   location n'était PAS enregistré. On gardait `equipment_id` (le kite, pour un
   Full) et tout le reste se DÉDUISAIT de la catégorie du matériel : un Full
   s'affichait « kite », et la page client ne disait pas du tout ce qui était loué.

   1. equipment_rentals.rental_type   : ce qui est vendu (kite | board | full |
      surfboard | foilboard | free). NULL = ligne d'avant cette migration (le
      front retombe alors sur l'ancienne déduction, l'affichage ne change pas).
   2. equipment_rentals.board_equipment_id : la planche d'un Full (kite = equipment_id).
      Facultatif, comme tout le détail du matériel.
   3. equipment_rentals.list_price    : le prix de grille FIGÉ à la saisie, pour
      que les remises se voient (prix facturé < prix de grille). Même principe
      que lessons.price_per_hour : on ne recalcule jamais.
   4. equipment_rentals.client_note   : note LISIBLE par le client. `notes`
      reste la note interne (elle n'est dans aucun GRANT anon).
   5. Le CHECK price_items_billable_category_chk reconnaît les 5 postes « jour ».
   6. 5 lignes de tarif journée : kite 60 · board 30 · full 80 · surf 40 · foil 70.
      Éditables ensuite dans Options → Pricing.
   7. GRANT anon : rental_type, list_price, client_note (page client). Le GRANT
      de table est déjà révoqué (2026-08-18c) : un GRANT de colonnes suffit.

   Rien n'est recalculé ni rattrapé : le passé reste NULL.
   ============================================================================ */

ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS rental_type        TEXT;
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS board_equipment_id UUID REFERENCES equipment(id);
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS list_price         NUMERIC(8,2);
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS client_note        TEXT;

ALTER TABLE equipment_rentals DROP CONSTRAINT IF EXISTS equipment_rentals_rental_type_chk;
ALTER TABLE equipment_rentals ADD CONSTRAINT equipment_rentals_rental_type_chk
  CHECK (rental_type IS NULL OR rental_type IN ('kite', 'board', 'full', 'surfboard', 'foilboard', 'free'));

COMMENT ON COLUMN equipment_rentals.rental_type IS
  'Ce qui est loué (full = kite + bar + board). NULL = ligne antérieure au 2026-10-18.';
COMMENT ON COLUMN equipment_rentals.list_price IS
  'Prix de grille figé à la saisie. price < list_price = remise.';
COMMENT ON COLUMN equipment_rentals.client_note IS
  'Note visible par le client (page client). `notes` = interne.';

ALTER TABLE price_items DROP CONSTRAINT IF EXISTS price_items_billable_category_chk;
ALTER TABLE price_items ADD CONSTRAINT price_items_billable_category_chk CHECK (
  billable_type IS NULL OR category = (CASE
    WHEN billable_type IN ('lesson_private', 'lesson_group', 'lesson_supervision',
                           'lesson_wing_private', 'lesson_wing_group',
                           'lesson_wing_discovery_private', 'lesson_wing_discovery_group') THEN 'lesson'
    WHEN billable_type IN ('rental_kite', 'rental_board', 'rental_full',
                           'rental_surfboard', 'rental_foilboard',
                           'rental_kite_day', 'rental_board_day', 'rental_full_day',
                           'rental_surfboard_day', 'rental_foilboard_day')                 THEN 'rental'
    WHEN billable_type = 'center_access'                                                   THEN 'center_access'
    WHEN billable_type = 'meal'                                                            THEN 'meal'
  END)::price_category
);

INSERT INTO price_items (category, name, description, price, unit, billable_type)
SELECT 'rental', v.name, v.descr, v.price, '€/day', v.bt::billable_type
FROM (VALUES
  ('Kite — full day',      'Kite rental (full day)',            60.00, 'rental_kite_day'),
  ('Board — full day',     'Board rental (full day)',           30.00, 'rental_board_day'),
  ('Full — full day',      'Full gear (kite + bar + board, full day)', 80.00, 'rental_full_day'),
  ('Surfboard — full day', 'Surfboard rental (full day)',       40.00, 'rental_surfboard_day'),
  ('Foilboard — full day', 'Foilboard rental (full day)',       70.00, 'rental_foilboard_day')
) AS v(name, descr, price, bt)
WHERE NOT EXISTS (
  SELECT 1 FROM price_items p WHERE p.billable_type = v.bt::billable_type
);

GRANT SELECT (rental_type, list_price, client_note) ON equipment_rentals TO anon;

/* ── VÉRIFICATION (après, sur chaque base) ───────────────────────────────────
   SELECT billable_type, price FROM price_items WHERE billable_type::text LIKE 'rental%_day';
   attendu : 5 lignes (60 / 30 / 80 / 40 / 70)
   SELECT count(*) FROM equipment_rentals WHERE rental_type IS NOT NULL;
   attendu : 0 (le passé n'est pas rattrapé)
   curl anon (x-share-token client valide) sur equipment_rentals :
     ?select=rental_type,list_price,client_note   → 200
     ?select=notes                                → 42501  (note interne)
     ?select=board_equipment_id                   → 42501
   ──────────────────────────────────────────────────────────────────────────── */
