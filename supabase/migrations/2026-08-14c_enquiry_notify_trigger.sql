-- 2026-08-14 (c) — Un email à chaque demande reçue.
--
-- 🔴 CORRIGÉ LE 2026-08-14 APRÈS INCIDENT — rejouer ce fichier (il remplace le
-- trigger en place). La première version laissait une erreur de `net.http_post`
-- **annuler l'insertion de la demande** : appliquée avec les placeholders non
-- remplacés, elle a rendu le formulaire public inopérant sur TEST (toute
-- insertion `channel='form'` en `XX000 Quote command returned error`). Le
-- commentaire promettait « l'email est un effet de bord, jamais une condition » —
-- le code, lui, ne le faisait pas. C'est désormais vrai, via un bloc EXCEPTION.
-- En attendant de rejouer : `DROP TRIGGER IF EXISTS trg_notify_enquiry ON enquiries;`
-- rétablit le formulaire immédiatement (au prix des emails).
--
-- ⚠️ CE FICHIER CONTIENT DEUX VALEURS À REMPLACER À LA MAIN. C'est le seul du
-- projet dans ce cas : l'URL du projet Supabase et le secret diffèrent
-- entre TEST et PROD, et le secret n'a rien à faire dans un dépôt Git.
--   <PROJECT_REF>            → oslsbansxaajcpwhivmx en PROD, uefezhyqcggpzomowpww en TEST
--   <NOTIFY_ENQUIRY_SECRET>  → une valeur QUE VOUS CHOISISSEZ, posée aussi dans
--                              les secrets Edge Functions du projet
--
-- ⚠️ POURQUOI UN SECRET DÉDIÉ, ET PAS LE `NOTIFY_SECRET` EXISTANT
-- Les secrets Supabase ne sont **pas relisibles** une fois posés : le dashboard
-- n'en montre qu'une empreinte. Impossible donc de recopier `NOTIFY_SECRET` dans
-- ce fichier — et le réécrire avec une valeur connue casserait
-- `notify-submission`, dont le trigger porte l'ancienne valeur en dur. Un secret
-- par consommateur : chacun se change sans toucher à l'autre.
-- (Vécu le 2026-08-15 : trigger et fonction avec deux valeurs différentes →
--  `net._http_response` en 401, aucune erreur visible ailleurs, aucun email.)
--
-- PRÉREQUIS : déployer d'abord la fonction
--   supabase functions deploy notify-enquiry --no-verify-jwt
--
-- POURQUOI UN TRIGGER pg_net ET PAS UN DATABASE WEBHOOK
-- L'UI Database Webhooks n'était pas disponible sur le projet PROD (schéma
-- `supabase_functions` absent), et le trigger pg_net avait été créé à la main
-- pour `form_submissions` en juin. On reste sur le même mécanisme des deux
-- côtés : deux façons de faire la même chose finissent par diverger.
--
-- CE QUE LE TRIGGER ENVOIE
-- La ligne insérée, **plus le libellé de l'origine** : la fonction recevrait
-- sinon un UUID, et l'email dirait « Found us via 7841a576-… », ce qui
-- n'apprend rien à personne.

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION notify_enquiry_inserted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_source TEXT;
BEGIN
  SELECT COALESCE(s.label->>'en', s.label->>'fr', '')
    INTO v_source
    FROM enquiry_sources s
   WHERE s.id = NEW.source_id;

  -- ⚠️ LE BLOC EXCEPTION EST LE CŒUR DE CE TRIGGER, pas une précaution de style.
  -- Sans lui, une erreur de `net.http_post` **annule l'INSERT** : le formulaire
  -- public renvoie « l'envoi a échoué » au visiteur, et la demande est perdue.
  -- Vécu le 2026-08-14 : une URL restée avec son `<PROJECT_REF>` non remplacé a
  -- fait échouer toute insertion `channel='form'` en XX000. Une notification
  -- ratée doit coûter un email, jamais un client.
  BEGIN
    PERFORM net.http_post(
      url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/notify-enquiry',
      headers := jsonb_build_object(
                   'Content-Type',     'application/json',
                   'x-notify-secret',  '<NOTIFY_ENQUIRY_SECRET>'
                 ),
      body    := jsonb_build_object(
                   'record',       to_jsonb(NEW),
                   'source_label', COALESCE(v_source, '')
                 )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_enquiry_inserted: notification non envoyée (%): %', SQLSTATE, SQLERRM;
  END;

  -- Toujours NEW : l'email est un effet de bord, jamais une condition.
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_enquiry ON enquiries;
CREATE TRIGGER trg_notify_enquiry
  AFTER INSERT ON enquiries
  FOR EACH ROW
  -- Seulement les demandes venues du formulaire : une fiche que gui crée à la
  -- main depuis WhatsApp n'a pas à lui envoyer un email à lui-même, et le
  -- visiteur n'attend pas d'accusé de réception pour un message qu'il n'a pas
  -- envoyé.
  WHEN (NEW.channel = 'form')
  EXECUTE FUNCTION notify_enquiry_inserted();

-- ════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION — sur TEST d'abord, puis PROD.
--
-- 1) Le trigger existe et ne se déclenche que sur le formulaire :
--    SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'trg_notify_enquiry';
--
-- 2) Bout-en-bout, en remplissant le formulaire public (le vrai test) :
--    ouvrir le lien `enquiry_form`, envoyer une demande avec une VRAIE adresse,
--    et vérifier les deux emails : l'accusé au visiteur, la notification à
--    contact@bilenekite.com.
--    ⚠️ contact@bilenekite.com est relevée en POP3 par Gmail : le mail peut
--    mettre jusqu'à ~1 h à apparaître. Ce n'est PAS une panne — piège vécu le
--    2026-07-28, où une fausse alerte a été ouverte pour ça.
--
-- 3) Une saisie manuelle ne déclenche RIEN :
--    INSERT INTO enquiries (name, channel) VALUES ('test manuel', 'manual');
--    → aucun email. Puis supprimer la ligne.
--
-- 4) Si aucun email n'arrive, regarder dans l'ordre :
--    • les logs de la fonction (dashboard → Edge Functions → notify-enquiry) ;
--      un 401 = la valeur du trigger ne correspond pas à `NOTIFY_ENQUIRY_SECRET` ;
--    • `SELECT * FROM net._http_response ORDER BY created DESC LIMIT 5;`
--      (la réponse HTTP réellement reçue par pg_net).
-- ════════════════════════════════════════════════════════════════════════════
