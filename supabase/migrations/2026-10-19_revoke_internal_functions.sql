-- 2026-10-19 — Fonctions internes : plus appelables par les visiteurs
-- À passer : TEST puis PROD (aucun code à déployer avec).
--
-- Constat (audit 2026-10-19, advisors Supabase) : toutes les fonctions SECURITY
-- DEFINER de `public` gardaient le EXECUTE par défaut de PUBLIC, donc d'anon.
--   • ping_brevo_keepalive() — RPC appelable par n'importe qui sans token :
--     chaque appel envoie une requête à Brevo. Seul le cron (postgres) s'en sert.
--   • notify_* (triggers) et rls_auto_enable (event trigger) — pas appelables en
--     RPC (type de retour trigger/event_trigger), un trigger ne vérifie pas
--     EXECUTE au déclenchement : retirer le droit ne change rien à leur marche.
--     Ménage, pour que l'advisor ne les signale plus.
-- Restent ouvertes, VOLONTAIREMENT : resolve_share_token, share_*, instructor_load,
-- instructor_outlook_bookings (pages partagées). get_db_stats est déjà fermée à anon.
--
-- + search_path figé sur les 3 fonctions que l'advisor signale « mutable » :
--   notify_form_submission n'appelle que net.http_post (qualifié) ; share_param et
--   share_type n'appellent que share_ctx() (public).

BEGIN;

REVOKE EXECUTE ON FUNCTION public.ping_brevo_keepalive()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_enquiry_inserted()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_form_submission()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()          FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.notify_form_submission() SET search_path = public, extensions;
ALTER FUNCTION public.share_param(text)        SET search_path = public;
ALTER FUNCTION public.share_type()             SET search_path = public;

COMMIT;

-- ── Vérification ─────────────────────────────────────────────────────────────
-- 1) Plus aucune des 4 fonctions n'est exécutable par anon (4 lignes à false) :
--   SELECT proname, has_function_privilege('anon', oid, 'execute') AS anon_exec
--   FROM pg_proc WHERE pronamespace = 'public'::regnamespace
--     AND proname IN ('ping_brevo_keepalive','notify_enquiry_inserted','notify_form_submission','rls_auto_enable');
-- 2) curl anon : POST /rest/v1/rpc/ping_brevo_keepalive → 401/403 (42501), plus 200/204.
-- 3) Les pages partagées marchent toujours : POST /rest/v1/rpc/resolve_share_token → 200.
-- 4) Le cron tourne toujours en postgres (propriétaire) : SELECT ping_brevo_keepalive(); en SQL editor → OK.
