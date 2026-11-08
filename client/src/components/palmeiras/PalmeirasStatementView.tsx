// The Palmeiras statement, as both sides read it: the admin tab (with the
// settlement and rent controls) and the Palmeiras share page. Neutral wording
// on purpose — "owed to BKC" / "owed to the Palmeiras" reads the same from
// either side of the table. Two views of the same figures, remembered on the
// device: the bungalow timeline and the chronological ledger (gui, 2026-10-30).
// In meticals, the Palmeiras' currency; « € equivalents » adds the euros under
// each amount, also remembered on the device (gui, 2026-11-08).
import type { ReactNode } from 'react'
import { fmtDate } from '../../utils/dates'
import {
  type Statement, type StatementInput, type StayInternals, PALMEIRAS_COMMISSION_PCT, RENT_PERIOD_DAY,
  fmtEurCents, fmtMzn, balanceSentence, balanceSentenceMzn, rowMzn,
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
  /** Admin only: price billed and margin per stay. The share page has none. */
  stayInternals?: StayInternals
  /** Admin only: an action on each payment (delete). */
  settlementAction?: (id: string) => ReactNode
  /** Admin only: the add-payment form, shown above the payments. */
  settlementControls?: ReactNode
  /** Admin only: records a missing rent period from the timeline. */
  onAddRent?: (month: string) => void
  /** Admin only: records the payment of a rent period from the timeline. */
  onPayRent?: (month: string, amount: number, amountMzn: number | null) => void
  defaultRentMzn?: number
}

export default function PalmeirasStatementView({ statement: st, input, eurMznRate, stayInternals, settlementAction, settlementControls, onAddRent, onPayRent, defaultRentMzn }: Props) {
  const [view, setView] = usePref<View>('palmeiras_view', 'timeline')
  const [currency, setCurrency] = usePref<'mzn' | 'eur'>('palmeiras_currency', 'mzn')
  const showEur = currency === 'eur'
  const rate = eurMznRate && eurMznRate > 0 ? eurMznRate : null
  // Meticals first; the euros only when no rate gives an MZN amount at all.
  const inMzn = st.balanceMzn !== null
  const settled = inMzn ? Math.abs(st.balanceMzn ?? 0) < 0.5 : Math.abs(st.balance) < 0.01
  const sign = inMzn ? (st.balanceMzn ?? 0) : st.balance
  const amount = (mzn: number | null, eur: number) => (
    <>
      {mzn !== null ? fmtMzn(mzn, st.mznExact) : fmtEurCents(eur)}
      {showEur && mzn !== null && eur ? <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">≈ {fmtEurCents(eur)}</span> : null}
    </>
  )
  const badge = (k: keyof typeof KIND_BADGE) => <span className={`px-1.5 py-0.5 rounded text-xs ${KIND_BADGE[k].cls}`}>{KIND_BADGE[k].label}</span>
  const toggle = (value: string, options: readonly (readonly [string, string])[], onChange: (v: string) => void) => (
    <div className="inline-flex gap-1 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-1 print:hidden">
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${value === v
            ? 'bg-teal-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
          {l}
        </button>
      ))}
    </div>
  )
  return (
    <div className="space-y-5">
      {/* Balance */}
      <div className={`rounded-xl border p-4 sm:p-5 ${settled
        ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800'
        : sign > 0
          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900'
          : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900'}`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Balance to date</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
          {inMzn ? balanceSentenceMzn(st.balanceMzn ?? 0, st.mznExact) : balanceSentence(st.balance)}
        </p>
        {!settled && inMzn && showEur && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
            ≈ {fmtEurCents(Math.abs(st.balance))}{rate && <> · today 1 € = {rate.toLocaleString('en-US')} MZN</>}
          </p>
        )}
        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <div><dt className="text-gray-500 dark:text-gray-400">Owed to BKC</dt>
            <dd className="font-semibold text-emerald-700 dark:text-emerald-400">{amount(st.toUsMzn, st.toUs)}</dd></div>
          <div><dt className="text-gray-500 dark:text-gray-400">Owed to the Palmeiras</dt>
            <dd className="font-semibold text-amber-700 dark:text-amber-400">{amount(st.toPalmeirasMzn, st.toPalmeiras)}</dd></div>
          <div><dt className="text-gray-500 dark:text-gray-400">Already paid by BKC</dt>
            <dd className="font-semibold text-gray-800 dark:text-gray-200">{amount(st.paidByUsMzn, st.paidByUs)}</dd></div>
          <div><dt className="text-gray-500 dark:text-gray-400">Already paid by the Palmeiras</dt>
            <dd className="font-semibold text-gray-800 dark:text-gray-200">{amount(st.paidByThemMzn, st.paidByThem)}</dd></div>
        </dl>
        {!st.mznExact && inMzn && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">≈ : some lines were recorded in euros and are converted at the rate of their date.</p>
        )}
      </div>

      {/* View + currency */}
      <div className="flex flex-wrap items-center gap-2">
        {toggle(view, [['timeline', '📅 Timeline'], ['table', '📋 Table']] as const, v => setView(v as View))}
        {toggle(currency, [['mzn', 'MZN'], ['eur', 'MZN + € equivalents']] as const, v => setCurrency(v as 'mzn' | 'eur'))}
      </div>

      {view === 'timeline' ? (<>
        <PalmeirasTimeline input={input} statement={st} showEur={showEur} onAddRent={onAddRent} onPayRent={onPayRent} defaultRentMzn={defaultRentMzn} />

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
                  <span className="font-semibold tabular-nums text-gray-800 dark:text-gray-200 text-right">
                    {(() => {
                      const m = rowMzn({ toUs: s.amount, toPalmeiras: 0, mzn: s.mzn, rate: s.rate })
                      return m !== null ? fmtMzn(m, !!s.mzn) : fmtEurCents(s.amount)
                    })()}
                    {showEur && (s.mzn || s.rate) && <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">≈ {fmtEurCents(s.amount)}</span>}
                  </span>
                  {settlementAction && s.id && settlementAction(s.id)}
                </li>
              ))}
            </ul>
          )}
        </section>
      </>) : (<>
        {settlementControls && <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">{settlementControls}</div>}
        <PalmeirasLedger statement={st} eurMznRate={rate} showEur={showEur} stayInternals={stayInternals} settlementAction={settlementAction} />
      </>)}

      {/* How to read it */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 text-sm text-gray-700 dark:text-gray-300 space-y-1.5">
        <p className="font-semibold text-gray-800 dark:text-gray-200">How this account works</p>
        <p>{badge('stay_ours')} the guest paid BKC: BKC owes the Palmeiras their price per night, minus {PALMEIRAS_COMMISSION_PCT}%.</p>
        <p>{badge('stay_direct')} the guest paid the Palmeiras: the Palmeiras owes BKC {PALMEIRAS_COMMISSION_PCT}% of what the guest paid.</p>
        <p>{badge('card')} a BKC guest paid on the Palmeiras card terminal: the Palmeiras owes BKC that amount.</p>
        <p>{badge('rent')} the house BKC rents from the Palmeiras, from the {RENT_PERIOD_DAY}th to the {RENT_PERIOD_DAY}th.</p>
        <p>{badge('settlement')} a payment between us: it is deducted from the balance. A rent paid on its own shows « ✓ Paid » on the timeline.</p>
        <p className="text-gray-500 dark:text-gray-400">A stay counts from its arrival day, a rent from the start of its period. Amounts are in meticals.</p>
      </div>
    </div>
  )
}
