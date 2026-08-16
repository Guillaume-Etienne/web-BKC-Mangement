-- 2026-08-16 — Ping mensuel pour garder la clé Brevo vivante.
--
-- Une clé Brevo se désactive après 90 jours sans appel API. Le seul appelant
-- aujourd'hui est `notify-enquiry`, à chaque demande du formulaire — largement
-- assez pendant la saison, mais l'activité est saisonnière (sept → mi-mars) :
-- le creux avril→août suffit à tuer la clé, et la panne ne se verrait qu'à la
-- première demande de la rentrée, quand les contacts comptent le plus.
--
-- Parade : une tâche pg_cron mensuelle qui appelle NOTRE fonction
-- (`brevo-ping`), jamais Brevo directement — la clé reste dans un seul
-- endroit (les secrets Edge Functions), jamais dans une migration ni dans
-- Postgres. `brevo-ping` fait un GET /v3/account : rien n'est envoyé, rien
-- n'est stocké, le seul but est qu'un appel API ait eu lieu.
--
-- ⚠️ CE FICHIER CONTIENT DEUX VALEURS À REMPLACER À LA MAIN — même piège que
-- `2026-08-14c_enquiry_notify_trigger.sql`, même raison :
--   <PROJECT_REF>        → oslsbansxaajcpwhivmx (PROD)
--   <BREVO_PING_SECRET>  → une valeur QUE VOUS CHOISISSEZ, posée aussi dans
--                          les secrets Edge Functions du projet
--
-- ⚠️ POURQUOI UN SECRET DÉDIÉ, ET PAS UN SECRET EXISTANT
-- Les secrets Supabase ne sont pas relisibles une fois posés (dashboard =
-- empreinte seule). Réutiliser NOTIFY_ENQUIRY_SECRET ou NOTIFY_SECRET
-- casserait le trigger qui porte déjà l'ancienne valeur en dur. Un secret par
-- consommateur : chacun se change sans toucher aux autres.
--
-- PRÉREQUIS : déployer d'abord la fonction
--   supabase functions deploy brevo-ping --no-verify-jwt
--
-- ⚠️ PROD UNIQUEMENT — décision gui du 2026-08-16, même écart assumé que pour
-- `BREVO_API_KEY` : tout ce qui touche Brevo reste sur une seule base, pour ne
-- pas polluer le CRM avec des essais. **Ne pas exécuter ce fichier sur TEST.**

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION ping_brevo_keepalive()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Même garde-fou que le trigger d'enquête : une erreur de net.http_post ne
  -- doit jamais remonter et casser le job cron (qui se réexécuterait le mois
  -- suivant de toute façon — pas la peine qu'il échoue bruyamment).
  BEGIN
    PERFORM net.http_post(
      url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/brevo-ping',
      headers := jsonb_build_object(
                   'Content-Type',     'application/json',
                   'x-notify-secret',  '<BREVO_PING_SECRET>'
                 ),
      body    := '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'ping_brevo_keepalive: appel non envoyé (%): %', SQLSTATE, SQLERRM;
  END;
END $$;

-- Idempotent : rejouable sans erreur si le job existe déjà (utile si vous
-- rejouez ce fichier après avoir corrigé les placeholders).
DO $$
BEGIN
  PERFORM cron.unschedule('brevo-keepalive-ping');
EXCEPTION WHEN OTHERS THEN
  NULL; -- le job n'existait pas encore, rien à retirer
END $$;

-- Le 1er de chaque mois à 03:00 UTC (5h à Bilene, UTC+2) : en dehors des
-- heures d'ouverture, et largement dans la fenêtre des 90 jours même en
-- traitant février le plus court.
SELECT cron.schedule(
  'brevo-keepalive-ping',
  '0 3 1 * *',
  $$ SELECT ping_brevo_keepalive(); $$
);

-- ════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION — sur PROD (seule base concernée).
--
-- 1) Le job existe et est actif :
--    SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'brevo-keepalive-ping';
--
-- 2) Test immédiat, sans attendre le 1er du mois :
--    SELECT ping_brevo_keepalive();
--    puis, quelques secondes après (l'appel est asynchrone) :
--    SELECT * FROM net._http_response ORDER BY created DESC LIMIT 1;
--    → doit montrer un status_code 200.
--
-- 3) Si le status est 401 : la valeur du fichier ne correspond pas à
--    BREVO_PING_SECRET dans les secrets Edge Functions — les deux doivent être
--    IDENTIQUES (piège déjà vécu le 2026-08-15 avec NOTIFY_ENQUIRY_SECRET :
--    trigger et fonction avec deux valeurs différentes).
-- ════════════════════════════════════════════════════════════════════════════
