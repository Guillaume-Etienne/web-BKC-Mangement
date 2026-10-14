/* ============================================================================
   Migration : materiel par rider dans une lecon de groupe
   Date : 2026-10-14   (apres les deux migrations wing : la categorie
   d'equipement 'wing' vient de 2026-10-14_wing_enum_values.sql)

   A executer en TEST **puis en PROD** dans la foulee. A passer AVANT de pousser
   le code : l'ecran lit cette table, et son absence remonte une erreur dans le
   bandeau de la page (les lecons, elles, continuent de s'afficher).

   Une lecon n'avait qu'un kite et qu'une planche (lessons.kite_id / board_id),
   donc un seul jeu de materiel pour tout un groupe. Une ligne ici = le materiel
   d'UN rider dans UNE lecon. Sans ligne, on retombe sur lessons.kite_id/board_id :
   rien de l'existant ne change. Quand des lignes existent, lessons.kite_id/board_id
   gardent le materiel du premier rider (les ecrans qui ne lisent que ca restent
   coherents).
   ============================================================================ */

CREATE TABLE IF NOT EXISTS lesson_participant_gear (
  lesson_id      UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES booking_participants(id) ON DELETE CASCADE,
  kite_id        UUID REFERENCES equipment(id) ON DELETE SET NULL,  -- kite OU aile (wing)
  board_id       UUID REFERENCES equipment(id) ON DELETE SET NULL,  -- planche / surf / foilboard
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (lesson_id, participant_id)
);

ALTER TABLE lesson_participant_gear ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all" ON lesson_participant_gear;
CREATE POLICY "admin_all" ON lesson_participant_gear FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Interne : aucune page partagee n'en a besoin.
REVOKE ALL ON lesson_participant_gear FROM anon;

/* -- VERIFICATION (apres, sur chaque base) -----------------------------------
   SELECT count(*) FROM lesson_participant_gear;               -- 0
   curl anon nu : "$URL/rest/v1/lesson_participant_gear?select=lesson_id"
     -> 401 / 42501
   ---------------------------------------------------------------------------- */
