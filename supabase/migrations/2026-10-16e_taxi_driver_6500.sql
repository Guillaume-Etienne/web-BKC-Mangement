-- 2026-10-16 (e) — Taxi Aéroport ↔ Bilene : le chauffeur passe de 6000 à 6500 MZN (décision gui).
-- Manager inchangé (1000 MZN), prix client inchangé (120 €) → la marge centre passe de
-- 1400 à 900 MZN par trajet (au taux de 70).
--
-- Données seulement, aucune structure modifiée. À lancer sur TEST puis PROD.
-- Ne touche que ce qui vaut exactement l'ancien tarif standard (120 € / 6000 / 1000) :
-- le Big Taxi (160 € / 8000), les trajets à 168 €, à 0 € ou déjà modifiés restent tels quels.
--
-- Rollback : mêmes UPDATE avec 6500 → 6000.

BEGIN;

-- 1) Défauts des nouveaux trajets
UPDATE taxi_pricing_defaults
   SET default_driver_mzn = 6500, updated_at = now()
 WHERE default_driver_mzn = 6000;

-- 2) Défauts par chauffeur (utilisés quand on crée un taxi depuis une résa)
UPDATE taxi_drivers
   SET default_driver_mzn = 6500
 WHERE default_driver_mzn = 6000 AND default_price_eur = 120 AND default_manager_mzn = 1000;

-- 3) Trajets à venir (aujourd'hui inclus) au tarif standard, Aéroport ↔ Bilene
UPDATE taxi_trips
   SET price_driver_mzn = 6500
 WHERE date >= current_date
   AND type IN ('aero-to-center', 'center-to-aero')
   AND price_eur = 120 AND price_driver_mzn = 6000 AND margin_manager_mzn = 1000;

-- Contrôle : on attend 0 ligne restante à 6000
SELECT type, price_eur, price_driver_mzn, margin_manager_mzn, count(*)
  FROM taxi_trips
 WHERE date >= current_date
 GROUP BY 1, 2, 3, 4
 ORDER BY 1, 2;

COMMIT;
