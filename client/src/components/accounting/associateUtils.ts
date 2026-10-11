/** Associate accounts — who took what out of the business.
 *
 *  Three things move an associate's account (decided with gui, 2026-10-11):
 *    + a guest paid them directly instead of the centre   (payments.received_by_associate_id)
 *    + the centre transferred them money                  (associate_transfers, to_associate)
 *    − they handed money back to the centre               (associate_transfers, to_centre)
 *    − they paid a centre expense out of their own pocket (expenses.paid_by_associate_id)
 *
 *  The balance is what they have really drawn. These are drawings on the profit,
 *  not a salary: nothing here changes revenue, expenses or the net result — the
 *  guest did pay, the expense did happen. Only WHERE the cash sits differs.
 */
import type { SharedAccountingData } from './types'
import type { Associate } from '../../types/database'

export type AssociateEntryKind = 'client_payment' | 'transfer_out' | 'transfer_back' | 'expense'

export interface AssociateEntry {
  /** Unique across kinds — a payment and an expense may share a uuid in tests. */
  key:        string
  /** Id of the underlying row (payment, transfer or expense). */
  sourceId:   string
  kind:       AssociateEntryKind
  date:       string
  /** Signed: positive = money the associate holds, negative = money they are owed back. */
  amount:     number
  /** Free text of the row (payment note, transfer note, expense description). */
  label:      string
  bookingId:  string | null
  /** A guest payment nobody has checked against a bank statement yet. */
  unverified: boolean
}

export interface AssociateSummary {
  associate:       Associate
  /** Guest payments received directly. */
  received:        number
  /** Centre → associate transfers. */
  transfersOut:    number
  /** Associate → centre transfers. */
  transfersBack:   number
  /** Centre expenses paid out of pocket. */
  expensesAdvanced: number
  /** received + transfersOut − transfersBack − expensesAdvanced */
  balance:         number
  entries:         AssociateEntry[]
}

/** Every movement on one associate's account, most recent first. */
export function buildAssociateLedger(data: SharedAccountingData, associateId: string): AssociateEntry[] {
  const entries: AssociateEntry[] = []

  for (const p of data.payments) {
    // A discount is not money: nobody received it, whatever the column says.
    if (p.received_by_associate_id !== associateId || p.is_discount) continue
    entries.push({
      key: `pay_${p.id}`, sourceId: p.id, kind: 'client_payment', date: p.date,
      amount: p.amount, label: p.notes ?? '', bookingId: p.booking_id, unverified: !p.is_verified,
    })
  }

  for (const t of data.associateTransfers) {
    if (t.associate_id !== associateId) continue
    const out = t.direction === 'to_associate'
    entries.push({
      key: `tr_${t.id}`, sourceId: t.id, kind: out ? 'transfer_out' : 'transfer_back', date: t.date,
      amount: out ? t.amount : -t.amount, label: t.notes ?? '', bookingId: null, unverified: false,
    })
  }

  for (const e of data.expenses) {
    if (e.paid_by_associate_id !== associateId) continue
    entries.push({
      key: `exp_${e.id}`, sourceId: e.id, kind: 'expense', date: e.date,
      amount: -e.amount, label: e.description, bookingId: null, unverified: false,
    })
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key))
}

/** One summary per associate, in their display order. */
export function computeAssociateSummaries(data: SharedAccountingData): AssociateSummary[] {
  return [...data.associates]
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map(associate => {
      const entries = buildAssociateLedger(data, associate.id)
      const sum = (kind: AssociateEntryKind) =>
        entries.filter(e => e.kind === kind).reduce((s, e) => s + Math.abs(e.amount), 0)
      const received = sum('client_payment')
      const transfersOut = sum('transfer_out')
      const transfersBack = sum('transfer_back')
      const expensesAdvanced = sum('expense')
      return {
        associate, received, transfersOut, transfersBack, expensesAdvanced, entries,
        balance: round2(received + transfersOut - transfersBack - expensesAdvanced),
      }
    })
}

export interface AssociateGap {
  ahead:  Associate
  behind: Associate
  /** How much more `ahead` has drawn than `behind`. */
  amount: number
}

/** With an equal split, the associates should have drawn the same amount: this
 *  is who is ahead, and by how much. `null` when they are level (to the cent) or
 *  when there are not exactly two of them — the sentence only reads for a pair. */
export function associateGap(summaries: AssociateSummary[]): AssociateGap | null {
  if (summaries.length !== 2) return null
  const [a, b] = summaries
  const diff = round2(a.balance - b.balance)
  if (diff === 0) return null
  return diff > 0
    ? { ahead: a.associate, behind: b.associate, amount: diff }
    : { ahead: b.associate, behind: a.associate, amount: -diff }
}

/** Sum of every balance: what has left the business towards its owners. */
export function totalDrawn(summaries: AssociateSummary[]): number {
  return round2(summaries.reduce((s, x) => s + x.balance, 0))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
