import { describe, it, expect } from 'vitest'
import { searchEverything, EMPTY_INDEX, type SearchIndex } from './globalSearch'

const index: SearchIndex = {
  clients: [
    { id: 'c1', first_name: 'Michel', last_name: 'Rulliat', email: 'fatmichel62@gmail.com', phone: '+33766756887' },
    { id: 'c2', first_name: 'Élisabeth', last_name: 'Bouteiller', email: 'babeth@orange.fr', phone: null,
      notes: 'Vient toujours en février avec Laurent' },
    { id: 'c3', first_name: 'Loic', last_name: 'Sene', email: null, phone: null, passport_number: '19FR88112' },
  ],
  bookings: [
    { id: 'b1', booking_number: 23, client_id: 'c1', check_in: '2026-11-07', check_out: '2026-11-21', status: 'provisional' },
    { id: 'b2', booking_number: 25, client_id: 'c2', check_in: '2026-10-31', check_out: '2026-11-05', status: 'provisional',
      notes: 'Full house 5 nights' },
  ],
  enquiries: [
    { id: 'e1', name: 'Cindy', email: null, phone: null, status: 'talking', arrival_month: '2026-11',
      message: 'Nous sommes 3 et envisageons un voyage au Mozambique de 14 jours début novembre.' },
    { id: 'e2', name: 'Pascal', email: null, phone: null, status: 'new', arrival_month: '2026-11',
      message: 'Do you also rent out wing foil equipment?' },
  ],
  notesByEnquiry: { e1: ['Relancée le 20, attend le prix des cours'] },
}

describe('searchEverything', () => {
  it('returns nothing below two characters — one letter is noise', () => {
    expect(searchEverything(index, 'm')).toEqual([])
    expect(searchEverything(index, '')).toEqual([])
    expect(searchEverything(index, '  ')).toEqual([])
  })

  it('finds nothing in an empty index', () => {
    expect(searchEverything(EMPTY_INDEX, 'michel')).toEqual([])
  })

  it('finds a client by the start of either name', () => {
    expect(searchEverything(index, 'rull')[0].targetId).toBe('c1')
    expect(searchEverything(index, 'mich')[0].targetId).toBe('c1')
  })

  it('ignores accents in both directions', () => {
    expect(searchEverything(index, 'elisabeth')[0].targetId).toBe('c2')
    expect(searchEverything(index, 'fevrier').some(h => h.targetId === 'c2')).toBe(true)
  })

  it('ranks a name above a match buried in a note', () => {
    const hits = searchEverything(index, 'laurent')
    expect(hits[0].kind).toBe('client')      // only the note mentions Laurent
    const mixed = searchEverything(index, 'cindy')
    expect(mixed[0].kind).toBe('enquiry')
  })

  it('puts the client above their own booking on a name match', () => {
    const hits = searchEverything(index, 'rulliat')
    expect(hits[0].kind).toBe('client')
    expect(hits[1].kind).toBe('booking')
  })

  it('finds a booking by number, typed however it is remembered', () => {
    for (const q of ['23', '#23', '023']) {
      const hits = searchEverything(index, q)
      expect(hits[0].kind, `query ${q}`).toBe('booking')
      expect(hits[0].targetId).toBe('b1')
    }
  })

  it('searches inside enquiry messages and their notes', () => {
    expect(searchEverything(index, 'wing foil')[0].targetId).toBe('e2')
    const chased = searchEverything(index, 'prix des cours')
    expect(chased[0].targetId).toBe('e1')
    expect(chased[0].why).toContain('prix des cours')
  })

  it('shows the sentence that matched, not just the row', () => {
    const hit = searchEverything(index, 'mozambique')[0]
    expect(hit.why).toContain('Mozambique')
    expect(hit.why!.length).toBeLessThan(90)
  })

  it('finds someone by email, phone or passport', () => {
    expect(searchEverything(index, 'fatmichel')[0].targetId).toBe('c1')
    expect(searchEverything(index, '766756887')[0].targetId).toBe('c1')
    expect(searchEverything(index, '19fr88')[0].targetId).toBe('c3')
  })

  it('never returns more than the limit', () => {
    expect(searchEverything(index, 'e', 3).length).toBeLessThanOrEqual(3)
    expect(searchEverything(index, '2026-11', 2).length).toBeLessThanOrEqual(2)
  })

  it('is stable: the same query gives the same order', () => {
    const a = searchEverything(index, 'novembre').map(h => h.id)
    const b = searchEverything(index, 'novembre').map(h => h.id)
    expect(a).toEqual(b)
  })
})
