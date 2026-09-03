import { describe, it, expect } from 'vitest'
import { referralLabel } from './referral'
import type { EnquirySource } from '../types/database'

const sources: EnquirySource[] = [
  { id: 's1', label: { fr: 'Un ami', en: 'A friend', es: 'Un amigo' }, sort_order: 1, is_active: true },
  { id: 's2', label: { fr: 'Salon nautique', en: 'Boat show', es: 'Salón náutico' }, sort_order: 2, is_active: true },
]

describe('referralLabel', () => {
  it('resolves to the English label whatever the visitor was reading', () => {
    expect(referralLabel({ sourceId: 's1', freeText: '' }, sources)).toBe('A friend')
    expect(referralLabel({ sourceId: 's2', freeText: '' }, sources)).toBe('Boat show')
  })

  it('keeps the free line for "Other" — that is how gui learns what to add', () => {
    expect(referralLabel({ sourceId: 'other', freeText: '  a kite school in Lisbon ' }, sources))
      .toBe('a kite school in Lisbon')
  })

  it('is empty when the question was skipped', () => {
    expect(referralLabel({ sourceId: '', freeText: '' }, sources)).toBe('')
    expect(referralLabel({ sourceId: 'other', freeText: '   ' }, sources)).toBe('')
  })

  it('refuses to invent a label for an id it does not know', () => {
    // The list changed under the visitor's feet: an empty answer beats a stale
    // one that would then be counted as a fact.
    expect(referralLabel({ sourceId: 'gone', freeText: '' }, sources)).toBe('')
    expect(referralLabel({ sourceId: 's1', freeText: '' }, [])).toBe('')
  })

  it('ignores the free line when a real source was chosen', () => {
    expect(referralLabel({ sourceId: 's1', freeText: 'leftover text' }, sources)).toBe('A friend')
  })
})
