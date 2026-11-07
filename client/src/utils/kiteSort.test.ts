import { describe, it, expect } from 'vitest'
import { sortKitesBySize } from './kiteSort'

const k = (name: string, size: string | null) => ({ name, size })

describe('sortKitesBySize', () => {
  it('sorts numerically, not alphabetically', () => {
    const out = sortKitesBySize([k('a', '12m'), k('b', '9m'), k('c', '10')]).map(x => x.size)
    expect(out).toEqual(['9m', '10', '12m'])
  })
  it('handles decimals with a comma, puts no-size last, ties by name', () => {
    const out = sortKitesBySize([k('z', null), k('b', '7,5'), k('a', '7.5'), k('c', '6')]).map(x => x.name)
    expect(out).toEqual(['c', 'a', 'b', 'z'])
  })
  it('does not mutate its input', () => {
    const input = [k('a', '12'), k('b', '9')]
    sortKitesBySize(input)
    expect(input[0].size).toBe('12')
  })
})
