-- 2026-09-05 (b) — « Est-ce que j'ai bien demandé l'acompte ? »
--
-- La question de gui n'avait aucune réponse en base. Vérifié colonne par
-- colonne avant d'écrire ce fichier : `bookings` n'a pas de champ acompte,
-- aucune migration n'en ajoute, l'étape 6 du wizard ne porte qu'un « montant
-- déjà payé », `email_log_type` n'a pas de valeur pour ça, et aucun des emails
-- de la page Documents ne parle d'argent (la confirmation n'affiche ni prix, ni
-- total, ni acompte). **La seule trace d'acompte de tout le schéma est
-- `payments.is_deposit`** — et celle-là dit qu'il est ARRIVÉ, pas qu'il a été
-- DEMANDÉ. Deux faits différents : un client qui n'a rien payé et à qui on n'a
-- jamais rien demandé ne se traite pas comme un client qu'on relance depuis
-- trois semaines, et la grille les affichait à l'identique.
--
-- Un horodatage, pas un booléen : c'est l'ancienneté de la demande qui porte
-- l'information (Documents → Overview passe la case à l'ambre au bout de 14
-- jours sans argent, cf. `askedState` dans utils/documentsOverview.ts). Un
-- booléen aurait dit « demandé » aussi bien pour hier que pour la saison
-- dernière.
--
-- ⚠️ Marqueur MANUEL : rien n'est envoyé. La demande part par WhatsApp, par mail
-- perso ou de vive voix — aucun canal que l'app contrôle ne la porte, et une
-- colonne qui prétendrait le contraire mentirait. Un clic pose la date, un
-- second l'efface.
--
-- ✅ Le code tourne SANS cette colonne : `useBookings` fait `select('*')`, donc
-- une colonne absente est simplement absente de l'objet, la case se lit « pas
-- demandé », et le clic affiche l'erreur en nommant ce fichier. Aucun
-- séquencement à respecter, rien à redéployer.
-- ✅ Rien à faire côté RLS : `bookings` est en GRANT par colonne pour anon
-- (Lot B du 2026-07-04, `REVOKE SELECT ON bookings FROM anon` + liste
-- explicite). Une colonne ajoutée n'est donc PAS lisible par un porteur de lien
-- tant qu'on ne l'accorde pas — et on ne l'accorde pas : la relance d'un
-- acompte ne regarde ni un chauffeur, ni un prestataire, ni le client lui-même.
--
-- Idempotente. À appliquer sur TEST **et** PROD (une seule tâche, feedback gui).

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_requested_at TIMESTAMPTZ;

COMMENT ON COLUMN bookings.deposit_requested_at IS
  'Quand l''acompte a été DEMANDÉ (marqueur manuel posé dans Documents → Overview). '
  'NULL = jamais demandé. Ne dit rien de ce qui a été reçu : ça, c''est payments.is_deposit.';

-- ════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION (après, sur chaque base)
--
--   -- 1. La colonne existe :
--   SELECT count(*) FILTER (WHERE deposit_requested_at IS NOT NULL) AS demandes,
--          count(*) AS resas
--     FROM bookings;
--   -- attendu : demandes = 0 juste après la migration (personne n'a cliqué)
--
--   -- 2. anon ne la voit pas, même avec un jeton de partage valide :
--   curl "$SUPABASE_URL/rest/v1/bookings?select=deposit_requested_at&limit=1" \
--        -H "apikey: $ANON_KEY" -H "x-share-token: <un jeton valide>"
--   -- attendu : 42501 permission denied — surtout PAS une date.
-- ════════════════════════════════════════════════════════════════════════════
