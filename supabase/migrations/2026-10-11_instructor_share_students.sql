-- 2026-10-11 — La page « Instructor Hours » affiche les NOMS des élèves de chaque jour.
--
-- Un token `instructor` lit, dans booking_participants, uniquement les voyageurs listés
-- dans `participant_ids` de SES cours. Le GRANT colonne de 2026-06-30 est inchangé :
-- anon ne reçoit que (id, booking_id, first_name, last_name) — jamais passeport/notes.
-- La sous-requête sur `lessons` passe par la RLS de `lessons` (déjà bornée au moniteur).
-- Strictement additif ; sans cette migration la page s'affiche, sans les noms.
-- À passer APRÈS 2026-10-10a/b (valeur d'enum `instructor`), TEST puis PROD.

DROP POLICY IF EXISTS "anon_read_booking_participants" ON booking_participants;
CREATE POLICY "anon_read_booking_participants" ON booking_participants
  FOR SELECT TO anon USING (
    (share_type() = 'client' AND booking_id = share_booking_id())
    OR share_type() = 'forecast'
    OR (share_type() = 'instructor' AND id IN (
          SELECT unnest(l.participant_ids) FROM lessons l
          WHERE l.instructor_id = share_param('instructor_id')::uuid))
  );

-- VÉRIFICATION — TEST et PROD, curl anon avec un VRAI token `instructor` :
--   curl "$URL/rest/v1/booking_participants?select=id,first_name,last_name" \
--        -H "apikey: $ANON" -H "x-share-token: <token>"
--   → seulement les élèves de CE moniteur ; `select=passport_number` → 42501 ; sans token → [].
