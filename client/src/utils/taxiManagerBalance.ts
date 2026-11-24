// What the taxi manager is owed. Same split as the "Completed / Planned" rows of
// the admin Finance tab: a trip earns its commission once its date has passed
// (`date < today`) — a planned trip, often still without a driver, earns
// nothing yet. Until 2026-11-24 every trip counted, future ones included, which
// showed the manager 14 000 MZN more than he was owed.

export interface ManagerTrip { date: string; margin_manager_mzn: number }
export interface ManagerAdvance { amount_mzn: number }

export interface ManagerBalance {
  earnedMzn: number      // commission on past trips
  earnedCount: number
  upcomingMzn: number    // commission on trips still to come (not due yet)
  upcomingCount: number
  paidMzn: number        // advances already paid to the manager
  balance: number        // > 0 = we owe him, < 0 = he was overpaid
}

export function managerBalance(trips: ManagerTrip[], advances: ManagerAdvance[], today: string): ManagerBalance {
  // margin 0 = private taxi: never his, not even counted in the trip numbers.
  const managed  = trips.filter(t => t.margin_manager_mzn > 0)
  const done     = managed.filter(t => t.date <  today)
  const upcoming = managed.filter(t => t.date >= today)
  const sum = (ts: ManagerTrip[]) => ts.reduce((s, t) => s + t.margin_manager_mzn, 0)
  const earnedMzn = sum(done)
  const paidMzn   = advances.reduce((s, p) => s + p.amount_mzn, 0)
  return {
    earnedMzn, earnedCount: done.length,
    upcomingMzn: sum(upcoming), upcomingCount: upcoming.length,
    paidMzn, balance: earnedMzn - paidMzn,
  }
}
