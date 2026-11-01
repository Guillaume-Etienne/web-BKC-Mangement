// The « Table » view of the Palmeiras account: a bank-statement-like ledger.
// Rows in date order, a running balance, a subtotal and closing balance per
// month, payments between us as rows of their own, then a « today » line and
// what is not due yet (greyed, out of the balance). Shared by the admin tab and
// the Palmeiras share page. A table that scrolls sideways on a phone, rather
// than a second card layout: a ledger is read across its columns.
//
// The MZN equivalents are for both sides. The « Billed » and « Margin » columns
// exist only when `stayInternals` is passed, which the share page never does.
import type { ReactNode } from 'react'
import { fmtDate, todayISO } from '../../utils/dates'
import {
  type Statement, type LedgerKind, type LedgerRow, type StayInternal, type StayInternals,
  buildLedger, fmtEurCents, fmtMonthLong, balanceSentence, fmtMznExact, fmtMznEquivalent,
  summarizeInternals, PALMEIRAS_COMMISSION_PCT,
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

const signedEur = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmtEurCents(Math.abs(n))}`

/** The small line under an amount: the real meticals if known, else an equivalent. */
function MznLine({ eur, mzn, rate }: { eur: number; mzn?: number | null; rate: number | null }) {
  const text = mzn ? fmtMznExact(mzn) : fmtMznEquivalent(eur, rate)
  if (!text) return null
  return <div className="text-[11px] font-normal tabular-nums whitespace-nowrap text-gray-500 dark:text-gray-400">{text}</div>
}

function Money({ value, side, rate, mzn }: { value: number; side: 'us' | 'palm'; rate: number | null; mzn?: number | null }) {
  if (!value) return <span className="text-gray-300 dark:text-gray-600">–</span>
  const cls = value < 0
    ? 'text-gray-700 dark:text-gray-300'          // a payment: it reduces that side
    : side === 'us' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
  return <>
    <span className={`font-semibold tabular-nums whitespace-nowrap ${cls}`}>{value < 0 ? '−' : ''}{fmtEurCents(Math.abs(value))}</span>
    <MznLine eur={value} mzn={mzn} rate={rate} />
  </>
}

function Balance({ value, rate }: { value: number | null; rate: number | null }) {
  if (value === null) return <span className="text-gray-300 dark:text-gray-600">—</span>
  if (Math.abs(value) < 0.01) return <span className="tabular-nums text-gray-500">0 €</span>
  return <>
    <span className={`tabular-nums whitespace-nowrap font-medium ${value > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
      {value > 0 ? '+' : '−'}{fmtEurCents(Math.abs(value))}
    </span>
    <MznLine eur={value} rate={rate} />
  </>
}

const adminCell = 'px-3 py-2 text-right border-l border-gray-200 dark:border-gray-700'

