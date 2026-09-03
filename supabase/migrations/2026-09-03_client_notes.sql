-- 2026-09-03 — Le dossier client : un seul endroit où écrire.
--
-- Le problème, dans les mots de gui : « ne plus savoir qui veut quoi quand le
-- temps passe, et devoir chercher l'info dans plusieurs pages, si j'ai eu la
-- bonne idée de la noter ». Une note pouvait s'écrire dans `clients.notes` (un
-- bloc unique qu'on écrase), `bookings.notes` (idem, et partagé avec du texte
-- généré par la machine), `booking_participants.notes` (affiché nulle part) ou
-- `enquiry_notes` (daté, mais réservé à l'avant-réservation). Cinq endroits,
-- aucun ordre chronologique, et rien qui suive la personne d'une saison à
-- l'autre.
--
-- Cette table est l'endroit où l'on écrit sur QUELQU'UN, par opposition à
-- `enquiry_notes` qui parle d'une CONVERSATION en cours. Les deux se lisent
-- ensemble dans la frise du dossier client (utils/dossier.ts) : le lecteur voit
-- un seul fil, l'écriture va là où on se trouve.
--
-- CE QUI EST DÉLIBÉRÉMENT ABSENT
--   • Pas de `booking_id` : une note appartient à la personne, pas au séjour.
--     La rattacher à une réservation la ferait disparaître de la vue d'ensemble
--     dès la saison suivante — exactement le défaut qu'on répare.
--   • Pas d'auteur : deux comptes admin, tous deux gui ou son associé. Une
--     colonne `author` serait toujours la même valeur.
--   • Pas de suppression douce (`deleted_at`) : une note effacée l'est vraiment.
--     Une corbeille invisible est une deuxième vérité à surveiller.
--   • ⚠️ `enquiry_notes` n'est PAS migrée ici. La fusion des deux tables est un
--     chantier à part (elle touche l'écran de qualification, qui doit rester
--     expédiable en vingt secondes) ; en attendant, rien n'est copié et donc
--     rien ne peut diverger.
--
-- Idempotente : peut être repassée sans dommage. À appliquer sur TEST **et**
-- PROD (une seule tâche, cf. feedback gui).

BEGIN;

CREATE TABLE IF NOT EXISTS client_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  body        TEXT NOT NULL
);

-- Le seul accès qui existe : « toutes les notes de cette personne ».
CREATE INDEX IF NOT EXISTS idx_client_notes_client ON client_notes(client_id, created_at DESC);

ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all" ON client_notes;
CREATE POLICY "admin_all" ON client_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Strictement admin, comme `enquiry_notes` : ces lignes contiennent ce que gui
-- pense d'un client. Aucune page partagée ne doit pouvoir les atteindre, et
-- l'absence de policy anon suffirait — le REVOKE ferme la porte deux fois.
REVOKE ALL ON client_notes FROM anon;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION (à passer après, sur chaque base)
--
--   -- 1. La table existe et n'accepte pas d'orphelin :
--   INSERT INTO client_notes (client_id, body)
--     VALUES ('00000000-0000-0000-0000-000000000000', 'test');
--   -- attendu : ERROR 23503 (violation de clé étrangère)
--
--   -- 2. anon ne voit rien, même avec un jeton de partage valide :
--   curl "$SUPABASE_URL/rest/v1/client_notes?select=body" \
--        -H "apikey: $ANON_KEY" -H "x-share-token: <un jeton valide>"
--   -- attendu : [] ou une erreur de permission — jamais une note.
-- ════════════════════════════════════════════════════════════════════════════
