import { describe, it, expect } from 'vitest'
import { isMissingTable } from './supabaseErrors'

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
