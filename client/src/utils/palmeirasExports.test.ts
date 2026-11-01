import { describe, it, expect } from 'vitest'
import { buildExportDocument, staysOfMonth, nightsInMonth, stayFigure, exportBungalows, EXPORT_FORMATS } from './palmeirasExports'
import { stayInternal, type StatementInput, type StatementStay } from './palmeirasStatement'

const stay = (o: Partial<StatementStay>): StatementStay => ({
  booking_number: 1, guest: 'Ann Martin', provisional: false, bungalow: 'B4',
  check_in: '2026-10-02', check_out: '2026-10-05',
  paid_direct: false, price_per_night: null, cost_per_night: 50, ...o,
})
const input = (stays: StatementStay[], bungalows?: string[]): StatementInput => ({
  eur_mzn_rate: 72, bungalows, stays, rents: [], adjustments: [], entries: [], card_payments: [], settlements: [],
})
const OPTS = { showAmounts: true, lang: 'en' as const }

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

  it('translates labels and month in FR / ES / PT, amounts included', () => {
    const i = input([stay({})], ['B4'])
    const html = (lang: 'fr' | 'es' | 'pt') => buildExportDocument('list', i, '2026-10', { showAmounts: true, lang })
    expect(html('fr')).toContain('Octobre 2026')
    expect(html('fr')).toContain('Payé à BKC')
    expect(html('fr')).toContain('BKC vous paie 150 €')
    expect(html('es')).toContain('Pagado a BKC')
    expect(html('es')).toContain('BKC le paga 150 €')
    expect(html('pt')).toContain('Outubro')
    expect(html('pt')).toContain('Pago à BKC')
    expect(html('pt')).toContain('a BKC paga-vos 150 €')
    expect(html('pt')).toContain('<html lang="pt">')
  })

  it('every language renders every format with no leftover English label', () => {
    for (const lang of ['fr', 'es', 'pt'] as const) for (const f of EXPORT_FORMATS) {
      const html = buildExportDocument(f.id, input([stay({})], ['B4']), '2026-10', { showAmounts: true, lang })
      expect(html).not.toContain('Paid to')
      expect(html).not.toContain('No stay')
    }
  })

  it('internal sheet: prices and margins per stay and per bungalow, with its warning', () => {
    const i = input([
      stay({ booking_number: 7, check_in: '2026-10-02', check_out: '2026-10-05', cost_per_night: 50 }),
      stay({ booking_number: 8, check_in: '2026-10-10', check_out: '2026-10-11', cost_per_night: 50 }),
    ], ['B4'])
    const html = buildExportDocument('internal', i, '2026-10', { ...OPTS, internals: {
      'stay-0': stayInternal(i.stays[0], 55),
      'stay-1': stayInternal(i.stays[1], 0),
    } })
    expect(html).toContain('INTERNAL – BKC ONLY')
    expect(html).toContain('165 €')          // 3 nights × 55 €
    expect(html).toContain('no price')       // the stay sold at 0 €
    expect(html).toContain('B4 −35 €')       // +15 € − 50 €
    expect(html).toContain('1 € = 72 MZN')
  })

  it('the selling price stays out of every sheet meant for the Palmeiras, internals or not', () => {
    const i = input([stay({ cost_per_night: 50 })], ['B4'])
    const internals = { 'stay-0': stayInternal(i.stays[0], 987) }
    for (const f of EXPORT_FORMATS.filter(x => !x.internal)) {
      const html = buildExportDocument(f.id, i, '2026-10', { ...OPTS, internals })
      expect(html).not.toContain('987')
      expect(html).not.toContain('INTERNAL')
    }
    expect(buildExportDocument('internal', i, '2026-10', { ...OPTS, internals })).toContain('987')
  })

  it('internal sheet: the commission and the actual figure of the month count in the total margin', () => {
    const i: StatementInput = {
      ...input([
        stay({ check_in: '2026-10-02', check_out: '2026-10-05', cost_per_night: 50 }),
        stay({ booking_number: 9, bungalow: 'B5', check_in: '2026-10-10', check_out: '2026-10-12', paid_direct: true, price_per_night: 100, cost_per_night: null }),
      ], ['B4', 'B5']),
      adjustments: [{ month: '2026-10', gross_amount: 200, percent: 15, net_amount: 25 }],
    }
    const internals = { 'stay-0': stayInternal(i.stays[0], 60), 'stay-1': stayInternal(i.stays[1], 100) }
    const html = buildExportDocument('internal', i, '2026-10', { ...OPTS, internals })
    expect(html).toContain('Commission adjustment:</b> −5 €')   // 25 € actual − 30 € computed
    expect(html).toContain('Total margin: +55 €')               // 30 € + 30 € − 5 €
    expect(html).toContain('B4 +30 € · B5 +30 €')
  })

  it('internal sheet without the data says so, rather than printing zeros', () => {
    expect(buildExportDocument('internal', input([stay({})]), '2026-10', OPTS)).toContain('No margin data')
  })

  it('every format renders for an empty month', () => {
    for (const f of EXPORT_FORMATS) {
      expect(buildExportDocument(f.id, input([], ['B1']), '2026-10', OPTS)).toContain('<body>')
    }
  })
})
