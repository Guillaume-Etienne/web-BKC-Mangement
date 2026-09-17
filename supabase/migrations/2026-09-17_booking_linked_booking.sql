/* ============================================================================
   Migration : bookings.linked_booking_id -- une même famille, deux résas
   Date : 2026-09-17

   Demande de gui : un groupe peut arriver en plusieurs vagues (des renforts
   qui rejoignent plus tard, avec leur propre chambre) ou repartir en
   plusieurs vagues (un sous-groupe qui part avant les autres). Décision prise
   en discussion : plutôt que d'étirer les dates d'une seule résa pour couvrir
   tout le monde, chaque sous-groupe garde SA PROPRE résa (ses dates, ses
   chambres, son solde), simplement reliée à la résa principale.

   Topologie en étoile : chaque résa "rejointe" pointe vers la résa
   principale ; la résa principale ne pointe vers rien. Pas de table de
   groupe séparée -- une seule colonne suffit, et une requête
   `booking_id = X OR linked_booking_id = X` retrouve tout le groupe.

   Décisions actées avec gui :
   - Solde/paiements restent SÉPARÉS par résa (pas de fusion des totaux) --
     plus juste pour chaque sous-groupe, et rien à recalculer nulle part.
   - Totaux saison (computeSeasonTotals) : AUCUN changement, deux résas liées
     comptent comme deux lignes de revenu, exactement comme deux résas
     indépendantes.
   - Numéro de résa : toujours affiché, jamais masqué -- annoté d'un badge
     "lié à #XXX" partout où le numéro apparaît déjà (liste, planning, fiche
     client, alertes Home), sur le modèle du short_code d'agence.

   Sécurité : `bookings` est déjà en GRANT par colonne pour anon (Lot B,
   2026-07-04 -- REVOKE SELECT ON bookings FROM anon ; GRANT SELECT (id,
   booking_number, check_in, check_out, status, client_id, num_center_access,
   center_access_rate) TO anon). Cette whitelist explicite veut dire que
   `linked_booking_id` est invisible à toute page partagée SANS RIEN À FAIRE
   de plus : on ne l'ajoute pas au GRANT.
   ⚠️ Le lien croisé sur la page client publique (ClientSharePage, "voir aussi
   le séjour #045") est volontairement HORS SCOPE de cette migration : la RLS
   de `bookings` filtre déjà les LIGNES par token de partage (Phase 2), donc
   afficher la résa liée à un visiteur anon demande une policy dédiée, pas
   seulement ce GRANT de colonne -- à concevoir séparément, pas en profiter
   de cette migration pour l'ouvrir en silence.

   Idempotente : peut être repassée sans dommage. À exécuter en TEST **puis
   en PROD** dans la foulée (Supabase SQL editor).
   ============================================================================ */

BEGIN;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS linked_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_linked_booking_id
  ON bookings(linked_booking_id) WHERE linked_booking_id IS NOT NULL;

COMMIT;

/* ============================================================================
   VÉRIFICATION (à passer après, sur chaque base)

   1. La colonne existe, tout le monde est NULL au départ :
      SELECT linked_booking_id, count(*) FROM bookings GROUP BY 1;
      -- attendu : une seule ligne, linked_booking_id = NULL

   2. Le lien pointe bien vers une résa existante (contrainte FK) :
      UPDATE bookings SET linked_booking_id = '00000000-0000-0000-0000-000000000000'
        WHERE id = (SELECT id FROM bookings LIMIT 1);
      -- attendu : ERROR violation de contrainte de clé étrangère

   3. anon ne la voit toujours pas, même avec un jeton de partage valide :
      curl "$SUPABASE_URL/rest/v1/bookings?select=id,linked_booking_id" \
           -H "apikey: $ANON_KEY" -H "x-share-token: <un jeton valide>"
      -- attendu : erreur de colonne inconnue / permission -- jamais la valeur.
   ============================================================================ */
