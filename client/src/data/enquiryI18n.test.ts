import { describe, it, expect } from 'vitest'
import { resolveLang, etr } from './enquiryI18n'

describe('resolveLang', () => {
  it('lets the website decide — it is the only one that knows which page it serves', () => {
    // A French speaker reading the Spanish page must get the Spanish form.
    expect(resolveLang('?lang=es', 'fr-FR')).toBe('es')
    expect(resolveLang('?lang=fr', 'en-GB')).toBe('fr')
  })

  it('accepts a full locale, not just a code', () => {
    expect(resolveLang('?lang=fr-CA', 'en')).toBe('fr')
  })

  it('falls back to the browser for a direct visit', () => {
    expect(resolveLang('', 'es-ES')).toBe('es')
    expect(resolveLang('', 'fr')).toBe('fr')
  })

  it('lands on English for anything we do not speak', () => {
    expect(resolveLang('', 'de-DE')).toBe('en')
    expect(resolveLang('?lang=de', 'de-DE')).toBe('en')
    expect(resolveLang('', '')).toBe('en')
  })

  it('ignores a nonsense parameter rather than breaking the page', () => {
    expect(resolveLang('?lang=%%%', 'fr-FR')).toBe('fr')
  })
})

describe('etr', () => {
  it('has all three languages on every string — a missing one would render blank', () => {
    for (const [key, value] of Object.entries(etr)) {
      for (const lang of ['fr', 'en', 'es'] as const) {
        expect(value[lang], `${key}.${lang}`).toBeTruthy()
      }
    }
  })
})
