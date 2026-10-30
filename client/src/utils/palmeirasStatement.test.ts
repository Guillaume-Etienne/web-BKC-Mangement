import { describe, it, expect } from 'vitest'
import { buildStatement, balanceSentence, fmtEurCents, type StatementInput, type StatementStay } from './palmeirasStatement'

const stay = (o: Partial<StatementStay>): StatementStay => ({
  booking_number: 1, guest: 'Guest', provisional: false, bungalow: 'B4',
  check_in: '2026-10-02', check_out: '2026-10-05',
  paid_direct: false, price_per_night: null, cost_per_night: 50, ...o,
})

const empty: StatementInput = {
  eur_mzn_rate: 72, stays: [], rents: [], adjustments: [], entries: [], card_payments: [], settlements: [],
}

// Fixed day, so a stay in November is in the future whatever the date of the run.
const build = (i: StatementInput) => buildStatement(i, '2026-10-30')

describe('buildStatement', () => {
  it('paid to the Palmeiras: they owe us 15 % of what the guest paid them', () => {
    // #39 in PROD: 2 nights × 165 € paid directly → 49,50 € to BKC
    const st = build({ ...empty, stays: [stay({
      booking_number: 39, check_in: '2026-09-25', check_out: '2026-09-27',
      paid_direct: true, price_per_night: 165, cost_per_night: null,
    })] })
    expect(st.toUs).toBe(49.5)
    expect(st.toPalmeiras).toBe(0)
    expect(st.balance).toBe(49.5)
    expect(st.months[0].lines[0].kind).toBe('stay_direct')
  })

  it('collected by us: we owe the cost, never showing our selling price', () => {
    const st = build({ ...empty, stays: [stay({ cost_per_night: 50, check_in: '2026-10-15', check_out: '2026-10-16' })] })
    expect(st.toPalmeiras).toBe(50)
    expect(st.balance).toBe(-50)
    expect(st.months[0].lines[0].detail).not.toContain('55')
  })

  it('rent, card terminal and free lines land on the right side', () => {
    const st = build({
      ...empty,
      rents: [{ month: '2026-10', amount: 138.89, amount_mzn: 10000 }],
      card_payments: [{ booking_number: 43, guest: 'X', date: '2026-10-04', amount: 100 }],
      entries: [
        { month: '2026-10', type: 'income',  description: 'Dinner refund', amount: 20 },
        { month: '2026-10', type: 'expense', description: 'Laundry',       amount: 15 },
      ],
    })
    expect(st.toUs).toBe(120)
    expect(st.toPalmeiras).toBe(153.89)
    expect(st.months[0].lines.find(l => l.kind === 'rent')?.detail).toBe('10,000 MZN')
  })

  it("an entered month's actual commission shows only the exchange-rate gap", () => {
    const st = build({
      ...empty,
      stays: [stay({ paid_direct: true, price_per_night: 165, cost_per_night: null })],   // 3 n × 165 → 74,25
      adjustments: [{ month: '2026-10', gross_amount: 480, percent: 15, net_amount: 72 }],
    })
    const adj = st.months[0].lines.find(l => l.kind === 'adjustment')
    expect(adj?.toPalmeiras).toBe(2.25)
    expect(st.toUs - st.toPalmeiras).toBe(72)
  })

  it('no adjustment line when the actual figure matches', () => {
    const st = build({
      ...empty,
      stays: [stay({ paid_direct: true, price_per_night: 100, cost_per_night: null })],   // 45
      adjustments: [{ month: '2026-10', gross_amount: 300, percent: 15, net_amount: 45 }],
    })
    expect(st.months[0].lines.some(l => l.kind === 'adjustment')).toBe(false)
  })

  it('a stay not begun yet and the rent of next month are shown but stay out of the balance', () => {
    const st = build({
      ...empty,
      stays: [stay({ booking_number: 58, check_in: '2026-11-03', check_out: '2026-11-10', cost_per_night: 50 })],
      rents: [{ month: '2026-10', amount: 140, amount_mzn: 10000 }, { month: '2026-11', amount: 140, amount_mzn: 10000 }],
    })
    expect(st.balance).toBe(-140)
    expect(st.upcoming.map(l => l.kind)).toEqual(['rent', 'stay_ours'])
    expect(st.months.map(m => m.month)).toEqual(['2026-10'])
  })

  it('payments between us bring the balance back to zero', () => {
    const st = build({
      ...empty,
      stays: [
        stay({ paid_direct: true, price_per_night: 165, cost_per_night: null }),          // +74,25
        stay({ check_in: '2026-09-03', check_out: '2026-09-10', cost_per_night: 50 }),    // −350
      ],
      settlements: [{ date: '2026-11-15', direction: 'us_to_palmeiras', amount: 275.75, method: 'cash' }],
    })
    expect(st.balance).toBe(0)
    expect(balanceSentence(st.balance)).toBe('All settled')
    expect(st.months.map(m => m.month)).toEqual(['2026-10', '2026-09'])
  })
})

describe('fmtEurCents / balanceSentence', () => {
  it('shows cents only when there are some', () => {
    expect(fmtEurCents(330)).toBe('330 €')
    expect(fmtEurCents(49.5)).toMatch(/^49,50\s€$/)
  })
  it('names who owes whom', () => {
    expect(balanceSentence(12)).toMatch(/^The Palmeiras owes BKC 12/)
    expect(balanceSentence(-12)).toMatch(/^BKC owes the Palmeiras 12/)
  })
})
