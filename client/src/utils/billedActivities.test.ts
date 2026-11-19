import { describe, it, expect, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

import { buildBilledActivities, billedActivityFormValues, planBilledActivityChanges } from './billedActivities'
import type { ActivityBooking } from '../types/database'

let n = 0
const base = {
  providerId: 'prov', date: '2026-09-28', label: 'Boat trip', notes: null,
  newId: () => `id${++n}`,
}

describe('buildBilledActivities', () => {
  it('one booking, two guests: one row, price × 2', () => {
    const rows = buildBilledActivities({ ...base, pricePerPerson: 40, totalCost: 0,
      guests: [{ participantId: 'p1', bookingId: 'b1' }, { participantId: 'p2', bookingId: 'b1' }] })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ booking_id: 'b1', nb_persons: 2, participant_ids: ['p1', 'p2'],
      price_client: 80, price_provider: 0, payment_flow: 'we_pay_provider' })
  })

  it('guests from two bookings: one row each, each billed for its own guests', () => {
    const rows = buildBilledActivities({ ...base, pricePerPerson: 40, totalCost: 0,
      guests: [{ participantId: 'p1', bookingId: 'b1' }, { participantId: 'q1', bookingId: 'b2' },
               { participantId: 'q2', bookingId: 'b2' }] })
    expect(rows.map(r => [r.booking_id, r.price_client])).toEqual([['b1', 40], ['b2', 80]])
  })

  it('spreads the cost by headcount and the rows add up to it exactly', () => {
    const rows = buildBilledActivities({ ...base, pricePerPerson: 50, totalCost: 100,
      guests: [{ participantId: 'p1', bookingId: 'b1' }, { participantId: 'q1', bookingId: 'b2' },
               { participantId: 'r1', bookingId: 'b3' }] })
    expect(rows.map(r => r.price_provider)).toEqual([33.33, 33.33, 33.34])
    expect(rows.reduce((s, r) => s + r.price_provider, 0)).toBeCloseTo(100, 10)
  })

  it('ignores a guest picked twice', () => {
    const rows = buildBilledActivities({ ...base, pricePerPerson: 10, totalCost: 0,
      guests: [{ participantId: 'p1', bookingId: 'b1' }, { participantId: 'p1', bookingId: 'b1' }] })
    expect(rows[0].nb_persons).toBe(1)
    expect(rows[0].price_client).toBe(10)
  })
})

// The 20/11 "North Wind Spot" as billed in PROD: 50 €/guest, #054 ×2, #077 ×1, #085 ×2.
const row = (id: string, booking: string, people: string[], perGuest = 50, cost = 0): ActivityBooking => ({
  id, provider_id: 'inhouse', booking_id: booking, date: '2026-11-20', label: 'North Wind Spot',
  nb_persons: people.length, participant_ids: people, price_client: perGuest * people.length,
  price_provider: cost, payment_flow: 'we_pay_provider', notes: null, created_at: '', day_activity_id: 'card',
})
const northWind = [row('r54', 'b54', ['n1', 'n2']), row('r77', 'b77', ['j1']), row('r85', 'b85', ['f1', 'a1'])]

describe('buildBilledActivities — link to the Daily card', () => {
  it('stamps day_activity_id only when given', () => {
    const g = [{ participantId: 'p1', bookingId: 'b1' }]
    expect(buildBilledActivities({ ...base, pricePerPerson: 1, totalCost: 0, guests: g })[0]).not.toHaveProperty('day_activity_id')
    expect(buildBilledActivities({ ...base, pricePerPerson: 1, totalCost: 0, guests: g, dayActivityId: 'card' })[0].day_activity_id).toBe('card')
  })
})

describe('billedActivityFormValues', () => {
  it('reads back the guests, the price per guest and the total cost', () => {
    expect(billedActivityFormValues(northWind)).toEqual({
      participantIds: ['n1', 'n2', 'j1', 'f1', 'a1'], pricePerPerson: 50, totalCost: 0, mixedPrices: false })
  })
  it('flags a booking billed at another price per guest', () => {
    expect(billedActivityFormValues([northWind[0], row('r77', 'b77', ['j1'], 40)]).mixedPrices).toBe(true)
  })
  it('nothing billed yet: no guests, no price', () => {
    expect(billedActivityFormValues([])).toEqual({ participantIds: [], pricePerPerson: null, totalCost: 0, mixedPrices: false })
  })
})

describe('planBilledActivityChanges', () => {
  const rebuild = (guests: [string, string][], pricePerPerson = 50) => buildBilledActivities({
    providerId: 'inhouse', date: '2026-11-20', label: 'North Wind Spot', notes: null, totalCost: 0,
    pricePerPerson, dayActivityId: 'card', guests: guests.map(([participantId, bookingId]) => ({ participantId, bookingId })),
  })

  it('price change: the same three rows rewritten, nothing inserted or deleted', () => {
    const plan = planBilledActivityChanges(northWind, rebuild([['n1', 'b54'], ['n2', 'b54'], ['j1', 'b77'], ['f1', 'b85'], ['a1', 'b85']], 60))
    expect(plan.inserts).toEqual([])
    expect(plan.deleteIds).toEqual([])
    expect(plan.updates.map(u => [u.id, u.price_client])).toEqual([['r54', 120], ['r77', 60], ['r85', 120]])
  })

  it('Jean drops out, a guest of another booking joins, Alexandra stays alone', () => {
    const plan = planBilledActivityChanges(northWind, rebuild([['n1', 'b54'], ['n2', 'b54'], ['a1', 'b85'], ['x1', 'b90']]))
    expect(plan.deleteIds).toEqual(['r77'])
    expect(plan.inserts.map(i => [i.booking_id, i.price_client])).toEqual([['b90', 50]])
    expect(plan.updates.find(u => u.id === 'r85')).toMatchObject({ nb_persons: 1, participant_ids: ['a1'], price_client: 50 })
  })

  it('keeps the provider a row was moved to, drops a duplicate row, ignores a row whose booking is gone', () => {
    const moved = { ...northWind[1], provider_id: 'boatman' }
    const dup = row('r77bis', 'b77', ['j1'])
    const orphan = { ...row('r00', 'x', ['z']), booking_id: null }
    const plan = planBilledActivityChanges([moved, dup, orphan], rebuild([['j1', 'b77']]))
    expect(plan.updates).toEqual([expect.objectContaining({ id: 'r77', provider_id: 'boatman' })])
    expect(plan.deleteIds).toEqual(['r77bis'])
  })
})
