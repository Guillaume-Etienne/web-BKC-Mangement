import { describe, it, expect } from 'vitest'
import { buildExportDocument, staysOfMonth, nightsInMonth, stayFigure, exportBungalows, EXPORT_FORMATS } from './palmeirasExports'
import type { StatementInput, StatementStay } from './palmeirasStatement'

const stay = (o: Partial<StatementStay>): StatementStay => ({
  booking_number: 1, guest: 'Ann Martin', provisional: false, bungalow: 'B4',
  check_in: '2026-10-02', check_out: '2026-10-05',
  paid_direct: false, price_per_night: null, cost_per_night: 50, ...o,
})
const input = (stays: StatementStay[], bungalows?: string[]): StatementInput => ({
  eur_mzn_rate: 72, bungalows, stays, rents: [], adjustments: [], entries: [], card_payments: [], settlements: [],
})
const OPTS = { showAmounts: true }

describe('palmeirasExports', () => {
  it('keeps a stay that straddles the month, counting only its nights inside', () => {
    const s = stay({ check_in: '2026-09-29', check_out: '2026-10-03' })
    expect(staysOfMonth(input([s]), '2026-10')).toHaveLength(1)
    expect(nightsInMonth(s, '2026-10')).toBe(2)   // nights of 1 and 2 Oct
    expect(nightsInMonth(s, '2026-09')).toBe(2)   // nights of 29 and 30 Sep
  })

  it('leaves out a stay that checks out on the 1st (no night in the month)', () => {
    const s = stay({ check_in: '2026-09-28', check_out: '2026-10-01' })
    expect(staysOfMonth(input([s]), '2026-10')).toHaveLength(0)
  })

  it('lists empty bungalows too, in natural order', () => {
    expect(exportBungalows(input([stay({ bungalow: 'B10' })], ['B2', 'B10', 'B1']))).toEqual(['B1', 'B2', 'B10'])
  })

  it('states the figure by arrival month; a stay that began earlier carries none', () => {
    expect(stayFigure(stay({}), '2026-10').text).toBe('BKC pays you 150 €')
    const direct = stay({ paid_direct: true, price_per_night: 100, cost_per_night: null })
    expect(stayFigure(direct, '2026-10').text).toContain('BKC share 15% = 45 €')
    expect(stayFigure(direct, '2026-11').side).toBe('none')
  })

  it('never prints a selling price: a BKC-collected stay shows the cost only', () => {
    const html = buildExportDocument('list', input([stay({ cost_per_night: 50 })]), '2026-10', OPTS)
    expect(html).toContain('150 €')
    expect(html).toContain('Paid to BKC')
  })

  it('escapes guest names', () => {
    const html = buildExportDocument('sheets', input([stay({ guest: '<b>x</b>' })]), '2026-10', OPTS)
    expect(html).not.toContain('<b>x</b>')
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
  })

  it('grid: one cell per day on every row, whatever the stays', () => {
    const html = buildExportDocument('grid', input([
      stay({ check_in: '2026-10-02', check_out: '2026-10-05' }),
      stay({ bungalow: 'B5', check_in: '2026-09-28', check_out: '2026-10-03' }),
      stay({ bungalow: 'B6', check_in: '2026-10-30', check_out: '2026-11-04' }),
    ], ['B4', 'B5', 'B6', 'B7']), '2026-10', OPTS)
    const body = html.split('<tbody>')[1].split('</tbody>')[0]
    const rows = body.split('<tr>').slice(1)
    expect(rows).toHaveLength(4)
    for (const r of rows) {
      const span = [...r.matchAll(/<td(?: colspan="(\d+)")?/g)].reduce((t, m) => t + Number(m[1] ?? 1), 0)
      expect(span).toBe(31)
    }
  })

  it('every format renders for an empty month', () => {
    for (const f of EXPORT_FORMATS) {
      expect(buildExportDocument(f.id, input([], ['B1']), '2026-10', OPTS)).toContain('<body>')
    }
  })
})
