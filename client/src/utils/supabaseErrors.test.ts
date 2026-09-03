import { describe, it, expect } from 'vitest'
import { isMissingTable, isMissingColumn } from './supabaseErrors'

describe('isMissingTable', () => {
  it('catches what the browser client actually returns', () => {
    // The real payload, copied from the console on 2026-09-03 — checking only
    // 42P01 looked right and never fired.
    expect(isMissingTable({
      code: 'PGRST205',
      message: "Could not find the table 'public.client_notes' in the schema cache",
    })).toBe(true)
  })

  it('catches the Postgres code too', () => {
    expect(isMissingTable({ code: '42P01', message: 'relation "client_notes" does not exist' })).toBe(true)
  })

  it('falls back to the sentence when the code is gone', () => {
    expect(isMissingTable({ message: "Could not find the table 'public.x' in the schema cache" })).toBe(true)
  })

  it('does not swallow a real failure', () => {
    expect(isMissingTable({ code: '42501', message: 'permission denied for table client_notes' })).toBe(false)
    expect(isMissingTable({ code: '23503', message: 'foreign key violation' })).toBe(false)
    expect(isMissingTable({ message: 'network error' })).toBe(false)
  })

  it('is false for no error at all', () => {
    expect(isMissingTable(null)).toBe(false)
    expect(isMissingTable(undefined)).toBe(false)
    expect(isMissingTable({})).toBe(false)
  })
})

describe('isMissingColumn', () => {
  it('catches the column that a pending migration has not added', () => {
    // The real one, from production on 2026-09-03: naming bookings.source_id in
    // a select made PostgREST reject the whole query, and every "Guests" count
    // fell to zero with nothing on screen to say why.
    expect(isMissingColumn({
      code: '42703',
      message: 'column bookings.source_id does not exist',
    })).toBe(true)
    expect(isMissingColumn({ code: 'PGRST204' })).toBe(true)
  })

  it('falls back to the sentence when the code is gone', () => {
    expect(isMissingColumn({ message: "Could not find the 'source_id' column of 'bookings'" })).toBe(true)
  })

  it('does not swallow a real failure', () => {
    expect(isMissingColumn({ code: '42501', message: 'permission denied' })).toBe(false)
    expect(isMissingColumn({ code: 'PGRST205', message: 'Could not find the table' })).toBe(false)
    expect(isMissingColumn(null)).toBe(false)
  })
})
