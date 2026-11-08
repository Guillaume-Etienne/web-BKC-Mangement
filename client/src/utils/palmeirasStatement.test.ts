import { describe, it, expect } from 'vitest'
import { buildStatement, buildLedger, rentPeriod, balanceSentence, balanceSentenceMzn, fmtEurCents, fmtMznEquivalent, rowMzn, withMznAmounts, stayInternal, summarizeInternals, type StatementInput, type StatementStay } from './palmeirasStatement'

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

describe('metical equivalents', () => {
  it('converts at the current rate, and shows nothing without a rate', () => {
    expect(fmtMznEquivalent(50, 70)).toBe('≈ 3,500 MZN')
    expect(fmtMznEquivalent(-50, 70)).toBe('≈ 3,500 MZN')
    expect(fmtMznEquivalent(50, null)).toBe('')
    expect(fmtMznEquivalent(50, 0)).toBe('')
  })

  it('a stay states its amounts in both currencies; no rate, no made-up MZN', () => {
    const line = (rate: number | null) => build({ ...empty, eur_mzn_rate: rate, stays: [stay({ cost_per_night: 50 })] }).months[0].lines[0].detail
    expect(line(70)).toContain('× 50 € (≈ 3,500 MZN)')
    expect(line(null)).not.toContain('MZN')
  })

  it('a rent and its full payment keep the real meticals, whatever the rate became', () => {
    const st = build({ ...empty, eur_mzn_rate: 80,
      rents: [{ month: '2026-09', amount: 142.86, amount_mzn: 10000 }],
      settlements: [
        { id: 'full', date: '2026-09-20', direction: 'us_to_palmeiras', amount: 142.86, method: null, rent_month: '2026-09' },
        { id: 'part', date: '2026-09-21', direction: 'us_to_palmeiras', amount: 50, method: null, rent_month: '2026-09' },
      ],
    })
    const rows = buildLedger(st).months[0].rows
    expect(rows.find(r => r.kind === 'rent')?.mzn).toBe(10000)
    expect(rows.find(r => r.settlementId === 'full')?.mzn).toBe(10000)
    expect(rows.find(r => r.settlementId === 'part')?.mzn).toBeNull()
  })
})

