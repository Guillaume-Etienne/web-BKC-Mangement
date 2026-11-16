import { describe, it, expect, beforeEach } from 'vitest'
import { notifyError, notifyInfo, dismissNotification, getNotifications, subscribeNotifications } from './notify'

beforeEach(() => { getNotifications().forEach(n => dismissNotification(n.id)) })

describe('notify', () => {
  it('stacks distinct messages in order, each with its tone', () => {
    notifyError('Save failed')
    notifyInfo('Name is required.')
    expect(getNotifications().map(n => [n.tone, n.message])).toEqual([
      ['error', 'Save failed'],
      ['info', 'Name is required.'],
    ])
  })

  it('counts a repeated message instead of stacking copies', () => {
    // A failing Save clicked three times: one card ×3, not three cards.
    notifyError('Save failed'); notifyError('Save failed'); notifyError('Save failed')
    expect(getNotifications()).toHaveLength(1)
    expect(getNotifications()[0].count).toBe(3)
  })

  it('dismisses one card and tells its listeners', () => {
    let calls = 0
    const off = subscribeNotifications(() => { calls++ })
    notifyError('a'); notifyError('b')
    dismissNotification(getNotifications()[0].id)
    off()
    expect(getNotifications().map(n => n.message)).toEqual(['b'])
    expect(calls).toBe(3)
  })
})
