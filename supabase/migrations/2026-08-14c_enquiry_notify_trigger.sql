-- 2026-08-14 (c) — Un email à chaque demande reçue.
--
-- ⚠️ CE FICHIER CONTIENT DEUX VALEURS À REMPLACER À LA MAIN. C'est le seul du
-- projet dans ce cas : l'URL du projet Supabase et le `NOTIFY_SECRET` diffèrent
-- entre TEST et PROD, et le secret n'a rien à faire dans un dépôt Git.
--   <PROJECT_REF>    → oslsbansxaajcpwhivmx en PROD, uefezhyqcggpzomowpww en TEST
--   <NOTIFY_SECRET>  → la valeur déjà présente dans les secrets Edge Functions
--                      du projet (celle qu'utilise notify-submission)
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

  PERFORM net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/notify-enquiry',
    headers := jsonb_build_object(
                 'Content-Type',     'application/json',
                 'x-notify-secret',  '<NOTIFY_SECRET>'
               ),
    body    := jsonb_build_object(
                 'record',       to_jsonb(NEW),
                 'source_label', COALESCE(v_source, '')
               )
  );

  -- Toujours NEW : l'email est un effet de bord, jamais une condition. Si la
  -- notification échoue, la demande doit exister quand même — c'est elle qui
  -- compte, l'email n'est qu'une commodité.
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
--      un 401 = le `<NOTIFY_SECRET>` du trigger ne correspond pas au secret ;
--    • `SELECT * FROM net._http_response ORDER BY created DESC LIMIT 5;`
--      (la réponse HTTP réellement reçue par pg_net).
-- ════════════════════════════════════════════════════════════════════════════
