import { describe, it, expect } from 'vitest'
import { buildAssociateLedger, computeAssociateSummaries, associateGap, totalDrawn } from './associateUtils'
import { filterDataToSeason } from './seasonFilter'
import { computeBookingPaid } from './utils'
import { mkData, mkPayment, mkBooking } from './utils.fixtures'
import type { Associate, AssociateTransfer, Expense } from '../../types/database'

const gui: Associate    = { id: 'a_gui', name: 'Gui', sort_order: 1 }
const teresa: Associate = { id: 'a_ter', name: 'Teresa', sort_order: 2 }

const mkTransfer = (o: Partial<AssociateTransfer> & { id: string }): AssociateTransfer => ({
  associate_id: gui.id, date: '2026-11-10', amount: 100, direction: 'to_associate', notes: null, ...o,
})
const mkExpense = (o: Partial<Expense> & { id: string }): Expense => ({
  date: '2026-11-12', category: '', category_id: null, amount: 40, description: 'Petrol', ...o,
})

describe('buildAssociateLedger', () => {
  it('counts a guest payment received directly as money the associate holds', () => {
    const data = mkData({
      associates: [gui, teresa],
      payments: [
        mkPayment({ id: 'p1', amount: 300, received_by_associate_id: teresa.id }),
        mkPayment({ id: 'p2', amount: 200 }),                       // the centre's own cash
        mkPayment({ id: 'p3', amount: 50, received_by_associate_id: null }),
      ],
    })
    const ledger = buildAssociateLedger(data, teresa.id)
    expect(ledger).toHaveLength(1)
    expect(ledger[0]).toMatchObject({ kind: 'client_payment', amount: 300, bookingId: 'bk1', sourceId: 'p1' })
    expect(buildAssociateLedger(data, gui.id)).toEqual([])
  })

  it('ignores a discount even when it is tagged with an associate', () => {
    const data = mkData({
      associates: [gui],
      payments: [mkPayment({ id: 'd1', amount: 80, is_discount: true, received_by_associate_id: gui.id })],
    })
    expect(buildAssociateLedger(data, gui.id)).toEqual([])
  })

  it('flags an unverified guest payment without dropping it', () => {
    const data = mkData({
      associates: [gui],
      payments: [mkPayment({ id: 'p1', amount: 120, is_verified: false, received_by_associate_id: gui.id })],
    })
    expect(buildAssociateLedger(data, gui.id)[0]).toMatchObject({ amount: 120, unverified: true })
  })

  it('signs transfers by direction and expenses as money owed back', () => {
    const data = mkData({
      associates: [gui],
      associateTransfers: [
        mkTransfer({ id: 't1', amount: 500, date: '2026-11-01' }),
        mkTransfer({ id: 't2', amount: 60, direction: 'to_centre', date: '2026-11-20' }),
        mkTransfer({ id: 't3', amount: 999, associate_id: teresa.id }),
      ],
      expenses: [
        mkExpense({ id: 'e1', amount: 40, paid_by_associate_id: gui.id }),
        mkExpense({ id: 'e2', amount: 70 }),                        // paid by the centre
      ],
    })
    const ledger = buildAssociateLedger(data, gui.id)
    // Most recent first.
    expect(ledger.map(e => [e.kind, e.amount])).toEqual([
      ['transfer_back', -60],
      ['expense', -40],
      ['transfer_out', 500],
    ])
    expect(ledger[1].label).toBe('Petrol')
  })
})

describe('computeAssociateSummaries', () => {
  const data = mkData({
    associates: [teresa, gui],   // out of order on purpose
    payments: [
      mkPayment({ id: 'p1', amount: 300, received_by_associate_id: teresa.id }),
      mkPayment({ id: 'p2', amount: 150.5, received_by_associate_id: gui.id }),
    ],
    associateTransfers: [
      mkTransfer({ id: 't1', amount: 500 }),
      mkTransfer({ id: 't2', amount: 60, direction: 'to_centre' }),
    ],
    expenses: [mkExpense({ id: 'e1', amount: 40.25, paid_by_associate_id: gui.id })],
  })

  it('orders by sort_order and nets the four movements', () => {
    const [g, t] = computeAssociateSummaries(data)
    expect(g.associate.name).toBe('Gui')
    expect(g).toMatchObject({ received: 150.5, transfersOut: 500, transfersBack: 60, expensesAdvanced: 40.25 })
    expect(g.balance).toBe(550.25)
    expect(t.balance).toBe(300)
  })

  it('says who is ahead and by how much', () => {
    const summaries = computeAssociateSummaries(data)
    expect(associateGap(summaries)).toMatchObject({ ahead: gui, behind: teresa, amount: 250.25 })
    expect(totalDrawn(summaries)).toBe(850.25)
  })

  it('reports no gap when both have drawn the same', () => {
    const level = mkData({
      associates: [gui, teresa],
      associateTransfers: [
        mkTransfer({ id: 't1', amount: 200 }),
        mkTransfer({ id: 't2', amount: 200, associate_id: teresa.id }),
      ],
    })
    expect(associateGap(computeAssociateSummaries(level))).toBeNull()
  })

  it('goes negative when an associate has only advanced expenses', () => {
    const owed = mkData({
      associates: [gui, teresa],
      expenses: [mkExpense({ id: 'e1', amount: 90, paid_by_associate_id: teresa.id })],
    })
    const summaries = computeAssociateSummaries(owed)
    expect(summaries[1].balance).toBe(-90)
    expect(associateGap(summaries)).toMatchObject({ ahead: gui, behind: teresa, amount: 90 })
  })

  it('returns nothing before the migration (no associates)', () => {
    expect(computeAssociateSummaries(mkData())).toEqual([])
    expect(associateGap([])).toBeNull()
  })
})

describe('associate accounts leave the books alone', () => {
  it('a payment received by an associate still settles the booking', () => {
    const data = mkData({
      bookings: [mkBooking()],
      payments: [mkPayment({ id: 'p1', amount: 300, received_by_associate_id: teresa.id })],
    })
    expect(computeBookingPaid('bk1', data.payments)).toBe(300)
  })
})

describe('season filter', () => {
  const season = { start_date: '2026-09-15', end_date: '2027-03-15' }
  const previous = { start_date: '2025-09-15', end_date: '2026-03-15' }

  it('attaches a between-seasons transfer to the season it precedes, like expenses', () => {
    const data = mkData({
      associates: [gui],
      associateTransfers: [
        mkTransfer({ id: 'old', date: '2026-02-01' }),
        mkTransfer({ id: 'gap', date: '2026-06-01' }),
        mkTransfer({ id: 'in',  date: '2026-11-01' }),
      ],
    })
    const filtered = filterDataToSeason(data, season, [previous, season])
    expect(filtered.associateTransfers.map(t => t.id)).toEqual(['gap', 'in'])
    expect(filtered.associates).toEqual([gui])
  })
})
