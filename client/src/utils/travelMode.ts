// How a guest reaches Bilene and leaves it (2026-11-08). The public form asks
// for the FLIGHT NUMBER — required — unless the guest comes by car or another
// way. A date and an hour typed by hand go wrong (AM/PM, the departure city's
// time, a 00:30 landing on which day?); a flight number can be checked, and the
// driver can follow a delay himself.
//
// Stored on `bookings` (and in the form payload) as two pairs:
//   arrival_by   / arrival_detail
//   departure_by / departure_detail
// `*_by` is 'flight' | 'car' | 'other'. `*_detail` is the flight number when
// 'flight', the guest's own words when 'other', empty when 'car'. NULL `*_by` =
// not asked (bookings older than this). No screen reads the raw pair: they all
// go through travelLabel(), so the meaning of `detail` lives here only.
import type { TaxiTripType } from '../types/database'

export type TravelBy = 'flight' | 'car' | 'other'
export const TRAVEL_BY: TravelBy[] = ['flight', 'car', 'other']

export type TravelLang = 'en' | 'pt'

export function isTravelBy(v: unknown): v is TravelBy {
  return v === 'flight' || v === 'car' || v === 'other'
}

/** "tm  302 " → "TM 302". Kept as typed otherwise: a strict pattern on a
 *  public form is how a guest gets stuck on a connection written "TM302/ET851". */
export function normalizeFlight(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toUpperCase()
}

/** A link that shows the flight's status — only for something that looks like
 *  one flight code (2–3 letters/digits + 1–4 digits), never for free text. */
export function flightTrackUrl(flight: string | null | undefined): string | null {
  const code = (flight ?? '').replace(/\s+/g, '').toUpperCase()
  if (!/^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(code)) return null
  return `https://www.google.com/search?q=${encodeURIComponent(`${code} flight`)}`
}

export interface TravelLabel {
  icon: string
  text: string
  /** Flight status link, when the detail is a flight code. */
  url:  string | null
  /** A flight with no number yet: worth chasing before a driver is sent. */
  missing: boolean
}

const WORDS = {
  car:       { en: 'By car',            pt: 'De carro' },
  other:     { en: 'Other',             pt: 'Outro' },
  noFlight:  { en: 'Flight no. missing', pt: 'Nº de voo em falta' },
}

/** What every screen shows for one direction. null = nothing known (old booking). */
export function travelLabel(by: string | null | undefined, detail: string | null | undefined, lang: TravelLang = 'en'): TravelLabel | null {
  const text = (detail ?? '').trim()
  if (by === 'flight') {
    return text
      ? { icon: '✈️', text, url: flightTrackUrl(text), missing: false }
      : { icon: '✈️', text: WORDS.noFlight[lang], url: null, missing: true }
  }
  if (by === 'car')   return { icon: '🚗', text: WORDS.car[lang], url: null, missing: false }
  if (by === 'other') return { icon: '📝', text: text || WORDS.other[lang], url: null, missing: false }
  // Typed by an admin without choosing a mode: a flight code still reads as one.
  if (text) return { icon: '✈️', text, url: flightTrackUrl(text), missing: false }
  return null
}

export interface TravelFields {
  arrival_by?:       string | null
  arrival_detail?:   string | null
  departure_by?:     string | null
  departure_detail?: string | null
}

/** The leg of the journey a taxi trip serves: an airport pick-up is the
 *  arrival, an airport drop-off the departure; anything else has no flight. */
export function tripTravel(type: TaxiTripType | string, b: TravelFields | null | undefined, lang: TravelLang = 'en'): TravelLabel | null {
  if (!b) return null
  if (type === 'aero-to-center') return travelLabel(b.arrival_by, b.arrival_detail, lang)
  if (type === 'center-to-aero') return travelLabel(b.departure_by, b.departure_detail, lang)
  return null
}

/** What goes in the database for one direction: no detail for a car, a
 *  normalised number for a flight, the guest's words trimmed otherwise. */
export function travelToStore(by: TravelBy | '' | null | undefined, detail: string | null | undefined): { by: TravelBy | null; detail: string | null } {
  if (!isTravelBy(by)) return { by: null, detail: detail?.trim() ? normalizeFlight(detail) : null }
  if (by === 'car') return { by, detail: null }
  const t = (detail ?? '').trim()
  if (!t) return { by, detail: null }
  return { by, detail: by === 'flight' ? normalizeFlight(t) : t.replace(/\s+/g, ' ') }
}