/** Admin only: what we billed for the stay and what is left once the Palmeiras is paid. */
function InternalCells({ row }: { row: StayInternal | undefined }) {
  if (!row) return <>
    <td className="px-3 py-2 border-l border-gray-200 dark:border-gray-700" />
    <td className="px-3 py-2" />
  </>
  return <>
    <td className={adminCell}>
      {row.noPrice
        ? <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 whitespace-nowrap">No price</span>
        : row.direct ? <>
          <span className="tabular-nums whitespace-nowrap text-gray-400 dark:text-gray-500">–</span>
          <div className="text-[11px] whitespace-nowrap text-gray-500 dark:text-gray-400">paid to the Palmeiras</div>
        </> : <>
          <span className="font-semibold tabular-nums whitespace-nowrap text-gray-800 dark:text-gray-200">{fmtEurCents(row.billed)}</span>
          <div className="text-[11px] tabular-nums whitespace-nowrap text-gray-500 dark:text-gray-400">{fmtEurCents(row.sellPerNight)} / night</div>
        </>}
    </td>
    <td className="px-3 py-2 text-right">
      <span className={`font-semibold tabular-nums whitespace-nowrap ${row.margin < 0 ? 'text-red-700 dark:text-red-400' : 'text-blue-700 dark:text-blue-400'}`}>{signedEur(row.margin)}</span>
      {row.marginPct !== null && (
        <div className={`text-[11px] tabular-nums whitespace-nowrap ${row.lowMargin ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}
          title={row.lowMargin ? `Below the ${PALMEIRAS_COMMISSION_PCT}% a stay paid directly earns us` : undefined}>
          {row.lowMargin && '⚠ '}{row.marginPct.toLocaleString('fr-FR')} %
        </div>
      )}
    </td>
  </>
}

function Row({ r, muted, action, rate, internals }: { r: LedgerRow; muted?: boolean; action?: ReactNode; rate: number | null; internals?: StayInternals }) {
  const b = KIND_BADGE[r.kind]
  const internal = internals?.[r.key]
  return (
    <tr className={`border-b border-gray-100 dark:border-gray-800 align-top ${muted ? 'opacity-60' : ''}
      ${r.kind === 'settlement' ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : ''}
      ${internal?.noPrice ? 'bg-red-50/60 dark:bg-red-950/20' : ''}`}>
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
      <td className="px-3 py-2 text-right"><Money value={r.toUs} side="us" rate={rate} /></td>
      <td className="px-3 py-2 text-right"><Money value={r.toPalmeiras} side="palm" rate={rate} mzn={r.mzn} /></td>
      <td className="px-3 py-2 text-right"><Balance value={r.balance} rate={rate} /></td>
      {internals && (r.kind === 'adjustment'
        ? <>
          <td className="px-3 py-2 border-l border-gray-200 dark:border-gray-700" />
          <td className="px-3 py-2 text-right font-semibold tabular-nums whitespace-nowrap text-blue-700 dark:text-blue-400">{signedEur(r.toUs - r.toPalmeiras)}</td>
        </>
        : <InternalCells row={internal} />)}
    </tr>
  )
}

interface Props {
  statement: Statement
  eurMznRate: number | null
  /** Admin only: price billed and margin per stay. Never passed by the share page. */
  stayInternals?: StayInternals
  /** Admin only: an action on each payment row (delete). */
  settlementAction?: (id: string) => ReactNode
}

export default function PalmeirasLedger({ statement, eurMznRate: rate, stayInternals, settlementAction }: Props) {
  const { months, upcoming } = buildLedger(statement)
  const today = todayISO()
  const th = 'px-3 py-2 text-xs font-semibold uppercase tracking-wide'
  const cols = stayInternals ? 7 : 5
  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      <div className="overflow-x-auto">
        <table className={`w-full text-sm ${stayInternals ? 'min-w-[900px]' : 'min-w-[680px]'}`}>
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-800">
            <tr>
              <th className={`${th} text-left text-gray-500 dark:text-gray-400 w-28`}>Date</th>
              <th className={`${th} text-left text-gray-500 dark:text-gray-400`}>Description</th>
              <th className={`${th} text-right text-emerald-700 dark:text-emerald-400 w-32`}>Owed to BKC</th>
              <th className={`${th} text-right text-amber-700 dark:text-amber-400 w-36`}>Owed to the Palmeiras</th>
              <th className={`${th} text-right text-gray-600 dark:text-gray-300 w-32`} title="Above 0: the Palmeiras owes BKC · below 0: BKC owes the Palmeiras">Balance</th>
              {stayInternals && <>
                <th className={`${th} text-right text-gray-600 dark:text-gray-300 w-28 border-l border-gray-200 dark:border-gray-700`} title="Internal: never shown to the Palmeiras">Billed</th>
                <th className={`${th} text-right text-blue-700 dark:text-blue-400 w-24`} title="Internal: never shown to the Palmeiras">Margin</th>
              </>}
            </tr>
          </thead>
          <tbody>
            {months.length === 0 && (
              <tr><td colSpan={cols} className="px-3 py-6 text-center text-gray-400 italic">Nothing recorded yet.</td></tr>
            )}
            {months.map(m => (<FragmentMonth key={m.month} m={m} rate={rate} cols={cols} internals={stayInternals} settlementAction={settlementAction} />))}

            {/* Today */}
            <tr className="bg-teal-600 text-white">
              <td className="px-3 py-2 font-semibold tabular-nums whitespace-nowrap">{fmtDate(today)}</td>
              <td colSpan={cols - 1} className="px-3 py-2 font-semibold">Today — {balanceSentence(statement.balance)}</td>
            </tr>

            {upcoming.length > 0 && (<>
              <tr className="bg-gray-50 dark:bg-gray-800">
                <td colSpan={cols} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Upcoming — not in the balance yet
                </td>
              </tr>
              {upcoming.map(r => <Row key={r.key} r={r} muted rate={rate} internals={stayInternals} />)}
            </>)}
          </tbody>
        </table>
      </div>
      <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800">
        Balance above 0: the Palmeiras owes BKC · below 0: BKC owes the Palmeiras. A payment reduces the side it settles (shown with −).
        {rate && <> Metical amounts marked ≈ use today's rate: 1 € = {rate.toLocaleString('en-US')} MZN.</>}
      </p>
      {stayInternals && (
        <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800">
          Billed and Margin are internal: the Palmeiras link does not show them. Margin is what BKC keeps: selling price minus cost on the stays we collected, the commission on the stays paid to the Palmeiras.
        </p>
      )}
    </section>
  )
}

function FragmentMonth({ m, rate, cols, internals, settlementAction }: {
  m: ReturnType<typeof buildLedger>['months'][number]
  rate: number | null
  cols: number
  internals?: StayInternals
  settlementAction?: (id: string) => ReactNode
}) {
  const summary = internals ? summarizeInternals(m.rows.map(r => internals[r.key])) : null
  // A commission adjustment belongs to no stay, but it is margin all the same.
  const totalMargin = (summary?.margin ?? 0) + m.rows.reduce((t, r) => t + (r.kind === 'adjustment' ? r.toUs - r.toPalmeiras : 0), 0)
  return (<>
    <tr className="bg-gray-100/70 dark:bg-gray-800/70 border-b border-gray-200 dark:border-gray-700">
      <td colSpan={cols} className="px-3 py-1.5 font-semibold text-gray-800 dark:text-gray-200">{fmtMonthLong(m.month)}</td>
    </tr>
    {m.rows.map(r => (
      <Row key={r.key} r={r} rate={rate} internals={internals}
        action={r.kind === 'settlement' && r.settlementId && settlementAction ? settlementAction(r.settlementId) : undefined} />
    ))}
    <tr className={`align-top bg-gray-50 dark:bg-gray-800/50 ${summary?.byBungalow.length ? 'border-b border-gray-200 dark:border-gray-700' : 'border-b-2 border-gray-300 dark:border-gray-600'}`}>
      <td />
      <td className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Total {fmtMonthLong(m.month)}</td>
      <td className="px-3 py-2 text-right"><Money value={m.toUs} side="us" rate={rate} /></td>
      <td className="px-3 py-2 text-right"><Money value={m.toPalmeiras} side="palm" rate={rate} /></td>
      <td className="px-3 py-2 text-right font-bold"><Balance value={m.closing} rate={rate} /></td>
      {summary && <>
        <td className={`${adminCell} font-semibold tabular-nums whitespace-nowrap text-gray-800 dark:text-gray-200`}>{summary.billed ? fmtEurCents(summary.billed) : '–'}</td>
        <td className="px-3 py-2 text-right">
          {summary.billed || totalMargin ? <>
            <span className={`font-bold tabular-nums whitespace-nowrap ${totalMargin < 0 ? 'text-red-700 dark:text-red-400' : 'text-blue-700 dark:text-blue-400'}`}>{signedEur(totalMargin)}</span>
            {summary.marginPct !== null && <div className="text-[11px] tabular-nums whitespace-nowrap text-gray-500 dark:text-gray-400">{summary.marginPct.toLocaleString('fr-FR')} %</div>}
          </> : '–'}
        </td>
      </>}
    </tr>
    {summary && summary.byBungalow.length > 0 && (
      <tr className="border-b-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50">
        <td />
        <td colSpan={cols - 1} className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400">
          <span className="font-semibold">Margin by bungalow:</span>{' '}
          {summary.byBungalow.map(b => `${b.bungalow} ${signedEur(b.margin)}`).join(' · ')}
        </td>
      </tr>
    )}
  </>)
}
