-- 2026-08-14 — Origines des demandes (« comment nous avez-vous trouvé ? »)
--
-- Étape 0 du chantier Enquiries (conception : .claude/docs/ENQUIRIES.md).
-- La question existe déjà sur le formulaire du site, en texte libre. Décision gui
-- du 2026-08-14 : elle devient une **liste déroulante qu'il alimente lui-même**,
-- parce que sa raison d'être est la statistique de fin de saison.
--
-- POURQUOI UNE TABLE, ET PAS UNE CONSTANTE DANS LE CODE
-- Une liste en dur se modifie par un déploiement. gui doit pouvoir ajouter
-- « salon nautique de Paris » un matin de février sans passer par moi.
--
-- TROIS LIBELLÉS PAR LIGNE
-- La liste s'affiche sur le formulaire public, qui est en FR/EN/ES. Même gabarit
-- que `document_templates` : un jsonb `{fr, en, es}`.
--
-- ⚠️ ON DÉSACTIVE, ON NE SUPPRIME PAS
-- Une demande garde l'origine choisie. Effacer la ligne casserait les statistiques
-- des saisons passées — même raison que les tarifs verrouillés d'Options → Pricing.
-- D'où `is_active` et une FK `ON DELETE RESTRICT` posée plus tard, quand la table
-- des demandes existera : la base refusera la suppression d'une origine utilisée.
--
-- ⚠️ « AUTRE » N'EST PAS UNE LIGNE D'ICI
-- Le formulaire l'ajoute toujours, avec une précision libre. En faire une ligne
-- éditable permettrait de la supprimer, et quelqu'un venu par un ami serait alors
-- poussé dans une case fausse : la statistique paraîtrait nette et mentirait.

BEGIN;

CREATE TABLE IF NOT EXISTS enquiry_sources (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label      JSONB   NOT NULL DEFAULT '{}'::jsonb,  -- { fr, en, es }
  sort_order INT     NOT NULL DEFAULT 0,            -- l'ordre dans la liste déroulante
  is_active  BOOLEAN NOT NULL DEFAULT true,         -- masquée du formulaire, gardée pour les stats
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE enquiry_sources IS
  'Choix de « comment nous avez-vous trouvé ? » sur le formulaire public. '
  'Éditable dans Options → Sources. Désactiver plutôt que supprimer : les demandes '
  'passées y font référence et les statistiques d''origine en dépendent.';

-- ── Semis : de quoi que la liste ne soit jamais vide au premier affichage ────
INSERT INTO enquiry_sources (label, sort_order)
SELECT * FROM (VALUES
  ('{"fr":"Recherche Google","en":"Google search","es":"Búsqueda en Google"}'::jsonb, 10),
  ('{"fr":"Instagram","en":"Instagram","es":"Instagram"}'::jsonb,                     20),
  ('{"fr":"Facebook","en":"Facebook","es":"Facebook"}'::jsonb,                        30),
  ('{"fr":"Bouche-à-oreille","en":"Word of mouth","es":"Boca a boca"}'::jsonb,        40),
  ('{"fr":"Déjà venu","en":"Been here before","es":"Ya he estado"}'::jsonb,           50),
  ('{"fr":"Site de kitesurf / forum","en":"Kitesurf site or forum","es":"Web o foro de kitesurf"}'::jsonb, 60)
) AS seed(label, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM enquiry_sources);   -- rejouable sans doublonner

-- ── Lecture anon ────────────────────────────────────────────────────────────
-- Le formulaire public est servi par un lien partagé : il lui faut la liste.
-- Rien de sensible ici (des libellés), mais on garde le rituel du Lot C — REVOKE
-- de table AVANT les GRANT de colonnes, sinon les GRANT ne restreignent rien
-- (piège vécu sur `room_rates` : `select=notes` répondait [] au lieu de 42501).
ALTER TABLE enquiry_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_enquiry_sources" ON enquiry_sources;
CREATE POLICY "anon_read_enquiry_sources" ON enquiry_sources
  FOR SELECT TO anon USING (share_type() IS NOT NULL AND is_active);

DROP POLICY IF EXISTS "admin_all_enquiry_sources" ON enquiry_sources;
CREATE POLICY "admin_all_enquiry_sources" ON enquiry_sources
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

REVOKE SELECT ON enquiry_sources FROM anon;
GRANT  SELECT (id, label, sort_order, is_active) ON enquiry_sources TO anon;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS — sur TEST **et** PROD, par curl anon direct.
--
--   URL=https://<projet>.supabase.co ; ANON=<clé anon>   (client/.env.local)
--
-- 1) La table existe et les colonnes sont accordées :
--    curl "$URL/rest/v1/enquiry_sources?select=id,label" -H "apikey: $ANON"
--    → 200 (et `[]` sans x-share-token : c'est RLS, PAS une table vide —
--      les 6 lignes semées ne sont visibles qu'avec un token valide ou connecté)
--
-- 2) Contrôle négatif, sans lui un [] ne prouverait rien :
--    curl "$URL/rest/v1/enquiry_sources?select=colonne_bidon" -H "apikey: $ANON"
--    → 42703 « column does not exist »
--
-- 3) Écriture anon refusée :
--    curl -X POST "$URL/rest/v1/enquiry_sources" -H "apikey: $ANON" \
--         -H "Content-Type: application/json" -d '{"label":{"fr":"x"}}'
--    → 42501 (aucun GRANT INSERT n'a été donné)
--
-- 4) ⚠️ CONNECTÉ (SQL editor) — le semis a bien eu lieu :
--    SELECT count(*), min(sort_order), max(sort_order) FROM enquiry_sources;
--    → 6 lignes, 10 → 60
-- ════════════════════════════════════════════════════════════════════════════
