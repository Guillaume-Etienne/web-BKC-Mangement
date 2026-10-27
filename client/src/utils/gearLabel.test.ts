import { describe, it, expect } from 'vitest'
import { gearName, lessonGearText, rentalGearText, inParens } from './gearLabel'

const eq = [
  { id: 'k1', name: 'Rebel', brand: 'Duotone', size: '9m' },
  { id: 'k2', name: 'Duotone Neo', brand: 'Duotone', size: '12m' },
  { id: 'b1', name: 'Jaime', brand: null, size: null },
]

describe('gearLabel', () => {
  it('writes brand, name and size, without repeating a brand already in the name', () => {
    expect(gearName(eq[0])).toBe('Duotone Rebel 9m')
    expect(gearName(eq[1])).toBe('Duotone Neo 12m')
    expect(gearName(eq[2])).toBe('Jaime')
  })

  it('joins the kite and the board of a rental, and ignores unknown ids', () => {
    expect(rentalGearText({ equipment_id: 'k1', board_equipment_id: 'b1' }, eq)).toBe('Duotone Rebel 9m + Jaime')
    expect(rentalGearText({ equipment_id: null, board_equipment_id: null }, eq)).toBe('')
    expect(rentalGearText({ equipment_id: 'gone', board_equipment_id: undefined }, eq)).toBe('')
  })

  it('uses the rider’s own gear in a group lesson, else the lesson’s', () => {
    const l = {
      kite_id: 'k1', board_id: null,
      rider_gear: [{ lesson_id: 'l', participant_id: 'p2', kite_id: 'k2', board_id: 'b1' }],
    }
    expect(lessonGearText(l, 'p2', eq)).toBe('Duotone Neo 12m + Jaime')
    expect(lessonGearText(l, 'p1', eq)).toBe('Duotone Rebel 9m')
    expect(lessonGearText(l, null, eq)).toBe('Duotone Rebel 9m')
  })

  it('wraps in parentheses only when there is something to show', () => {
    expect(inParens('X')).toBe(' (X)')
    expect(inParens('')).toBe('')
  })
})
