-- 2026-08-14 (b) — L'avant-réservation : demandes, notes, origines.
--
-- ⚠️ PASSER LE FICHIER (a) D'ABORD (valeur d'enum `enquiry_form`).
--
-- Tout le schéma du chantier Enquiries en une fois, à la demande de gui : il
-- applique le SQL à la main sur deux bases, et six migrations coûtaient douze
-- manipulations. Le code des écrans arrivera ensuite par étapes, par-dessus une
-- base déjà prête — ce qui permet de vérifier chaque étape au navigateur.
-- Conception complète et décisions : .claude/docs/ENQUIRIES.md
--
-- LA RÈGLE QUI TIENT TOUT
-- Une demande ne touche ni l'argent, ni l'occupation : aucune FK vers `rooms`,
-- rien que la compta puisse lire. `computeSeasonTotals` n'exclut que les
-- réservations annulées — modéliser un prospect comme une réservation
-- `provisional` gonflerait le CA de tout ce qui ne viendra jamais.
--
-- CE QUI EST DÉLIBÉRÉMENT ABSENT
--   • Pas de `season_id` : la saison se déduit de `arrival_month` au moment de
--     l'affichage, comme la compta la déduit du check-in. Une saison stockée
--     devient fausse dès qu'on corrige une date.
--   • Pas de `archived_at` : « archivée » = statut `won` ou `lost`. Une deuxième
--     façon de dire la même chose finit toujours par la contredire.
--   • Pas de colonne d'opt-in newsletter : décision gui du 2026-08-14, toute
--     demande part vers Brevo (motifs et garde-fous dans ENQUIRIES.md).

BEGIN;

-- ── 1. Origines : « comment nous avez-vous trouvé ? » ────────────────────────
-- En base et pas dans le code : gui doit pouvoir ajouter « salon nautique de
-- Paris » un matin de février sans attendre un déploiement. Trilingue parce que
-- le formulaire public l'est.
CREATE TABLE IF NOT EXISTS enquiry_sources (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label      JSONB   NOT NULL DEFAULT '{}'::jsonb,  -- { fr, en, es }
  sort_order INT     NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT true,         -- retirée du formulaire, gardée pour les stats
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE enquiry_sources IS
  'Choix de « comment nous avez-vous trouvé ? ». Éditable dans Options → Sources. '
  'Désactiver plutôt que supprimer : les demandes passées y font référence.';

INSERT INTO enquiry_sources (label, sort_order)
SELECT * FROM (VALUES
  ('{"fr":"Recherche Google","en":"Google search","es":"Búsqueda en Google"}'::jsonb, 10),
  ('{"fr":"Instagram","en":"Instagram","es":"Instagram"}'::jsonb,                     20),
  ('{"fr":"Facebook","en":"Facebook","es":"Facebook"}'::jsonb,                        30),
  ('{"fr":"Bouche-à-oreille","en":"Word of mouth","es":"Boca a boca"}'::jsonb,        40),
  ('{"fr":"Déjà venu","en":"Been here before","es":"Ya he estado"}'::jsonb,           50),
  ('{"fr":"Site ou forum de kitesurf","en":"Kitesurf site or forum","es":"Web o foro de kitesurf"}'::jsonb, 60)
) AS seed(label, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM enquiry_sources);   -- rejouable sans doublonner

-- ── 2. Les demandes ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enquiries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Comment la fiche est entrée dans l'app. À ne pas confondre avec `source_id`,
  -- qui est ce que le visiteur répond à « comment nous avez-vous trouvé ? ».
  channel         TEXT NOT NULL DEFAULT 'form' CHECK (channel IN ('form', 'manual')),

  -- Identité. Un seul champ obligatoire : le nom. Une fiche qui exige un email
  -- valide avant d'être enregistrée ne sera pas créée depuis WhatsApp.
  name            TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  language        TEXT NOT NULL DEFAULT 'en',   -- 'fr' | 'en' | 'es'

  -- Ce que le visiteur a écrit de sa plume, tel quel. C'est là que vivent le
  -- nombre de personnes et les dates tant que gui n'a pas qualifié la fiche.
  message         TEXT,

  source_id       UUID REFERENCES enquiry_sources(id) ON DELETE RESTRICT,
  source_other    TEXT,   -- la précision libre quand « Autre » est choisi

  -- Qualification, saisie par gui en lisant le message. Tout est nullable :
  -- une fiche non qualifiée est un état normal, pas une fiche incomplète.
  party_size      INTEGER CHECK (party_size IS NULL OR party_size > 0),
  arrival_month   TEXT CHECK (arrival_month IS NULL OR arrival_month ~ '^\d{4}-\d{2}$'),
  wants_lessons       BOOLEAN NOT NULL DEFAULT false,
  wants_rental        BOOLEAN NOT NULL DEFAULT false,
  wants_accommodation BOOLEAN NOT NULL DEFAULT false,
  -- Budget du GROUPE entier (les gens raisonnent comme ça), jamais demandé sur
  -- le formulaire public.
  budget_eur      NUMERIC(10,2) CHECK (budget_eur IS NULL OR budget_eur >= 0),

  -- TEXT + CHECK plutôt qu'un enum, exprès : ajouter un statut en cours de
  -- saison ne doit pas imposer la danse en deux fichiers des valeurs d'enum.
  status          TEXT NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new', 'talking', 'waiting', 'won', 'lost')),
  lost_reason     TEXT,   -- un mot, seulement quand status = 'lost'

  -- Ce qui alimente la colonne « Silence » : jours depuis le dernier échange.
  -- Mis à jour par l'app quand une note est ajoutée (pas par un trigger : ce
  -- projet garde ses garde-fous visibles dans le code plutôt qu'en base).
  last_contact_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Rattachements, tous facultatifs et tous en SET NULL : supprimer une
  -- réservation ne doit pas effacer l'historique commercial qui y a mené.
  client_id          UUID REFERENCES clients(id)          ON DELETE SET NULL,
  booking_id         UUID REFERENCES bookings(id)         ON DELETE SET NULL,
  form_submission_id UUID REFERENCES form_submissions(id) ON DELETE SET NULL,

  -- Synchro CRM (HubSpot / Brevo). Elle ne bloque jamais l'enregistrement : la
  -- demande existe d'abord. Ces deux colonnes rendent l'échec visible sur la
  -- fiche — une synchro qui rate en silence est un client perdu sans le savoir.
  crm_synced_at   TIMESTAMPTZ,
  crm_error       TEXT
);

