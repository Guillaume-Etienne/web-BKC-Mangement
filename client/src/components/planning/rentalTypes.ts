import type { Equipment, EquipmentRental, RentalSlot, RentalType } from '../../types/database'

/** What the rental picker offers: every billable type, plus "Other" which is
 *  free by definition. There is deliberately no fallback price table here — a
 *  rate lives in Options → Pricing or nowhere, so it can never be silently
 *  different from what the screen shows. Shared by the Daily's rental form and
 *  the walk-in form. */
export type RentalKind = RentalType | 'free'

export const RENTAL_TYPES: { key: RentalKind; label: string; icon: string; sub?: string }[] = [
  { key: 'kite',      label: 'Kite',            icon: '🪂' },
  { key: 'board',     label: 'Board',           icon: '🏄' },
  { key: 'full',      label: 'Full',            icon: '🪂🏄', sub: 'Kite + Bar + Board' },
  { key: 'surfboard', label: 'Surfboard',       icon: '🌊' },
  { key: 'foilboard', label: 'Foilboard',       icon: '⬆️' },
  { key: 'free',      label: 'Other',           icon: '📦' },
]

/** Which gear pickers a rental type shows. The board slot takes the category of
 *  the type (a surfboard rental offers surfboards, not kite boards); 'free' has none. */
export const showsKitePicker = (type: RentalKind) => type === 'kite' || type === 'full'
export const boardPickerCategory = (type: RentalKind): 'board' | 'surfboard' | 'foilboard' | null =>
  type === 'board' || type === 'full' ? 'board'
  : type === 'surfboard' || type === 'foilboard' ? type
  : null

/** The equipment a rental stores for a given type: kite → equipment_id; board,
 *  surfboard, foilboard → equipment_id; full → kite in equipment_id + board in
 *  board_equipment_id. Everything stays optional (null = "not specified"). */
export function rentalGear(
  type: RentalKind, kiteId: string | null, boardId: string | null,
): { equipment_id: string | null; board_equipment_id: string | null } {
  if (type === 'full') return { equipment_id: kiteId, board_equipment_id: boardId }
  if (type === 'kite') return { equipment_id: kiteId, board_equipment_id: null }
  if (type === 'free') return { equipment_id: null, board_equipment_id: null }
  return { equipment_id: boardId, board_equipment_id: null }
}

/** What a rental IS. The stored type wins; rows from before 2026-10-18 have none,
 *  so they keep the old deduction (the equipment's category) — null if unknowable. */
export function rentalKind(
  r: Pick<EquipmentRental, 'rental_type' | 'equipment_id'>, equipment: Pick<Equipment, 'id' | 'category'>[],
): RentalKind | null {
  if (r.rental_type) return r.rental_type
  const cat = equipment.find(e => e.id === r.equipment_id)?.category
  return RENTAL_TYPES.some(t => t.key === cat) ? (cat as RentalKind) : null
}

/** Our word for it ("Full") or the guest's ("Kite + bar + board"): a guest reads
 *  what he actually got, "Full" stays an internal shorthand. */
export function rentalLabel(kind: RentalKind | null, audience: 'staff' | 'client'): string {
  if (!kind) return 'Equipment'
  if (audience === 'client') {
    if (kind === 'full') return 'Kite + bar + board'
    if (kind === 'kite') return 'Kite + bar'
  }
  return RENTAL_TYPES.find(t => t.key === kind)?.label ?? 'Equipment'
}

export const RENTAL_SLOT_LABEL: Record<RentalSlot, string> = {
  morning: 'Morning', afternoon: 'Afternoon', full_day: 'Full day',
}
