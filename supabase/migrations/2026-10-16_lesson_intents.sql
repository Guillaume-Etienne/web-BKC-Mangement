-- 2026-10-16 — « Outlook » : les INTENTIONS de cours / locations, à long terme.
--
-- Le Forecast (planned_lessons / planned_rentals) place des cours À L'HEURE, la veille. L'Outlook
-- prévoit plus tôt et plus gros : « ce participant fera ~6 h de wing avec Léo entre le 20 et le
-- 25 ». Une ligne par participant et par nature (kite | wing | rental). Rien n'est compté ici :
-- ni compta, ni paie, ni prix. Les heures FAITES ne sont pas stockées, elles se lisent dans
-- `lessons` (Daily).
--
-- `prepaid_hours` est SAISI (jamais déduit d'un libellé de forfait) ; NULL = « non renseigné ».
-- Les lignes sont créées à la première édition ; tant qu'elles n'existent pas, l'écran les
-- déduit des cases du participant (wants_kite_lessons / wants_wing_lessons / wants_kite_rental)
-- — aucun trigger, donc rien qui puisse bloquer un INSERT sur booking_participants.
--
-- ⚠️ Strictement additif : une table neuve, AUCUN enum (kind = TEXT + CHECK), un seul fichier.
-- Admin seulement : anon n'a AUCUN accès. Les accès moniteur (« ma vue », charge globale) font
-- l'objet de migrations séparées, étapes 2 et 3.

CREATE TABLE IF NOT EXISTS lesson_intents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  participant_id  UUID NOT NULL REFERENCES booking_participants(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('kite', 'wing', 'rental')),
  instructor_id   UUID REFERENCES instructors(id) ON DELETE SET NULL,  -- NULL = non assigné
  planned_hours   NUMERIC(5,2) CHECK (planned_hours >= 0),             -- cours seulement
  prepaid_hours   NUMERIC(5,2) CHECK (prepaid_hours >= 0),             -- cours seulement, saisi
  rental_type     TEXT,                                                -- rental seulement (comme planned_rentals)
  estimated_days  INTEGER CHECK (estimated_days >= 0),                 -- rental seulement
  window_start    DATE,                                                -- NULL = dates de la résa
  window_end      DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  CHECK (kind = 'rental' OR (rental_type IS NULL AND estimated_days IS NULL)),
  CHECK (kind <> 'rental' OR (planned_hours IS NULL AND prepaid_hours IS NULL AND instructor_id IS NULL)),
  CHECK (window_end IS NULL OR window_start IS NULL OR window_end >= window_start)
);

-- Une ligne par participant et par nature ; plusieurs locations possibles si le type diffère.
CREATE UNIQUE INDEX IF NOT EXISTS uq_lesson_intents_slot
  ON lesson_intents (participant_id, kind, COALESCE(rental_type, ''));
CREATE INDEX IF NOT EXISTS idx_lesson_intents_booking    ON lesson_intents (booking_id);
CREATE INDEX IF NOT EXISTS idx_lesson_intents_instructor ON lesson_intents (instructor_id);

ALTER TABLE lesson_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON lesson_intents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Supabase accorde par défaut tous les privilèges à anon sur une table neuve : on les retire.
REVOKE ALL ON lesson_intents FROM anon;

-- ════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION — TEST **et** PROD, par curl anon (clés dans client/.env.local) :
--   curl "$URL/rest/v1/lesson_intents?select=id" -H "apikey: $ANON"
--     → 42501 « permission denied » (REVOKE ALL) — c'est le résultat ATTENDU ici, la table
--       n'est pas du tout exposée. Surtout PAS un 200 avec des lignes.
--   curl "$URL/rest/v1/lesson_intents?select=id" -H "apikey: $ANON" -H "x-share-token: <n'importe lequel>"
--     → 42501 aussi.
-- ════════════════════════════════════════════════════════════════════════════
