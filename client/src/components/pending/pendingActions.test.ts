import { describe, it, expect } from 'vitest'
import { computePendingActions, splitDismissed, type PendingAction, type PendingActionsData } from './pendingActions'
import type { Booking } from '../../types/database'

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


// ── Affaire classée ─────────────────────────────────────────────────────────

/** Le strict nécessaire : computePendingActions ne lit que ces champs-là. */
function mkBooking(over: Partial<Booking> & { id: string }): Booking {
  return {
    booking_number: 1, status: 'provisional',
    check_in: '2026-01-01', check_out: '2026-01-08',
    ...over,
  } as unknown as Booking
}

/** Une réservation qui arrive dans `days` jours, sans rien d'envoyé. */
function bookingInDays(id: string, days: number): Booking {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  const iso = d.toISOString().slice(0, 10)
  const out = new Date(d); out.setDate(out.getDate() + 7)
  return mkBooking({ id, check_in: iso, check_out: out.toISOString().slice(0, 10) })
}

const keyOf = (actions: PendingAction[], idPrefix: string) =>
  actions.find(a => a.id.startsWith(idPrefix))!.dismissKey

describe('computePendingActions — la clé de classement', () => {
  it('en donne une à chaque ligne, sinon le bouton classerait le vide', () => {
    const all = computePendingActions(mkData({
      unqualifiedEnquiriesCount: 1, silentEnquiriesCount: 1, crmFailedCount: 1,
      pendingFormSubmissionsCount: 1, taxiTripUnlinkedCount: 1,
      bookings: [bookingInDays('b1', 1)],
      payments: [{ id: 'p1', booking_id: 'b1', date: '2026-01-01', is_verified: false, is_discount: false } as never],
    }))
    expect(all.length).toBeGreaterThan(5)
    expect(all.every(a => !!a.dismissKey)).toBe(true)
  })

  it("ne change pas quand l'urgence monte — une affaire classée le reste", () => {
    // C'est tout l'intérêt de ne pas classer sur `id` : celui-ci passe de
    // travel-guide-week-b1 à travel-guide-urgent-b1 à deux jours de l'arrivée.
    const week   = computePendingActions(mkData({ bookings: [bookingInDays('b1', 5)] }))
    const urgent = computePendingActions(mkData({ bookings: [bookingInDays('b1', 1)] }))
    expect(keyOf(week, 'travel-guide-week')).toBe('travel-guide:b1')
    expect(keyOf(urgent, 'travel-guide-urgent')).toBe('travel-guide:b1')
    expect(keyOf(week, 'no-payment-week')).toBe(keyOf(urgent, 'no-payment-urgent'))
  })

  it('compte ce que la ligne compte, pour les lignes qui comptent', () => {
    const a = find(mkData({ unqualifiedEnquiriesCount: 3 }), 'unqualified-enquiries')!
    expect(a.dismissCount).toBe(3)
    // Une ligne oui/non n'en a pas : elle est classée jusqu'à réouverture.
    const g = computePendingActions(mkData({ bookings: [bookingInDays('b1', 5)] }))
      .find(x => x.id.startsWith('travel-guide-week'))!
    expect(g.dismissCount).toBeUndefined()
  })
})

describe('splitDismissed', () => {
  const line = (over: Partial<PendingAction> = {}): PendingAction => ({
    id: 'x', priority: 'week', message: 'm', route: 'home', routeLabel: 'Home',
    dismissKey: 'k', ...over,
  })

  it("laisse tout en haut quand rien n'est classé", () => {
    const { open, closed } = splitDismissed([line()], [])
    expect(open).toHaveLength(1)
    expect(closed).toHaveLength(0)
  })

  it("range une ligne oui/non jusqu'à réouverture", () => {
    const { open, closed } = splitDismissed([line()], [{ dismiss_key: 'k', up_to_count: null }])
    expect(open).toHaveLength(0)
    expect(closed).toHaveLength(1)
  })

  it('ne range que ce qui porte la clé', () => {
    const { open, closed } = splitDismissed(
      [line({ id: 'a', dismissKey: 'k1' }), line({ id: 'b', dismissKey: 'k2' })],
      [{ dismiss_key: 'k1', up_to_count: null }])
    expect(closed.map(a => a.id)).toEqual(['a'])
    expect(open.map(a => a.id)).toEqual(['b'])
  })

  it('rouvre une ligne qui compte dès que le nombre dépasse ce qui a été classé', () => {
    // Le piège qu'on refuse : classer « 3 demandes à lire » puis ne jamais voir
    // arriver la quatrième.
    const { open } = splitDismissed([line({ dismissCount: 4 })], [{ dismiss_key: 'k', up_to_count: 3 }])
    expect(open).toHaveLength(1)
  })

  it('la garde classée tant que le nombre ne dépasse pas', () => {
    // Trois classées, une traitée : les deux qui restent étaient dans le lot.
    const { closed } = splitDismissed([line({ dismissCount: 2 })], [{ dismiss_key: 'k', up_to_count: 3 }])
    expect(closed).toHaveLength(1)
  })

  it("garde l'ordre de priorité dans les deux listes", () => {
    const actions = [line({ id: 'u', priority: 'urgent' }), line({ id: 'm', priority: 'monitor' })]
    const { open } = splitDismissed(actions, [])
    expect(open.map(a => a.id)).toEqual(['u', 'm'])
  })

  it('oublie un classement dont la situation a disparu', () => {
    // Rien à afficher : la ligne n'est plus calculée du tout, et la ligne en
    // base ne ressuscite personne. C'est le ménage, et il est gratuit.
    const { open, closed } = splitDismissed([], [{ dismiss_key: 'k', up_to_count: null }])
    expect(open).toHaveLength(0)
    expect(closed).toHaveLength(0)
  })
})
