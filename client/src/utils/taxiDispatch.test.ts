import { describe, it, expect } from 'vitest'
import { groupByDay, withinDays, dayLabel, waPhone, whatsappUrl, tripMessage, dayMessage, type DispatchTrip } from './taxiDispatch'

const trip = (over: Partial<DispatchTrip>): DispatchTrip => ({
  id: 'x', date: '2026-11-10', start_time: '08:30', type: 'aero-to-center', taxi_driver_id: null,
  nb_persons: 2, nb_luggage: 0, nb_boardbags: 0, notes: null, ...over,
})

describe('groupByDay', () => {
  it('orders days, then trips by time inside a day', () => {
    const g = groupByDay([
      trip({ id: 'c', date: '2026-11-11', start_time: '07:00' }),
      trip({ id: 'b', date: '2026-11-10', start_time: '15:00' }),
      trip({ id: 'a', date: '2026-11-10', start_time: '08:30' }),
    ])
    expect(g.map(([d, ts]) => [d, ts.map(t => t.id)])).toEqual([
      ['2026-11-10', ['a', 'b']],
      ['2026-11-11', ['c']],
    ])
  })
})

describe('withinDays', () => {
  it('keeps today and the next 6 days, not the 7th', () => {
    expect(withinDays('2026-11-09', '2026-11-09', 7)).toBe(true)
    expect(withinDays('2026-11-15', '2026-11-09', 7)).toBe(true)
    expect(withinDays('2026-11-16', '2026-11-09', 7)).toBe(false)
    expect(withinDays('2026-11-08', '2026-11-09', 7)).toBe(false)
  })
  it('crosses a month end', () => {
    expect(withinDays('2026-12-02', '2026-11-28', 7)).toBe(true)
  })
})

describe('dayLabel', () => {
  it('names today and tomorrow, dates the rest', () => {
    expect(dayLabel('2026-11-09', '2026-11-09', 'pt')).toBe('Hoje · Seg 09/11')
    expect(dayLabel('2026-11-10', '2026-11-09', 'en')).toBe('Tomorrow · Tue 10/11')
    expect(dayLabel('2026-11-11', '2026-11-09', 'pt')).toBe('Qua 11/11')
  })
})

describe('waPhone', () => {
  it('keeps an international number, digits only', () => {
    expect(waPhone('+258 84 123 4567')).toBe('258841234567')
    expect(waPhone('00258 84 123 4567')).toBe('258841234567')
  })
  it('adds the Mozambican code to a local mobile', () => {
    expect(waPhone('84 123 4567')).toBe('258841234567')
  })
  it('gives up on a missing or too short number (contact picker instead)', () => {
    expect(waPhone(null)).toBeNull()
    expect(waPhone('')).toBeNull()
    expect(waPhone('+258 123456')).toBeNull()
  })
})

describe('whatsappUrl', () => {
  it('opens the chat of a full number, the picker otherwise', () => {
    expect(whatsappUrl('olá', '+258 84 123 4567')).toBe('https://wa.me/258841234567?text=ol%C3%A1')
    expect(whatsappUrl('olá', null)).toBe('https://wa.me/?text=ol%C3%A1')
  })
})

describe('tripMessage', () => {
  const t = trip({ nb_persons: 3, nb_luggage: 2, nb_boardbags: 1, notes: ' meet at arrivals ' })
  it('says everything a driver needs, in his language', () => {
    expect(tripMessage(t, {
      client: 'Jean Dupont', driver: 'Ruiz',
      travel: { icon: '✈️', text: 'AF 3951', url: null, missing: false },
    }, 'pt')).toBe([
      '🚕 Ter 10/11 · 08:30',
      'Aeroporto → Bilene',
      '👤 Jean Dupont',
      '👥 3 pessoas · 🧳 Malas: 2 Normal · 1 Comprida',
      '✈️ AF 3951',
      '🚗 Ruiz',
      '💬 meet at arrivals',
    ].join('\n'))
  })
  it('leaves out what is unknown, and flags a trip with no driver', () => {
    const msg = tripMessage(trip({}), {
      client: null, driver: null,
      travel: { icon: '✈️', text: 'Nº de voo em falta', url: null, missing: true },
    }, 'pt')
    expect(msg).toBe(['🚕 Ter 10/11 · 08:30', 'Aeroporto → Bilene', '👥 2 pessoas', '🚗 Não atribuído'].join('\n'))
  })
  it('never carries an amount', () => {
    const msg = tripMessage(trip({}), { client: 'A B', driver: 'Ruiz', travel: null }, 'en')
    expect(msg).not.toMatch(/MZN|€|\d{3,}/)
  })
})

describe('dayMessage', () => {
  it('one line per trip under the day', () => {
    const msg = dayMessage('2026-11-10', '2026-11-09', [
      trip({ id: 'a', start_time: '08:30' }),
      trip({ id: 'b', start_time: '15:00', type: 'center-to-aero', taxi_driver_id: 'r' }),
    ], t => ({ client: t.id === 'a' ? 'Dupont' : null, driver: t.taxi_driver_id ? 'Ruiz' : null, travel: null }), 'en')
    expect(msg).toBe([
      '🚕 Tomorrow · Tue 10/11 — 2 trips',
      '08:30 Airport → Bilene · Dupont · 2 pax · 🚗 Unassigned',
      '15:00 Bilene → Airport · 2 pax · 🚗 Ruiz',
    ].join('\n'))
  })
})
