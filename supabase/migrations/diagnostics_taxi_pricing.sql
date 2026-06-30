-- ============================================================
-- Diagnostic — taxi_pricing_defaults (read-only first)
-- Investigates the "new taxi trip prefilled at 8000€" bug.
-- New trips inherit taxi_pricing_defaults.default_price_eur. If several rows
-- exist, TaxiPage and Options could pick different ones (now both ORDER BY
-- updated_at DESC in code, but stale rows should still be cleaned up).
-- ============================================================

-- 1. How many rows, and what do they hold? (Expect exactly ONE, ~120€.)
SELECT id, default_price_eur, default_driver_mzn, default_manager_mzn, eur_mzn_rate, updated_at
FROM taxi_pricing_defaults
ORDER BY updated_at DESC;

-- 2. If a row shows default_price_eur = 8000 (an MZN amount typed into the EUR
--    field), fix it from the UI (Options → Taxi Pricing Defaults → Edit → 120)
--    or here:
-- UPDATE taxi_pricing_defaults SET default_price_eur = 120, updated_at = now()
-- WHERE default_price_eur > 1000;   -- EUR price should never be in the thousands

-- 3. If there is MORE THAN ONE row, keep only the most recent and delete the rest:
-- DELETE FROM taxi_pricing_defaults
-- WHERE id NOT IN (SELECT id FROM taxi_pricing_defaults ORDER BY updated_at DESC LIMIT 1);