describe('the rate over time', () => {
  const rates = [{ valid_from: '2000-01-01', rate: 70 }, { valid_from: '2026-10-10', rate: 72 }]

  it('a line keeps the rate of its date; a new rate leaves it as it was', () => {
    const i = { ...empty, eur_mzn_rate: 72, eur_mzn_rates: rates, stays: [stay({ cost_per_night: 50 })] }
    const rows = () => buildLedger(build(i)).months[0].rows
    expect(rowMzn(rows()[0])).toBe(10500)    // 150 € at 70, the rate of 2 Oct
    expect(rows()[0].detail).toContain('≈ 3,500 MZN')
  })

  it('without the history (an older RPC), the latest rate everywhere', () => {
    expect(rowMzn(buildLedger(build({ ...empty, eur_mzn_rate: 72, stays: [stay({ cost_per_night: 50 })] })).months[0].rows[0])).toBe(10800)
  })

  it('the month total adds up each line at its own rate', () => {
    const st = build({ ...empty, eur_mzn_rate: 72, eur_mzn_rates: rates, stays: [
      stay({ check_in: '2026-10-02', check_out: '2026-10-03', cost_per_night: 50 }),   // 3 500
      stay({ check_in: '2026-10-12', check_out: '2026-10-13', cost_per_night: 50 }),   // 3 600
    ] })
    expect(buildLedger(st).months[0].toPalmeirasMzn).toBe(7100)
  })

  it('a payment takes off its own meticals; no rate, no total', () => {
    const paid = build({ ...empty, eur_mzn_rate: 70, stays: [stay({ cost_per_night: 50 })],
      settlements: [{ id: 's', date: '2026-10-20', direction: 'us_to_palmeiras', amount: 100, method: null }] })
    expect(buildLedger(paid).months[0].toPalmeirasMzn).toBe(3500)
    expect(buildLedger(build({ ...empty, eur_mzn_rate: null, stays: [stay({})] })).months[0].toPalmeirasMzn).toBeNull()
  })

  it('the Palmeiras price sets the euros of both kinds of stay at the rate of the arrival', () => {
    const i = withMznAmounts({ ...empty, eur_mzn_rate: 72, eur_mzn_rates: rates, stays: [
      // B4 at 4 000 MZN, 3 nights, we collected (rate 70): we owe 85 %
      stay({ check_in: '2026-10-02', check_out: '2026-10-05', cost_per_night: 50, palmeiras_price_mzn: 4000 }),
      // See View 5 at 12 000 MZN, 2 nights, paid to them (rate 72): they owe 15 %
      stay({ check_in: '2026-10-12', check_out: '2026-10-14', paid_direct: true, price_per_night: 170, cost_per_night: null, palmeiras_price_mzn: 12000 }),
    ] })
    expect(i.stays.map(s => [s.cost_per_night, s.price_per_night])).toEqual([[48.57, null], [null, 166.67]])
    const st = build(i)
    expect([st.toPalmeirasMzn, st.toUsMzn, st.balanceMzn, st.mznExact]).toEqual([10200, 3600, -6600, true])
    const rows = buildLedger(st).months[0].rows
    expect(rows.map(r => r.mzn)).toEqual([10200, 3600])
    expect(rows[0].detail).toContain('3 nights × 4,000 MZN − 15% = 10,200 MZN')
    expect(rows[1].detail).toContain('guest paid the Palmeiras 2 nights × 12,000 MZN = 24,000 MZN')
  })

  it('no Palmeiras price: the euros stay as they are, and the meticals are marked ≈', () => {
    const i = withMznAmounts({ ...empty, eur_mzn_rate: 72, eur_mzn_rates: rates, stays: [stay({ cost_per_night: 50 })] })
    expect(i.stays[0].cost_per_night).toBe(50)
    const st = build(i)
    expect([st.balanceMzn, st.mznExact]).toEqual([-10500, false])   // 3 × 50 € × 70
    expect(balanceSentenceMzn(st.balanceMzn ?? 0, st.mznExact)).toBe('BKC owes the Palmeiras ≈ 10,500 MZN')
  })
})

describe('meticals as the base (2026-11-08)', () => {
  const rates = [{ valid_from: '2000-01-01', rate: 70 }, { valid_from: '2026-10-10', rate: 72 }]

  it('a rent paid in meticals is settled to the metical, a free line in MZN counts as such', () => {
    const i = withMznAmounts({
      ...empty, eur_mzn_rate: 72, eur_mzn_rates: rates,
      rents: [{ month: '2026-10', amount: 138.89, amount_mzn: 10000 }],
      settlements: [{ id: 's', date: '2026-10-20', direction: 'us_to_palmeiras', amount: 0, amount_mzn: 10000, method: 'cash', rent_month: '2026-10' }],
      entries: [{ month: '2026-10', date: '2026-10-21', type: 'income', description: 'Fuel', amount: 0, amount_mzn: 1500 }],
    })
    expect(i.settlements[0].amount).toBe(138.89)
    expect(i.entries[0].amount).toBe(20.83)
    const st = build(i)
    expect([st.paidByUsMzn, st.balanceMzn, st.mznExact]).toEqual([10000, 1500, true])
    expect(balanceSentenceMzn(st.balanceMzn ?? 0, st.mznExact)).toBe('The Palmeiras owes BKC 1,500 MZN')
  })

  it('a card payment on their terminal counts what the terminal charged', () => {
    const st = build(withMznAmounts({ ...empty, eur_mzn_rate: 72, eur_mzn_rates: rates,
      card_payments: [{ booking_number: 7, guest: 'G', date: '2026-10-20', amount: 100, amount_mzn: 7300 }] }))
    expect([st.toUsMzn, st.mznExact, st.toUs]).toEqual([7300, true, 101.39])
  })

  it('the actual commission entered in meticals corrects the month in meticals', () => {
    const st = build(withMznAmounts({ ...empty, eur_mzn_rate: 72, eur_mzn_rates: rates,
      stays: [stay({ check_in: '2026-10-12', check_out: '2026-10-14', paid_direct: true, price_per_night: 170, cost_per_night: null, palmeiras_price_mzn: 12000 })],
      adjustments: [{ month: '2026-10', gross_amount: 0, percent: 12.5, net_amount: 0, gross_amount_mzn: 24000, net_amount_mzn: 3000 }],
    }))
    const adj = st.months[0].lines.find(l => l.kind === 'adjustment')!
    expect([adj.mzn, adj.toPalmeiras, adj.toUs]).toEqual([600, 8.33, 0])   // 3 000 − 3 600, at 72
    expect([st.balanceMzn, st.mznExact]).toEqual([3000, true])
    const rows = buildLedger(st).months[0].rows
    expect(rows.map(r => r.balanceMzn)).toEqual([3600, 3000])
    expect(buildLedger(st).months[0]).toMatchObject({ closingMzn: 3000, closingMznExact: true })
  })

  it('a line in euros only makes the running balance approximate from there on', () => {
    const st = build(withMznAmounts({ ...empty, eur_mzn_rate: 72, eur_mzn_rates: rates,
      rents: [{ month: '2026-09', amount: 142.86, amount_mzn: 10000 }],
      entries: [{ month: '2026-10', date: '2026-10-20', type: 'expense', description: 'Old line', amount: 10 }],
    }))
    const rows = buildLedger(st).months.flatMap(m => m.rows)
    expect(rows.map(r => [r.balanceMzn, r.balanceMznExact])).toEqual([[-10000, true], [-10720, false]])
  })

  it('half a metical is settled; the sentence carries ≈ when the balance is an equivalent', () => {
    expect(balanceSentenceMzn(0.3, true)).toBe('All settled')
    expect(balanceSentenceMzn(12345.4, true)).toBe('The Palmeiras owes BKC 12,345 MZN')
    expect(balanceSentenceMzn(-500, false)).toBe('BKC owes the Palmeiras ≈ 500 MZN')
  })
})

