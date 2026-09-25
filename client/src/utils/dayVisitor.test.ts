import { describe, it, expect } from 'vitest'
import { _booking, _client } from '../types/canary'
import type { Booking, BookingParticipant, Client } from '../types/database'
import {
  isDayVisitor, stayBookings, isOnSiteOn, newVisitBookingRow, findVisitOn,
  suggestedLessonRate, visitsOf, searchClients,
} from './dayVisitor'

function mkBooking(over: Partial<Booking> = {}): Booking {
  return { ..._booking, status: 'confirmed', ...over } as Booking
}
function mkParticipant(over: Partial<BookingParticipant> = {}): BookingParticipant {
  return {
    id: 'p1', booking_id: 'b1', first_name: 'Joao', last_name: 'M', passport_number: null,
    client_id: 'c1', kite_level: null, does_kite: true, brings_own_gear: false, needs_storage: false,
    wants_kite_lessons: false, wants_kite_rental: false, wants_wing_lessons: false, notes: null,
    created_at: '2026-09-25T08:00:00Z', ...over,
  }
}
function mkClient(over: Partial<Client> = {}): Client {
  return { ..._client, ...over } as Client
}

describe('isDayVisitor / stayBookings', () => {
  it('a booking without kind (base not migrated) is a stay', () => {
    const b = mkBooking()
    expect(isDayVisitor(b)).toBe(false)
    expect(stayBookings([b])).toHaveLength(1)
  })
  it('filters day visitors out and keeps stays', () => {
    const out = stayBookings([mkBooking({ id: 's', kind: 'stay' }), mkBooking({ id: 'v', kind: 'day_visitor' })])
    expect(out.map(b => b.id)).toEqual(['s'])
  })
})

describe('isOnSiteOn', () => {
  it('a stay covers check_in through check_out included', () => {
    const b = mkBooking({ check_in: '2026-09-20', check_out: '2026-09-25' })
    expect(isOnSiteOn(b, '2026-09-19')).toBe(false)
    expect(isOnSiteOn(b, '2026-09-20')).toBe(true)
    expect(isOnSiteOn(b, '2026-09-25')).toBe(true)
    expect(isOnSiteOn(b, '2026-09-26')).toBe(false)
  })
  it('a visit covers its own day only, despite check_out = day + 1', () => {
    const v = mkBooking({ kind: 'day_visitor', check_in: '2026-09-25', check_out: '2026-09-26' })
    expect(isOnSiteOn(v, '2026-09-25')).toBe(true)
    expect(isOnSiteOn(v, '2026-09-26')).toBe(false)
  })
  it('cancelled = nobody', () => {
    expect(isOnSiteOn(mkBooking({ status: 'cancelled', check_in: '2026-09-25', check_out: '2026-09-26' }), '2026-09-25')).toBe(false)
  })
})

describe('newVisitBookingRow', () => {
  it('satisfies check_out > check_in, across a month end', () => {
    const row = newVisitBookingRow('c1', '2026-09-30')
    expect(row).toMatchObject({ client_id: 'c1', check_in: '2026-09-30', check_out: '2026-10-01', status: 'confirmed', center_access_rate: 0 })
  })
})

describe('findVisitOn', () => {
  const visit = mkBooking({ id: 'b1', client_id: 'c1', kind: 'day_visitor', check_in: '2026-09-25', check_out: '2026-09-26' })
  const p = mkParticipant()
  it('reuses the visit of the same client on the same day', () => {
    expect(findVisitOn([visit], [p], 'c1', '2026-09-25')?.booking.id).toBe('b1')
  })
  it('never reuses it the next day, another client, a stay, or a cancelled visit', () => {
    expect(findVisitOn([visit], [p], 'c1', '2026-09-26')).toBeNull()
    expect(findVisitOn([visit], [p], 'c2', '2026-09-25')).toBeNull()
    expect(findVisitOn([{ ...visit, kind: 'stay' }], [p], 'c1', '2026-09-25')).toBeNull()
    expect(findVisitOn([{ ...visit, status: 'cancelled' }], [p], 'c1', '2026-09-25')).toBeNull()
  })
  it('a visit whose participant row is missing is not reused (nothing to hang a lesson on)', () => {
    expect(findVisitOn([visit], [], 'c1', '2026-09-25')).toBeNull()
  })
})

describe('suggestedLessonRate', () => {
  it('the mate\'s rate wins, including a free 0', () => {
    expect(suggestedLessonRate(mkClient({ custom_lesson_rate: 25 }), 40)).toBe(25)
    expect(suggestedLessonRate(mkClient({ custom_lesson_rate: 0 }), 40)).toBe(0)
  })
  it('falls back to the official rate, and stays null when nothing is set', () => {
    expect(suggestedLessonRate(mkClient({ custom_lesson_rate: null }), 40)).toBe(40)
    expect(suggestedLessonRate(mkClient(), null)).toBeNull()
    expect(suggestedLessonRate(undefined, 40)).toBe(40)
  })
  it('a NUMERIC column arriving as a string is read as a number', () => {
    expect(suggestedLessonRate(mkClient({ custom_lesson_rate: '25.00' as unknown as number }), 40)).toBe(25)
  })
})

describe('visitsOf', () => {
  it('lists this client\'s visits only, most recent first', () => {
    const out = visitsOf([
      mkBooking({ id: 'a', client_id: 'c1', kind: 'day_visitor', check_in: '2026-09-10' }),
      mkBooking({ id: 'b', client_id: 'c1', kind: 'day_visitor', check_in: '2026-09-20' }),
      mkBooking({ id: 'c', client_id: 'c1', kind: 'stay', check_in: '2026-09-15' }),
      mkBooking({ id: 'd', client_id: 'c2', kind: 'day_visitor', check_in: '2026-09-21' }),
      mkBooking({ id: 'e', client_id: 'c1', kind: 'day_visitor', check_in: '2026-09-22', status: 'cancelled' }),
    ], 'c1')
    expect(out.map(b => b.id)).toEqual(['b', 'a'])
  })
})

describe('searchClients', () => {
  const clients = [
    mkClient({ id: '1', first_name: 'Joao', last_name: 'Mabunda', phone: '+258 84 123 4567' }),
    mkClient({ id: '2', first_name: 'Ana', last_name: 'Joaquim', phone: null }),
    mkClient({ id: '3', first_name: 'Pierre', last_name: 'Dujoa', email: 'pierre@x.com' }),
  ]
  it('needs 2 characters', () => {
    expect(searchClients(clients, 'j')).toEqual([])
  })
  it('first or last name starting with it first (alphabetical), then contains', () => {
    expect(searchClients(clients, 'joa').map(c => c.id)).toEqual(['2', '1', '3'])
  })
  it('finds by last name first ("Mabunda Joao")', () => {
    expect(searchClients(clients, 'mabunda j').map(c => c.id)).toEqual(['1'])
  })
  it('finds a local by WhatsApp digits', () => {
    expect(searchClients(clients, '1234').map(c => c.id)).toEqual(['1'])
  })
})
