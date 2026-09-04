import type { FormTraveler } from '../types/database'
import type { FormI18nKey } from '../data/formI18n'

// ─── What the public booking form still needs, step by step ───────────────────
// One list decides two things: whether the step can be left, and what the visitor
// is told is missing. Keeping them apart is how someone ends up staring at a grey
// button with nothing on screen explaining it (reported from Android, 2026-09-04:
// a personalised link carrying a one-word name pre-filled "Bruno" as the first
// name and left the required last name empty, on the one step whose hint was
// suppressed).

/** Form state shape — everything except the travelers and the language. */
export interface FormData {
  reference_name: string
  email: string
  phone: string
  /** An enquiry_sources id, or the literal 'other'. */
  referral_source_id: string
  /** Only filled when the choice is 'other' — the free line. */
  referral_source: string
  country_entry_date: string
  country_exit_date: string
  nights_bilene: number
  arrival_time: string
  departure_time: string
  taxi_arrival: boolean
  taxi_departure: boolean
  transfer_to_bilene_date: string
  transfer_to_bilene_time: string
  transfer_to_airport_date: string
  transfer_to_airport_time: string
  luggage_count: number
  boardbag_count: number
  double_beds: number
  single_beds: number
  /** undefined = not answered yet. A default of false would answer for them. */
  has_travel_insurance?: boolean
  emergency_contact_name: string
  emergency_contact_phone: string
  emergency_contact_email: string
  emergency_contact_relation: string
  waiver_accepted: boolean
}

export const EMPTY_FORM: FormData = {
  reference_name: '', email: '', phone: '', referral_source_id: '', referral_source: '',
  country_entry_date: '', country_exit_date: '', nights_bilene: 7,
  arrival_time: '', departure_time: '',
  taxi_arrival: true, taxi_departure: true,
  transfer_to_bilene_date: '', transfer_to_bilene_time: '',
  transfer_to_airport_date: '', transfer_to_airport_time: '',
  luggage_count: 1, boardbag_count: 1, double_beds: 0, single_beds: 1,
  emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_email: '', emergency_contact_relation: '',
  waiver_accepted: false,
}

/** A required answer still missing. `traveler` is the 1-based crew number when
 *  the field belongs to one traveler rather than to the whole booking. */
export interface MissingAnswer {
  /** The label the form itself shows for that field. */
  key: FormI18nKey
  traveler?: number
}

/** Every required answer still missing on `step`. Empty = the step is done. */
export function missingOnStep(step: number, d: FormData, travelers: FormTraveler[]): MissingAnswer[] {
  const missing: MissingAnswer[] = []
  if (step === 1) {
    if (!d.reference_name.trim()) missing.push({ key: 'f_reference_name' })
    if (!d.email.trim()) missing.push({ key: 'f_email' })
  }
  if (step === 2) {
    if (!(d.nights_bilene > 0)) missing.push({ key: 'f_nights' })
    if (!d.country_entry_date) missing.push({ key: 'f_country_entry' })
    if (!d.country_exit_date) missing.push({ key: 'f_country_exit' })
  }
  if (step === 4) {
    // A crew with nobody in it cannot be described field by field.
    if (travelers.length === 0) missing.push({ key: 'f_first_name', traveler: 1 })
    travelers.forEach((t, i) => {
      if (!t.first_name.trim()) missing.push({ key: 'f_first_name', traveler: i + 1 })
      if (!t.last_name.trim()) missing.push({ key: 'f_last_name', traveler: i + 1 })
    })
  }
  if (step === 5) {
    if (!d.emergency_contact_name.trim()) missing.push({ key: 'f_ec_name' })
    if (!d.emergency_contact_phone.trim()) missing.push({ key: 'f_ec_phone' })
    if (!d.waiver_accepted) missing.push({ key: 'waiver_heading' })
  }
  return missing
}

/** Step 3 asks nothing mandatory, so it is always passable. */
export function canLeaveStep(step: number, d: FormData, travelers: FormTraveler[]): boolean {
  return missingOnStep(step, d, travelers).length === 0
}