COMMENT ON TABLE enquiries IS
  'Avant-réservation : une personne qui a écrit mais n''a rien réservé. '
  'Ne touche ni le planning ni la compta — voir .claude/docs/ENQUIRIES.md.';

-- ── 3. Les notes : le fil de la conversation ────────────────────────────────
-- Une table et pas un jsonb : on cherche par mot-clé dedans, et on ajoute une
-- ligne sans réécrire tout l'historique.
CREATE TABLE IF NOT EXISTS enquiry_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id  UUID NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  body        TEXT NOT NULL
);

-- ── 4. Index ────────────────────────────────────────────────────────────────
-- Volume attendu : des dizaines par saison. La recherche par mot-clé se fera en
-- ILIKE côté app — un index plein texte serait de l'ornement à cette échelle.
CREATE INDEX IF NOT EXISTS idx_enquiries_status        ON enquiries(status);
CREATE INDEX IF NOT EXISTS idx_enquiries_arrival_month ON enquiries(arrival_month);
CREATE INDEX IF NOT EXISTS idx_enquiry_notes_enquiry   ON enquiry_notes(enquiry_id);

-- ── 5. RLS et droits ────────────────────────────────────────────────────────
ALTER TABLE enquiry_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE enquiries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE enquiry_notes   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all" ON enquiry_sources;
DROP POLICY IF EXISTS "admin_all" ON enquiries;
DROP POLICY IF EXISTS "admin_all" ON enquiry_notes;
CREATE POLICY "admin_all" ON enquiry_sources FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON enquiries       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON enquiry_notes   FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Origines : lisibles par un porteur de lien valide, et seulement les actives.
-- Une origine retirée reste en base pour les statistiques, pas sur le formulaire.
DROP POLICY IF EXISTS "anon_read_enquiry_sources" ON enquiry_sources;
CREATE POLICY "anon_read_enquiry_sources" ON enquiry_sources
  FOR SELECT TO anon USING (share_type() IS NOT NULL AND is_active);

