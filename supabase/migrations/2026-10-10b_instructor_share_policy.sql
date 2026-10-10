-- 2026-10-10 (b) — Un token `instructor` lit SES cours, et seulement les siens.
--
-- ⚠️ À passer APRÈS le (a) (valeur d'enum), TEST puis PROD.
--
-- La page « heures » lit `lessons` (date, duration_hours, type, instructor_id).
-- Les GRANT colonne de 2026-08-18c suffisent déjà : `instructor_rate` (paie) et
-- `price_per_hour` restent révoqués pour anon, la page ne voit donc AUCUN montant.
-- Seule la policy de lignes manque : sans elle un token `instructor` ne voit rien.
-- Le nom du moniteur vient de `instructors` (référentiel, déjà ouvert à tout token
-- valide, colonnes id/first_name/last_name seulement).

DROP POLICY IF EXISTS "anon_read_lessons" ON lessons;
CREATE POLICY "anon_read_lessons" ON lessons FOR SELECT TO anon USING (
  share_type() = 'forecast'
  OR (share_type() = 'client' AND booking_id = share_booking_id())
  OR (share_type() = 'instructor' AND instructor_id = share_param('instructor_id')::uuid)
);

-- ════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION — curl anon avec un VRAI token `instructor` :
--   curl "$URL/rest/v1/lessons?select=date,duration_hours,type,instructor_id" \
--        -H "apikey: $ANON" -H "x-share-token: <token>"
--   → uniquement les cours de CE moniteur
--   …et `?select=instructor_rate` → 42501 (colonne révoquée, c'est voulu)
-- ════════════════════════════════════════════════════════════════════════════
