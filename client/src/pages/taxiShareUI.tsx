import { useState, type ReactNode } from 'react'
import { readLocal, writeLocal } from '../utils/safeStorage'
import { tr, formatMonth, type TaxiLang } from '../data/taxiShareI18n'
import { tripsCount } from '../utils/taxiDispatch'

// Small UI bits shared by the public taxi share pages (driver + manager).

/** A preference persisted in localStorage (language, view mode, date format…). */
export function usePref<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  // Through safeStorage, not localStorage: this runs on the FIRST render of a
  // page anonymous guests open, and a browser that blocks site data throws here
  // rather than returning null — a white screen with nothing on it. A
  // preference that cannot be stored simply lasts one visit.
  const [val, setVal] = useState<T>(() => (readLocal(key) as T) ?? fallback)
  const set = (v: T) => { writeLocal(key, v); setVal(v) }
  return [val, set]
}

/** White-on-blue segmented toggle, meant to sit in the page's blue header. */
export function Segmented<T extends string>({ value, options, onChange }: {
  value: T; options: { v: T; label: string }[]; onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-white/30 overflow-hidden text-xs">
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className={`px-3 py-2 whitespace-nowrap font-medium transition-colors ${
            value === o.v ? 'bg-white dark:bg-gray-900 text-blue-700 dark:text-blue-400' : 'text-white/80 hover:bg-white/15'
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** A card whose list folds away behind its header (gui, 2026-11-09: "rendre
 *  repliable les longues listes"). Open/closed is remembered on the device, so
 *  the page is found as it was left.
 *
 *  Long list opened on a phone (gui, 2026-11-26: "je ne sais plus comment
 *  compacter") — the header scrolled out of sight and the only cue was a 12 px
 *  arrow. So: the header sticks to the top while the card is open, the chevron
 *  is a real button-sized target on the right, and a "Close" bar ends the list.
 *  `overflow-clip` (not `-hidden`) keeps the rounded corners without making the
 *  card a scroll container, which would break `sticky`. */
export function Fold({ prefKey, title, defaultOpen, lang, tone = 'gray', scrollX = false, children }: {
  prefKey: string; title: string; defaultOpen: boolean; lang: TaxiLang
  tone?: 'gray' | 'blue'; scrollX?: boolean; children: ReactNode
}) {
  const [state, setState] = usePref<'open' | 'closed'>(prefKey, defaultOpen ? 'open' : 'closed')
  const open = state === 'open'
  const toggle = () => setState(open ? 'closed' : 'open')
  // Opaque backgrounds: rows scroll under the sticky header.
  const head = tone === 'blue'
    ? 'bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-400'
    : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 ${scrollX ? 'overflow-x-auto' : 'overflow-clip'}`}>
      <button type="button" onClick={toggle} aria-expanded={open}
        className={`w-full flex items-center gap-2 px-4 sm:px-5 py-3 text-left hover:brightness-95 ${head} ${
          open ? 'border-b border-gray-200 dark:border-gray-800' : ''
        } ${open && !scrollX ? 'sticky top-0 z-10' : ''}`}>
        <h2 className="text-sm font-bold min-w-0">{title}</h2>
        <span aria-hidden className="ml-auto shrink-0 w-7 h-7 rounded-full bg-white/70 dark:bg-gray-900/60 border border-current/20 flex items-center justify-center text-sm">
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open && children}
      {open && !scrollX && (
        <button type="button" onClick={toggle}
          className="w-full py-2.5 border-t border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
          ▴ {tr.fold_close[lang]}
        </button>
      )}
    </div>
  )
}

/** "novembro de 2026" → "Novembro de 2026" (CSS `capitalize` would also give "De"). */
const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Completed trips folded by month, newest first: only the latest month is open
 *  at first, and each one can be opened or closed at will. `render` draws one
 *  month's trips. */
export function MonthFolds<T extends { date: string; start_time: string }>({ trips, lang, render }: {
  trips: T[]; lang: TaxiLang; render: (ts: T[]) => ReactNode
}) {
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({})
  const sorted = [...trips].sort((a, b) => `${b.date}${b.start_time}`.localeCompare(`${a.date}${a.start_time}`))
  const months = new Map<string, T[]>()
  for (const t of sorted) months.set(t.date.slice(0, 7), [...(months.get(t.date.slice(0, 7)) ?? []), t])
  return (
    <>
      {[...months.entries()].map(([m, ts], i) => {
        const open = openMonths[m] ?? i === 0
        return (
          <div key={m} className={i > 0 ? 'border-t border-gray-100 dark:border-gray-800' : ''}>
            <button type="button" onClick={() => setOpenMonths({ ...openMonths, [m]: !open })} aria-expanded={open}
              className="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-50/60 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-semibold text-gray-600 dark:text-gray-400">
              <span className="w-3 shrink-0">{open ? '▾' : '▸'}</span>
              <span>{upperFirst(formatMonth(`${m}-01`, lang))}</span>
              <span className="ml-auto font-normal">{tripsCount(ts.length, lang)}</span>
            </button>
            {open && <div className="border-t border-gray-100 dark:border-gray-800 opacity-90">{render(ts)}</div>}
          </div>
        )
      })}
    </>
  )
}
