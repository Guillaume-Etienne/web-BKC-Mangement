import type { ClientRelationshipFlag } from '../types/database'

/** Shared badge look, so a client flagged in ClientsPage reads the same way
 *  in the BookingsPage picker — the two places someone actually needs to see it. */
export const relationshipFlagLabels: Record<ClientRelationshipFlag, string> = {
  avoid: 'Avoid',
  favorite: 'Favorite',
}

export const relationshipFlagIcons: Record<ClientRelationshipFlag, string> = {
  avoid: '🚫',
  favorite: '⭐',
}

export const relationshipFlagColors: Record<ClientRelationshipFlag, string> = {
  avoid: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400',
  favorite: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400',
}
