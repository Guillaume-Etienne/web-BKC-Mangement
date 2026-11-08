import { describe, it, expect } from 'vitest'
import { buildBookingOrder, zeroPricedLines, type BookingOrderData } from './bookingOrder'
import {
  mkAccommodation, mkRoom, mkBookingRoom, mkBookingRoomPrice, mkRoomRate, mkBooking, mkTaxiTrip,
  mkExternalBooking, mkPayment, mkCharge, mkActivityBooking, mkAgency, mkAgencyRateItem, mkAgencyLine,
  mkParticipant, mkData,
} from '../components/accounting/utils.fixtures'
import type { ActivityProvider } from '../types/database'

const provider: ActivityProvider = {
  id: 'prov1', name: 'TourMaputo', type: 'safari', phone: null, email: null, website: null,
  notes: null, is_active: true, show_prices: false, created_at: '2026-01-01T00:00:00Z',
}

// A 7-night stay (01→08/11) in house H3, room F, rate frozen at 60 €.
function base(over: Partial<BookingOrderData> = {}): BookingOrderData {
  return {
    ...mkData({
      accommodations: [mkAccommodation({ id: 'acc1', name: 'H3', type: 'house' })],
      rooms: [mkRoom({ id: 'room1', accommodation_id: 'acc1', name: 'F' })],
      bookingRooms: [mkBookingRoom()],
      bookingRoomPrices: [mkBookingRoomPrice({ price_per_night: 60 })],
      roomRates: [mkRoomRate({ price_per_night: 50 })],
    }),
    ...over,
  }
}

