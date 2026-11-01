-- 2026-11-01 (b) — Historique du taux EUR/MZN + coût des bungalows en MZN (décisions gui 2026-11-01).
-- Mettre à jour le taux ne change plus ce qui a été appliqué par le passé : une conversion prend le taux de SA date.
--
-- 1. eur_mzn_rates : « à partir de telle date, 1 € = X MZN », modifiable dans Options → Pricing. Admin seulement.
--    Première ligne = le taux actuel, à partir de 2000-01-01 : AUCUN chiffre ne bouge au passage de cette migration.
-- 2. taxi_pricing_defaults.eur_mzn_rate reste « le taux du moment » pour ce qui le lit déjà : un trigger le recopie
--    depuis la ligne la plus récente. Il ne se modifie plus à la main.
-- 3. accommodations.cost_per_night_mzn : tarif du bungalow en meticals (NULL = cost_per_night en € reste la référence).
--    anon lit déjà cost_per_night par son GRANT de table : même niveau d'exposition, décision à part si on le ferme.
-- 4. palmeiras_statement() rend aussi eur_mzn_rates et cost_per_night_mzn. Toujours jamais notre prix de vente.
--
-- Rien n'est supprimé (Supabase signalera le REVOKE ... FROM PUBLIC : il re-pose le même droit qu'en 30b).
-- ⚠️ À passer AVANT de pousser le code, TEST puis PROD (le code lit la table et écrit la colonne). Puis relancer le MCP.

BEGIN;

CREATE TABLE IF NOT EXISTS eur_mzn_rates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  valid_from  DATE NOT NULL UNIQUE,
  rate        NUMERIC(10,4) NOT NULL CHECK (rate > 0),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE eur_mzn_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all" ON eur_mzn_rates;
CREATE POLICY "admin_all" ON eur_mzn_rates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON eur_mzn_rates FROM anon;

INSERT INTO eur_mzn_rates (valid_from, rate, note)
SELECT DATE '2000-01-01', eur_mzn_rate, 'Rate in use when the history started'
  FROM taxi_pricing_defaults
 ORDER BY updated_at DESC
 LIMIT 1
ON CONFLICT (valid_from) DO NOTHING;

CREATE OR REPLACE FUNCTION sync_current_eur_mzn_rate()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  latest NUMERIC;
BEGIN
  SELECT rate INTO latest FROM eur_mzn_rates ORDER BY valid_from DESC LIMIT 1;
  IF latest IS NOT NULL THEN
    UPDATE taxi_pricing_defaults SET eur_mzn_rate = latest, updated_at = now()
     WHERE eur_mzn_rate IS DISTINCT FROM latest;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION sync_current_eur_mzn_rate() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS eur_mzn_rates_sync_current ON eur_mzn_rates;
CREATE TRIGGER eur_mzn_rates_sync_current
  AFTER INSERT OR UPDATE OR DELETE ON eur_mzn_rates
  FOR EACH STATEMENT EXECUTE FUNCTION sync_current_eur_mzn_rate();

ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS cost_per_night_mzn NUMERIC(12,2) CHECK (cost_per_night_mzn > 0);

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
               'cost_per_night_mzn', CASE WHEN NOT coalesce(p.paid_to_owner, false) THEN a.cost_per_night_mzn END
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
                                        'percent', percent, 'net_amount', net_amount) ORDER BY month)
        FROM palmeiras_reversals
    ), '[]'::json),
    'entries', COALESCE((
      SELECT json_agg(json_build_object('month', month, 'date', date, 'type', type, 'description', description,
                                        'amount', amount) ORDER BY coalesce(date, (month || '-01')::date))
        FROM palmeiras_entries
    ), '[]'::json),
    'card_payments', COALESCE((
      SELECT json_agg(json_build_object(
               'booking_number', b.booking_number,
               'guest',          trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')),
               'date',           x.date,
               'amount',         x.amount
             ) ORDER BY x.date)
        FROM payments x
        LEFT JOIN bookings b ON b.id = x.booking_id
        LEFT JOIN clients c  ON c.id = b.client_id
       WHERE x.method = 'card_palmeiras' AND NOT x.is_discount
    ), '[]'::json),
    'settlements', COALESCE((
      SELECT json_agg(json_build_object('date', date, 'direction', direction,
                                        'amount', amount, 'method', method, 'rent_month', rent_month) ORDER BY date)
        FROM palmeiras_settlements
    ), '[]'::json)
  ) END;
$$;
REVOKE EXECUTE ON FUNCTION palmeiras_statement() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION palmeiras_statement() TO anon, authenticated;

COMMIT;

-- VÉRIFICATION
-- SELECT valid_from, rate FROM eur_mzn_rates;  → 1 ligne : 2000-01-01, le taux actuel
-- curl anon eur_mzn_rates?select=*             → 401 / 42501
-- curl anon rpc/palmeiras_statement sans token → null ; avec token palmeiras → clé eur_mzn_rates présente
