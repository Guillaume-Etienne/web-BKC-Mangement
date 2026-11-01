import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import PalmeirasLedger from './PalmeirasLedger'
import { buildStatement, stayInternal, type StatementInput, type StatementStay } from '../../utils/palmeirasStatement'

const stay: StatementStay = {
  booking_number: 1, guest: 'Ann Martin', provisional: false, bungalow: 'B4',
  check_in: '2026-10-02', check_out: '2026-10-05',
  paid_direct: false, price_per_night: null, cost_per_night: 50,
}
const input: StatementInput = {
  eur_mzn_rate: 70, bungalows: ['B4'], stays: [stay],
  rents: [{ month: '2026-09', amount: 142.86, amount_mzn: 10000 }],
  adjustments: [], entries: [], card_payments: [], settlements: [],
}
const statement = buildStatement(input, '2026-10-30')
const internals = { 'stay-0': stayInternal(stay, 987)! }

describe('PalmeirasLedger', () => {
  it('the Palmeiras view has the meticals, and nothing of our price or margin', () => {
    const html = renderToStaticMarkup(<PalmeirasLedger statement={statement} eurMznRate={70} />)
    expect(html).toContain('≈ 10,500 MZN')           // 150 € owed for the stay
    expect(html).toContain('10,000 MZN')             // the rent, in real meticals
    expect(html).toContain('1 € = 70 MZN')
    expect(html).not.toContain('Billed')
    expect(html).not.toContain('Margin')
    expect(html).not.toContain('987')
  })

  it('the admin view adds the price billed, the margin and the margin by bungalow', () => {
    const html = renderToStaticMarkup(<PalmeirasLedger statement={statement} eurMznRate={70} stayInternals={internals} />)
    expect(html).toContain('Billed')
    expect(html).toContain('987 € / night')
    expect(html).toContain('Margin by bungalow:')
    expect(html).toContain('B4 +2')                  // (987 − 50) × 3 = 2 811 €
  })

  it('without a rate, no metical equivalent is made up', () => {
    const html = renderToStaticMarkup(<PalmeirasLedger statement={buildStatement({ ...input, eur_mzn_rate: null }, '2026-10-30')} eurMznRate={null} />)
    expect(html).not.toContain('≈')
    expect(html).toContain('10,000 MZN')             // a real amount stays
  })
})
