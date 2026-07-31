import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { persistWith, rollbackMessage } from './persist'
import type { WriteResult } from './persist'

/** A Supabase query that came back cleanly. */
const ok = (): PromiseLike<WriteResult> => Promise.resolve({ error: null })

/** A Supabase query the database refused (RLS, constraint, …). */
const refused = (message: string): PromiseLike<WriteResult> =>
  Promise.resolve({ error: { message } })

/** A query that never reached the database at all (offline, DNS, CORS). */
const threw = (message: string): PromiseLike<WriteResult> =>
  Promise.reject(new Error(message))

describe('persistWith', () => {
  // The rollback path logs on purpose; keep the test output readable.
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}) })
  afterEach(() => { vi.restoreAllMocks() })

  it('leaves the optimistic change in place when the write lands', async () => {
    const rollback = vi.fn()
    const notify = vi.fn()
    await persistWith(notify, ok(), rollback, 'the payment')
    expect(rollback).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })

  it('undoes the change when the database refuses it', async () => {
    const rollback = vi.fn()
    const notify = vi.fn()
    await persistWith(notify, refused('new row violates row-level security policy'), rollback, 'the payment')
    expect(rollback).toHaveBeenCalledOnce()
  })

  it('undoes the change when the write never reached the database', async () => {
    // The failure mode that matters at the centre: the phone drops off the wifi
    // mid-save. A rejected promise loses the write just as surely as a refusal.
    const rollback = vi.fn()
    const notify = vi.fn()
    await persistWith(notify, threw('Failed to fetch'), rollback, 'the expense')
    expect(rollback).toHaveBeenCalledOnce()
    expect(notify).toHaveBeenCalledOnce()
  })

  it('tells the user what was lost and why, and that nothing was recorded', async () => {
    const notify = vi.fn()
    await persistWith(notify, refused('duplicate key value'), () => {}, 'the payment')
    const message = notify.mock.calls[0][0] as string
    expect(message).toContain('the payment')       // which action
    expect(message).toContain('duplicate key')     // the database's own words
    expect(message).toContain('nothing was recorded')
  })

  it('restores exactly the snapshot it was given, not a reconstruction', async () => {
    // The whole point of snapshotting the array: order and contents come back
    // untouched, so a failed delete does not silently reshuffle the books.
    const original = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    let state = original.filter(x => x.id !== 'b')  // optimistic delete
    await persistWith(() => {}, refused('nope'), () => { state = original }, 'the payment deletion')
    expect(state).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
  })

  it('rolls back before telling the user, so the screen is already correct', async () => {
    // The alert blocks: if it fired first, the user would be staring at a row
    // that is about to vanish behind the dialog.
    const order: string[] = []
    await persistWith(
      () => order.push('notify'),
      refused('nope'),
      () => order.push('rollback'),
      'the payment',
    )
    expect(order).toEqual(['rollback', 'notify'])
  })
})

describe('rollbackMessage', () => {
  it('names the action rather than the table it failed to write', () => {
    // "the instructor payment" is what gui recognises; `instructor_payments` is not.
    expect(rollbackMessage('the instructor payment', 'timeout'))
      .toContain('Could not save the instructor payment')
  })
})
