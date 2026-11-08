import { describe, it, expect } from 'vitest'
import { normalizeFlight, flightTrackUrl, travelLabel, tripTravel, travelToStore } from './travelMode'

describe('normalizeFlight', () => {
  it('upper-cases and squeezes the spaces, nothing more', () => {
    expect(normalizeFlight('  tm  302 ')).toBe('TM 302')
    expect(normalizeFlight('tm302/et851')).toBe('TM302/ET851')
  })
})

describe('flightTrackUrl', () => {
  it('links a flight code, spaces or not', () => {
    expect(flightTrackUrl('TM 302')).toBe('https://www.google.com/search?q=TM302%20flight')
    expect(flightTrackUrl('fa171')).toBe('https://www.google.com/search?q=FA171%20flight')
    expect(flightTrackUrl('ET851A')).not.toBeNull()
  })
  it('never links free text or a connection', () => {
    expect(flightTrackUrl('bus from Tofo')).toBeNull()
    expect(flightTrackUrl('TM302/ET851')).toBeNull()
    expect(flightTrackUrl('')).toBeNull()
    expect(flightTrackUrl(null)).toBeNull()
  })
})

describe('travelLabel', () => {
  it('a flight with its number, and its status link', () => {
    expect(travelLabel('flight', 'TM 302')).toEqual({ icon: '✈️', text: 'TM 302', url: 'https://www.google.com/search?q=TM302%20flight', missing: false })
  })
  it('a flight without number is flagged', () => {
    expect(travelLabel('flight', '  ')).toMatchObject({ missing: true, text: 'Flight no. missing' })
    expect(travelLabel('flight', null, 'pt')).toMatchObject({ missing: true, text: 'Nº de voo em falta' })
  })
  it('car and other, in the driver language too', () => {
    expect(travelLabel('car', 'ignored')).toMatchObject({ icon: '🚗', text: 'By car', url: null })
    expect(travelLabel('car', null, 'pt')).toMatchObject({ text: 'De carro' })
    expect(travelLabel('other', 'bus from Tofo')).toMatchObject({ icon: '📝', text: 'bus from Tofo', url: null })
    expect(travelLabel('other', '')).toMatchObject({ text: 'Other' })
  })
  it('an old booking says nothing, unless a number was typed without a mode', () => {
    expect(travelLabel(null, null)).toBeNull()
    expect(travelLabel(undefined, '')).toBeNull()
    expect(travelLabel(null, 'TM302')).toMatchObject({ icon: '✈️', text: 'TM302' })
  })
})

describe('tripTravel', () => {
  const b = { arrival_by: 'flight', arrival_detail: 'TM 302', departure_by: 'car', departure_detail: null }
  it('airport pick-up = arrival, airport drop-off = departure', () => {
    expect(tripTravel('aero-to-center', b)?.text).toBe('TM 302')
    expect(tripTravel('center-to-aero', b)?.text).toBe('By car')
  })
  it('a Maputo leg, or no booking, has no flight', () => {
    expect(tripTravel('center-to-town', b)).toBeNull()
    expect(tripTravel('aero-to-center', null)).toBeNull()
  })
})

describe('travelToStore', () => {
  it('normalises a flight, drops the detail of a car, trims other', () => {
    expect(travelToStore('flight', ' tm 302 ')).toEqual({ by: 'flight', detail: 'TM 302' })
    expect(travelToStore('car', 'TM 302')).toEqual({ by: 'car', detail: null })
    expect(travelToStore('other', '  bus   from Tofo ')).toEqual({ by: 'other', detail: 'bus from Tofo' })
    expect(travelToStore('flight', '   ')).toEqual({ by: 'flight', detail: null })
  })
  it('no mode chosen: keeps a typed number, nothing else', () => {
    expect(travelToStore('', 'tm302')).toEqual({ by: null, detail: 'TM302' })
    expect(travelToStore(null, '')).toEqual({ by: null, detail: null })
  })
})
