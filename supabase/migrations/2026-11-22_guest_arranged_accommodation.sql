-- « Own accommodation » : les clients qui viennent au centre mais logent par
-- leurs propres moyens (maison à eux, Airbnb, autre lodge).
--
-- Pourquoi (gui, 2026-11-22) : faute de mieux, ils étaient rangés dans
-- San Martinho, ce qui faussait les comptes — nuits vendues gonflées (Lama seul :
-- 84 nuits), ligne SM du planning remplie de gens qui n'y sont pas, confirmation
-- qui affiche « Géré par San Martinho ».
--
-- Le modèle de San Martinho convient déjà (pas de prix à la nuit, planning qui
-- ne montre que les emplacements occupés) : on crée un 2ᵉ hébergement du même
-- genre, et un DRAPEAU dit que le logement n'est pas de notre fait. Comme pour
-- `hide_empty_rooms`, un drapeau et jamais un test sur le nom.
--
-- Effets du drapeau (code client) :
--   - nuits vendues : ces nuits sortent du compteur, comptées à part (décision gui) ;
--   - confirmation : la ligne dit « Own accommodation », sans « Géré par… ».

ALTER TABLE accommodations
  ADD COLUMN IF NOT EXISTS guest_arranged BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN accommodations.guest_arranged IS
  'The guest sleeps somewhere of their own (own house, Airbnb, another lodge): not a night we sold. Out of the nights-sold counter (counted apart), shown as "Own accommodation" on the confirmation. Expect external_billing = true too.';

-- L'hébergement lui-même, une seule fois (idempotent sur le drapeau).
-- 4 emplacements : hide_empty_rooms n'en dessine que les occupés + 1 libre.
DO $$
DECLARE acc UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM accommodations WHERE guest_arranged) THEN
    INSERT INTO accommodations (name, type, total_rooms, external_billing, hide_empty_rooms, guest_arranged, is_active)
    VALUES ('Own accommodation', 'other', 4, true, true, true, true)
    RETURNING id INTO acc;
    INSERT INTO rooms (accommodation_id, name, capacity)
    SELECT acc, 'OWN-' || i, 4 FROM generate_series(1, 4) AS i;
  END IF;
END $$;

-- ── Vérifications ────────────────────────────────────────────────────────────
-- 1) SELECT name, external_billing, hide_empty_rooms, guest_arranged,
--           (SELECT count(*) FROM rooms r WHERE r.accommodation_id = a.id) AS spots
--    FROM accommodations a WHERE external_billing ORDER BY name;
--    → San Martinho (guest_arranged false) + Own accommodation (true, 4 spots).
-- 2) anon : `accommodations` est un référentiel lisible par tout token valide,
--    la colonne suit la table — curl anon avec x-share-token → 200.
