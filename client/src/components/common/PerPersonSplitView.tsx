import { useState, type ReactNode } from 'react'
import {
  filterSplit, groupByCategory, splitSum, splitMismatch, shareFraction,
  type PersonSplit, type SplitCategory,
} from '../../utils/perPersonSplit'

// "Split per person" — shared by the accounting panel (BookingFinances) and the
// guest's own share page (ClientSharePage). Both price their items their own way
// and hand the result of splitPerPerson here; this only displays it. Texts come
// in as props: the share page is public and has its own i18n, not the admin's.

export interface PerPersonSplitLabels {
  title: string
  wholeStay: string
  activitiesOnly: string
  included: string
  /** "Sum of shares" */
  sum: string
  /** Shown when the shares miss the booking total — `{sum}` and `{total}` filled in. */
  mismatch: string
  categories: Record<SplitCategory, string>
}

interface Props {
  splits: PersonSplit[]
  names: Record<string, string>
  /** The booking's own total, as the same screen shows it elsewhere. */
  expectedTotal: number
  labels: PerPersonSplitLabels
  fmtEur: (n: number) => string
  fmtDate: (iso: string) => string
  /** An extra control for the header (the share page's gear toggle). */
  headerExtra?: ReactNode
  /** 'card' = its own white card (share page); 'plain' = inline (accounting panel). */
  variant: 'card' | 'plain'
}

export function PerPersonSplitView({ splits, names, expectedTotal, labels, fmtEur, fmtDate, headerExtra, variant }: Props) {
  // "Whole stay" by default, everywhere (gui, 2026-11-15).
  const [activitiesOnly, setActivitiesOnly] = useState(false)
  if (splits.length === 0) return null

  const shown = filterSplit(splits, activitiesOnly)
  const mismatch = !activitiesOnly && splitMismatch(splits, expectedTotal)

  // Inside a <summary> a click would also fold the section, hence preventDefault.
  const modeButton = (on: boolean, label: string, value: boolean) => (
    <button type="button" aria-pressed={on}
      onClick={e => { e.preventDefault(); e.stopPropagation(); setActivitiesOnly(value) }}
      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${on
        ? 'bg-blue-600 text-white'
        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
      {label}
    </button>
  )

  const card = variant === 'card'
  const body = (
    <details className="group/split">
      <summary className={`cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex flex-wrap items-center gap-2 font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors ${card ? 'px-5 py-4' : 'py-2 text-sm'}`}>
        <span className="text-xs transition-transform group-open/split:rotate-90">▶</span>
        <span>{labels.title}</span>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <span role="group" className="inline-flex rounded-full bg-gray-100 dark:bg-gray-800 p-0.5">
            {modeButton(!activitiesOnly, labels.wholeStay, false)}
            {modeButton(activitiesOnly, labels.activitiesOnly, true)}
          </span>
          {headerExtra}
        </span>
      </summary>

      <div className={card ? 'px-5 pb-4 space-y-3' : 'mt-2 space-y-3'}>
        {shown.map(s => (
          <div key={s.participantId} className="rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="flex justify-between items-center px-4 py-2 bg-blue-50 dark:bg-blue-950/40">
              <span className="text-sm font-medium text-blue-800 dark:text-blue-400">{names[s.participantId] ?? '—'}</span>
              <span className="text-sm font-semibold text-blue-800 dark:text-blue-400">{fmtEur(s.total)}</span>
            </div>
            <div className="px-4 py-1 divide-y divide-gray-100 dark:divide-gray-800">
              {groupByCategory(s.lines).map(g => (
                <details key={g.category} className="group/cat">
                  <summary className="cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex justify-between items-center gap-3 py-1.5 text-sm text-gray-700 dark:text-gray-300">
                    <span className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 transition-transform group-open/cat:rotate-90">▶</span>
                      {labels.categories[g.category]}
                      <span className="text-xs text-gray-400 dark:text-gray-500">({g.lines.length})</span>
                    </span>
                    <span className="font-medium whitespace-nowrap">{fmtEur(g.total)}</span>
                  </summary>
                  <div className="pl-5 pb-2 space-y-1">
                    {g.lines.map((l, i) => {
                      const fraction = shareFraction(l.sharedBy)
                      return (
                        <div key={i} className="flex justify-between gap-4 text-xs text-gray-500 dark:text-gray-400">
                          <span>
                            {l.date ? `${fmtDate(l.date)} · ` : ''}{l.label}
                            {fraction && <span className="ml-1 text-gray-400 dark:text-gray-500">({fraction})</span>}
                            {l.gear && <span className="text-teal-700 dark:text-teal-400"> · {l.gear}</span>}
                          </span>
                          <span className="whitespace-nowrap">{l.covered ? labels.included : fmtEur(l.amount)}</span>
                        </div>
                      )
                    })}
                  </div>
                </details>
              ))}
            </div>
          </div>
        ))}

        {!activitiesOnly && (
          <div className="flex justify-between items-center px-4 text-sm">
            <span className="text-gray-500 dark:text-gray-400">{labels.sum}</span>
            <span className="font-semibold text-gray-800 dark:text-gray-200">{fmtEur(splitSum(splits))}</span>
          </div>
        )}
        {mismatch && (
          <p className="px-4 text-xs text-amber-600 dark:text-amber-400">
            {labels.mismatch.replace('{sum}', fmtEur(splitSum(splits))).replace('{total}', fmtEur(expectedTotal))}
          </p>
        )}
      </div>
    </details>
  )

  return card
    ? <section className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">{body}</section>
    : body
}
