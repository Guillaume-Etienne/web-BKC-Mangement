-- ═══════════════════════════════════════════════════════════════════════════════
-- 2026-07-30 (a) — Deux valeurs de catégorie, À PASSER SEULES ET EN PREMIER
--
-- ⚠️ POURQUOI UN FICHIER À PART : PostgreSQL refuse d'UTILISER une valeur d'enum
-- ajoutée dans la même transaction (« unsafe use of new value ... New enum values
-- must be committed before they can be used »). Or l'éditeur SQL du dashboard
-- Supabase exécute tout le script dans UNE transaction — mettre ces deux lignes en
-- tête du fichier principal ne suffit donc pas, contrairement à psql.
--
-- Ordre : passer CE fichier, attendre le « Success », puis
--         2026-07-30b_billable_types.sql.
--
-- Sans effet visible tout seul : ces catégories ne sont utilisées que par (b).
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TYPE price_category ADD VALUE IF NOT EXISTS 'meal';
ALTER TYPE price_category ADD VALUE IF NOT EXISTS 'center_access';

-- Vérification :
--   SELECT unnest(enum_range(NULL::price_category));
--   → lesson, activity, rental, taxi, meal, center_access
--   ('taxi' est encore là : l'enum garde ses valeurs, ce sont les LIGNES qui
--    disparaissent dans (b). Retirer une valeur d'enum en PostgreSQL demande de
--    recréer le type — pas la peine pour une valeur que plus personne n'écrit.)
