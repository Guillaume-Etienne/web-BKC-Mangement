// The taxi manager's "Viagens" tab (2026-11-09): upcoming trips grouped by
// day, the ones without a driver flagged, and a WhatsApp message ready to send
// to a driver — the manager dispatches by WhatsApp. Pure functions, tested.
//
// ⚠️ A message leaves the app: it carries the trip (date, route, client, load,
// flight, notes) and NEVER an amount.
import { addDaysISO } from './dates'
import { tr, tripTypeLabel, formatTripDate, fmt, bagsLabel, type TaxiLang } from '../data/taxiShareI18n'
import type { TravelLabel } from './travelMode'
import type { TaxiTripType } from '../types/database'

export interface DispatchTrip {
  id: string
  date: string
  start_time: string
  type: TaxiTripType
  taxi_driver_id: string | null
  nb_persons: number
  nb_luggage: number
  nb_boardbags: number
  notes: string | null
}

/** Trips grouped by day, days in order, trips by start time inside a day. */
export function groupByDay<T extends DispatchTrip>(trips: T[]): [string, T[]][] {
  const byDay = new Map<string, T[]>()
  for (const t of [...trips].sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`))) {
    const list = byDay.get(t.date) ?? []
    list.push(t)
    byDay.set(t.date, list)
  }
  return [...byDay.entries()]
}

/** Is `date` within the `days` days starting today (today included)? */
export function withinDays(date: string, today: string, days: number): boolean {
  return date >= today && date < addDaysISO(today, days)
}

/** "Hoje · Seg 09/11", "Amanhã · Ter 10/11", otherwise "Qua 11/11". */
export function dayLabel(date: string, today: string, lang: TaxiLang): string {
  const d = formatTripDate(date, lang, 'readable')
  if (date === today) return `${tr.today[lang]} · ${d}`
  if (date === addDaysISO(today, 1)) return `${tr.tomorrow[lang]} · ${d}`
  return d
}

/** A phone as wa.me wants it (country code + number, digits only), or null
 *  when it is missing or too short to be a full international number — the
 *  link then opens WhatsApp's contact picker instead of a wrong chat. */
export function waPhone(phone: string | null | undefined): string | null {
  const raw = (phone ?? '').trim()
  if (!raw) return null
  let digits = raw.replace(/\D/g, '')
  if (raw.startsWith('00')) digits = digits.slice(2)
  // A Mozambican mobile typed without its code (84 123 4567).
  else if (!raw.startsWith('+') && /^8\d{8}$/.test(digits)) digits = `258${digits}`
  return digits.length >= 10 ? digits : null
}

/** wa.me link: straight to that number's chat, or the contact picker. */
export function whatsappUrl(text: string, phone?: string | null): string {
  const p = waPhone(phone)
  return `https://wa.me/${p ?? ''}?text=${encodeURIComponent(text)}`
}

export interface TripWords {
  client: string | null
  driver: string | null
  /** The flight of an airport trip, when known (a missing number is left out). */
  travel: TravelLabel | null
}

function loadLine(t: DispatchTrip, lang: TaxiLang): string {
  const bags = t.nb_luggage > 0 || t.nb_boardbags > 0 ? ` · 🧳 ${bagsLabel(t.nb_luggage, t.nb_boardbags, lang)}` : ''
  return `👥 ${t.nb_persons} ${tr.unit_pax[lang]}${bags}`
}

function travelText(travel: TravelLabel | null): string | null {
  return travel && !travel.missing ? `${travel.icon} ${travel.text}` : null
}

/** One trip, as sent to a driver. */
export function tripMessage(t: DispatchTrip, w: TripWords, lang: TaxiLang): string {
  return [
    `🚕 ${formatTripDate(t.date, lang, 'readable')} · ${t.start_time}`,
    tripTypeLabel(t.type, lang),
    w.client ? `👤 ${w.client}` : null,
    loadLine(t, lang),
    travelText(w.travel),
    `🚗 ${w.driver ?? tr.unassigned[lang]}`,
    t.notes?.trim() ? `💬 ${t.notes.trim()}` : null,
  ].filter(Boolean).join('\n')
}

/** A whole day, one line per trip — for the drivers' group. */
export function dayMessage<T extends DispatchTrip>(date: string, today: string, trips: T[], words: (t: T) => TripWords, lang: TaxiLang): string {
  const head = `🚕 ${dayLabel(date, today, lang)} — ${fmt(tr.trips_all[lang], { count: trips.length })}`
  const lines = trips.map(t => {
    const w = words(t)
    return [
      `${t.start_time} ${tripTypeLabel(t.type, lang)}`,
      w.client,
      `${t.nb_persons} ${tr.unit_pax[lang]}`,
      travelText(w.travel),
      `🚗 ${w.driver ?? tr.unassigned[lang]}`,
    ].filter(Boolean).join(' · ')
  })
  return [head, ...lines].join('\n')
}