-- REVOKE de table AVANT les GRANT de colonnes : sans ça les GRANT ne
-- restreignent rien (piège vécu sur `room_rates`, `select=notes` répondait []).
REVOKE ALL ON enquiry_sources FROM anon;
GRANT  SELECT (id, label, sort_order, is_active) ON enquiry_sources TO anon;

-- Demandes : le formulaire public ÉCRIT, il ne relit jamais rien. Aucune policy
-- SELECT pour anon ⇒ RLS refuse par défaut, même si un GRANT traînait.
-- Le WITH CHECK verrouille les deux champs qui ne doivent pas venir du dehors :
-- personne ne s'auto-déclare « gagnée », ni ne se fait passer pour une saisie
-- manuelle. Le reste est borné par les colonnes accordées ci-dessous.
DROP POLICY IF EXISTS "anon_insert_enquiries" ON enquiries;
CREATE POLICY "anon_insert_enquiries" ON enquiries
  FOR INSERT TO anon
  WITH CHECK (status = 'new' AND channel = 'form');

REVOKE ALL ON enquiries FROM anon;
GRANT  INSERT (name, email, phone, language, message, source_id, source_other)
  ON enquiries TO anon;
-- Volontairement hors de cette liste : party_size, arrival_month, budget_eur,
-- les trois `wants_*`, les rattachements et les colonnes de synchro. Ce sont des
-- champs de qualification : ils appartiennent à gui, pas au visiteur.

-- Notes : strictement admin. Elles contiennent ce que gui pense d'un client.
REVOKE ALL ON enquiry_notes FROM anon;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS — sur TEST **et** PROD, par curl anon direct.
--
--   URL=https://<projet>.supabase.co ; ANON=<clé anon>   (client/.env.local)
--
-- 1) Les tables existent, colonnes accordées côté origines :
--    curl "$URL/rest/v1/enquiry_sources?select=id,label" -H "apikey: $ANON"
--    → 200 — et `[]` sans x-share-token : c'est RLS, PAS une table vide.
--      ⚠️ Les 6 origines semées ne se voient que connecté ou avec un token.
--
-- 2) Contrôle négatif (sans lui, un [] ne prouve rien) :
--    curl "$URL/rest/v1/enquiry_sources?select=colonne_bidon" -H "apikey: $ANON"
--    → 42703 « column does not exist »
--
-- 3) Les demandes ne se lisent pas de l'extérieur :
--    curl "$URL/rest/v1/enquiries?select=name" -H "apikey: $ANON"
--    → 42501 (aucun SELECT accordé à anon)
--    curl "$URL/rest/v1/enquiries?select=budget_eur" ... → 42501 aussi
--
-- 4) Les notes non plus :
--    curl "$URL/rest/v1/enquiry_notes?select=body" -H "apikey: $ANON" → 42501
--
-- 5) ⚠️ CONNECTÉ (SQL editor) — le semis a eu lieu et les défauts tiennent :
--    SELECT count(*) FROM enquiry_sources;                        → 6
--    INSERT INTO enquiries (name) VALUES ('test');                → OK
--    SELECT status, channel, last_contact_at IS NOT NULL FROM enquiries; → new, form, true
--    DELETE FROM enquiries WHERE name = 'test';
--
-- 6) ⚠️ CONNECTÉ — une origine utilisée ne peut pas être supprimée (ON DELETE
--    RESTRICT), c'est ce qui protège les statistiques passées :
--    INSERT INTO enquiries (name, source_id) VALUES ('test2', (SELECT id FROM enquiry_sources LIMIT 1));
--    DELETE FROM enquiry_sources WHERE id = (SELECT source_id FROM enquiries WHERE name='test2');
--    → 23503 violation de contrainte de clé étrangère  ✅ attendu
--    DELETE FROM enquiries WHERE name = 'test2';
-- ════════════════════════════════════════════════════════════════════════════
