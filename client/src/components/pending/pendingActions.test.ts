import { describe, it, expect } from 'vitest'
import { computePendingActions, type PendingActionsData } from './pendingActions'

/** Only the enquiry lines are covered here — the booking ones predate this file
 *  and are driven by dates relative to today, which is a different exercise. */

function mkData(over: Partial<PendingActionsData> = {}): PendingActionsData {
  return {
    bookings: [], payments: [],
    taxiTripUnlinkedCount: 0, pendingFormSubmissionsCount: 0,
    ...over,
  }
}

const ids = (d: PendingActionsData) => computePendingActions(d).map(a => a.id)
const find = (d: PendingActionsData, id: string) => computePendingActions(d).find(a => a.id === id)

describe('computePendingActions — enquiries', () => {
  it('says nothing when there is nothing to say', () => {
    expect(computePendingActions(mkData())).toEqual([])
  })

  it('raises unread enquiries as urgent — someone is waiting for an answer', () => {
    const a = find(mkData({ unqualifiedEnquiriesCount: 3 }), 'unqualified-enquiries')!
    expect(a.priority).toBe('urgent')
    expect(a.message).toBe('3 new enquiries to read')
    expect(a.route).toBe('requests')
  })

  it('puts unread enquiries above booking forms', () => {
    // A booking form is a dossier and waits well; an unread enquiry is a person.
    const order = ids(mkData({ unqualifiedEnquiriesCount: 1, pendingFormSubmissionsCount: 1 }))
    expect(order.indexOf('unqualified-enquiries')).toBeLessThan(order.indexOf('pending-submissions'))
  })

  it('raises silence for the week, not as an emergency', () => {
    const a = find(mkData({ silentEnquiriesCount: 2 }), 'silent-enquiries')!
    expect(a.priority).toBe('week')
    expect(a.message).toBe('2 enquiries waiting on you for a week or more')
  })

  it('raises a failed CRM push as something to watch', () => {
    const a = find(mkData({ crmFailedCount: 1 }), 'crm-failed')!
    expect(a.priority).toBe('monitor')
    expect(a.message).toBe('1 enquiry not added to Brevo')
  })

  it('routes every enquiry line to Requests', () => {
    const all = computePendingActions(mkData({
      unqualifiedEnquiriesCount: 1, silentEnquiriesCount: 1, crmFailedCount: 1,
      pendingFormSubmissionsCount: 1,
    }))
    expect(all.every(a => a.route === 'requests')).toBe(true)
    expect(all).toHaveLength(4)
  })

  it('stays silent on zero rather than showing an empty line', () => {
    const quiet = mkData({ unqualifiedEnquiriesCount: 0, silentEnquiriesCount: 0, crmFailedCount: 0 })
    expect(computePendingActions(quiet)).toEqual([])
  })

  it('works when the caller omits the enquiry counts entirely', () => {
    // The fields are optional so an older caller cannot crash the Home page.
    expect(computePendingActions(mkData({ pendingFormSubmissionsCount: 1 })).map(a => a.id))
      .toEqual(['pending-submissions'])
  })

  it('singularises', () => {
    expect(find(mkData({ unqualifiedEnquiriesCount: 1 }), 'unqualified-enquiries')!.message)
      .toBe('1 new enquiry to read')
    expect(find(mkData({ silentEnquiriesCount: 1 }), 'silent-enquiries')!.message)
      .toBe('1 enquiry waiting on you for a week or more')
  })
})
