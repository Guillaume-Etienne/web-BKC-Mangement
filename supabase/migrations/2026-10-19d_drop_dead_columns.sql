-- 2026-10-19d — Suppression des colonnes et tables mortes (audit 2026-10-19)
-- À passer : TEST puis PROD, **APRÈS le déploiement** du code qui ne les nomme plus
-- (une requête qui cite une colonne absente est refusée EN ENTIER) — et après
-- 2026-10-19c. Le MCP local (mcp-server) doit avoir été relancé sur le même code.
--
--   • bookings.amount_paid — cache périmé (9/35 résas à 0 alors que payées) ; il
--     a causé le risque de paiement en double de l'étape 6 (corrigé 82e8fb8).
--     Plus rien ne le lit : l'argent vient de `payments`.
--   • email_logs.delivered_at / opened_at — 0/17 remplies, jamais lues : le
--     webhook Resend qui devait les remplir n'a jamais été branché. (Les statuts
--     'delivered' / 'opened' de la colonne `status` restent.)
--   • lesson_clients — table vide (0 ligne), remplacée par lessons.participant_ids ;
--     seul deleteGuard la consultait.
--   • expenses.category — copie texte du libellé, remplacée par category_id
--     (phase 3 de 2026-09-19_expense_categories.sql).
--
-- Gardés volontairement (champs en service, juste jamais remplis) :
-- clients.passport_number (fiche client), lesson_intents.estimated_days (Outlook).
--
-- ⚠️ Irréversible : les données de ces colonnes partent avec. Elles sont vides ou
-- recopiées ailleurs — la requête de contrôle ci-dessous le revérifie AVANT.

-- ── Contrôle préalable (à lancer seul d'abord) ───────────────────────────────
--   SELECT
--     (SELECT count(*) FROM email_logs WHERE delivered_at IS NOT NULL OR opened_at IS NOT NULL) AS email_ts,   -- attendu 0
--     (SELECT count(*) FROM lesson_clients)                                                    AS lesson_clients, -- attendu 0
--     (SELECT count(*) FROM expenses WHERE category_id IS NULL)                                AS exp_sans_id;    -- attendu 0

BEGIN;

ALTER TABLE public.bookings   DROP COLUMN amount_paid;
ALTER TABLE public.email_logs DROP COLUMN delivered_at, DROP COLUMN opened_at;
ALTER TABLE public.expenses   DROP COLUMN category;
DROP TABLE public.lesson_clients;

COMMIT;

-- ── Vérification ─────────────────────────────────────────────────────────────
--   SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'
--   AND (column_name IN ('amount_paid', 'delivered_at', 'opened_at') OR (table_name = 'expenses' AND column_name = 'category'));
--   → 0 ligne ;  SELECT to_regclass('public.lesson_clients') → NULL
-- Puis l'app : Accounting (dépenses), Bookings (enregistrer une résa), fiche client (emails).
