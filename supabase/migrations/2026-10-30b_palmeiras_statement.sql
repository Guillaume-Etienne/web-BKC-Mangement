-- 2026-10-30 (b) — Relevé de compte Palmeiras : règlements, loyer en MZN, page partagée.
-- Nécessite 2026-10-30 (valeur d'enum `palmeiras`, passée SEULE avant). Idempotent. TEST puis PROD,
-- AVANT de pousser le code (l'onglet nomme `amount_mzn` et `palmeiras_settlements`).
--
-- 1. palmeiras_rents.amount_mzn : le loyer est fixé en meticals (10 000 MZN). `amount` (€) reste la
--    valeur comptée partout ; amount_mzn n'est que le montant d'origine affiché à côté.
-- 2. palmeiras_settlements : un règlement daté entre nous et le Palmeiras (cash, virement,
--    compensation). Remet le solde du relevé à zéro au fil des points. Admin seulement.
-- 3. palmeiras_statement() : SECURITY DEFINER, token `palmeiras` seulement. Rend en un JSON ce que
--    la page partagée affiche — et RIEN de plus. Les tables palmeiras_* / bookings / prix restent
--    fermées à anon. En particulier : pour un bungalow que NOUS avons encaissé, seul le coût dû au
--    Palmeiras sort (jamais notre prix de vente) ; aucune note interne (loyer, règlement, prix).
--    Nom complet du client : décision gui 2026-10-30 (pour pointer avec leur propre compta).

BEGIN;

ALTER TABLE palmeiras_rents ADD COLUMN IF NOT EXISTS amount_mzn NUMERIC(12,2);

CREATE TABLE IF NOT EXISTS palmeiras_settlements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL,
  direction   TEXT NOT NULL CHECK (direction IN ('us_to_palmeiras', 'palmeiras_to_us')),
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method      TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE palmeiras_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all" ON palmeiras_settlements;
CREATE POLICY "admin_all" ON palmeiras_settlements
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON palmeiras_settlements FROM anon;

CREATE OR REPLACE FUNCTION palmeiras_statement()
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN (share_ctx()).type = 'palmeiras' THEN json_build_object(
    'eur_mzn_rate', (SELECT eur_mzn_rate FROM taxi_pricing_defaults LIMIT 1),
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
               'cost_per_night',  CASE WHEN NOT coalesce(p.paid_to_owner, false) THEN coalesce(a.cost_per_night, 0) END
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
      SELECT json_agg(json_build_object('month', month, 'type', type, 'description', description,
                                        'amount', amount) ORDER BY month)
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
                                        'amount', amount, 'method', method) ORDER BY date)
        FROM palmeiras_settlements
    ), '[]'::json)
  ) END;
$$;
REVOKE EXECUTE ON FUNCTION palmeiras_statement() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION palmeiras_statement() TO anon, authenticated;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION — TEST **et** PROD, curl anon (POST, corps JSON vide) :
--   curl -X POST "$URL/rest/v1/rpc/palmeiras_statement" -H "apikey: $ANON" \
--        -H "content-type: application/json" -H "x-share-token: <token palmeiras>" -d '{}'
--     → un objet {eur_mzn_rate, stays, rents, adjustments, entries, card_payments, settlements}
--       stays : price_per_night seulement si paid_direct, cost_per_night seulement sinon
--   même appel SANS token, ou avec un token d'un autre type (client, forecast…) → null
--   curl "$URL/rest/v1/palmeiras_settlements?select=*" -H "apikey: $ANON" → 42501
-- ════════════════════════════════════════════════════════════════════════════
