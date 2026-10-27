-- 2026-10-27b — matériel (modèle) lisible sur la page partagée du client
--
-- La page client affiche le matériel entre parenthèses sur chaque cours et chaque
-- location : « Private (Duotone Rebel 9m) », « Kite + bar + board (… + …) ».
-- Il faut donc que anon lise 3 colonnes d'identifiants (aucune donnée sensible :
-- ce sont des UUID vers `equipment`, dont anon ne lit déjà que id/name/brand/size/…).
--
-- Sans cette migration la page marche quand même : ces lectures ont leur propre
-- requête côté client, une erreur 42501 veut seulement dire « pas de matériel ».
--
-- À passer sur TEST puis PROD. Vérif (curl anon, avec un x-share-token valide) :
--   /rest/v1/lessons?select=id,kite_id,board_id            → 200
--   /rest/v1/equipment_rentals?select=id,board_equipment_id → 200
--   /rest/v1/lessons?select=instructor_rate                 → 42501 (inchangé)

GRANT SELECT (kite_id, board_id) ON lessons TO anon;
GRANT SELECT (board_equipment_id) ON equipment_rentals TO anon;
