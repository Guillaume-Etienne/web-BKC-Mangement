import { describe, it, expect, beforeEach } from 'vitest'
import { saveDraft, loadDraft, clearDraft, draftKey, isWorthKeeping, DRAFT_MAX_AGE_MS } from './bookingFormDraft'
import { EMPTY_FORM } from './bookingFormCompleteness'
import type { FormTraveler } from '../types/database'

/** A localStorage that can be told to misbehave the way real ones do. */
function fakeStorage(mode: 'ok' | 'throws' = 'ok') {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => { if (mode === 'throws') throw new Error('Access is denied for this document.'); return map.get(k) ?? null },
    setItem: (k: string, v: string) => { if (mode === 'throws') throw new Error('QuotaExceededError'); map.set(k, v) },
    removeItem: (k: string) => { if (mode === 'throws') throw new Error('nope'); map.delete(k) },
    _map: map,
  }
}
function install(s: unknown) { (globalThis as { localStorage?: unknown }).localStorage = s }

const KEY = draftKey('enq-1')
const CREW: FormTraveler[] = [{ first_name: 'Bruno', last_name: 'Meyer', passport_number: 'X123' }]

beforeEach(() => install(fakeStorage()))

describe('booking form draft', () => {
  it('gives the open form and a personalised link their own key', () => {
    expect(draftKey()).not.toBe(draftKey('enq-1'))
    expect(draftKey(null)).toBe(draftKey(undefined))
  })

  it('comes back exactly as it went in', () => {
    const d = { ...EMPTY_FORM, reference_name: 'Bruno', nights_bilene: 7 }
    saveDraft(KEY, { step: 4, lang: 'fr', d, travelers: CREW })
    const back = loadDraft(KEY)
    expect(back?.step).toBe(4)
    expect(back?.lang).toBe('fr')
    expect(back?.d.nights_bilene).toBe(7)
    expect(back?.travelers[0].passport_number).toBe('X123')
  })

  it('forgets a draft older than a week — passports do not linger', () => {
    const t0 = 1_700_000_000_000
    saveDraft(KEY, { step: 2, lang: 'en', d: EMPTY_FORM, travelers: CREW }, t0)
    expect(loadDraft(KEY, t0 + DRAFT_MAX_AGE_MS - 1000)).not.toBeNull()
    expect(loadDraft(KEY, t0 + DRAFT_MAX_AGE_MS + 1000)).toBeNull()
  })

  it('drops what it cannot read instead of crashing the form', () => {
    const s = fakeStorage(); install(s)
    s._map.set(KEY, '{not json')
    expect(loadDraft(KEY)).toBeNull()
    s._map.set(KEY, JSON.stringify({ v: 99, savedAt: Date.now(), d: {}, travelers: [] }))
    expect(loadDraft(KEY)).toBeNull()
    s._map.set(KEY, JSON.stringify({ v: 1, savedAt: Date.now(), d: {}, travelers: 'nope' }))
    expect(loadDraft(KEY)).toBeNull()
  })

  it('survives a browser that refuses to store anything at all', () => {
    install(fakeStorage('throws'))
    expect(() => saveDraft(KEY, { step: 1, lang: 'en', d: EMPTY_FORM, travelers: CREW })).not.toThrow()
    expect(saveDraft(KEY, { step: 1, lang: 'en', d: EMPTY_FORM, travelers: CREW })).toBe(false)
    expect(loadDraft(KEY)).toBeNull()
    expect(() => clearDraft(KEY)).not.toThrow()
  })

  it('survives a browser with no localStorage at all', () => {
    install(undefined)
    expect(loadDraft(KEY)).toBeNull()
    expect(saveDraft(KEY, { step: 1, lang: 'en', d: EMPTY_FORM, travelers: CREW })).toBe(false)
  })

  it('is cleared when the form is sent', () => {
    saveDraft(KEY, { step: 5, lang: 'en', d: EMPTY_FORM, travelers: CREW })
    clearDraft(KEY)
    expect(loadDraft(KEY)).toBeNull()
  })

  describe('isWorthKeeping', () => {
    it('says no to a form that only holds the link prefill', () => {
      const d = { ...EMPTY_FORM, reference_name: 'Bruno', email: 'b@x.com' }
      expect(isWorthKeeping(d, [{ first_name: '', last_name: '', passport_number: '' }])).toBe(false)
    })
    it('ignores the counters — nights and beds start at a number nobody typed', () => {
      expect(isWorthKeeping({ ...EMPTY_FORM, nights_bilene: 7, single_beds: 1 }, [])).toBe(false)
    })
    it('says yes as soon as the visitor answers something of their own', () => {
      expect(isWorthKeeping({ ...EMPTY_FORM, country_entry_date: '2026-09-20' }, [])).toBe(true)
      expect(isWorthKeeping({ ...EMPTY_FORM, emergency_contact_name: 'Ana' }, [])).toBe(true)
      expect(isWorthKeeping(EMPTY_FORM, CREW)).toBe(true)
    })
  })
})
