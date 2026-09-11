/* ============================================================================
   Migration : clients.relationship_flag -- un client à éviter, ou à retenir
   Date : 2026-09-11

   Demande de gui, en toutes lettres : « une espèce de black list » -- le mot
   est fort volontairement -- pour les clients qu'on préfère ne pas revoir
   (le fan de jetski qui déteste les kitesurfeurs), et à l'inverse ceux
   qu'on aimerait beaucoup voir revenir.

   Décision : DEUX états, pas plus ('avoid' / 'favorite'), pas un système de
   tags -- l'app tourne à 2 admins, un enum binaire suffit et reste lisible
   d'un coup d'oeil en badge. Le POURQUOI (l'anecdote jetski) s'écrit dans
   client_notes (2026-09-03), qui existe déjà pour "ce qu'on pense de
   quelqu'un" -- pas un nouveau champ texte de plus.

   Sécurité : clients est déjà en GRANT par colonne pour anon (REVOKE SELECT
   ON clients FROM anon ; GRANT SELECT (id, first_name, last_name) ON clients
   TO anon -- schema.sql). Cette whitelist explicite veut dire que la
   nouvelle colonne est invisible à toute page partagée SANS RIEN À FAIRE de
   plus : on ne l'ajoute pas au GRANT, elle ne sort pas.

   Idempotente : peut être repassée sans dommage. À exécuter en TEST **puis
   en PROD** dans la foulée (Supabase SQL editor).
   ============================================================================ */

BEGIN;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS relationship_flag TEXT
  CHECK (relationship_flag IN ('avoid', 'favorite'));

COMMIT;

/* ============================================================================
   VÉRIFICATION (à passer après, sur chaque base)

   1. La colonne existe, tout le monde est NULL au départ :
      SELECT relationship_flag, count(*) FROM clients GROUP BY 1;
      -- attendu : une seule ligne, relationship_flag = NULL

   2. Le garde-fou de valeur tient :
      UPDATE clients SET relationship_flag = 'nope' WHERE id = (SELECT id FROM clients LIMIT 1);
      -- attendu : ERROR 23514 (violation de contrainte CHECK)

   3. anon ne la voit toujours pas, même avec un jeton de partage valide :
      curl "$SUPABASE_URL/rest/v1/clients?select=id,relationship_flag" \
           -H "apikey: $ANON_KEY" -H "x-share-token: <un jeton valide>"
      -- attendu : erreur de colonne inconnue / permission -- jamais la valeur.
   ============================================================================ */
