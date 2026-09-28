import { describe, it, expect, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

import { buildBilledActivities } from './billedActivities'

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
