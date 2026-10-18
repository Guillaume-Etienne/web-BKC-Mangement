/* ============================================================================
   Migration : tarifs location « journée »  (1/2 — à passer AVANT la suivante)
   Date : 2026-10-18

   À exécuter en TEST **puis en PROD** dans la foulée (Supabase SQL editor),
   AVANT 2026-10-18c_rental_type.sql. Deux fichiers, toujours, dès qu'un enum
   est étendu puis utilisé : le SQL editor exécute tout dans UNE transaction et
   une valeur ajoutée n'y est pas utilisable (55P04).

   Décision de gui (2026-10-18) : une location « journée » (slot full_day) a son
   propre tarif par type de matériel, un poste facturable de plus par type.
   ============================================================================ */

ALTER TYPE billable_type ADD VALUE IF NOT EXISTS 'rental_kite_day';
ALTER TYPE billable_type ADD VALUE IF NOT EXISTS 'rental_board_day';
ALTER TYPE billable_type ADD VALUE IF NOT EXISTS 'rental_full_day';
ALTER TYPE billable_type ADD VALUE IF NOT EXISTS 'rental_surfboard_day';
ALTER TYPE billable_type ADD VALUE IF NOT EXISTS 'rental_foilboard_day';

/* ── VÉRIFICATION (après, sur chaque base) ───────────────────────────────────
   SELECT enum_range(NULL::billable_type);
   attendu : …,rental_kite_day,rental_board_day,rental_full_day,rental_surfboard_day,rental_foilboard_day
   ──────────────────────────────────────────────────────────────────────────── */
