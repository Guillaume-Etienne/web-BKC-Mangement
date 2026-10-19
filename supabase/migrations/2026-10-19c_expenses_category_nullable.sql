-- 2026-10-19c — expenses.category n'est plus obligatoire
-- À passer : TEST puis PROD, **AVANT de pousser le code** du commit qui arrête
-- d'écrire cette colonne (sinon toute nouvelle dépense est refusée : NOT NULL).
--
-- Première moitié de la « phase 3 » des catégories de dépenses
-- (2026-09-19_expense_categories.sql) : `category_id` est la seule source depuis
-- un mois ; la colonne texte `category` n'était plus qu'une copie du libellé.
-- 36/36 dépenses ont un category_id en PROD (vérifié 2026-10-19) → on peut le
-- rendre obligatoire dans la foulée.
--
-- La suppression des colonnes vient APRÈS le déploiement : 2026-10-19d.

BEGIN;

ALTER TABLE public.expenses ALTER COLUMN category DROP NOT NULL;
ALTER TABLE public.expenses ALTER COLUMN category_id SET NOT NULL;

COMMIT;

-- ── Vérification ─────────────────────────────────────────────────────────────
--   SELECT column_name, is_nullable FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name IN ('category', 'category_id');
--   → category YES, category_id NO
-- Rollback : ALTER TABLE public.expenses ALTER COLUMN category_id DROP NOT NULL;
--            (category ne redevient NOT NULL que si plus aucune ligne n'est vide)
