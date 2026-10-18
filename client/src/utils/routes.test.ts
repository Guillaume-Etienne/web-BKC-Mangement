import { describe, it, expect } from 'vitest'
import { pageFromPath, pathForPage } from './routes'

describe('routes', () => {
  it('puts Home at the root and every other page at its id', () => {
    expect(pathForPage('home')).toBe('/')
    expect(pathForPage('accounting')).toBe('/accounting')
  })

  it('reads a path back to its page', () => {
    expect(pageFromPath('/')).toBe('home')
    expect(pageFromPath('/planning')).toBe('planning')
    expect(pageFromPath('/taxis/')).toBe('taxis')
    expect(pageFromPath('/Bookings')).toBe('bookings')
  })

  it('falls back to Home for an unknown path', () => {
    expect(pageFromPath('/nope')).toBe('home')
    expect(pageFromPath('/planning/extra')).toBe('home')
  })

  it('round-trips every page', () => {
    for (const p of ['home', 'planning', 'bookings', 'clients', 'management', 'taxis',
      'equipment', 'documents', 'accounting', 'activities', 'requests'] as const) {
      expect(pageFromPath(pathForPage(p))).toBe(p)
    }
  })
})
