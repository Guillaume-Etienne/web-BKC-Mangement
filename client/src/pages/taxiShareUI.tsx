import { useState } from 'react'

// Small UI bits shared by the public taxi share pages (driver + manager).

/** A preference persisted in localStorage (language, view mode, date format…). */
export function usePref<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(() => (localStorage.getItem(key) as T) ?? fallback)
  const set = (v: T) => { localStorage.setItem(key, v); setVal(v) }
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
            value === o.v ? 'bg-white text-blue-700' : 'text-white/80 hover:bg-white/10'
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
