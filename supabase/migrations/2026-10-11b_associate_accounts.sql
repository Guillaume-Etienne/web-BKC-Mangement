-- 2026-10-11b — Comptes des associés (Gui, Teresa).
--
-- Trois mouvements alimentent le compte d'un associé :
--   1. un client paie directement l'associé (« virement à Teresa »)
--        → payments.received_by_associate_id
--   2. un virement entre la trésorerie du centre et l'associé
--        → associate_transfers
--   3. l'associé règle de sa poche une dépense du centre
--        → expenses.paid_by_associate_id
--
-- Solde d'un associé = (1) + virements reçus − virements rendus − (3)
--                    = ce qu'il a réellement sorti de la boîte.
-- Ce sont des prélèvements sur le bénéfice, pas un salaire : ni le chiffre
-- d'affaires, ni les dépenses, ni le résultat net ne changent (décision gui,
-- 2026-10-11). Partage 50/50, tout en euros.
--
-- « associate » et pas « partner » : dans ce schéma « partner » désigne déjà les
-- agences et les hôtels partenaires.
--
-- Strictement additif. NULL = encaissé / payé par le centre, donc toutes les
-- lignes existantes gardent leur sens. Sans cette migration l'app tourne comme
-- avant : l'onglet « Associates » invite à la passer et les deux sélecteurs
-- n'apparaissent pas. À passer TEST puis PROD.

BEGIN;

CREATE TABLE IF NOT EXISTS associates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  sort_order  INT  NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO associates (name, sort_order) VALUES ('Gui', 1), ('Teresa', 2)
ON CONFLICT (name) DO NOTHING;

-- Virements trésorerie ↔ associé. `amount` toujours positif, le sens est porté
-- par `direction` : 'to_associate' = le centre verse à l'associé (prélèvement,
-- ou remboursement d'une dépense avancée) ; 'to_centre' = l'associé remet de
-- l'argent dans la boîte.
CREATE TABLE IF NOT EXISTS associate_transfers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  associate_id  UUID NOT NULL REFERENCES associates(id) ON DELETE RESTRICT,
  date          DATE NOT NULL,
  amount        NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  direction     TEXT NOT NULL DEFAULT 'to_associate'
                CHECK (direction IN ('to_associate', 'to_centre')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_associate_transfers_associate
  ON associate_transfers(associate_id, date DESC);

-- ON DELETE RESTRICT partout : un associé qui porte des écritures ne se supprime pas.
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS received_by_associate_id UUID REFERENCES associates(id) ON DELETE RESTRICT;
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS paid_by_associate_id UUID REFERENCES associates(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_payments_received_by_associate
  ON payments(received_by_associate_id) WHERE received_by_associate_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by_associate
  ON expenses(paid_by_associate_id) WHERE paid_by_associate_id IS NOT NULL;

-- Admin uniquement, comme `expenses`.
ALTER TABLE associates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE associate_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all" ON associates;
DROP POLICY IF EXISTS "admin_all" ON associate_transfers;
CREATE POLICY "admin_all" ON associates          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON associate_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON associates          FROM anon;
REVOKE ALL ON associate_transfers FROM anon;

COMMIT;

-- ⚠️ CONNU, NON FERMÉ ICI : anon a un SELECT de TABLE sur `payments` (la RLS le
-- borne aux paiements de SA résa). Un détenteur de lien client peut donc lire
-- `received_by_associate_id` de ses propres paiements — un uuid opaque, la table
-- `associates` lui étant fermée. La page client ne le demande plus (select
-- explicite). Le fermer vraiment = passer `payments` en GRANT par colonnes, ce
-- qui casse tout `select=*` anon : à faire dans une migration à part, APRÈS le
-- déploiement du code.

-- VÉRIFICATION — TEST et PROD :
--   connecté (SQL editor) :  SELECT name FROM associates ORDER BY sort_order;  → Gui, Teresa
--   curl anon nu :  "$URL/rest/v1/associates?select=name"            → 401/42501 (pas [])
--   curl anon nu :  "$URL/rest/v1/associate_transfers?select=id"     → 401/42501
--   curl anon + token client :  "$URL/rest/v1/payments?select=id,amount" → 200, inchangé
