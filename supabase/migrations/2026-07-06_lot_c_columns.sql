-- ═══════════════════════════════════════════════════════════════════════════════
-- Lot C — GRANT colonnes sur instructors / taxi_drivers / activity_providers
-- (2026-07-06, décisions gui : recos confirmées telles quelles)
--
-- Même pattern que les Lots précédents (clients, booking_participants, bookings) :
-- les policies RLS token-aware (Phase 2) scopent les LIGNES, ces GRANT scopent les
-- COLONNES. anon ne lit plus : email/phone/notes/specialties des moniteurs,
-- email/notes/margin_percent/tarifs par défaut des chauffeurs (phone GARDÉ —
-- décision gui : utile pour appeler son taxi), notes internes des providers.
--
-- ⚠️ Tout .select() anon sur ces tables doit désormais lister explicitement les
-- colonnes autorisées (`*` → 42501). Pages narrowées dans le même commit :
-- ClientShare, ForecastShare, TaxiShare, DriverShare, TaxiManagerShare,
-- ActivityProviderShare.
--
-- ROLLBACK : GRANT SELECT ON instructors, taxi_drivers, activity_providers TO anon;
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Moniteurs : identité + tarifs (le détail de prix des leçons de ClientSharePage
-- en a besoin). Bloqué : email, phone, notes, specialties.
REVOKE SELECT ON instructors FROM anon;
GRANT  SELECT (id, first_name, last_name, rate_private, rate_group, rate_supervision)
  ON instructors TO anon;

-- Chauffeurs : identité + contact + véhicule. Bloqué : email, notes,
-- margin_percent, default_price_eur, default_driver_mzn, default_manager_mzn
-- (tarification interne).
REVOKE SELECT ON taxi_drivers FROM anon;
GRANT  SELECT (id, name, phone, vehicle, seats) ON taxi_drivers TO anon;

-- Providers : leur propre fiche publique (lignes déjà scopées à eux par Phase 2).
-- Bloqué : notes (notes internes gui).
REVOKE SELECT ON activity_providers FROM anon;
GRANT  SELECT (id, name, type, phone, email, website, show_prices)
  ON activity_providers TO anon;

COMMIT;
