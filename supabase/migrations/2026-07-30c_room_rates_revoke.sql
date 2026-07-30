-- ═══════════════════════════════════════════════════════════════════════════════
-- 2026-07-30 (c) — Correctif : retirer le GRANT de table sur room_rates
--
-- Trouvé en vérifiant (b) par curl sur TEST : `room_rates?select=notes` avec un
-- token client répondait `[]` au lieu de 42501. Autrement dit anon avait toujours
-- le SELECT de TABLE (Supabase le pose par défaut sur tout le schéma public), et
-- mes GRANT de colonnes ne restreignaient donc rien du tout : `notes` — des
-- commentaires internes sur les tarifs — serait devenu lisible dès qu'une ligne
-- passe la policy. Aucune fuite constatée : sur TEST aucune chambre n'a de tarif,
-- donc la policy ne rendait aucune ligne.
--
-- C'est exactement le gabarit du Lot C (REVOKE puis GRANT colonnes) : je l'avais
-- appliqué aux 4 tables de ce lot-là et oublié ici.
--
-- Déjà inclus dans (b) pour les bases où il n'a pas encore été passé — ce fichier
-- ne sert qu'à rattraper une base où (b) est DÉJÀ appliqué. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

REVOKE SELECT ON room_rates FROM anon;
GRANT  SELECT (room_id, price_per_night) ON room_rates TO anon;

COMMIT;

-- Vérification (curl anon, avec un token client valide) :
--   .../room_rates?select=notes                → 42501 (et non [])
--   .../room_rates?select=room_id,price_per_night → les chambres du booking, ou []
--     s'il n'a aucun tarif de base configuré.
