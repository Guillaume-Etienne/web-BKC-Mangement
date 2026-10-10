-- 2026-10-10 (d) — Un plan peut viser un CLIENT existant (walk-in), pas seulement un voyageur d'une résa.
--
-- Un walk-in n'a pas de résa à l'avance : sa « venue » (résa day visitor) n'est créée qu'au
-- moment où le plan part dans Daily. D'ici là le plan retient juste QUI (clients.id).
-- À l'export : même code que le bouton 🚶 du Daily (saveWalkIn) — même client, même jour =
-- même venue, prix = tarif perso ou paliers, rien de compté avant.
--
-- ⚠️ Strictement additif (2 colonnes nullables), aucun enum. Pas de GRANT anon : la page
-- publique Forecast ne lit PAS ces colonnes (le GRANT de 10c est colonne par colonne), donc
-- elle n'expose ni l'identité ni le lien client. À passer TEST puis PROD avant le push.

ALTER TABLE planned_lessons
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

ALTER TABLE planned_rentals
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- Vérification (curl anon, avec un lien Forecast valide) :
--   select=client_id sur planned_lessons → 42501 (permission denied for column)
--   select=id,date                       → des lignes
