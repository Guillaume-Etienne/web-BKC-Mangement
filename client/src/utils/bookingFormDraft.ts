/** Keeping what the visitor typed, so no recovery costs them their afternoon.
 *
 *  The booking form is five screens, up to four travellers, passport numbers
 *  and an emergency contact. Every remedy we have for a crash — remount,
 *  reload, "try again" — used to throw all of that away, which is why the
 *  Android client of 2026-09-04 simply stopped. With a draft on the device,
 *  a crash costs a second and a scroll instead of a re-typing session.
 *
 *  It is the visitor's own browser, and the draft is wiped the moment the form
 *  is sent. Passport numbers are in it, so it is deliberately short-lived: a
 *  week, then it is treated as if it were never there. */

import type { FormTraveler } from '../types/database'
import type { FormData } from './bookingFormCompleteness'
import { readLocal, writeLocal, removeLocal } from './safeStorage'

export interface FormDraft {
  v: 1
  savedAt: number
  step: number
  lang: string
  d: FormData
  travelers: FormTraveler[]
}

export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** One key per link: a personalised link from an enquiry and the open form are
 *  two different conversations, and a family sharing a tablet must not find
 *  someone else's passport in their form. */
export function draftKey(scope?: string | null): string {
  return `bkc_form_draft_v1:${scope || 'open'}`
}

export function saveDraft(key: string, draft: Omit<FormDraft, 'v' | 'savedAt'>, now = Date.now()): boolean {
  try {
    return writeLocal(key, JSON.stringify({ v: 1, savedAt: now, ...draft }))
  } catch {
    // A payload that will not serialise is not worth a crash on a keystroke.
    return false
  }
}

/** Defensive on purpose: this runs before the first paint, on data that has sat
 *  in a browser across app versions. Anything it does not recognise is treated
 *  as no draft at all — a fresh form is always a valid answer, a crash is not. */
export function loadDraft(key: string, now = Date.now()): FormDraft | null {
  const raw = readLocal(key)
  if (!raw) return null
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { removeLocal(key); return null }
  if (!parsed || typeof parsed !== 'object') { removeLocal(key); return null }
  const dr = parsed as Partial<FormDraft>
  if (dr.v !== 1) { removeLocal(key); return null }
  if (typeof dr.savedAt !== 'number' || now - dr.savedAt > DRAFT_MAX_AGE_MS) { removeLocal(key); return null }
  if (!dr.d || typeof dr.d !== 'object' || !Array.isArray(dr.travelers)) { removeLocal(key); return null }
  return {
    v: 1,
    savedAt: dr.savedAt,
    step: typeof dr.step === 'number' && dr.step >= 1 ? dr.step : 1,
    lang: typeof dr.lang === 'string' ? dr.lang : '',
    d: dr.d as FormData,
    travelers: dr.travelers as FormTraveler[],
  }
}

export function clearDraft(key: string): void { removeLocal(key) }

/** True once the visitor has actually put something of their own in. Restoring
 *  a draft that only holds the link's own prefill would show "we kept your
 *  answers" to someone who has typed nothing.
 *
 *  Deliberately blind to the counters: nights, beds and luggage all start at a
 *  sensible number in EMPTY_FORM, so a non-zero one says nothing about whether
 *  anybody touched it. The dates, the crew and the emergency contact all start
 *  empty, and one of them is filled long before a draft is worth restoring. */
export function isWorthKeeping(d: FormData, travelers: FormTraveler[]): boolean {
  const filled = (s: unknown) => typeof s === 'string' && s.trim().length > 0
  if (filled(d.country_entry_date) || filled(d.country_exit_date)) return true
  if (filled(d.emergency_contact_name) || filled(d.emergency_contact_phone)) return true
  return travelers.some(t => filled(t.first_name) || filled(t.last_name) || filled(t.passport_number))
}
