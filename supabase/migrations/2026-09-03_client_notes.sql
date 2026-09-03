-- 2026-09-03 — Le dossier client : un seul endroit où écrire,
--              + l'origine d'une réservation, pour que la statistique existe.
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


-- ── 2. L'origine d'une réservation ──────────────────────────────────────────
-- « Sa raison d'être, c'est la statistique » (gui, à propos de la liste des
-- sources). L'écran qui la lit existe enfin (Requests → Archive → « Where they
-- came from ») et il a immédiatement montré le trou : sur les 8 clients de la
-- base, **5 étaient « Unknown »** — parce qu'une résa saisie à la main dans le
-- wizard ne se voyait jamais poser la question. La colonne la range là où elle
-- se compte, en pointant la MÊME liste que le formulaire public : sans elle, un
-- « Instagram » tapé dans le wizard et un « Instagram » choisi sur le formulaire
-- feraient deux lignes différentes dans le tableau.
--
-- NULL est un état normal : on ne connaît pas l'origine de tout le monde, et le
-- tableau le dit à voix haute plutôt que de répartir les inconnus au hasard.
--
-- ⚠️ Le code ne casse PAS sans cette colonne : l'app écrit `source_id` par un
-- UPDATE séparé, après coup, et signale simplement « booking saved, but the
-- source was not recorded » si la colonne manque. La réservation existe, le
-- libellé reste dans `bookings.referral_source`. Rien à séquencer.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES enquiry_sources(id);

-- Reprise de l'historique. Deux sources, dans l'ordre où on leur fait confiance :
-- la demande d'où vient la résa (la réponse a été donnée en premier), puis le
-- formulaire de réservation qui l'a créée.
UPDATE bookings b
   SET source_id = e.source_id
  FROM enquiries e
 WHERE e.booking_id = b.id
   AND e.source_id IS NOT NULL
   AND b.source_id IS NULL;

-- Le garde-fou de format n'est pas décoratif : `payload` est un jsonb écrit par
-- un visiteur, et un cast d'une valeur non-UUID ferait échouer toute la
-- migration sur une ligne bancale.
UPDATE bookings b
   SET source_id = (fs.payload->>'referral_source_id')::uuid
  FROM form_submissions fs
 WHERE fs.created_booking_id = b.id
   AND b.source_id IS NULL
   AND fs.payload->>'referral_source_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   AND EXISTS (SELECT 1 FROM enquiry_sources s WHERE s.id = (fs.payload->>'referral_source_id')::uuid);

-- Pas d'index : quelques centaines de réservations, et l'écran qui les compte
-- les charge toutes de toute façon. Ce serait de l'ornement, même argument que
-- pour `enquiry_notes`.

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
--
--   -- 3. La colonne d'origine existe et la reprise a mordu :
--   SELECT s.label->>'en' AS source, count(*)
--     FROM bookings b LEFT JOIN enquiry_sources s ON s.id = b.source_id
--    GROUP BY 1 ORDER BY 2 DESC;
--   -- attendu en PROD : au moins « Fun & Fly » et « Google search » renseignés
--   -- (les résas issues d'une demande qualifiée), le reste en NULL — c'est
--   -- normal, personne n'a jamais posé la question à ces gens-là.
-- ════════════════════════════════════════════════════════════════════════════
