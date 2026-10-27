import { describe, it, expect } from 'vitest'
import { eventCost, eventRevenue, eventDailyContribution, eventHeadcount } from './diningEventCosts'
import type { DiningEvent, DiningEventCost, EventAttendee } from '../types/database'

const att = (id: string, over: Partial<EventAttendee> = {}): EventAttendee => ({
  id, person_id: id, person_type: 'participant', person_name: id, room_label: '',
  is_attending: true, starter: '', main: '', side: '', dessert: '', ...over,
})
const ev = (attendees: EventAttendee[], price = 50): DiningEvent => ({
  id: 'e1', name: 'Limpopo trip', date: '2026-10-26', time: '08:00', type: 'count',
  price_per_person: price, notes: '', attendees,
})
const cost = (over: Partial<DiningEventCost> = {}): DiningEventCost => ({
  dining_event_id: 'e1', count_in_daily: true, cost_mode: 'total', cost_amount: 0, expense_id: null, ...over,
})

describe('dining event cost & daily contribution', () => {
  // 3 clients at 50 + 1 instructor free = 150 revenue, 4 heads
  const trip = ev([att('a'), att('b'), att('c'), att('i', { person_type: 'instructor', price_override: 0 })])

  it('counts every head present, absentees excluded', () => {
    expect(eventHeadcount(trip)).toBe(4)
    expect(eventHeadcount(ev([att('a'), att('b', { is_attending: false })]))).toBe(1)
  })

  it('revenue applies per-head overrides', () => {
    expect(eventRevenue(trip)).toBe(150)
  })

  it('flat cost ignores the headcount', () => {
    expect(eventCost(trip, cost({ cost_mode: 'total', cost_amount: 80 }))).toBe(80)
  })

  it('per-person cost multiplies by heads present, instructors included', () => {
    expect(eventCost(trip, cost({ cost_mode: 'per_person', cost_amount: 20 }))).toBe(80)
  })

  it('no cost row = no cost', () => {
    expect(eventCost(trip, undefined)).toBe(0)
  })

  it('contribution is revenue net of cost', () => {
    expect(eventDailyContribution(trip, cost({ cost_mode: 'per_person', cost_amount: 20 }))).toBe(70)
  })

  it('an event not ticked contributes nothing, whatever it earns', () => {
    expect(eventDailyContribution(trip, cost({ count_in_daily: false, cost_amount: 10 }))).toBe(0)
    expect(eventDailyContribution(trip, undefined)).toBe(0)
  })

  it('goes negative when the provider costs more than the event brings in', () => {
    expect(eventDailyContribution(trip, cost({ cost_amount: 400 }))).toBe(-250)
  })
})
