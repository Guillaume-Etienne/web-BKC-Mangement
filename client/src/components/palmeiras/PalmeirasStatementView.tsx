// The Palmeiras statement, as both sides read it: the admin tab (with the
// settlement controls) and the Palmeiras share page. Neutral wording on
// purpose — "owed to BKC" / "owed to the Palmeiras" reads the same from either
// side of the table. One layout that folds on mobile (no duplicate render).
import type { ReactNode } from 'react'
import { fmtDate } from '../../utils/dates'
import {
  type Statement, type StatementInput, type StatementLine, PALMEIRAS_COMMISSION_PCT,
  fmtEurCents, balanceSentence, fmtMonthLong,
} from '../../utils/palmeirasStatement'
import PalmeirasTimeline from './PalmeirasTimeline'

const KIND_BADGE: Record<StatementLine['kind'], { label: string; cls: string }> = {
  stay_ours:   { label: 'Booked & paid via BKC',   cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' },
  stay_direct: { label: 'Paid to the Palmeiras',   cls: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' },
  adjustment:  { label: 'Adjustment',              cls: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' },
  rent:        { label: 'Rent',                    cls: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' },
  card:        { label: 'Card terminal',           cls: 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300' },
  entry:       { label: 'Other',                   cls: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' },
}

function Amount({ value, side }: { value: number; side: 'us' | 'palm' }) {
  if (!value) return <span className="hidden sm:block text-right text-gray-300 dark:text-gray-600">–</span>
  return (
    <span className={`text-right font-semibold tabular-nums whitespace-nowrap ${side === 'us'
      ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
      <span className="sm:hidden text-xs font-normal text-gray-500 dark:text-gray-400 mr-1">
        {side === 'us' ? 'owed to BKC' : 'owed to the Palmeiras'}
      </span>
      {fmtEurCents(value)}
    </span>
  )
}

const ROW = 'grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_8.5rem_8.5rem] gap-x-4 gap-y-1 items-start'

interface Props {
  statement: Statement
  /** The raw statement data — the timeline draws the stays from it. */
  input: StatementInput
  eurMznRate: number | null
  /** Admin only: an action under each settlement (delete). */
  settlementAction?: (id: string) => ReactNode
  /** Admin only: controls above the settlements list (add form). */
  settlementControls?: ReactNode
}

export default function PalmeirasStatementView({ statement: st, input, eurMznRate, settlementAction, settlementControls }: Props) {
  const rate = eurMznRate && eurMznRate > 0 ? eurMznRate : null
  const settled = Math.abs(st.balance) < 0.01
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

      <PalmeirasTimeline input={input} statement={st} />

      {/* How to read it */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 text-sm text-gray-700 dark:text-gray-300 space-y-1.5">
        <p className="font-semibold text-gray-800 dark:text-gray-200">How this account works</p>
        <p><span className={`px-1.5 py-0.5 rounded text-xs ${KIND_BADGE.stay_ours.cls}`}>{KIND_BADGE.stay_ours.label}</span> the guest paid BKC: BKC owes the Palmeiras the agreed price per night.</p>
        <p><span className={`px-1.5 py-0.5 rounded text-xs ${KIND_BADGE.stay_direct.cls}`}>{KIND_BADGE.stay_direct.label}</span> the guest paid the Palmeiras: the Palmeiras owes BKC {PALMEIRAS_COMMISSION_PCT}% of what the guest paid.</p>
        <p><span className={`px-1.5 py-0.5 rounded text-xs ${KIND_BADGE.card.cls}`}>{KIND_BADGE.card.label}</span> a BKC guest paid on the Palmeiras card terminal: the Palmeiras owes BKC that amount.</p>
        <p><span className={`px-1.5 py-0.5 rounded text-xs ${KIND_BADGE.rent.cls}`}>{KIND_BADGE.rent.label}</span> what BKC owes the Palmeiras each month.</p>
        <p className="text-gray-500 dark:text-gray-400">Each payment between us, listed at the bottom, is deducted from the balance.</p>
      </div>

      {/* Month by month */}
      {st.months.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Nothing recorded yet.</p>
      ) : st.months.map(m => (
        <section key={m.month} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
          <header className={`${ROW} px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-800`}>
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">{fmtMonthLong(m.month)}</h3>
            <span className="hidden sm:block text-right text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Owed to BKC</span>
            <span className="hidden sm:block text-right text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Owed to the Palmeiras</span>
          </header>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {m.lines.map(l => (
              <li key={l.key} className={`${ROW} px-4 py-3 text-sm`}>
                <div className="min-w-0 row-span-2 sm:row-span-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${KIND_BADGE[l.kind].cls}`}>{KIND_BADGE[l.kind].label}</span>
                    {l.provisional && <span className="px-1.5 py-0.5 rounded text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">Provisional</span>}
                  </div>
                  <p className="font-medium text-gray-800 dark:text-gray-200 mt-1">{l.title}</p>
                  {l.detail && <p className="text-xs text-gray-500 dark:text-gray-400">{l.detail}</p>}
                </div>
                <Amount value={l.toUs} side="us" />
                <Amount value={l.toPalmeiras} side="palm" />
              </li>
            ))}
          </ul>
          <footer className={`${ROW} px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-800 text-sm`}>
            <span className="row-span-2 sm:row-span-1 font-semibold text-gray-700 dark:text-gray-300">Total {fmtMonthLong(m.month)}</span>
            <Amount value={m.toUs} side="us" />
            <Amount value={m.toPalmeiras} side="palm" />
          </footer>
        </section>
      ))}

      {/* Not due yet */}
      {st.upcoming.length > 0 && (
        <section className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-white/60 dark:bg-gray-900/60 overflow-hidden">
          <header className={`${ROW} px-4 py-3 border-b border-dashed border-gray-300 dark:border-gray-700`}>
            <div className="row-span-2 sm:row-span-1">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300">Upcoming — not in the balance yet</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Stays that have not started and rents of months to come.</p>
            </div>
          </header>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800 opacity-80">
            {st.upcoming.map(l => (
              <li key={l.key} className={`${ROW} px-4 py-3 text-sm`}>
                <div className="min-w-0 row-span-2 sm:row-span-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${KIND_BADGE[l.kind].cls}`}>{KIND_BADGE[l.kind].label}</span>
                    {l.provisional && <span className="px-1.5 py-0.5 rounded text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">Provisional</span>}
                  </div>
                  <p className="font-medium text-gray-800 dark:text-gray-200 mt-1">{l.title}</p>
                  {l.detail && <p className="text-xs text-gray-500 dark:text-gray-400">{l.detail}</p>}
                </div>
                <Amount value={l.toUs} side="us" />
                <Amount value={l.toPalmeiras} side="palm" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Payments between us */}
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
    </div>
  )
}
