// The « Table » view of the Palmeiras account: a bank-statement-like ledger.
// Rows in date order, a running balance, a subtotal and closing balance per
// month, payments between us as rows of their own, then a « today » line and
// what is not due yet (greyed, out of the balance). Shared by the admin tab and
// the Palmeiras share page. A table that scrolls sideways on a phone, rather
// than a second card layout: a ledger is read across its columns.
import type { ReactNode } from 'react'
import { fmtDate, todayISO } from '../../utils/dates'
import {
  type Statement, type LedgerKind, type LedgerRow,
  buildLedger, fmtEurCents, fmtMonthLong, balanceSentence,
} from '../../utils/palmeirasStatement'

export const KIND_BADGE: Record<LedgerKind, { label: string; cls: string }> = {
  stay_ours:   { label: 'Booked & paid via BKC', cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' },
  stay_direct: { label: 'Paid to the Palmeiras', cls: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' },
  adjustment:  { label: 'Adjustment',            cls: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' },
  rent:        { label: 'Rent',                  cls: 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300' },
  card:        { label: 'Card terminal',         cls: 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300' },
  entry:       { label: 'Other',                 cls: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' },
  settlement:  { label: 'Payment',               cls: 'bg-emerald-600 text-white' },
}

function Money({ value, side }: { value: number; side: 'us' | 'palm' }) {
  if (!value) return <span className="text-gray-300 dark:text-gray-600">–</span>
  const cls = value < 0
    ? 'text-gray-700 dark:text-gray-300'          // a payment: it reduces that side
    : side === 'us' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
  return <span className={`font-semibold tabular-nums whitespace-nowrap ${cls}`}>{value < 0 ? '−' : ''}{fmtEurCents(Math.abs(value))}</span>
}

function Balance({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-300 dark:text-gray-600">—</span>
  if (Math.abs(value) < 0.01) return <span className="tabular-nums text-gray-500">0 €</span>
  return (
    <span className={`tabular-nums whitespace-nowrap font-medium ${value > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
      {value > 0 ? '+' : '−'}{fmtEurCents(Math.abs(value))}
    </span>
  )
}

function Row({ r, muted, action }: { r: LedgerRow; muted?: boolean; action?: ReactNode }) {
  const b = KIND_BADGE[r.kind]
  return (
    <tr className={`border-b border-gray-100 dark:border-gray-800 align-top ${muted ? 'opacity-60' : ''}
      ${r.kind === 'settlement' ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : ''}`}>
      <td className="px-3 py-2 tabular-nums whitespace-nowrap text-gray-600 dark:text-gray-400">{fmtDate(r.date)}</td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`px-1.5 py-0.5 rounded text-[11px] ${b.cls}`}>{b.label}</span>
          {r.provisional && <span className="px-1.5 py-0.5 rounded text-[11px] bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">Provisional</span>}
          <span className="font-medium text-gray-800 dark:text-gray-200">{r.title}</span>
          {action}
        </div>
        {r.detail && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{r.detail}</div>}
      </td>
      <td className="px-3 py-2 text-right"><Money value={r.toUs} side="us" /></td>
      <td className="px-3 py-2 text-right"><Money value={r.toPalmeiras} side="palm" /></td>
      <td className="px-3 py-2 text-right"><Balance value={r.balance} /></td>
    </tr>
  )
}

interface Props {
  statement: Statement
  /** Admin only: an action on each payment row (delete). */
  settlementAction?: (id: string) => ReactNode
}

export default function PalmeirasLedger({ statement, settlementAction }: Props) {
  const { months, upcoming } = buildLedger(statement)
  const today = todayISO()
  const th = 'px-3 py-2 text-xs font-semibold uppercase tracking-wide'
  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-800">
            <tr>
              <th className={`${th} text-left text-gray-500 dark:text-gray-400 w-28`}>Date</th>
              <th className={`${th} text-left text-gray-500 dark:text-gray-400`}>Description</th>
              <th className={`${th} text-right text-emerald-700 dark:text-emerald-400 w-32`}>Owed to BKC</th>
              <th className={`${th} text-right text-amber-700 dark:text-amber-400 w-36`}>Owed to the Palmeiras</th>
              <th className={`${th} text-right text-gray-600 dark:text-gray-300 w-32`} title="Above 0: the Palmeiras owes BKC · below 0: BKC owes the Palmeiras">Balance</th>
            </tr>
          </thead>
          <tbody>
            {months.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400 italic">Nothing recorded yet.</td></tr>
            )}
            {months.map(m => (<FragmentMonth key={m.month} m={m} settlementAction={settlementAction} />))}

            {/* Today */}
            <tr className="bg-teal-600 text-white">
              <td className="px-3 py-2 font-semibold tabular-nums whitespace-nowrap">{fmtDate(today)}</td>
              <td colSpan={4} className="px-3 py-2 font-semibold">Today — {balanceSentence(statement.balance)}</td>
            </tr>

            {upcoming.length > 0 && (<>
              <tr className="bg-gray-50 dark:bg-gray-800">
                <td colSpan={5} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Upcoming — not in the balance yet
                </td>
              </tr>
              {upcoming.map(r => <Row key={r.key} r={r} muted />)}
            </>)}
          </tbody>
        </table>
      </div>
      <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800">
        Balance above 0: the Palmeiras owes BKC · below 0: BKC owes the Palmeiras. A payment reduces the side it settles (shown with −).
      </p>
    </section>
  )
}

function FragmentMonth({ m, settlementAction }: {
  m: ReturnType<typeof buildLedger>['months'][number]
  settlementAction?: (id: string) => ReactNode
}) {
  return (<>
    <tr className="bg-gray-100/70 dark:bg-gray-800/70 border-b border-gray-200 dark:border-gray-700">
      <td colSpan={5} className="px-3 py-1.5 font-semibold text-gray-800 dark:text-gray-200">{fmtMonthLong(m.month)}</td>
    </tr>
    {m.rows.map(r => (
      <Row key={r.key} r={r}
        action={r.kind === 'settlement' && r.settlementId && settlementAction ? settlementAction(r.settlementId) : undefined} />
    ))}
    <tr className="border-b-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50">
      <td />
      <td className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Total {fmtMonthLong(m.month)}</td>
      <td className="px-3 py-2 text-right"><Money value={m.toUs} side="us" /></td>
      <td className="px-3 py-2 text-right"><Money value={m.toPalmeiras} side="palm" /></td>
      <td className="px-3 py-2 text-right font-bold"><Balance value={m.closing} /></td>
    </tr>
  </>)
}
