/* ============================================================================
   Migration : equipment -- prix d'achat, revente, et lien vers les dépenses
   Date : 2026-09-07
   À exécuter en TEST **puis en PROD** dans la foulée (Supabase SQL editor),
   APRÈS 2026-09-07_equipment_category_bar.sql.

   Demande de gui : pouvoir répondre à "combien ce matériel m'a coûté, combien
   il m'a rapporté à la revente" -- rien de tout ça n'existait sur `equipment`.
   Prix toujours en EUR (décision gui, comme le reste de l'app hors taxis).
   Pas de concept de "lot d'achat" : chaque pièce porte son propre prix, saisi
   à la main même quand plusieurs pièces viennent de la même commande.

   Le lien vers `expenses` est volontaire et à sens unique : `equipment` ne
   fait QUE stocker l'id de la dépense créée depuis sa fiche (bouton "Créer la
   dépense" / "Mettre à jour la dépense" dans l'app -- jamais automatique,
   jamais silencieux). Si la dépense liée est supprimée depuis l'onglet
   Comptabilité, `ON DELETE SET NULL` fait juste réapparaître le bouton
   "Créer la dépense" sur la fiche -- pas d'orphelin, pas d'erreur.

   ⚠️ SÉCURITÉ -- pourquoi ce fichier touche aussi les GRANTs anon :
   `equipment` a une policy RLS anon depuis la Phase 2 (2026-07-06,
   anon_read_equipment) mais n'a JAMAIS reçu le traitement par colonne des
   Lots B/C/Phase 4 (contrairement à equipment_rentals, lessons, taxi_trips...).
   Concrètement : un curl avec N'IMPORTE QUEL token de partage valide (client,
   taxi, driver, forecast...) pouvait déjà lire toute la table `equipment` en
   `select=*`. Rien dans le code actuel ne s'en sert (vérifié : aucune page
   partagée n'appelle useEquipment ni ne select() equipment), donc aucun risque
   à fermer la colonne dans la foulée -- mais sans ce verrou, les nouvelles
   colonnes ci-dessous (prix d'achat, fournisseur, prix de revente, acheteur)
   seraient exposées day one à quiconque a un lien de partage, quel qu'il soit.
   ============================================================================ */

BEGIN;

ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS purchase_price      NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS purchase_date       DATE,
  ADD COLUMN IF NOT EXISTS shipping_cost       NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS supplier            TEXT,
  ADD COLUMN IF NOT EXISTS purchase_comment    TEXT,
  ADD COLUMN IF NOT EXISTS purchase_expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sold_price          NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS sold_date           DATE,
  ADD COLUMN IF NOT EXISTS sold_to             TEXT,
  ADD COLUMN IF NOT EXISTS sold_paid_date      DATE,
  ADD COLUMN IF NOT EXISTS sale_expense_id     UUID REFERENCES expenses(id) ON DELETE SET NULL;

COMMENT ON COLUMN equipment.purchase_price      IS 'EUR, hors frais de port. NULL = jamais renseigné (tout le parc existant avant le 2026-09-07).';
COMMENT ON COLUMN equipment.shipping_cost       IS 'EUR, port/douane -- saisi à la main, jamais calculé depuis un lot.';
COMMENT ON COLUMN equipment.purchase_expense_id IS 'Dépense créée depuis la fiche (bouton, jamais automatique). NULL = pas encore liée.';
COMMENT ON COLUMN equipment.sold_price          IS 'EUR. NULL = pièce toujours dans le parc.';
COMMENT ON COLUMN equipment.sold_paid_date      IS 'Date où l''acheteur a payé. NULL = vendu mais pas (encore) payé.';
COMMENT ON COLUMN equipment.sale_expense_id     IS 'Dépense (montant négatif) créée depuis la fiche pour la revente. NULL = pas encore liée.';

-- Colonnes par défaut du schéma, déjà anon-lisibles depuis la Phase 2 : rien
-- d'argent, rien de nouveau ici.
REVOKE SELECT ON equipment FROM anon;
GRANT  SELECT (id, name, category, brand, size, year, condition, notes, is_active)
  ON equipment TO anon;

COMMIT;

/* ── VÉRIFICATION (après, sur chaque base) ───────────────────────────────────
   TOKEN=<token d'un shared_link actif, N'IMPORTE LEQUEL>   # Options → Shared Links
   URL=https://<ref>.supabase.co ; KEY=<clé anon>
   H=(-H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "x-share-token: $TOKEN")

   1. Colonnes financières FERMÉES -- doit répondre 42501 :
        curl -s "$URL/rest/v1/equipment?select=purchase_price" "${H[@]}"
        curl -s "$URL/rest/v1/equipment?select=sold_price,sold_to" "${H[@]}"
        curl -s "$URL/rest/v1/equipment?select=*" "${H[@]}"

   2. Colonnes neutres toujours OUVERTES -- doit répondre 200 :
        curl -s "$URL/rest/v1/equipment?select=id,name,category,condition" "${H[@]}"

   3. Les pages Equipment / Accounting / Planning de l'app (authentifiées,
      pas anon) continuent d'afficher le matériel normalement.
   ──────────────────────────────────────────────────────────────────────────── */