describe('buildBookingOrder', () => {
  it('lists the room at its frozen rate × nights and counts it', () => {
    const o = buildBookingOrder(mkBooking(), base(), [])
    expect(o.lines).toHaveLength(1)
    expect(o.lines[0]).toMatchObject({
      item: { kind: 'room', accommodationName: 'H3', roomName: 'F', nights: 7, nightlyRate: 60 },
      amount: 420, settledBy: { kind: 'us' },
    })
    expect(o.total).toBe(420)
  })

  it('falls back to the base rate when no price was frozen', () => {
    const o = buildBookingOrder(mkBooking(), base({ bookingRoomPrices: [] }), [])
    expect(o.lines[0].amount).toBe(350)
  })

  it('lists every taxi of the booking with its own price, in date order', () => {
    const o = buildBookingOrder(mkBooking(), base({
      taxiTrips: [
        mkTaxiTrip({ id: 't2', date: '2026-11-08', start_time: '06:00', type: 'center-to-aero', price_eur: 120 }),
        mkTaxiTrip({ id: 't1', date: '2026-11-01', start_time: '10:00', price_eur: 110 }),
        mkTaxiTrip({ id: 'other', booking_id: 'bk2' }),
      ],
    }), [])
    const taxis = o.lines.filter(l => l.item.kind === 'taxi')
    expect(taxis.map(l => l.amount)).toEqual([110, 120])
    expect(taxis[0].item).toMatchObject({ tripType: 'aero-to-center', date: '2026-11-01', time: '10:00' })
    expect(o.total).toBe(420 + 230)
  })

  it('shows what the agency pays as included, without a price, and out of the total', () => {
    const o = buildBookingOrder(mkBooking({ agency_id: 'ag1' }), base({
      agencies: [mkAgency()],
      agencyRateItems: [
        mkAgencyRateItem({ id: 'ari1', label: 'Pack Wing 4h', unit_hours: 4 }),
        mkAgencyRateItem({ id: 'ari2', category: 'transfer', label: 'Transfer airport', unit_hours: null }),
      ],
      agencyBillingLines: [
        mkAgencyLine({ id: 'pack', agency_rate_item_id: 'ari1', unit_hours: 4 }),
        mkAgencyLine({ id: 'transfer', agency_rate_item_id: 'ari2', unit_hours: null, participant_id: null }),
      ],
      bookingParticipants: [mkParticipant({ id: 'p1', first_name: 'Alice' })],
      bookingRoomPrices: [mkBookingRoomPrice({ agency_billing_line_id: 'room-line' })],
      taxiTrips: [mkTaxiTrip({ agency_billing_line_id: 'transfer' })],
    }), [])
    expect(o.lines.find(l => l.item.kind === 'room')).toMatchObject({ amount: null, settledBy: { kind: 'agency', name: 'Fun & Fly' } })
    expect(o.lines.find(l => l.item.kind === 'taxi')).toMatchObject({ amount: null, settledBy: { kind: 'agency', name: 'Fun & Fly' } })
    // the transfer line is already shown as its taxi: only the package is listed by name
    const services = o.lines.filter(l => l.item.kind === 'agency_service')
    expect(services).toHaveLength(1)
    expect(services[0].item).toMatchObject({ label: 'Pack Wing 4h', hours: 4, travelerName: 'Alice' })
    expect(o.total).toBe(0)
  })

  it('a bungalow paid to its owner is listed but not owed to us', () => {
    const o = buildBookingOrder(mkBooking(), base({ bookingRoomPrices: [mkBookingRoomPrice({ paid_to_owner: true })] }), [])
    expect(o.lines[0]).toMatchObject({ amount: null, settledBy: { kind: 'owner' } })
    expect(o.total).toBe(0)
  })

  it('a room priced per stay (San Martinho) shows once, as its external stay', () => {
    const o = buildBookingOrder(mkBooking(), base({
      accommodations: [mkAccommodation({ id: 'acc1', name: 'San Martinho', type: 'other', external_billing: true })],
      rooms: [mkRoom({ id: 'room1', accommodation_id: 'acc1', name: 'SM-2' })],
      bookingRoomPrices: [],
      externalAccommodationBkgs: [mkExternalBooking({ total_sell_price: 600 })],
    }), [])
    expect(o.lines).toHaveLength(1)
    expect(o.lines[0]).toMatchObject({ item: { kind: 'external_stay', accommodationName: 'San Martinho', roomNames: ['SM-2'], nights: 4 }, amount: 600 })
  })

  it('a room there with no stay entered still shows, at 0 € (flagged, never dropped)', () => {
    const o = buildBookingOrder(mkBooking(), base({
      accommodations: [mkAccommodation({ id: 'acc1', name: 'San Martinho', type: 'other', external_billing: true })],
      rooms: [mkRoom({ id: 'room1', accommodation_id: 'acc1', name: 'SM-2' })],
      bookingRoomPrices: [],
      externalAccommodationBkgs: [],
    }), [])
    expect(o.lines).toHaveLength(1)
    expect(o.lines[0]).toMatchObject({ item: { kind: 'external_stay', accommodationName: 'San Martinho', roomNames: ['SM-2'], nights: 7 }, amount: 0 })
    expect(zeroPricedLines(o)).toHaveLength(1)
  })

  it('activities: billed by us, or paid to the provider directly', () => {
    const o = buildBookingOrder(mkBooking(), base({
      activityBookings: [
        mkActivityBooking({ id: 'a1', price_client: 100 }),
        mkActivityBooking({ id: 'a2', payment_flow: 'provider_pays_us', price_client: 300 }),
      ],
    }), [provider])
    const acts = o.lines.filter(l => l.item.kind === 'activity')
    expect(acts[0]).toMatchObject({ amount: 100, settledBy: { kind: 'us' } })
    expect(acts[1]).toMatchObject({ amount: null, settledBy: { kind: 'provider', name: 'TourMaputo' } })
    expect(o.total).toBe(420 + 100)
  })

  it('center access and extras (a package sold in advance) are counted', () => {
    const o = buildBookingOrder(mkBooking({ num_center_access: 2, center_access_rate: 7 }), base({
      bookingCharges: [mkCharge({ label: 'Pack 10h kite', quantity: 1, unit_price: 550 })],
    }), [])
    expect(o.lines.find(l => l.item.kind === 'center_access')).toMatchObject({ item: { persons: 2, days: 7, rate: 7 }, amount: 98 })
    expect(o.lines.find(l => l.item.kind === 'extra')).toMatchObject({ amount: 550 })
    expect(o.total).toBe(420 + 98 + 550)
  })

  it('paid = verified money only; remaining = total − discounts − paid, never below 0', () => {
    const data = base({
      payments: [
        mkPayment({ id: 'dep', amount: 100 }),
        mkPayment({ id: 'unv', amount: 50, is_verified: false }),
        mkPayment({ id: 'disc', amount: 20, is_discount: true }),
        mkPayment({ id: 'other', booking_id: 'bk2', amount: 999 }),
      ],
    })
    const o = buildBookingOrder(mkBooking(), data, [])
    expect(o).toMatchObject({ total: 420, paid: 100, unverified: 50, discounts: 20, remaining: 300 })
    const over = buildBookingOrder(mkBooking(), { ...data, payments: [mkPayment({ amount: 500 })] }, [])
    expect(over.remaining).toBe(0)
  })

  it('flags lines we bill at 0 €', () => {
    const o = buildBookingOrder(mkBooking(), base({ taxiTrips: [mkTaxiTrip({ price_eur: 0 })] }), [])
    expect(zeroPricedLines(o).map(l => l.item.kind)).toEqual(['taxi'])
  })
})
