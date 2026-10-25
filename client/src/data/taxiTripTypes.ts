import type { TaxiTripType } from '../types/database'

// The one place the taxi trip names live. Every screen (admin list, kanban,
// filters, driver statement, shared pages, client page, dossier) reads from here —
// rename a trip once, it changes everywhere.
//
// The Postgres enum `taxi_trip_type` still holds 'aero-to-spot' / 'spot-to-aero'
// (an enum value cannot be dropped); the app no longer offers or knows them.

export type TaxiTripLang = 'en' | 'pt'

interface TripTypeInfo { icon: string; en: string; pt: string }

export const TAXI_TRIP_TYPES: Record<TaxiTripType, TripTypeInfo> = {
  'aero-to-center': { icon: '✈️', en: 'Airport → Bilene', pt: 'Aeroporto → Bilene' },
  'center-to-aero': { icon: '🏠', en: 'Bilene → Airport', pt: 'Bilene → Aeroporto' },
  'center-to-town': { icon: '🏠', en: 'Bilene → Maputo',  pt: 'Bilene → Maputo' },
  'town-to-center': { icon: '🏢', en: 'Maputo → Bilene',  pt: 'Maputo → Bilene' },
  'other':          { icon: '❓', en: 'Other',            pt: 'Outro' },
}

/** Keys in display order — drives every dropdown and filter. */
export const TAXI_TRIP_TYPE_KEYS = Object.keys(TAXI_TRIP_TYPES) as TaxiTripType[]

/** "Airport → Bilene", or "✈️ Airport → Bilene" with `icon`. An unknown value
 *  (a row saved before a type was retired) shows as is rather than blank. */
export function taxiTripLabel(type: string, opts: { icon?: boolean; lang?: TaxiTripLang } = {}): string {
  const info = TAXI_TRIP_TYPES[type as TaxiTripType]
  if (!info) return type
  const text = info[opts.lang ?? 'en']
  return opts.icon ? `${info.icon} ${text}` : text
}

/** Every type → its label, in display order (for dropdowns and lookups). */
export function taxiTripLabels(opts: { icon?: boolean; lang?: TaxiTripLang } = {}): Record<string, string> {
  return Object.fromEntries(TAXI_TRIP_TYPE_KEYS.map(k => [k, taxiTripLabel(k, opts)]))
}
