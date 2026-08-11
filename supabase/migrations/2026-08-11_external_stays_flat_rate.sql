-- 2026-08-11 — Séjours externes : forfait, facturation externe, et fermeture
-- d'une fuite de marge vers les liens partagés.
--
-- CONTEXTE
-- `external_accommodations` et `external_accommodation_bookings` existent depuis
-- l'origine, sont lues par la compta et par la page client — et n'ont JAMAIS été
-- alimentées : aucun `insert` dans tout le code, 0 ligne sur PROD comme sur TEST
-- (vérifié le 2026-08-11). On les branche pour de bon, d'où trois changements.
--
-- 1. FORFAIT. Le modèle facturait à la nuit ; gui raisonne au forfait ("x dépensé
--    chez eux, y facturé au client", décidé le 2026-08-11). Diviser un forfait par
--    le nombre de nuits recalculerait le total dès qu'une date bouge — on stocke
--    donc le total. Les tables étant vides, on remplace les colonnes au lieu d'en
--    empiler de nouvelles à côté. Cette liberté n'existera plus après l'ouverture.
--
-- 2. `accommodations.external_billing`. Un hébergement ainsi marqué ne porte pas
--    de tarif : son prix vit sur la ligne de séjour, au cas par cas. C'est ce qui
--    distingue « pas encore renseigné » (badge rouge légitime) de « délibérément
--    sans tarif » (San Martinho, la ligne No accommodation des vans).
--
-- 3. 🔴 FUITE DE MARGE. Aucune des deux tables n'a de privilèges de colonnes :
--       - `external_accommodation_bookings` → policy anon `client` : le client lit
--         `cost_per_night`, donc ce qu'on paie l'hôtel, donc notre marge.
--       - `external_accommodations` → policy anon `share_type() IS NOT NULL` :
--         N'IMPORTE QUEL porteur de lien (chauffeur, Geraldo, restaurant, forecast,
--         prestataire) lit tout le référentiel, prix d'achat compris.
--    Même motif que le Lot C (salaires moniteurs lisibles depuis un lien client).
--    Impact réel aujourd'hui : nul, les tables sont vides. Il cesse de l'être à la
--    première ligne saisie — c'est-à-dire dès cette migration.
--
-- ⚠️ ORDRE : le REVOKE de table AVANT les GRANT de colonnes. Supabase pose un
-- GRANT SELECT de table sur tout le schéma public ; tant qu'il est là, les
-- privilèges de colonnes ne restreignent rien (piège vécu le 2026-07-31 sur
-- `room_rates` : `select=notes` répondait [] au lieu de 42501).
--
-- ⚠️ Le code qui accompagne cette migration narrowe les `select()` de
-- ClientSharePage. Sans lui, son `select('*')` sur ces deux tables renverra
-- 42501 et la page client n'affichera plus rien.

BEGIN;

-- ── 1. Forfait ──────────────────────────────────────────────────────────────
-- Le référentiel redevient une simple liste de lieux : les montants varient à
-- chaque séjour, un prix « par défaut » n'y voulait plus rien dire.
ALTER TABLE external_accommodations
  DROP COLUMN IF EXISTS cost_per_night,
  DROP COLUMN IF EXISTS sell_price_per_night;

ALTER TABLE external_accommodation_bookings
  DROP COLUMN IF EXISTS cost_per_night,
  DROP COLUMN IF EXISTS sell_price_per_night;

ALTER TABLE external_accommodation_bookings
  ADD COLUMN IF NOT EXISTS total_cost       NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_sell_price NUMERIC(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN external_accommodation_bookings.total_cost IS
  'Forfait payé à l''hébergeur pour tout le séjour. Jamais lisible par anon.';
COMMENT ON COLUMN external_accommodation_bookings.total_sell_price IS
  'Forfait facturé au client pour tout le séjour. 0 = hébergement offert / autonome.';

-- ── 2. Hébergements facturés hors grille ────────────────────────────────────
ALTER TABLE accommodations
  ADD COLUMN IF NOT EXISTS external_billing BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN accommodations.external_billing IS
  'true = ne porte aucun room_rate ; le montant vit sur external_accommodation_bookings, '
  'au cas par cas (San Martinho, ligne No accommodation). Exempt du badge "no sell price".';

-- ── 3. Colonnes lisibles par anon ───────────────────────────────────────────
-- REVOKE d'abord (cf. avertissement en tête), GRANT colonnes ensuite.

REVOKE SELECT ON external_accommodations FROM anon;
GRANT  SELECT (id, name, provider, is_active) ON external_accommodations TO anon;
-- `notes` exclu : notes internes.

REVOKE SELECT ON external_accommodation_bookings FROM anon;
GRANT  SELECT (id, booking_id, external_accommodation_id, check_in, check_out, total_sell_price)
  ON external_accommodation_bookings TO anon;
-- `total_cost` exclu : c'est notre prix d'achat. `notes` exclu.

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS — à faire sur TEST **et** PROD, par curl anon direct.
-- Un `[]` ne prouve rien tout seul (les policies masquent les lignes) : c'est le
-- 42501 qui prouve que la colonne est fermée, et le contrôle négatif qui prouve
-- que le `[]` ne cache pas une colonne inexistante.
--
--   URL=<https://xxx.supabase.co>ANON=<clé anon>
--
-- 1) Le prix d'achat est fermé, y compris avec un token client valide :
--    curl "$URL/rest/v1/external_accommodation_bookings?select=total_cost" \
--         -H "apikey: $ANON" -H "x-share-token: <token client>"
--    → 42501   (et NON [])
--
-- 2) Idem sur select=* (le chemin qu'empruntait ClientSharePage) :
--    curl "$URL/rest/v1/external_accommodation_bookings?select=*" ...
--    → 42501
--
-- 3) Les colonnes autorisées répondent :
--    curl "$URL/rest/v1/external_accommodation_bookings?select=check_in,total_sell_price" ...
--    → 200, [] tant qu'aucun séjour n'existe
--
-- 4) Le référentiel ne fuit plus vers les autres types de liens :
--    curl "$URL/rest/v1/external_accommodations?select=notes" \
--         -H "apikey: $ANON" -H "x-share-token: <token chauffeur>"
--    → 42501
--    curl "$URL/rest/v1/external_accommodations?select=id,name" ... (token chauffeur)
--    → 200
--
-- 5) Contrôle négatif — sans lui, un [] pourrait venir d'un champ ignoré :
--    curl "$URL/rest/v1/external_accommodation_bookings?select=colonne_bidon" ...
--    → 42703 « column does not exist »
--
-- 6) Les colonnes du forfait existent bien, et les anciennes ont disparu :
--    select=total_cost           → 42501 (existe, fermée)
--    select=cost_per_night       → 42703 (supprimée)
--    accommodations?select=external_billing → 200
-- ════════════════════════════════════════════════════════════════════════════
