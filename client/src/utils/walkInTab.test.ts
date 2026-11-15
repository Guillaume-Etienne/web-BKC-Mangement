import { describe, it, expect } from 'vitest'
import { _booking, _equipmentRental, _lesson, _payment } from '../types/canary'
import type { Booking, EquipmentRental, Lesson, Payment } from '../types/database'
import { splitTabPayment, tabDue, visitBalances } from './walkInTab'

function visit(id: string, date: string): Booking {
  return { ..._booking, id, check_in: date, check_out: date, kind: 'day_visitor', status: 'confirmed', num_center_access: 0 } as Booking
}
function lesson(bookingId: string, hours: number, rate: number): Lesson {
  return { ..._lesson, id: `l-${bookingId}-${hours}`, booking_id: bookingId, duration_hours: hours, price_per_hour: rate } as Lesson
}
function payment(bookingId: string, amount: number, over: Partial<Payment> = {}): Payment {
  return { ..._payment, id: `p-${bookingId}-${amount}`, booking_id: bookingId, amount, ...over } as Payment
}

// The case that started it (2026-11-15): two walk-in lessons, 1 h then 2 h at 50 €/h.
const v13 = visit('b13', '2026-11-13')
const v14 = visit('b14', '2026-11-14')
const lessons = [lesson('b13', 1, 50), lesson('b14', 2, 50)]

describe('visitBalances', () => {
  it('orders visits oldest first, whatever order they come in', () => {
    const out = visitBalances([v14, v13], { lessons })
    expect(out.map(v => v.booking.id)).toEqual(['b13', 'b14'])
    expect(out.map(v => v.due)).toEqual([50, 100])
  })

  it('counts rentals, payments and discounts like accounting does', () => {
    const rentals = [{ ..._equipmentRental, id: 'r1', booking_id: 'b14', price: 30 } as EquipmentRental]
    const payments = [payment('b14', 40), payment('b14', 10, { is_discount: true })]
    const [, b14] = visitBalances([v13, v14], { lessons, equipmentRentals: rentals, payments })
    expect(b14).toMatchObject({ billed: 130, paid: 40, discounts: 10, due: 80 })
  })
})

describe('tabDue', () => {
  it('is the net of every visit, an overpaid one offsetting the others', () => {
    const payments = [payment('b13', 70)] // 20 too much on the 13th
    expect(tabDue(visitBalances([v13, v14], { lessons, payments }))).toBe(80)
  })
})

describe('splitTabPayment', () => {
  const balances = visitBalances([v13, v14], { lessons })

  it('settles the whole tab in one payment, one share per visit', () => {
    expect(splitTabPayment(balances, 150)).toEqual([
      { bookingId: 'b13', amount: 50 },
      { bookingId: 'b14', amount: 100 },
    ])
  })

  it('a partial payment settles the oldest visit and eats into the next', () => {
    expect(splitTabPayment(balances, 80)).toEqual([
      { bookingId: 'b13', amount: 50 },
      { bookingId: 'b14', amount: 30 },
    ])
  })

  it('skips a visit already settled', () => {
    const settled = visitBalances([v13, v14], { lessons, payments: [payment('b13', 50)] })
    expect(splitTabPayment(settled, 100)).toEqual([{ bookingId: 'b14', amount: 100 }])
  })

  it('puts an overpayment on the most recent visit instead of losing it', () => {
    expect(splitTabPayment(balances, 170)).toEqual([
      { bookingId: 'b13', amount: 50 },
      { bookingId: 'b14', amount: 120 },
    ])
  })

  it('works to the cent', () => {
    const odd = visitBalances([v13, v14], { lessons: [lesson('b13', 1.5, 33.34), lesson('b14', 1, 10)] })
    const split = splitTabPayment(odd, 60)
    expect(split).toEqual([
      { bookingId: 'b13', amount: 50.01 },
      { bookingId: 'b14', amount: 9.99 },
    ])
    expect(split.reduce((s, x) => s + x.amount, 0)).toBeCloseTo(60, 2)
  })

  it('nothing to split: no amount, or no visit', () => {
    expect(splitTabPayment(balances, 0)).toEqual([])
    expect(splitTabPayment([], 50)).toEqual([])
  })
})
