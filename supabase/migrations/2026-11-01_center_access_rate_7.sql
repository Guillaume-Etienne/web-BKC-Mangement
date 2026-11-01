-- 2026-11-01 — Center access : 7 €/jour pour tous les séjours en cours et à venir (décision gui).
-- Le défaut de colonne restait à 5 alors que le tarif (price_items.center_access) est à 7 : les résas
-- créées hors formulaire (conversion d'un formulaire client, MCP) partaient à 5.
-- Séjours terminés (check_out < 2026-11-01), résas annulées et tarifs à 0 (agence) : inchangés.
-- Retour arrière : remettre 5 sur #21 #25 #29 #30 #31 #33 #38 #45 #49 #54 #56 #58 #60 #65 (PROD),
-- et le DEFAULT à 5.

BEGIN;

ALTER TABLE bookings ALTER COLUMN center_access_rate SET DEFAULT 7;

UPDATE bookings
SET center_access_rate = 7
WHERE center_access_rate = 5
  AND check_out >= DATE '2026-11-01'
  AND status <> 'cancelled';

COMMIT;
