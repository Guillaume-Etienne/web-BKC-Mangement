import { describe, it, expect } from 'vitest'
import { bileneStart, nightsFromDates, leaveDateFromNights, nightsMismatch, withAutoNights, proposedStay, stayIssues } from './bileneStay'

// Booking #029's form (2026-09-04), as it was sent.
const BOOKING_029 = {
  country_entry_date: '2027-01-14', country_exit_date: '2027-02-06',
  transfer_to_bilene_date: '2027-01-14', transfer_to_airport_date: '2027-02-06',
  nights_bilene: 7,
}

describe('bileneStay', () => {
  it('starts on the transfer pickup, else on the country entry', () => {
    expect(bileneStart({ country_entry_date: '2027-01-13', transfer_to_bilene_date: '2027-01-14' })).toBe('2027-01-14')
    expect(bileneStart({ country_entry_date: '2027-01-13' })).toBe('2027-01-13')
    expect(bileneStart({})).toBe('')
  })

  it('counts nights from the dates, never zero or negative', () => {
    expect(nightsFromDates(BOOKING_029)).toBe(23)
    expect(nightsFromDates({ country_entry_date: '2027-01-14' })).toBeNull()
    expect(nightsFromDates({ country_entry_date: '2027-01-14', transfer_to_airport_date: '2027-01-14' })).toBeNull()
  })

  it('#029: the untouched 7 is flagged against the airport transfer', () => {
    expect(leaveDateFromNights(BOOKING_029)).toBe('2027-01-21')
    expect(nightsMismatch(BOOKING_029)).toEqual({ byNights: '2027-01-21', byTransfer: '2027-02-06' })
    expect(nightsMismatch({ ...BOOKING_029, nights_bilene: 23 })).toBeNull()
    expect(nightsMismatch({ ...BOOKING_029, nights_bilene: 0 })).toBeNull()
  })

  it('#029: the review screen proposes the transfer dates, not entry + 7', () => {
    expect(proposedStay(BOOKING_029)).toEqual({ checkIn: '2027-01-14', checkOut: '2027-02-06' })
    // No departure transfer → typed nights, as before.
    expect(proposedStay({ country_entry_date: '2027-01-14', nights_bilene: 7 }))
      .toEqual({ checkIn: '2027-01-14', checkOut: '2027-01-21' })
  })

  describe('withAutoNights', () => {
    const empty = { nights_bilene: 0, country_entry_date: '2027-01-14', transfer_to_bilene_date: '', transfer_to_airport_date: '' }
    it('fills the nights when the transfer dates complete the picture', () => {
      const next = withAutoNights(empty, { ...empty, transfer_to_airport_date: '2027-01-24' })
      expect(next.nights_bilene).toBe(10)
    })
    it('lets a hand correction stand while the dates do not move', () => {
      const dated = { ...empty, transfer_to_airport_date: '2027-01-24', nights_bilene: 10 }
      expect(withAutoNights(dated, { ...dated, nights_bilene: 9 }).nights_bilene).toBe(9)
    })
    it('follows again once the dates change', () => {
      const dated = { ...empty, transfer_to_airport_date: '2027-01-24', nights_bilene: 9 }
      expect(withAutoNights(dated, { ...dated, transfer_to_airport_date: '2027-01-26' }).nights_bilene).toBe(12)
    })
  })

  describe('stayIssues', () => {
    it('is quiet when everything agrees', () => {
      expect(stayIssues({ ...BOOKING_029, nights_bilene: 23 }, '2027-01-14', '2027-02-06')).toEqual([])
    })
    it('#029 as it was booked: the check-out misses the airport transfer', () => {
      const kinds = stayIssues(BOOKING_029, '2027-01-14', '2027-01-21').map(i => i.kind)
      expect(kinds).toEqual(['checkout_vs_transfer', 'exit_after_checkout'])
    })
    it('#029 with the right dates: the untouched 7 is still pointed out', () => {
      expect(stayIssues(BOOKING_029, '2027-01-14', '2027-02-06'))
        .toEqual([{ kind: 'nights_vs_dates', typed: 7, dates: 23 }])
    })
    it('a later country exit is information, an earlier one a problem', () => {
      expect(stayIssues({ country_exit_date: '2027-02-10' }, '2027-01-14', '2027-02-06'))
        .toEqual([{ kind: 'exit_after_checkout', exit: '2027-02-10' }])
      // #033: exit typed as 2026-09-20 for a February stay.
      expect(stayIssues({ country_exit_date: '2026-09-20' }, '2027-02-06', '2027-02-19'))
        .toEqual([{ kind: 'exit_before_checkout', exit: '2026-09-20' }])
    })
  })
})
