import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PerPersonSplitView, type PerPersonSplitLabels } from './PerPersonSplitView'
import { splitPerPerson, type SplitItem } from '../../utils/perPersonSplit'

const labels: PerPersonSplitLabels = {
  title: 'Split per person', wholeStay: 'Whole stay', activitiesOnly: 'Activities only',
  included: 'Included', sum: 'Sum of shares', mismatch: 'MISMATCH {sum} vs {total}',
  categories: {
    accommodation: 'Accommodation', lessons: 'Lessons', rentals: 'Rentals', taxis: 'Taxis',
    dining: 'Dining', activities: 'Activities', center_access: 'Center access', extras: 'Extras',
  },
}
const fmtEur = (n: number) => `€${n.toFixed(2)}`
const items: SplitItem[] = [
  { category: 'accommodation', date: null, label: 'H 10/B × 7N', amount: 280, beneficiaries: [] },
  { category: 'lessons', date: '2026-11-12', label: 'private lesson 2h', amount: 120, beneficiaries: ['t'], gear: 'Rebel 9m' },
  { category: 'extras', date: '2026-11-15', label: 'Board Crazy Fly', amount: 300, beneficiaries: ['j'] },
]
const render = (expectedTotal: number) => renderToStaticMarkup(
  <PerPersonSplitView variant="card" splits={splitPerPerson(['t', 'j'], items)} names={{ t: 'Alice', j: 'Bob' }}
    expectedTotal={expectedTotal} labels={labels} fmtEur={fmtEur} fmtDate={d => d} />,
)

describe('PerPersonSplitView', () => {
  it('shows each person with their total, categories and lines', () => {
    const html = render(700)
    expect(html).toContain('Alice')
    expect(html).toContain('€260.00') // 140 + 120
    expect(html).toContain('€440.00') // 140 + 300
    expect(html).toContain('Accommodation')
    expect(html).toContain('(½)')      // the shared room
    expect(html).toContain('Rebel 9m') // gear
    expect(html).toContain('Sum of shares')
    expect(html).toContain('€700.00')
  })

  it('says so when the shares miss the booking total', () => {
    expect(render(700)).not.toContain('MISMATCH')
    expect(render(701)).toContain('MISMATCH €700.00 vs €701.00')
  })

  it('opens on "Whole stay"', () => {
    expect(render(700)).toMatch(/aria-pressed="true"[^>]*>Whole stay/)
  })

  it('renders nothing without travellers', () => {
    const html = renderToStaticMarkup(
      <PerPersonSplitView variant="plain" splits={[]} names={{}} expectedTotal={0} labels={labels} fmtEur={fmtEur} fmtDate={d => d} />,
    )
    expect(html).toBe('')
  })
})
