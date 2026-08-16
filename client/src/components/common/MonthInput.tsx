import { useState, useEffect } from 'react'

const MONTHS: [string, string][] = [
  ['01', 'Jan'], ['02', 'Feb'], ['03', 'Mar'], ['04', 'Apr'],
  ['05', 'May'], ['06', 'Jun'], ['07', 'Jul'], ['08', 'Aug'],
  ['09', 'Sep'], ['10', 'Oct'], ['11', 'Nov'], ['12', 'Dec'],
]

interface Props {
  value: string                 // 'YYYY-MM', or '' when allowEmpty
  onChange: (value: string) => void
  allowEmpty?: boolean          // adds a "—" option that clears the value
  className?: string            // wrapper class (layout/width)
  focusRing?: string            // tailwind ring color for both selects, e.g. 'focus:ring-red-300'
}

const selectCls = 'flex-1 min-w-0 px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2'

/** Firefox never implemented <input type="month"> — it silently falls back to a
 *  plain text box with no picker and no calendar icon, which just looks broken.
 *  Two <select>s give the same 'YYYY-MM' value on every browser, desktop or mobile. */
export default function MonthInput({ value, onChange, allowEmpty, className, focusRing = 'focus:ring-blue-400' }: Props) {
  const [y, m] = value ? value.split('-') : ['', '']
  const currentYear = new Date().getFullYear()

  // The year survives even while no month is picked yet (e.g. an empty
  // optional field) — without this, picking the year before the month would
  // be silently forgotten on every render.
  const [year, setYear] = useState(y || String(currentYear))
  useEffect(() => { if (y) setYear(y) }, [y])

  const known = parseInt(y || year, 10)
  const lo = Math.min(currentYear - 2, known - 2)
  const hi = Math.max(currentYear + 3, known + 3)
  const years = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)

  return (
    <span className={`inline-flex gap-1 ${className ?? ''}`}>
      <select value={m} onChange={e => { const nm = e.target.value; onChange(nm ? `${year}-${nm}` : '') }}
        className={`${selectCls} ${focusRing}`}>
        {allowEmpty && <option value="">—</option>}
        {MONTHS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
      </select>
      <select value={year} onChange={e => { const ny = e.target.value; setYear(ny); if (m) onChange(`${ny}-${m}`) }}
        className={`${selectCls} ${focusRing}`}>
        {years.map(yr => <option key={yr} value={yr}>{yr}</option>)}
      </select>
    </span>
  )
}
