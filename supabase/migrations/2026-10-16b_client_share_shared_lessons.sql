-- 2026-10-16 (b) — Lien client : voir aussi les cours de GROUPE partagés avec une autre résa.
--
-- Un cours de groupe appartient à UNE résa (lessons.booking_id) mais ses riders peuvent venir de
-- plusieurs (cas #051 / #052). Côté compta, chaque tête est due par la résa de son participant
-- (utils.ts : lessonHeadsFor). Le lien public du client doit suivre : il lit désormais aussi les
-- cours de groupe où l'un des participants de SA résa figure dans participant_ids.
--
-- Ce qui est exposé en plus : la ligne du cours (date, heure, durée, moniteur, prix rédigé
-- `share_price_per_hour`) et son participant_ids (des UUID sans signification) + le booking_id de
-- la résa propriétaire (UUID). AUCUN nom, passeport ni note des riders de l'autre résa :
-- booking_participants n'est PAS élargi. Les colonnes de paie restent révoquées (inchangé).
--
-- Le périmètre passe par une fonction SECURITY DEFINER (comme share_walkin_booking_ids) : une
-- sous-requête dans la policy devrait relire booking_participants avec les privilèges d'anon.
-- Strictement additif : les 4 clauses existantes de la policy sont recopiées telles quelles
-- (état de 2026-10-10f). Sans cette migration, la page affiche seulement les cours possédés.
-- À passer en TEST puis en PROD.

CREATE OR REPLACE FUNCTION share_client_participant_ids() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT bp.id FROM booking_participants bp
   WHERE share_type() = 'client'
     AND bp.booking_id = share_booking_id();
$$;
REVOKE EXECUTE ON FUNCTION share_client_participant_ids() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION share_client_participant_ids() TO anon, authenticated;

DROP POLICY IF EXISTS "anon_read_lessons" ON lessons;
CREATE POLICY "anon_read_lessons" ON lessons FOR SELECT TO anon USING (
  share_type() = 'forecast'
  OR (share_type() = 'client' AND booking_id = share_booking_id())
  OR (share_type() = 'client' AND type = 'group'
      AND participant_ids && ARRAY(SELECT share_client_participant_ids()))
  OR (share_type() = 'instructor' AND instructor_id = share_param('instructor_id')::uuid)
  OR (share_type() = 'walkin' AND booking_id IN (SELECT share_walkin_booking_ids()))
);

-- ── Vérification (curl anon, header x-share-token, VRAIS tokens client) ──────
--  token client de #052 (Tit) :
--    lessons?select=id,booking_id,type,participant_ids   → le cours du 15/10 (booking_id = celui de #051)
--    lessons?select=instructor_rate                      → 42501 (colonne fermée, inchangé)
--    booking_participants?select=first_name              → uniquement les riders de #052
--  token client de #051 (Andy) : lessons → ce même cours (il l'était déjà).
--  token client d'une résa sans lien avec ce cours : lessons → ses propres cours seulement.
--  sans token : tout → [].
