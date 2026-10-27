-- 2026-10-27 — Événements de l'onglet Now (trip Limpopo, barbecues…) : chiffre du jour + coût prestataire.
--
-- Décisions gui (2026-10-27) :
--   • case « compter dans le chiffre du jour » PAR événement (les repas ordinaires ne changent pas) ;
--   • coût facturé par un prestataire, soit au total, soit par personne présente ;
--   • le chiffre du Daily est NET de ce coût ;
--   • la compta propose une dépense (centre, cash) puis la met à jour si le coût change.
--
-- ⚠️ Table SÉPARÉE, admin seulement, et non des colonnes sur `dining_events` : la page client
-- partagée lit `dining_events` avec `select('*')` en anon — un coût prestataire y aurait fuité
-- vers les clients (marge visible). Même raison pour ne rien ajouter à `expenses` : le lien vers
-- la dépense vit ici (`expense_id`).
--
-- Strictement additif : une table neuve, AUCUN enum (cost_mode = TEXT + CHECK), un seul fichier.
-- Pas de ligne = événement non compté, sans coût (comportement actuel).
-- Idempotent. À passer en TEST puis en PROD.

CREATE TABLE IF NOT EXISTS dining_event_costs (
  dining_event_id  UUID PRIMARY KEY REFERENCES dining_events(id) ON DELETE CASCADE,
  count_in_daily   BOOLEAN NOT NULL DEFAULT false,
  cost_mode        TEXT NOT NULL DEFAULT 'total' CHECK (cost_mode IN ('total', 'per_person')),
  cost_amount      NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (cost_amount >= 0),
  -- La dépense créée depuis l'événement ; la dépense survit si on retire le lien.
  expense_id       UUID REFERENCES expenses(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE dining_event_costs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all" ON dining_event_costs;
CREATE POLICY "admin_all" ON dining_event_costs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Supabase accorde par défaut tous les privilèges à anon sur une table neuve : on les retire.
REVOKE ALL ON dining_event_costs FROM anon;

-- ════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION — TEST **et** PROD, par curl anon (clés dans client/.env.local) :
--   curl "$URL/rest/v1/dining_event_costs?select=*" -H "apikey: $ANON"
--     → 42501 « permission denied » (REVOKE ALL) — résultat ATTENDU, surtout pas un 200.
--   idem avec un header x-share-token quelconque → 42501.
--   SQL : SELECT to_regclass('public.dining_event_costs');  → dining_event_costs
-- ════════════════════════════════════════════════════════════════════════════
