-- 2026-10-10 (c) — Le Forecast devient un PLAN (brouillon d'organisation), séparé de Daily.
--
-- Avant : l'onglet Forecast écrivait directement dans `lessons` / `equipment_rentals`,
-- c'est-à-dire dans la table qui sert à la compta, à la paie et à la facturation. Un cours
-- « placé pour s'organiser » comptait donc comme un cours donné.
-- Après : le Forecast lit et écrit ces deux tables-ci, que RIEN ne compte. Daily
-- (`lessons`, `equipment_rentals`) reste la vérité chiffrée de ce qui a eu lieu ;
-- « Exporter vers Daily » copie un plan dans les vraies tables, prix et paie gelés à ce
-- moment-là, et marque la ligne du plan `exported_at`.
--
-- ⚠️ Strictement additif : deux tables neuves + une policy élargie. Aucun enum ajouté,
-- donc UN seul fichier (pas de piège 55P04). À passer sur TEST puis PROD, AVANT le push :
-- sans elle l'onglet Forecast affiche une alerte de lecture et ne peut rien enregistrer.

-- ── Cours prévus ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS planned_lessons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE NOT NULL,
  start_time      TEXT NOT NULL,                       -- HH:MM
  duration_hours  NUMERIC(4,2) NOT NULL DEFAULT 1,
  type            lesson_type NOT NULL,
  instructor_id   UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  participant_ids UUID[] NOT NULL DEFAULT '{}',        -- booking_participants.id[]
  -- Déduit du 1er participant à l'enregistrement. Nullable : un plan peut être posé
  -- avant de savoir pour qui (« un privé à 9 h »).
  booking_id      UUID REFERENCES bookings(id) ON DELETE SET NULL,
  notes           TEXT,
  exported_at     TIMESTAMPTZ,                         -- non NULL = déjà copié dans Daily
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_planned_lessons_date ON planned_lessons(date);

-- ── Locations prévues ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS planned_rentals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE NOT NULL,
  slot            rental_slot NOT NULL,
  rental_type     TEXT NOT NULL,                       -- kite | board | full | surfboard | foilboard | free
  equipment_id    UUID REFERENCES equipment(id) ON DELETE SET NULL,   -- optionnel : « n'importe quel kite »
  participant_id  UUID REFERENCES booking_participants(id) ON DELETE SET NULL,
  booking_id      UUID REFERENCES bookings(id) ON DELETE SET NULL,
  notes           TEXT,
  exported_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_planned_rentals_date ON planned_rentals(date);

-- ── RLS : admin partout, anon = lecture colonne par colonne, token `forecast` seul ──
ALTER TABLE planned_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE planned_rentals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON planned_lessons FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON planned_rentals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Supabase accorde par défaut tous les privilèges à anon sur une table neuve : on
-- repart de zéro, puis on n'ouvre que ce que la page publique « Forecast » affiche.
REVOKE ALL ON planned_lessons, planned_rentals FROM anon;
GRANT SELECT (id, date, start_time, duration_hours, type, instructor_id, participant_ids, notes)
  ON planned_lessons TO anon;
GRANT SELECT (id, date, slot, rental_type, equipment_id, participant_id, notes)
  ON planned_rentals TO anon;

CREATE POLICY "anon_read_planned_lessons" ON planned_lessons
  FOR SELECT TO anon USING (share_type() = 'forecast');
CREATE POLICY "anon_read_planned_rentals" ON planned_rentals
  FOR SELECT TO anon USING (share_type() = 'forecast');

-- La page publique affichait des noms qu'elle cherchait dans `clients` avec des ids de
-- PARTICIPANTS : elle les montrait vides. Elle lit maintenant les voyageurs, dont anon
-- ne reçoit que (id, booking_id, first_name, last_name) — le GRANT colonne de 2026-07 est
-- inchangé. Même population de noms qu'avant : le token forecast voyait déjà `clients`.
DROP POLICY IF EXISTS "anon_read_booking_participants" ON booking_participants;
CREATE POLICY "anon_read_booking_participants" ON booking_participants
  FOR SELECT TO anon USING (
    (share_type() = 'client' AND booking_id = share_booking_id())
    OR share_type() = 'forecast'
  );

-- ════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION — TEST **et** PROD, par curl anon :
--   # sans token : rien (RLS), mais PAS d'erreur 42501/42P01
--   curl "$URL/rest/v1/planned_lessons?select=id" -H "apikey: $ANON"            → 200 []
--   # colonne non accordée → refusée
--   curl "$URL/rest/v1/planned_lessons?select=booking_id" -H "apikey: $ANON"    → 42501
--   # avec le token d'un lien `forecast` : les lignes du plan
--   curl "$URL/rest/v1/planned_lessons?select=id,date" -H "apikey: $ANON" -H "x-share-token: <token>"
--   # `lessons` et `equipment_rentals` ne changent pas
-- ════════════════════════════════════════════════════════════════════════════
