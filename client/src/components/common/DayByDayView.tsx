import type { DayJournal, PersonCount } from '../../utils/dayJournal'
import type { SplitCategory, SplitItem } from '../../utils/perPersonSplit'

// "Day by day" (2026-11-21) — the guest's share page as a diary: one card per
// day up to today, who did what inside it. Display only: the journal comes from
// utils/dayJournal, built on the same items as the per-person split. Texts come
// in as props (the share page has its own i18n).

export interface DayByDayLabels {
  wholeStay: string
  nothing: string
  everyone: string
  notStarted: string
  /** "1 more item booked after today…" */
  laterOne: string
  /** "{n} more items booked after today…" */
  laterMany: string
  countTitle: string
  /** "{h} h of lessons" */
  countHours: string
  /** "{d} rental day" / "{d} rental days" */
  countDay: string
  countDays: string
  included: string
}

const ICON: Record<SplitCategory, string> = {
  accommodation: '🛏️', lessons: '🏄', rentals: '🎿', taxis: '🚕',
  dining: '🍽️', activities: '🎯', center_access: '🏖️', extras: '➕',
}

interface Props {
  journal: DayJournal
  counts: PersonCount[]
  /** First names, by participant id. */
  names: Record<string, string>
  showPrices: boolean
  labels: DayByDayLabels
  fmtEur: (n: number) => string
  /** "Mon 14 Nov" */
  fmtDay: (iso: string) => string
  /** 1.5 → "1,5" in the guest's language. */
  fmtNum: (n: number) => string
}

export function DayByDayView({ journal, counts, names, showPrices, labels, fmtEur, fmtDay, fmtNum }: Props) {
  const who = (ids: string[]) => ids.length === 0 ? labels.everyone : ids.map(id => names[id] ?? '—').join(', ')

  const line = (item: SplitItem, i: number) => (
    <li key={i} className="flex justify-between gap-3 py-0.5">
      <span className="text-gray-700 dark:text-gray-300">
        <span aria-hidden className="mr-1.5">{ICON[item.category]}</span>
        {item.label}
        {item.gear && <span className="text-teal-700 dark:text-teal-400"> · {item.gear}</span>}
      </span>
      {showPrices && (
        <span className="whitespace-nowrap text-gray-600 dark:text-gray-400">
          {item.covered
            ? <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{labels.included}</span>
            : fmtEur(item.amount)}
        </span>
      )}
    </li>
  )

  const card = 'bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden'
  const head = 'flex justify-between items-center gap-3 px-4 sm:px-5 py-2.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800'
  const { later } = journal

  return (
    <div className="space-y-3">
      {counts.length > 0 && (
        <section className={`${card} px-4 sm:px-5 py-3`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">{labels.countTitle}</p>
          <ul className="space-y-1 text-sm">
            {counts.map(c => (
              <li key={c.participantId} className="flex flex-wrap gap-x-2">
                <span className="font-medium text-blue-700 dark:text-blue-400">{names[c.participantId] ?? '—'}</span>
                <span className="text-gray-600 dark:text-gray-400">
                  {[
                    c.hours > 0 ? `🏄 ${labels.countHours.replace('{h}', fmtNum(c.hours))}` : '',
                    c.days > 0 ? `🎿 ${(c.days > 1 ? labels.countDays : labels.countDay).replace('{d}', fmtNum(c.days))}` : '',
                  ].filter(Boolean).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {journal.stay.length > 0 && (
        <section className={card}>
          <div className={head}>
            <span className="font-semibold text-gray-800 dark:text-gray-200">{labels.wholeStay}</span>
            {showPrices && <span className="font-semibold text-gray-800 dark:text-gray-200">{fmtEur(journal.stayTotal)}</span>}
          </div>
          <ul className="px-4 sm:px-5 py-2 text-sm">{journal.stay.map(line)}</ul>
        </section>
      )}

      {journal.days.length === 0 && (
        <p className="px-1 text-sm text-gray-500 dark:text-gray-400 italic">{labels.notStarted}</p>
      )}

      {journal.days.map(day => (
        <section key={day.date} className={card}>
          <div className={head}>
            <span className="font-semibold text-gray-800 dark:text-gray-200 first-letter:uppercase">{fmtDay(day.date)}</span>
            {showPrices && day.groups.length > 0 && (
              <span className="font-semibold text-gray-800 dark:text-gray-200">{fmtEur(day.total)}</span>
            )}
          </div>
          {day.groups.length === 0 ? (
            <p className="px-4 sm:px-5 py-2 text-sm text-gray-400 dark:text-gray-500 italic">{labels.nothing}</p>
          ) : (
            <div className="px-4 sm:px-5 py-2 space-y-2 text-sm">
              {day.groups.map(g => (
                <div key={g.who.join('|') || 'all'} className="sm:flex sm:gap-4">
                  <p className="sm:w-32 sm:shrink-0 text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 sm:pt-0.5">{who(g.who)}</p>
                  <ul className="flex-1">{g.items.map(line)}</ul>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}

      {later.count > 0 && (
        <p className="px-1 text-sm text-gray-500 dark:text-gray-400">
          {(later.count === 1 ? labels.laterOne : labels.laterMany).replace('{n}', String(later.count))}
          {showPrices && later.total !== 0 && <span className="ml-1 whitespace-nowrap">({fmtEur(later.total)})</span>}
        </p>
      )}
    </div>
  )
}
