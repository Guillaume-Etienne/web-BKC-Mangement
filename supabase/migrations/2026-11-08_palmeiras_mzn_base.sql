-- 2026-11-08 — Le compte Palmeiras passe en meticals (gui : « ils sont QUE en meticals »).
--
-- 1. accommodations.palmeiras_price_mzn : le prix public du Palmeiras par nuit, en MZN.
--    BKC leur doit 85 % quand le client paie BKC, ils doivent 15 % à BKC quand le client
--    les paie (gui, 2026-11-08). Remplace cost_per_night_mzn (jamais rempli, colonne laissée
--    en place, à supprimer plus tard avec archive).
-- 2. Un montant MZN d'origine sur ce qui naît en meticals : règlements, lignes libres,
--    commission réelle du mois, paiement CB sur le terminal du Palmeiras (payments.amount_mzn,
--    seulement pour card_palmeiras ; `amount` reste en € pour le client).
-- 3. Tarifs donnés par gui le 2026-11-08 : See View 5 = 12 000, B1 = 4 000, B2 = 8 000,
--    B3 = 8 000, B4 = 4 000 MZN / nuit. Seulement là où rien n'est encore saisi.
-- 4. palmeiras_statement() rend ces montants. Toujours jamais notre prix de vente
--    (palmeiras_price_mzn est LEUR prix public).
--
-- Rien n'est supprimé (Supabase signalera le REVOKE ... FROM PUBLIC : il re-pose le même droit qu'en 30b).
-- ⚠️ À passer AVANT de pousser le code, TEST puis PROD (le code écrit ces colonnes).

BEGIN;

ALTER TABLE accommodations        ADD COLUMN IF NOT EXISTS palmeiras_price_mzn NUMERIC(12,2) CHECK (palmeiras_price_mzn > 0);
ALTER TABLE palmeiras_settlements ADD COLUMN IF NOT EXISTS amount_mzn          NUMERIC(12,2) CHECK (amount_mzn > 0);
ALTER TABLE palmeiras_entries     ADD COLUMN IF NOT EXISTS amount_mzn          NUMERIC(12,2) CHECK (amount_mzn > 0);
ALTER TABLE palmeiras_reversals   ADD COLUMN IF NOT EXISTS gross_amount_mzn    NUMERIC(12,2);
ALTER TABLE palmeiras_reversals   ADD COLUMN IF NOT EXISTS net_amount_mzn      NUMERIC(12,2);
ALTER TABLE payments              ADD COLUMN IF NOT EXISTS amount_mzn          NUMERIC(12,2) CHECK (amount_mzn > 0);

UPDATE accommodations a
   SET palmeiras_price_mzn = v.price
  FROM (VALUES ('Bungalow See View 5', 12000), ('B1', 4000), ('B2', 8000), ('B3', 8000), ('B4', 4000)) AS v(name, price)
 WHERE a.type = 'bungalow' AND a.name = v.name AND a.palmeiras_price_mzn IS NULL;

CREATE OR REPLACE FUNCTION palmeiras_statement()
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN (share_ctx()).type = 'palmeiras' THEN json_build_object(
    'eur_mzn_rate', (SELECT eur_mzn_rate FROM taxi_pricing_defaults LIMIT 1),
    -- each line converts at the rate of its own date (2026-11-01b)
    'eur_mzn_rates', COALESCE((
      SELECT json_agg(json_build_object('valid_from', valid_from, 'rate', rate) ORDER BY valid_from)
        FROM eur_mzn_rates
    ), '[]'::json),
    -- every Palmeiras bungalow, so the timeline shows the empty ones too (2026-10-30c)
    'bungalows', COALESCE((SELECT json_agg(name ORDER BY name) FROM accommodations WHERE type = 'bungalow'), '[]'::json),
    'stays', COALESCE((
      SELECT json_agg(json_build_object(
               'booking_number', b.booking_number,
               'guest',          trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')),
               'provisional',    b.status = 'provisional',
               'bungalow',       a.name,
               'check_in',       b.check_in,
               'check_out',      b.check_out,
               'paid_direct',    coalesce(p.paid_to_owner, false),
               -- the guest paid them: the price they collected is the base of our commission
               'price_per_night', CASE WHEN coalesce(p.paid_to_owner, false) THEN coalesce(p.price_per_night, 0) END,
               -- we collected: only what we owe them, never our selling price
               'cost_per_night',  CASE WHEN NOT coalesce(p.paid_to_owner, false) THEN coalesce(a.cost_per_night, 0) END,
               -- their own public price in meticals (2026-11-08): both sides derive from it
               'palmeiras_price_mzn', a.palmeiras_price_mzn
             ) ORDER BY b.check_in)
        FROM booking_rooms br
        JOIN rooms r          ON r.id = br.room_id
        JOIN accommodations a ON a.id = r.accommodation_id AND a.type = 'bungalow'
        JOIN bookings b       ON b.id = br.booking_id AND b.status <> 'cancelled'
        LEFT JOIN clients c   ON c.id = b.client_id
        LEFT JOIN booking_room_prices p ON p.booking_id = br.booking_id AND p.room_id = br.room_id
    ), '[]'::json),
    'rents', COALESCE((
      SELECT json_agg(json_build_object('month', month, 'amount', amount, 'amount_mzn', amount_mzn) ORDER BY month)
        FROM palmeiras_rents
    ), '[]'::json),
    'adjustments', COALESCE((
      SELECT json_agg(json_build_object('month', month, 'gross_amount', gross_amount,
                                        'percent', percent, 'net_amount', net_amount,
                                        'gross_amount_mzn', gross_amount_mzn, 'net_amount_mzn', net_amount_mzn) ORDER BY month)
        FROM palmeiras_reversals
    ), '[]'::json),
    'entries', COALESCE((
      SELECT json_agg(json_build_object('month', month, 'date', date, 'type', type, 'description', description,
                                        'amount', amount, 'amount_mzn', amount_mzn) ORDER BY coalesce(date, (month || '-01')::date))
        FROM palmeiras_entries
    ), '[]'::json),
    'card_payments', COALESCE((
      SELECT json_agg(json_build_object(
               'booking_number', b.booking_number,
               'guest',          trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')),
               'date',           x.date,
               'amount',         x.amount,
               'amount_mzn',     x.amount_mzn
             ) ORDER BY x.date)
        FROM payments x
        LEFT JOIN bookings b ON b.id = x.booking_id
        LEFT JOIN clients c  ON c.id = b.client_id
       WHERE x.method = 'card_palmeiras' AND NOT x.is_discount
    ), '[]'::json),
    'settlements', COALESCE((
      SELECT json_agg(json_build_object('date', date, 'direction', direction,
                                        'amount', amount, 'amount_mzn', amount_mzn,
                                        'method', method, 'rent_month', rent_month) ORDER BY date)
        FROM palmeiras_settlements
    ), '[]'::json)
  ) END;
$$;
REVOKE EXECUTE ON FUNCTION palmeiras_statement() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION palmeiras_statement() TO anon, authenticated;

COMMIT;

-- VÉRIFICATION
-- SELECT name, palmeiras_price_mzn FROM accommodations WHERE type = 'bungalow' ORDER BY name;
--   → B1 4000, B2 8000, B3 8000, B4 4000, Bungalow See View 5 12000
-- curl anon palmeiras_settlements?select=*     → 401 / 42501 (inchangé)
-- curl anon rpc/palmeiras_statement sans token → null ; avec token palmeiras → stays[].palmeiras_price_mzn présent
