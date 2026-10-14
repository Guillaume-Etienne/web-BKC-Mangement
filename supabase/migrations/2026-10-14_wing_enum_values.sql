/* ============================================================================
   Migration : valeurs d'enum pour le wing  (1/2 — à passer AVANT la suivante)
   Date : 2026-10-14

   À exécuter en TEST **puis en PROD** dans la foulée (Supabase SQL editor),
   AVANT 2026-10-14b_wing_lessons.sql. Deux fichiers, toujours, dès qu'un enum
   est étendu puis utilisé : le SQL editor exécute tout dans UNE transaction et
   une valeur ajoutée n'y est pas utilisable (55P04).

   Décision de gui (2026-10-14) : le wing a deux tarifs horaires par type de cours,
   « discovery » (sans planche foil) et « normal » (avec). Le niveau se choisit à
   la saisie de la leçon par une case ; il fige un prix, rien n'est recalculé.
   - billable_type  : 4 postes de cours wing (un tarif par poste, index unique).
   - equipment_category : 'wing' (aile), pour que les listes de matériel d'une
     leçon se filtrent selon sa discipline (utilisé à l'étape matériel par rider).
   ============================================================================ */

ALTER TYPE billable_type ADD VALUE IF NOT EXISTS 'lesson_wing_private';
ALTER TYPE billable_type ADD VALUE IF NOT EXISTS 'lesson_wing_group';
ALTER TYPE billable_type ADD VALUE IF NOT EXISTS 'lesson_wing_discovery_private';
ALTER TYPE billable_type ADD VALUE IF NOT EXISTS 'lesson_wing_discovery_group';

ALTER TYPE equipment_category ADD VALUE IF NOT EXISTS 'wing';

/* ── VÉRIFICATION (après, sur chaque base) ───────────────────────────────────
   SELECT enum_range(NULL::billable_type);
   attendu : …,lesson_wing_private,lesson_wing_group,lesson_wing_discovery_private,lesson_wing_discovery_group
   SELECT enum_range(NULL::equipment_category);
   attendu : {kite,board,surfboard,foilboard,bar,wing}
   ──────────────────────────────────────────────────────────────────────────── */
