import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import PalmeirasTimeline from './PalmeirasTimeline'
import { buildStatement, type StatementInput } from '../../utils/palmeirasStatement'

// Shaped like PROD on 2026-10-30 (numbers only, no real names).
const input: StatementInput = {
  eur_mzn_rate: 72,
  bungalows: ['B1', 'B2', 'B3', 'B4', 'Bungalow See View 5'],
  stays: [
    { booking_number: 39, guest: 'Guest A', provisional: false, bungalow: 'Bungalow See View 5',
      check_in: '2026-09-25', check_out: '2026-09-27', paid_direct: true, price_per_night: 165, cost_per_night: null },
    { booking_number: 52, guest: 'Guest B', provisional: false, bungalow: 'B4',
      check_in: '2026-10-15', check_out: '2026-10-16', paid_direct: false, price_per_night: null, cost_per_night: 50 },
    { booking_number: 64, guest: 'Guest C', provisional: true, bungalow: 'B4',
      check_in: '2026-10-21', check_out: '2026-10-23', paid_direct: true, price_per_night: 55, cost_per_night: null },
  ],
  rents: [{ month: '2026-10', amount: 138.89, amount_mzn: 10000 }],
  adjustments: [], entries: [], card_payments: [], settlements: [],
}

describe('PalmeirasTimeline', () => {
  const html = renderToStaticMarkup(<PalmeirasTimeline input={input} statement={buildStatement(input, '2026-10-30')} />)

  it('draws every bungalow, even an empty one', () => {
    for (const b of input.bungalows!) expect(html).toContain(`>${b}<`)
  })

  it('puts the amount each stay weighs on its bar', () => {
    expect(html).toContain('#39 · +49,50')
    expect(html).toContain('#52 · 50 € Palm.')
    expect(html).toContain('#64 · +16,50')
  })

  it('shows the monthly totals with the rent in meticals', () => {
    expect(html).toContain('incl. rent 10,000 MZN')
    expect(html).toContain('October 2026')
  })
})
