import { describe, it, expect } from 'vitest'
import { buildStatement, buildLedger, rentPeriod, balanceSentence, fmtEurCents, type StatementInput, type StatementStay } from './palmeirasStatement'

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
    expect(st.upcoming.map(l => l.kind)).toEqual(['stay_ours', 'rent'])   // 03/11, then the rent from 15/11
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

describe('rent from the 15th to the 15th', () => {
  it('is dated on the 15th it starts and due from that day', () => {
    const rents = [{ month: '2026-10', amount: 140, amount_mzn: 10000 }]
    const before = buildStatement({ ...empty, rents }, '2026-10-14')
    const after  = buildStatement({ ...empty, rents }, '2026-10-15')
    expect(before.balance).toBe(0)
    expect(before.upcoming[0].title).toBe('House rent 15/10/2026 → 15/11/2026')
    expect(after.balance).toBe(-140)
  })
  it('crosses the year end', () => {
    expect(rentPeriod('2026-12')).toEqual({ start: '2026-12-15', end: '2027-01-15' })
  })
})

describe('buildLedger', () => {
  const st = build({
    ...empty,
    stays: [
      stay({ booking_number: 39, check_in: '2026-09-25', check_out: '2026-09-27', paid_direct: true, price_per_night: 165, cost_per_night: null }),
      stay({ booking_number: 52, check_in: '2026-10-15', check_out: '2026-10-16', cost_per_night: 50 }),
      stay({ booking_number: 58, check_in: '2026-11-03', check_out: '2026-11-10', cost_per_night: 50 }),
    ],
    rents: [{ month: '2026-09', amount: 140, amount_mzn: 10000 }, { month: '2026-10', amount: 140, amount_mzn: 10000 }],
    entries: [{ month: '2026-10', date: '2026-10-20', type: 'income', description: 'Dinner refund', amount: 20 }],
    settlements: [{ id: 's1', date: '2026-10-28', direction: 'us_to_palmeiras', amount: 100, method: 'cash' }],
  })
  const { months, upcoming } = buildLedger(st)

  it('runs a balance in date order that ends on the statement balance', () => {
    const rows = months.flatMap(m => m.rows)
    expect(rows.map(r => r.date)).toEqual([...rows.map(r => r.date)].sort())
    expect(rows[rows.length - 1].balance).toBe(st.balance)
    expect(months.map(m => [m.month, m.closing])).toEqual([['2026-09', -90.5], ['2026-10', st.balance]])
  })

  it('a free line keeps its own day, a payment is a row that reduces its side', () => {
    const oct = months[1].rows
    expect(oct.find(r => r.kind === 'entry')?.date).toBe('2026-10-20')
    const pay = oct.find(r => r.kind === 'settlement')!
    expect(pay.toPalmeiras).toBe(-100)
    expect(pay.settlementId).toBe('s1')
  })

  it('what is not due yet stays out, without a balance', () => {
    expect(upcoming.map(r => r.title)).toEqual(['Bungalow rented through BKC — #58 · Guest'])
    expect(upcoming[0].balance).toBeNull()
  })
})
