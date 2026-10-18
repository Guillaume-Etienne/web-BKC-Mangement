import { describe, it, expect } from 'vitest'
import { rentalBillable } from '../../types/database'
import { boardPickerCategory, rentalGear, rentalKind, rentalLabel, showsKitePicker } from './rentalTypes'

const gear = [
  { id: 'k1', category: 'kite' as const },
  { id: 'b1', category: 'board' as const },
]

describe('rentalBillable', () => {
  it('bills the half-day rate for morning and afternoon, the day rate for full_day', () => {
    expect(rentalBillable('full')).toBe('rental_full')
    expect(rentalBillable('full', 'morning')).toBe('rental_full')
    expect(rentalBillable('full', 'afternoon')).toBe('rental_full')
    expect(rentalBillable('full', 'full_day')).toBe('rental_full_day')
    expect(rentalBillable('foilboard', 'full_day')).toBe('rental_foilboard_day')
  })
})

describe('rentalGear', () => {
  it('keeps the kite in equipment_id and the board of a Full in board_equipment_id', () => {
    expect(rentalGear('full', 'k1', 'b1')).toEqual({ equipment_id: 'k1', board_equipment_id: 'b1' })
    expect(rentalGear('full', null, 'b1')).toEqual({ equipment_id: null, board_equipment_id: 'b1' })
  })
  it('stores one piece for kite / board and nothing for the rest', () => {
    expect(rentalGear('kite', 'k1', 'b1')).toEqual({ equipment_id: 'k1', board_equipment_id: null })
    expect(rentalGear('board', 'k1', 'b1')).toEqual({ equipment_id: 'b1', board_equipment_id: null })
    expect(rentalGear('free', 'k1', 'b1')).toEqual({ equipment_id: null, board_equipment_id: null })
  })
  it('stores the surfboard / foilboard picked, which used to be dropped', () => {
    expect(rentalGear('surfboard', null, 's1')).toEqual({ equipment_id: 's1', board_equipment_id: null })
    expect(rentalGear('foilboard', null, 'f1')).toEqual({ equipment_id: 'f1', board_equipment_id: null })
  })
})

describe('gear pickers', () => {
  it('offers the board list of the type, and a kite list only for kite / full', () => {
    expect(boardPickerCategory('full')).toBe('board')
    expect(boardPickerCategory('surfboard')).toBe('surfboard')
    expect(boardPickerCategory('foilboard')).toBe('foilboard')
    expect(boardPickerCategory('kite')).toBeNull()
    expect(boardPickerCategory('free')).toBeNull()
    expect(showsKitePicker('full')).toBe(true)
    expect(showsKitePicker('board')).toBe(false)
  })
})

describe('rentalKind', () => {
  it('trusts the stored type: a Full whose gear is a kite is still a Full', () => {
    expect(rentalKind({ rental_type: 'full', equipment_id: 'k1' }, gear)).toBe('full')
  })
  it('falls back to the gear category for rows from before the type was stored', () => {
    expect(rentalKind({ rental_type: null, equipment_id: 'k1' }, gear)).toBe('kite')
    expect(rentalKind({ rental_type: undefined, equipment_id: 'b1' }, gear)).toBe('board')
  })
  it('is null when nothing says what it was', () => {
    expect(rentalKind({ rental_type: null, equipment_id: null }, gear)).toBeNull()
  })
})

describe('rentalLabel', () => {
  it('keeps "Full" for us and spells it out for the guest', () => {
    expect(rentalLabel('full', 'staff')).toBe('Full')
    expect(rentalLabel('full', 'client')).toBe('Kite + bar + board')
    expect(rentalLabel('kite', 'client')).toBe('Kite + bar')
    expect(rentalLabel('board', 'client')).toBe('Board')
  })
})
