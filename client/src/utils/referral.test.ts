import { describe, it, expect } from 'vitest'
import { referralLabel } from './referral'
import type { EnquirySource } from '../types/database'

const sources: EnquirySource[] = [
  { id: 's1', label: { fr: 'Un ami', en: 'A friend', es: 'Un amigo' }, sort_order: 1, is_active: true },
  { id: 's2', label: { fr: 'Salon nautique', en: 'Boat show', es: 'Salón náutico' }, sort_order: 2, is_active: true },
]

describe('referralLabel', () => {
  it('resolves to the English label whatever the visitor was reading', () => {
    expect(referralLabel({ referral_source_id: 's1', referral_source: '' }, sources)).toBe('A friend')
    expect(referralLabel({ referral_source_id: 's2', referral_source: '' }, sources)).toBe('Boat show')
  })

  it('keeps the free line for "Other" — that is how gui learns what to add', () => {
    expect(referralLabel({ referral_source_id: 'other', referral_source: '  a kite school in Lisbon ' }, sources))
      .toBe('a kite school in Lisbon')
  })

  it('is empty when the question was skipped', () => {
    expect(referralLabel({ referral_source_id: '', referral_source: '' }, sources)).toBe('')
    expect(referralLabel({ referral_source_id: 'other', referral_source: '   ' }, sources)).toBe('')
  })

  it('refuses to invent a label for an id it does not know', () => {
    // The list changed under the visitor's feet: an empty answer beats a stale
    // one that would then be counted as a fact.
    expect(referralLabel({ referral_source_id: 'gone', referral_source: '' }, sources)).toBe('')
    expect(referralLabel({ referral_source_id: 's1', referral_source: '' }, [])).toBe('')
  })

  it('ignores the free line when a real source was chosen', () => {
    expect(referralLabel({ referral_source_id: 's1', referral_source: 'leftover text' }, sources)).toBe('A friend')
  })
})
