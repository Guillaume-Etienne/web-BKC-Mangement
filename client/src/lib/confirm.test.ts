import { describe, it, expect } from 'vitest'
import { askConfirm, answerConfirm, getCurrentConfirm } from './confirm'

describe('askConfirm', () => {
  it('resolves with the answer given to the question on screen', async () => {
    const p = askConfirm('Delete this row?')
    const req = getCurrentConfirm()!
    expect(req.message).toBe('Delete this row?')
    answerConfirm(req.id, true)
    await expect(p).resolves.toBe(true)
    expect(getCurrentConfirm()).toBeNull()
  })

  it('queues a second question instead of replacing the first', async () => {
    // A replaced question would leave its caller awaiting forever.
    const first = askConfirm('First?')
    const second = askConfirm('Second?', { confirmLabel: 'Export', tone: 'neutral' })
    expect(getCurrentConfirm()!.message).toBe('First?')
    answerConfirm(getCurrentConfirm()!.id, false)
    expect(getCurrentConfirm()!.message).toBe('Second?')
    expect(getCurrentConfirm()!.confirmLabel).toBe('Export')
    answerConfirm(getCurrentConfirm()!.id, true)
    await expect(first).resolves.toBe(false)
    await expect(second).resolves.toBe(true)
  })

  it('ignores a second answer to the same question', () => {
    askConfirm('Once?')
    const id = getCurrentConfirm()!.id
    answerConfirm(id, false)
    expect(() => answerConfirm(id, true)).not.toThrow()
    expect(getCurrentConfirm()).toBeNull()
  })
})
