// The Palmeiras statement, as both sides read it: the admin tab (with the
// settlement and rent controls) and the Palmeiras share page. Neutral wording
// on purpose — "owed to BKC" / "owed to the Palmeiras" reads the same from
// either side of the table. Two views of the same figures, remembered on the
// device: the bungalow timeline and the chronological ledger (gui, 2026-10-30).
import type { ReactNode } from 'react'
import { fmtDate } from '../../utils/dates'
import {
  type Statement, type StatementInput, PALMEIRAS_COMMISSION_PCT, RENT_PERIOD_DAY,
  fmtEurCents, balanceSentence,
} from '../../utils/palmeirasStatement'
import { usePref } from '../../pages/taxiShareUI'
import PalmeirasTimeline from './PalmeirasTimeline'
import PalmeirasLedger, { KIND_BADGE } from './PalmeirasLedger'

type View = 'timeline' | 'table'

interface Props {
  statement: Statement
  /** The raw statement data — the timeline draws the stays from it. */
  input: StatementInput
  eurMznRate: number | null
  /** Admin only: an action on each payment (delete). */
  settlementAction?: (id: string) => ReactNode
  /** Admin only: the add-payment form, shown above the payments. */
  settlementControls?: ReactNode
  /** Admin only: records a missing rent period from the timeline. */
  onAddRent?: (month: string) => void
  defaultRentMzn?: number
}

export default function PalmeirasStatementView({ statement: st, input, eurMznRate, settlementAction, settlementControls, onAddRent, defaultRentMzn }: Props) {
  const [view, setView] = usePref<View>('palmeiras_view', 'timeline')
  const rate = eurMznRate && eurMznRate > 0 ? eurMznRate : null
  const settled = Math.abs(st.balance) < 0.01
  const badge = (k: keyof typeof KIND_BADGE) => <span className={`px-1.5 py-0.5 rounded text-xs ${KIND_BADGE[k].cls}`}>{KIND_BADGE[k].label}</span>
  return (
    <div className="space-y-5">
      {/* Balance */}
      <div className={`rounded-xl border p-4 sm:p-5 ${settled
        ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800'
        : st.balance > 0
          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900'
          : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900'}`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Balance to date</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{balanceSentence(st.balance)}</p>
        {!settled && rate && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
            ≈ {Math.round(Math.abs(st.balance) * rate).toLocaleString('en-US')} MZN at {rate.toLocaleString('en-US')} MZN / €
          </p>
        )}
        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <div><dt className="text-gray-500 dark:text-gray-400">Owed to BKC</dt>
            <dd className="font-semibold text-emerald-700 dark:text-emerald-400">{fmtEurCents(st.toUs)}</dd></div>
          <div><dt className="text-gray-500 dark:text-gray-400">Owed to the Palmeiras</dt>
            <dd className="font-semibold text-amber-700 dark:text-amber-400">{fmtEurCents(st.toPalmeiras)}</dd></div>
          <div><dt className="text-gray-500 dark:text-gray-400">Already paid by BKC</dt>
            <dd className="font-semibold text-gray-800 dark:text-gray-200">{fmtEurCents(st.paidByUs)}</dd></div>
          <div><dt className="text-gray-500 dark:text-gray-400">Already paid by the Palmeiras</dt>
            <dd className="font-semibold text-gray-800 dark:text-gray-200">{fmtEurCents(st.paidByThem)}</dd></div>
        </dl>
      </div>

      {/* View */}
      <div className="inline-flex gap-1 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-1 print:hidden">
        {([['timeline', '📅 Timeline'], ['table', '📋 Table']] as const).map(([v, l]) => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${view === v
              ? 'bg-teal-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
            {l}
          </button>
        ))}
      </div>

      {view === 'timeline' ? (<>
        <PalmeirasTimeline input={input} statement={st} onAddRent={onAddRent} defaultRentMzn={defaultRentMzn} />

        {/* Payments between us — in the table they are rows of their own */}
        <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
          <header className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-800">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">Payments between us</h3>
          </header>
          {settlementControls}
          {st.settlements.length === 0 ? (
            <p className="px-4 py-4 text-sm text-gray-400 italic">No payment recorded yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {st.settlements.map(s => (
                <li key={s.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                  <span className="text-gray-600 dark:text-gray-400 tabular-nums">{fmtDate(s.date)}</span>
                  <span className="flex-1 min-w-[10rem] text-gray-800 dark:text-gray-200">
                    {s.direction === 'us_to_palmeiras' ? 'BKC → the Palmeiras' : 'The Palmeiras → BKC'}
                    {s.method && <span className="text-gray-500 dark:text-gray-400"> · {s.method}</span>}
                  </span>
                  <span className="font-semibold tabular-nums text-gray-800 dark:text-gray-200">{fmtEurCents(s.amount)}</span>
                  {settlementAction && s.id && settlementAction(s.id)}
                </li>
              ))}
            </ul>
          )}
        </section>
      </>) : (<>
        {settlementControls && <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">{settlementControls}</div>}
        <PalmeirasLedger statement={st} settlementAction={settlementAction} />
      </>)}

      {/* How to read it */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 text-sm text-gray-700 dark:text-gray-300 space-y-1.5">
        <p className="font-semibold text-gray-800 dark:text-gray-200">How this account works</p>
        <p>{badge('stay_ours')} the guest paid BKC: BKC owes the Palmeiras the agreed price per night.</p>
        <p>{badge('stay_direct')} the guest paid the Palmeiras: the Palmeiras owes BKC {PALMEIRAS_COMMISSION_PCT}% of what the guest paid.</p>
        <p>{badge('card')} a BKC guest paid on the Palmeiras card terminal: the Palmeiras owes BKC that amount.</p>
        <p>{badge('rent')} the house BKC rents from the Palmeiras, from the {RENT_PERIOD_DAY}th to the {RENT_PERIOD_DAY}th.</p>
        <p>{badge('settlement')} a payment between us: it is deducted from the balance.</p>
        <p className="text-gray-500 dark:text-gray-400">A stay counts from its arrival day, a rent from the start of its period.</p>
      </div>
    </div>
  )
}
