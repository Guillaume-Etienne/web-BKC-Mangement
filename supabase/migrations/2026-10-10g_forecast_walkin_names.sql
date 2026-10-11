-- 2026-10-10 (g) — Le Forecast public affiche le NOM d'un walk-in placé dans le plan.
--
-- Depuis 10d un plan peut viser un client (client_id) sans participant. La page publique
-- ne lisait pas cette colonne : la carte d'un walk-in n'affichait que sa note.
-- On ouvre UNIQUEMENT la colonne client_id des deux tables du plan. Aucune fuite nouvelle :
-- un token `forecast` lit déjà clients (id, first_name, last_name) et les noms des voyageurs.
-- Les lignes restent réservées au token `forecast` (policies de 10c, inchangées).
--
-- Additif, un seul fichier, pas d'enum. Sans elle : la page publique marche comme avant
-- (le nom du walk-in n'apparaît pas), rien ne casse — la colonne est lue par une requête à part.

GRANT SELECT (client_id) ON planned_lessons TO anon;
GRANT SELECT (client_id) ON planned_rentals TO anon;

-- Vérification (curl anon, x-share-token d'un lien forecast) :
--   planned_lessons?select=id,client_id → des lignes (plus de 42501)
--   planned_lessons?select=booking_id   → 42501 (toujours fermé)
--   sans token                          → []
