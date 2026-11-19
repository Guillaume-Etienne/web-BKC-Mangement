-- 2026-11-19 — Relier une activité du Daily à ses lignes de facture (demande gui)
--
-- Une activité créée dans le Daily avec « Bill to guests » écrit 2 choses : la carte
-- (day_activities) et une ligne activity_bookings par résa concernée. Rien ne les
-- reliait : la carte ne pouvait donc modifier que son nom, son créneau et ses notes.
-- gui veut tout modifier comme à la création (voyageurs, prix, coût) → il faut savoir
-- quelles lignes appartiennent à quelle carte.
--
-- ON DELETE SET NULL : supprimer la carte ne supprime pas ce qui a été facturé (même
-- règle qu'avant : une facture ne disparaît pas sans qu'on le demande).
-- Les lignes saisies ailleurs (page Activities, compta) restent à NULL : elles n'ont
-- pas de carte.
--
-- Rattrapage : une ligne du prestataire « BKC (in-house) » est rattachée à LA carte
-- de même date et de même nom, seulement quand il n'y en a qu'une (au 19/11 : 6 lignes,
-- 6 correspondances uniques).
--
-- Anon : activity_bookings est en GRANT de table entière (cf. 2026-10-08), la colonne
-- est donc lisible comme les autres, sous les mêmes policies de lignes. Rien à accorder.
-- Strictement additive. TEST puis PROD AVANT de pousser le code (le Daily écrit
-- day_activity_id à chaque création).

ALTER TABLE activity_bookings
  ADD COLUMN IF NOT EXISTS day_activity_id uuid NULL
  REFERENCES day_activities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activity_bookings_day_activity ON activity_bookings(day_activity_id);

UPDATE activity_bookings ab
SET day_activity_id = d.id
FROM day_activities d
WHERE ab.day_activity_id IS NULL
  AND ab.provider_id = (SELECT id FROM activity_providers WHERE name = 'BKC (in-house)' LIMIT 1)
  AND d.date = ab.date
  AND d.name = ab.label
  AND (SELECT count(*) FROM day_activities d2 WHERE d2.date = ab.date AND d2.name = ab.label) = 1;

-- Vérif :
--   SELECT count(*) FILTER (WHERE day_activity_id IS NOT NULL), count(*) FROM activity_bookings;
--   curl anon : activity_bookings?select=id,day_activity_id → 200 (lignes selon le token)
