-- 2026-11-15b — « Répartition par personne » (décidé avec gui le 15/11)
--
-- 1. Un extra peut être rattaché à UN voyageur de la résa (« pour qui ») : la planche
--    cassée d'un voyageur (#056) va à lui seul. NULL (défaut, et toutes les lignes existantes) =
--    partagé à parts égales entre les voyageurs. ON DELETE SET NULL comme
--    equipment_rentals.participant_id : supprimer un voyageur ne supprime pas l'extra,
--    il redevient partagé. Les voyageurs gardent leur id à l'enregistrement d'une résa
--    (BookingsPage met à jour, ne supprime/recrée pas) → le lien tient.
-- 2. La page client répartit le center access entre les voyageurs « own gear » (comme
--    l'admin) : elle doit pouvoir lire booking_participants.brings_own_gear. Lisible
--    seulement sur les lignes que la policy anon rend déjà (sa résa ; tous pour le token
--    forecast, qui voit déjà les noms) — un booléen « a son matériel », rien de plus.
--
-- Les deux tables sont en GRANT de colonnes pour anon : sans les GRANT ci-dessous, la
-- page client reçoit 42501 sur ces colonnes (et les traite comme « inconnu »).
-- Strictement additive. À passer TEST puis PROD AVANT de pousser le code (l'admin
-- écrit participant_id à chaque insert d'extra).

ALTER TABLE booking_charges
  ADD COLUMN IF NOT EXISTS participant_id uuid NULL
  REFERENCES booking_participants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_booking_charges_participant ON booking_charges(participant_id);

GRANT SELECT (participant_id) ON booking_charges TO anon;
GRANT SELECT (brings_own_gear) ON booking_participants TO anon;

-- Vérif (curl anon) :
--   sans token : booking_charges?select=id,participant_id      → 200 []
--   sans token : booking_participants?select=id,brings_own_gear → 200 []
--   token client : booking_charges?select=id,participant_id     → 200, ses extras
--   toujours interdit : booking_charges?select=notes            → 42501
--   toujours interdit : booking_participants?select=passport_number → 42501
