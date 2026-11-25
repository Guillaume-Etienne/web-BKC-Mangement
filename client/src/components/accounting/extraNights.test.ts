import { describe, it, expect } from 'vitest'
import { extraNights, extraNightsLabel } from './extraNights'

describe('extraNights', () => {
  it('counts the nights between arrival and pick-up (22→25 = 3, not 4)', () => {
    expect(extraNights('2026-11-22', '2026-11-25')).toBe(3)
  })
  it('is 0 for an empty, same-day or reversed range', () => {
    expect(extraNights('2026-11-22', '')).toBe(0)
    expect(extraNights('2026-11-22', '2026-11-22')).toBe(0)
    expect(extraNights('2026-11-25', '2026-11-22')).toBe(0)
  })
})

describe('extraNightsLabel', () => {
  it('writes the range into the label the guest reads', () => {
    expect(extraNightsLabel('Gear storage', '2026-11-22', '2026-11-25', 'en')).toBe('Gear storage · 3 nights (22/11 → 25/11)')
  })
  it('singular for one night, FR too', () => {
    expect(extraNightsLabel('Stockage', '2026-11-22', '2026-11-23', 'fr')).toBe('Stockage · 1 nuit (22/11 → 23/11)')
  })
  it('leaves the label alone without a valid range', () => {
    expect(extraNightsLabel('Gear storage', '2026-11-22', '', 'en')).toBe('Gear storage')
  })
})
