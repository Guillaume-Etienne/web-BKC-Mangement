/* ============================================================================
   Migration : walk-ins -- clients de passage (étape 1)
   Date : 2026-09-25
   Conception : .claude/docs/WALK_INS.md

   Des locaux viennent juste pour un cours ou une location, souvent, et
   reviennent. Décision gui : pas de leçon sans résa (tout passe par la résa :
   participants, paiements, compta, paie moniteur). Une venue walk-in = une
   résa normale d'un jour, sans chambre, marquée `kind = 'day_visitor'`, créée
   en coulisse depuis le Daily. check_out = check_in + 1 (la contrainte
   check_dates exige check_out > check_in) : le code ne considère une venue
   active QUE le jour de check_in.

   Trois colonnes, toutes additives, toutes avec un défaut qui laisse
   l'existant strictement inchangé :

   1. bookings.kind                 'stay' (défaut, toutes les résas actuelles)
                                    | 'day_visitor'
      -> sort la venue du planning hébergement, des alertes de séjour de la
         page d'accueil, de Now (repas) et des documents de séjour. Elle
         compte toujours en compta et dans la paie moniteur.

   2. clients.custom_lesson_rate    EUR/h, NULL = tarif officiel
      -> le "tarif perso" d'un pote : proposé à la place du tarif officiel à la
         création d'un cours walk-in, toujours modifiable.

   3. clients.waiver_signed_at      NULL = jamais signée
      -> la décharge d'un habitué se signe UNE fois, sur le client, au lieu de
         la redemander à chaque venue. bookings.waiver_accepted_at (formulaire
         public) n'est pas touché.

   Sécurité : `bookings` et `clients` sont en GRANT par colonne pour anon
   (Lot B 2026-07-04 / 2026-06-30). Les nouvelles colonnes sont donc
   invisibles à toute page partagée sans rien faire de plus.

   Exception décidée par gui le 2026-09-26 : `bookings.kind` EST ajoutée au
   GRANT anon (colonne non sensible, juste 'stay'/'day_visitor'). Raison :
   RestaurantSharePage doit pouvoir exclure les walk-ins (des locaux passés
   pour un cours, jamais des hôtes) de son planning de séjours — voir
   WALK_INS.md § Reste à faire. `custom_lesson_rate` et `waiver_signed_at`
   restent hors GRANT, rien ne les justifie côté pages partagées.

   Le code tourne déjà sans cette migration : `kind` absent = tout est un
   séjour (le walk-in atterrit alors dans la ligne « No room » du planning,
   comme avant), et les deux colonnes client sont écrites par un UPDATE séparé
   qui signale la migration manquante au lieu de casser l'écran.

   ⚠️ RestaurantSharePage.tsx sélectionne désormais `kind` dans sa requête
   anon : cette migration doit être passée sur PROD **avant** (ou en même
   temps que) le déploiement de ce code, sinon la page partagée casse
   entièrement (colonne absente ou non accordée = la requête ENTIÈRE échoue,
   pas juste le filtre — voir reference_never_select_unmigrated_column).

   Idempotente. À passer en TEST **puis en PROD** dans la foulée.
   ============================================================================ */

BEGIN;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'stay';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_kind_check'
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_kind_check CHECK (kind IN ('stay', 'day_visitor'));
  END IF;
END $$;

GRANT SELECT (kind) ON bookings TO anon;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS custom_lesson_rate NUMERIC(10,2)
    CHECK (custom_lesson_rate IS NULL OR custom_lesson_rate >= 0);

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS waiver_signed_at TIMESTAMPTZ;

COMMIT;

/* ============================================================================
   ROLLBACK (si besoin, rien d'autre ne dépend de ces colonnes en base)
     REVOKE SELECT (kind) ON bookings FROM anon;
     ALTER TABLE bookings DROP COLUMN IF EXISTS kind;
     ALTER TABLE clients  DROP COLUMN IF EXISTS custom_lesson_rate;
     ALTER TABLE clients  DROP COLUMN IF EXISTS waiver_signed_at;

   VÉRIFICATION (sur chaque base)

   1. Toutes les résas existantes sont des séjours :
      SELECT kind, count(*) FROM bookings GROUP BY 1;
      -- attendu : une seule ligne, kind = 'stay'

   2. La contrainte refuse n'importe quoi :
      UPDATE bookings SET kind = 'oops' WHERE id = (SELECT id FROM bookings LIMIT 1);
      -- attendu : ERROR violation de contrainte bookings_kind_check

   3. anon voit `kind` (décision du 2026-09-26) mais rien d'autre de nouveau :
      curl "$SUPABASE_URL/rest/v1/bookings?select=id,kind" -H "apikey: $ANON_KEY"
      -- attendu : 200, des lignes (PAS 42501, PAS 42703)
      curl "$SUPABASE_URL/rest/v1/clients?select=id,custom_lesson_rate,waiver_signed_at" -H "apikey: $ANON_KEY"
      -- attendu : 42501 permission denied (colonnes client toujours fermées)
   ============================================================================ */
