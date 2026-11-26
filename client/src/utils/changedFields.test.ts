import { describe, it, expect } from 'vitest'
import { changedFields } from './changedFields'

describe('changedFields', () => {
  type Row = { notes: string; taxi_driver_id: string | null; status: string; price: number }
  const row: Row = { notes: 'a', taxi_driver_id: null, status: 'needs_details', price: 6500 }

  it('keeps only what was edited', () => {
    expect(changedFields(row, { ...row, notes: 'b' })).toEqual({ notes: 'b' })
  })

  it('leaves the driver alone when the form still holds the old (empty) one', () => {
    // the manager staffed the trip after the screen was opened; gui only edits the note
    const stale = { ...row, notes: 'b' }
    expect(changedFields(row, stale)).not.toHaveProperty('taxi_driver_id')
    expect(changedFields(row, stale)).not.toHaveProperty('status')
  })

  it('still sends the driver when gui changes it', () => {
    expect(changedFields(row, { ...row, taxi_driver_id: 'd1' })).toEqual({ taxi_driver_id: 'd1' })
  })

  it('treats null and undefined as the same', () => {
    expect(changedFields(row, { ...row, taxi_driver_id: undefined as unknown as Row['taxi_driver_id'] })).toEqual({})
  })

  it('an emptied value is a change', () => {
    expect(changedFields(row, { ...row, notes: '' })).toEqual({ notes: '' })
  })

  it('without a previous row, sends everything', () => {
    expect(changedFields(undefined, row)).toEqual(row)
  })
})
