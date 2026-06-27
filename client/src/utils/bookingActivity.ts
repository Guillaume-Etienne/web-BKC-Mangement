/** Per-traveler kite activity flags (subset shared by BookingParticipant and the wizard draft). */
export interface ActivityFlags {
  brings_own_gear?: boolean | null
  wants_kite_lessons?: boolean | null
  wants_kite_rental?: boolean | null
  wants_wing_lessons?: boolean | null
}

export interface ActivityCounts {
  lessons: number       // persons taking kite lessons
  rentals: number       // persons renting equipment
  wing: number          // persons taking wing lessons
  centerAccess: number  // own-gear persons → billed center access
}

/**
 * Derive a booking's activity counters from its travelers' flags.
 * Source of truth = the per-traveler flags; the booking's num_* columns are a cache of this.
 * Center access rule: a traveler with their own gear (brings_own_gear) is billed center access.
 */
export function deriveActivityCounts(travelers: ActivityFlags[]): ActivityCounts {
  return travelers.reduce<ActivityCounts>(
    (acc, t) => ({
      lessons:      acc.lessons      + (t.wants_kite_lessons ? 1 : 0),
      rentals:      acc.rentals      + (t.wants_kite_rental ? 1 : 0),
      wing:         acc.wing         + (t.wants_wing_lessons ? 1 : 0),
      centerAccess: acc.centerAccess + (t.brings_own_gear ? 1 : 0),
    }),
    { lessons: 0, rentals: 0, wing: 0, centerAccess: 0 },
  )
}

/** Map derived counts onto the booking column names (for inserts/updates). */
export function activityCountColumns(travelers: ActivityFlags[]) {
  const c = deriveActivityCounts(travelers)
  return {
    num_lessons: c.lessons,
    num_equipment_rentals: c.rentals,
    num_wing_lessons: c.wing,
    num_center_access: c.centerAccess,
  }
}

/** Compact one-traveler activity summary, e.g. "lessons · own gear + storage · wing". */
export function travelerActivityLabel(p: {
  does_kite?: boolean | null
  brings_own_gear?: boolean | null
  needs_storage?: boolean | null
  wants_kite_lessons?: boolean | null
  wants_kite_rental?: boolean | null
  wants_wing_lessons?: boolean | null
}): string {
  if (!p.does_kite) return 'no kite'
  return [
    p.brings_own_gear ? (p.needs_storage ? 'own gear + storage' : 'own gear') : null,
    p.wants_kite_lessons ? 'lessons' : null,
    p.wants_kite_rental ? 'rental' : null,
    p.wants_wing_lessons ? 'wing' : null,
  ].filter(Boolean).join(' · ') || 'kites'
}