describe('stayInternal (admin only)', () => {
  it('billed and margin of a stay we collected', () => {
    const r = stayInternal(stay({ cost_per_night: 50 }), 55)
    expect([r.nights, r.billed, r.margin, r.marginPct]).toEqual([3, 165, 15, 9.1])
    expect(r.lowMargin).toBe(true)
    expect(r.noPrice).toBe(false)
  })

  it('a stay sold at 0 € is flagged, its cost is a loss', () => {
    const r = stayInternal(stay({ check_in: '2026-10-15', check_out: '2026-10-16', cost_per_night: 50 }), 0)
    expect([r.billed, r.margin, r.marginPct, r.noPrice, r.lowMargin]).toEqual([0, -50, null, true, false])
  })

  it('a stay paid directly: nothing billed by us, the commission is our margin', () => {
    const r = stayInternal(stay({ paid_direct: true, price_per_night: 100, cost_per_night: null }), 100)
    expect([r.direct, r.billed, r.guestPaid, r.margin, r.marginPct, r.lowMargin]).toEqual([true, 0, 300, 45, 15, false])
  })

  it('a stay paid directly at 0 € is flagged too', () => {
    const r = stayInternal(stay({ paid_direct: true, price_per_night: 0, cost_per_night: null }), 0)
    expect([r.noPrice, r.margin, r.marginPct]).toEqual([true, 0, null])
  })

  it('a commission counts in the total, which then gives no percentage of what we billed', () => {
    const ours = stayInternal(stay({ cost_per_night: 50 }), 60)
    const direct = stayInternal(stay({ paid_direct: true, price_per_night: 100, cost_per_night: null }), 100)
    expect(summarizeInternals([ours]).marginPct).toBe(16.7)
    const s = summarizeInternals([ours, direct])
    expect([s.billed, s.margin, s.marginPct]).toEqual([180, 75, null])
  })

  it('sums by month and by bungalow, in natural order', () => {
    const a = stayInternal(stay({ bungalow: 'B10', cost_per_night: 50 }), 60)
    const b = stayInternal(stay({ bungalow: 'B4', cost_per_night: 50 }), 55)
    const c = stayInternal(stay({ bungalow: 'B4', cost_per_night: 50 }), 0)
    const s = summarizeInternals([a, undefined, b, c, null])
    expect([s.billed, s.margin]).toEqual([345, -105])
    expect(s.byBungalow).toEqual([{ bungalow: 'B4', margin: -135 }, { bungalow: 'B10', margin: 30 }])
  })
})
