import { describe, it, expect } from 'vitest'
import { rateOn, bungalowCostPerNight } from './exchangeRates'

const rates = [
  { valid_from: '2026-11-15', rate: 72 },
  { valid_from: '2000-01-01', rate: 70 },
]

describe('rateOn', () => {
  it('takes the rate in force on the date, whatever the order of the rows', () => {
    expect(rateOn(rates, '2026-10-02', 65)).toBe(70)
    expect(rateOn(rates, '2026-11-14', 65)).toBe(70)
    expect(rateOn(rates, '2026-11-15', 65)).toBe(72)
    expect(rateOn(rates, '2027-01-01', 65)).toBe(72)
  })

  it('a new rate leaves an older date untouched', () => {
    const before = rateOn([{ valid_from: '2000-01-01', rate: 70 }], '2026-10-02', 65)
    expect(rateOn(rates, '2026-10-02', 65)).toBe(before)
  })

  it('before the first row, that row; no history, the fallback', () => {
    expect(rateOn([{ valid_from: '2026-01-01', rate: 70 }], '2025-06-01', 65)).toBe(70)
    expect(rateOn([], '2026-10-02', 65)).toBe(65)
    expect(rateOn(undefined, '2026-10-02', 65)).toBe(65)
  })
})

describe('bungalowCostPerNight', () => {
  it('a tariff in meticals gives euros at the rate of the date', () => {
    const acc = { cost_per_night: 154, cost_per_night_mzn: 10080 }
    expect(bungalowCostPerNight(acc, '2026-10-02', rates, 65)).toBe(144)
    expect(bungalowCostPerNight(acc, '2026-12-01', rates, 65)).toBe(140)
  })

  it('no tariff in meticals: the amount in euros stays, at any rate', () => {
    expect(bungalowCostPerNight({ cost_per_night: 50, cost_per_night_mzn: null }, '2026-12-01', rates, 65)).toBe(50)
    expect(bungalowCostPerNight({ cost_per_night: null }, '2026-12-01', rates, 65)).toBe(0)
    expect(bungalowCostPerNight(null, '2026-12-01', rates, 65)).toBe(0)
  })
})
