/* ============================================================================
   Migration : equipment_category -- nouvelle valeur 'bar' (barre de kite)
   Date : 2026-09-07

   À exécuter en TEST **puis en PROD** dans la foulée (Supabase SQL editor).
   Doit passer AVANT 2026-09-07b_equipment_purchase_resale.sql -- pas que ce
   fichier-ci l'utilise, mais gui va s'en servir dès que le formulaire propose
   la catégorie, et une valeur d'enum ne peut de toute façon pas être utilisée
   dans la transaction qui l'ajoute (55P04) si jamais un futur script s'en sert
   le même jour -- deux fichiers, toujours, dès qu'un enum est étendu.

   Décision de gui (2026-09-07) : la barre reste une pièce d'inventaire (achat,
   usure, revente) mais N'ENTRE PAS dans le calcul de revenu par cours -- elle
   continue de peser dans la part "accessoires non suivis" du modèle CA
   (equipment_pricing_defaults.other_gear_share), au même titre que casque,
   harnais, gilet, radio. Pas de bar_id sur lessons.
   ============================================================================ */

ALTER TYPE equipment_category ADD VALUE IF NOT EXISTS 'bar';

/* ── VÉRIFICATION (après, sur chaque base) ───────────────────────────────────
   SELECT enum_range(NULL::equipment_category);
   attendu : {kite,board,surfboard,foilboard,bar}
   ──────────────────────────────────────────────────────────────────────────── */
