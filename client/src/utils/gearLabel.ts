import type { Equipment, EquipmentRental, Lesson } from '../types/database'

/** The part of an equipment row a label needs. A share link only receives these
 *  four columns (brand, name, size, id) — never condition or notes. */
export type GearLike = Pick<Equipment, 'id' | 'name' | 'brand' | 'size'>

/** "Duotone Rebel 9m": brand + name + size, skipping a brand the name already starts with. */
export function gearName(e: GearLike): string {
  const brand = e.brand && !e.name.toLowerCase().startsWith(e.brand.toLowerCase()) ? e.brand : ''
  // Names like "E8 Master 139x42" already carry the size
  const size = e.size && !e.name.toLowerCase().includes(e.size.toLowerCase()) ? e.size : ''
  return [brand, e.name, size].filter(Boolean).join(' ')
}

function joinGear(ids: (string | null | undefined)[], equipment: GearLike[]): string {
  return ids
    .map(id => (id ? equipment.find(e => e.id === id) : undefined))
    .filter((e): e is GearLike => !!e)
    .map(gearName)
    .join(' + ')
}

/** Gear used in a lesson, for one rider when `participantId` is given. A group
 *  lesson can carry one kite/board per rider (`rider_gear`); without a row for
 *  that rider the lesson's own kite/board apply. '' when nothing is recorded. */
export function lessonGearText(
  l: Pick<Lesson, 'kite_id' | 'board_id' | 'rider_gear'>, participantId: string | null, equipment: GearLike[],
): string {
  const own = participantId ? l.rider_gear?.find(g => g.participant_id === participantId) : undefined
  return joinGear(own ? [own.kite_id, own.board_id] : [l.kite_id, l.board_id], equipment)
}

/** Gear of a rental: the kite (or the only item) in equipment_id, the board of a
 *  "Full" in board_equipment_id. '' when nothing is recorded. */
export function rentalGearText(
  r: Pick<EquipmentRental, 'equipment_id' | 'board_equipment_id'>, equipment: GearLike[],
): string {
  return joinGear([r.equipment_id, r.board_equipment_id], equipment)
}

/** " (Duotone Rebel 9m)" or '' — ready to append to a line. */
export const inParens = (text: string): string => (text ? ` (${text})` : '')
