import type { TaxiPricingDefaults } from '../types/database'

// Used when the taxi_pricing_defaults table is empty or hasn't loaded yet.
export const FALLBACK_TAXI_PRICING: TaxiPricingDefaults = {
  id: '',
  default_price_eur:    120,
  default_driver_mzn:   6000,
  default_manager_mzn:  1000,
  eur_mzn_rate:         65,
  updated_at:           new Date().toISOString(),
}
