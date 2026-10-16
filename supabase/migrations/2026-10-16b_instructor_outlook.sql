-- 2026-10-16 (b) — Outlook, étape 2 : « ma vue » du moniteur (lecture seule, lien perso).
-- Nécessite 2026-10-16_lesson_intents.sql (table) et 2026-10-10a/b (token `instructor`).
--
-- Un token `instructor` lit, dans `lesson_intents`, UNIQUEMENT les lignes de cours (kite/wing)
-- qui lui sont assignées. Jamais les locations, jamais `notes` (interne), jamais les lignes
-- d'un autre moniteur, jamais les non-assignées. Aucune écriture (anon n'a que SELECT).
--
-- Trois choses, toutes strictement additives :
--   1. GRANT colonne + policy de lignes sur lesson_intents.
--   2. Les NOMS de ses élèves : la policy booking_participants du token `instructor` couvre
--      aussi les participants de SES intentions (avant : seulement ceux de ses cours donnés).
--      GRANT colonne inchangé : anon ne reçoit toujours que id, booking_id, first_name, last_name.
--   3. Les DATES du séjour (pour une fenêtre laissée vide = « dates de la résa »). On n'ouvre
--      PAS `bookings` à ce token : la table porte `center_access_rate` (un prix) et `client_id`,
--      et un GRANT colonne est par rôle, pas par type de token. À la place, une fonction
--      SECURITY DEFINER qui ne rend que (booking_id, check_in, check_out), et seulement pour
--      les résas où CE moniteur a une intention de cours — même schéma que
--      share_walkin_booking_ids() (2026-10-10f).
--   + `lessons.discipline` devient lisible par anon (valeur 'kite' | 'wing' | 'wing_discovery',
--     aucune donnée sensible) : sans elle la page ne peut pas répartir les heures FAITES entre
--     kite et wing. La policy de lignes de `lessons` est inchangée (ses cours seulement).

-- ── 1. lesson_intents ────────────────────────────────────────────────────────
GRANT SELECT (id, booking_id, participant_id, kind, instructor_id,
              planned_hours, prepaid_hours, window_start, window_end)
  ON lesson_intents TO anon;

DROP POLICY IF EXISTS "anon_read_lesson_intents" ON lesson_intents;
CREATE POLICY "anon_read_lesson_intents" ON lesson_intents FOR SELECT TO anon USING (
  share_type() = 'instructor'
  AND instructor_id = share_param('instructor_id')::uuid
  AND kind IN ('kite', 'wing')
);

-- ── 2. Noms des élèves : ses cours donnés OU ses intentions ──────────────────
DROP POLICY IF EXISTS "anon_read_booking_participants" ON booking_participants;
CREATE POLICY "anon_read_booking_participants" ON booking_participants
  FOR SELECT TO anon USING (
    (share_type() = 'client' AND booking_id = share_booking_id())
    OR share_type() = 'forecast'
    OR (share_type() = 'instructor' AND (
          id IN (SELECT unnest(l.participant_ids) FROM lessons l
                 WHERE l.instructor_id = share_param('instructor_id')::uuid)
          OR id IN (SELECT i.participant_id FROM lesson_intents i
                    WHERE i.instructor_id = share_param('instructor_id')::uuid
                      AND i.kind IN ('kite', 'wing'))))
  );

-- ── 3. Dates des séjours concernés, et rien d'autre ──────────────────────────
CREATE OR REPLACE FUNCTION instructor_outlook_bookings()
RETURNS TABLE (booking_id uuid, check_in date, check_out date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id, b.check_in, b.check_out FROM bookings b
   WHERE (share_ctx()).type = 'instructor'
     AND b.status <> 'cancelled'
     AND b.kind = 'stay'
     AND b.check_out >= current_date
     AND EXISTS (
       SELECT 1 FROM lesson_intents i
        WHERE i.booking_id = b.id
          AND i.kind IN ('kite', 'wing')
          AND i.instructor_id = ((share_ctx()).params->>'instructor_id')::uuid);
$$;
REVOKE EXECUTE ON FUNCTION instructor_outlook_bookings() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION instructor_outlook_bookings() TO anon, authenticated;

-- ── 4. Discipline des cours (kite / wing) ────────────────────────────────────
GRANT SELECT (discipline) ON lessons TO anon;

-- ════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION — TEST **et** PROD, par curl anon, avec un VRAI token `instructor`
-- (Options → Shared Links ; aucun lien instructor en PROD le 2026-10-11, à créer) :
--   H='-H "apikey: $ANON" -H "x-share-token: <token>"'
--   lesson_intents?select=id,kind,planned_hours,prepaid_hours,instructor_id
--       → seulement SES lignes kite/wing (donner d'abord une intention à ce moniteur, côté admin)
--   lesson_intents?select=notes            → 42501 (colonne fermée)
--   lesson_intents?select=rental_type      → 42501
--   rpc/instructor_outlook_bookings        → seulement les séjours où il a une intention
--   booking_participants?select=id,first_name,last_name → ses élèves (cours + intentions)
--   booking_participants?select=passport_number         → 42501
--   bookings?select=id                     → [] (inchangé : ce token ne lit pas `bookings`)
--   lessons?select=id,discipline           → ses cours ; lessons?select=instructor_rate → 42501
-- Avec le token d'UN AUTRE moniteur : jamais les lignes du premier. SANS token : tout → [].
-- ════════════════════════════════════════════════════════════════════════════
