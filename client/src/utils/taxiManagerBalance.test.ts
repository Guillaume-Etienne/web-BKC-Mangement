import { describe, it, expect } from 'vitest'
import { managerBalance } from './taxiManagerBalance'

const t = (date: string, margin_manager_mzn = 1000) => ({ date, margin_manager_mzn })

describe('managerBalance', () => {
  it('only past trips earn the commission', () => {
    const b = managerBalance([t('2026-11-20'), t('2026-11-23'), t('2026-11-27'), t('2027-01-14')], [], '2026-11-24')
    expect(b.earnedMzn).toBe(2000)
    expect(b.earnedCount).toBe(2)
    expect(b.upcomingMzn).toBe(2000)
    expect(b.upcomingCount).toBe(2)
    expect(b.balance).toBe(2000)
  })

  it("today's trip is still upcoming (same split as the Finance tab)", () => {
    const b = managerBalance([t('2026-11-24')], [], '2026-11-24')
    expect(b.earnedMzn).toBe(0)
    expect(b.upcomingMzn).toBe(1000)
  })

  it('private taxis (margin 0) are ignored everywhere', () => {
    const b = managerBalance([t('2026-11-01', 0), t('2026-12-01', 0), t('2026-11-02', 500)], [], '2026-11-24')
    expect(b).toMatchObject({ earnedMzn: 500, earnedCount: 1, upcomingMzn: 0, upcomingCount: 0 })
  })

  it('advances are deducted; overpaid gives a negative balance', () => {
    const trips = [t('2026-11-01'), t('2026-11-02'), t('2026-12-01')]
    expect(managerBalance(trips, [{ amount_mzn: 500 }], '2026-11-24').balance).toBe(1500)
    expect(managerBalance(trips, [{ amount_mzn: 5000 }], '2026-11-24').balance).toBe(-3000)
  })
})
