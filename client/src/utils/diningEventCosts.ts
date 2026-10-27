import type { DiningEvent, DiningEventCost } from '../types/database'

/** Heads present at an event — instructors included: a provider bills everyone aboard. */
export function eventHeadcount(ev: DiningEvent): number {
  return (ev.attendees ?? []).filter(a => a.is_attending).length
}

/** What the provider charges for the event: a flat amount, or an amount per head present. */
export function eventCost(ev: DiningEvent, cost: DiningEventCost | undefined): number {
  if (!cost) return 0
  return cost.cost_mode === 'per_person' ? cost.cost_amount * eventHeadcount(ev) : cost.cost_amount
}

/** What the event brings in: price × heads present, individual overrides applied. */
export function eventRevenue(ev: DiningEvent): number {
  return (ev.attendees ?? [])
    .filter(a => a.is_attending)
    .reduce((s, a) => s + (a.price_override ?? ev.price_per_person), 0)
}

/** The event's share of the Daily figure: revenue NET of the provider's cost.
 *  0 unless the event is ticked "count in the day's figure". Can go negative —
 *  a trip that costs more than it brings in should say so. */
export function eventDailyContribution(ev: DiningEvent, cost: DiningEventCost | undefined): number {
  if (!cost?.count_in_daily) return 0
  return eventRevenue(ev) - eventCost(ev, cost)
}

/** Description of the expense created from an event — also how a later edit is spotted. */
export function eventExpenseDescription(ev: DiningEvent): string {
  return `Event — ${ev.name.trim() || 'unnamed'}`
}
