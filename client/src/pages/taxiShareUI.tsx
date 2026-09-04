import { useState } from 'react'
import { readLocal, writeLocal } from '../utils/safeStorage'

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
          className={`px-2.5 py-1 font-medium transition-colors ${
            value === o.v ? 'bg-white dark:bg-gray-900 text-blue-700 dark:text-blue-400' : 'text-white/80 hover:bg-white dark:hover:bg-gray-900/10'
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
