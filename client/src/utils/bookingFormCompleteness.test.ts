import { describe, it, expect } from 'vitest'
import { missingOnStep, canLeaveStep, EMPTY_FORM } from './bookingFormCompleteness'
import type { FormData } from './bookingFormCompleteness'
import type { FormTraveler } from '../types/database'

function mkForm(patch: Partial<FormData> = {}): FormData {
  return { ...EMPTY_FORM, ...patch }
}
function mkTraveler(patch: Partial<FormTraveler> = {}): FormTraveler {
  return { first_name: 'Ana', last_name: 'Silva', passport_number: '', ...patch }
}

describe('missingOnStep', () => {
  it('names the two answers step 1 needs', () => {
    const keys = missingOnStep(1, mkForm(), []).map(m => m.key)
    expect(keys).toEqual(['f_reference_name', 'f_email'])
  })

  it('is happy once step 1 is answered', () => {
    const d = mkForm({ reference_name: 'Bruno Sousa', email: 'b@x.com' })
    expect(missingOnStep(1, d, [])).toEqual([])
  })

  it('asks for both flight dates on step 2', () => {
    const keys = missingOnStep(2, mkForm(), []).map(m => m.key)
    expect(keys).toContain('f_country_entry')
    expect(keys).toContain('f_country_exit')
  })

  // Both transfers used to arrive with "Yes" already lit. The visitor read back
  // an answer they had never given, and a trip that needed no taxi got one
  // unless they noticed and un-clicked it.
  it('makes the visitor answer both transfer questions', () => {
    const keys = missingOnStep(2, mkForm(), []).map(m => m.key)
    expect(keys).toContain('f_taxi_arrival')
    expect(keys).toContain('f_taxi_departure')
  })

  it('accepts "no transfer" as an answer, not as a blank', () => {
    const d = mkForm({
      country_entry_date: '2027-01-10', country_exit_date: '2027-01-20',
      taxi_arrival: false, taxi_departure: false,
    })
    expect(missingOnStep(2, d, [])).toEqual([])
    expect(canLeaveStep(2, d, [])).toBe(true)
  })

  it('flags a night count brought down to zero', () => {
    const keys = missingOnStep(2, mkForm({ nights_bilene: 0 }), []).map(m => m.key)
    expect(keys).toContain('f_nights')
  })

  it('never blocks step 3 — it asks nothing mandatory', () => {
    expect(missingOnStep(3, mkForm(), [])).toEqual([])
    expect(canLeaveStep(3, mkForm(), [])).toBe(true)
  })

  // The Android report of 2026-09-04: a link labelled with a single first name
  // pre-filled "Bruno" and left the last name empty. The step must say so.
  it('says WHICH traveler is missing a last name', () => {
    const crew = [mkTraveler({ first_name: 'Bruno', last_name: '' })]
    expect(missingOnStep(4, mkForm(), crew)).toEqual([
      { key: 'f_last_name', traveler: 1 },
    ])
  })

  it('numbers the travelers from 1, not from 0', () => {
    const crew = [mkTraveler(), mkTraveler({ first_name: '' })]
    expect(missingOnStep(4, mkForm(), crew)).toEqual([
      { key: 'f_first_name', traveler: 2 },
    ])
  })

  it('treats a whitespace-only name as empty', () => {
    const crew = [mkTraveler({ last_name: '   ' })]
    expect(missingOnStep(4, mkForm(), crew).map(m => m.key)).toEqual(['f_last_name'])
  })

  it('asks for someone when the crew is empty', () => {
    expect(missingOnStep(4, mkForm(), [])).toEqual([{ key: 'f_first_name', traveler: 1 }])
  })

  it('counts the unticked waiver as a missing answer on step 5', () => {
    const d = mkForm({ emergency_contact_name: 'Ana', emergency_contact_phone: '+258 84' })
    expect(missingOnStep(5, d, []).map(m => m.key)).toEqual(['waiver_heading'])
  })

  it('lets step 5 through once the waiver is ticked', () => {
    const d = mkForm({
      emergency_contact_name: 'Ana', emergency_contact_phone: '+258 84', waiver_accepted: true,
    })
    expect(canLeaveStep(5, d, [mkTraveler()])).toBe(true)
  })

  it('agrees with canLeaveStep on every step', () => {
    const d = mkForm()
    for (const step of [1, 2, 3, 4, 5]) {
      expect(canLeaveStep(step, d, [])).toBe(missingOnStep(step, d, []).length === 0)
    }
  })
})
