-- 2026-10-30 (e) — Un loyer « payé le X » : un règlement peut être rattaché à une période de loyer.
-- palmeiras_settlements.rent_month (TEXT YYYY-MM, nullable) = le mois où démarre la période (15 → 15) payée.
-- Le règlement reste LA source du paiement (solde, tableau) ; la frise en déduit « ✓ Paid le X ».
-- palmeiras_statement() rend aussi rent_month (CREATE OR REPLACE ; rien n'est supprimé, le REVOKE FROM PUBLIC
-- re-pose le droit de 30b). ⚠️ À passer AVANT de pousser le code (le formulaire écrit rent_month). TEST puis PROD.

BEGIN;

ALTER TABLE palmeiras_settlements ADD COLUMN IF NOT EXISTS rent_month TEXT CHECK (rent_month ~ '^[0-9]{4}-[0-9]{2}$');

CREATE OR REPLACE FUNCTION palmeiras_statement()
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN (share_ctx()).type = 'palmeiras' THEN json_build_object(
    'eur_mzn_rate', (SELECT eur_mzn_rate FROM taxi_pricing_defaults LIMIT 1),
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

-- VÉRIFICATION : curl token palmeiras → settlements[*].rent_month présent ; sans token → null
