// Options → Pricing: the EUR/MZN rate over time. A new rate applies from its date
// on and leaves everything before it as it was; correcting an old row changes the
// euro figures of its period, on purpose, so the panel says so.
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useEurMznRates } from '../../hooks/useEurMznRates'
import { fmtDate, todayISO } from '../../utils/dates'
import type { EurMznRateRow } from '../../types/database'

interface Draft { id: string | null; valid_from: string; rate: string; note: string }

const inputCls = 'text-sm border rounded px-2 py-1.5 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200'

export default function EurMznRatesPanel({ onChanged }: { onChanged: () => void }) {
  const { data: rates, loading, refresh } = useEurMznRates()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  const sorted = [...rates].sort((a, b) => b.valid_from.localeCompare(a.valid_from))
  const current = sorted[0]
  const rate = draft ? parseFloat(draft.rate) : NaN
  const taken = !!draft && sorted.some(r => r.valid_from === draft.valid_from && r.id !== draft.id)
  const valid = !!draft && rate > 0 && !!draft.valid_from && draft.valid_from <= todayISO() && !taken

  const done = () => { setDraft(null); refresh(); onChanged() }

  const save = async () => {
    if (!draft || !valid) return
    setSaving(true)
    const fields = { valid_from: draft.valid_from, rate, note: draft.note.trim() || null }
    const { error } = draft.id
      ? await supabase.from('eur_mzn_rates').update(fields).eq('id', draft.id)
      : await supabase.from('eur_mzn_rates').insert([fields])
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    done()
  }

  const remove = async (r: EurMznRateRow) => {
    if (!confirm(`Delete the rate of ${fmtDate(r.valid_from)}? The figures of that period will use the previous rate.`)) return
    const { error } = await supabase.from('eur_mzn_rates').delete().eq('id', r.id)
    if (error) { alert('Error: ' + error.message); return }
    done()
  }

  const correcting = !!draft?.id && draft.id !== current?.id

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">💱 EUR/MZN rate</h2>
        {!draft && (
          <button onClick={() => setDraft({ id: null, valid_from: todayISO(), rate: current ? String(current.rate) : '', note: '' })}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors text-sm">
            + New rate
          </button>
        )}
      </div>
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          A new rate applies from its date on: what came before keeps the rate it had.
        </p>

        {draft && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                <span className="block mb-1">From</span>
                <input type="date" max={todayISO()} value={draft.valid_from}
                  onChange={e => setDraft({ ...draft, valid_from: e.target.value })} className={inputCls} />
              </label>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                <span className="block mb-1">1 € = … MZN</span>
                <input type="number" min="0" step="0.01" value={draft.rate}
                  onChange={e => setDraft({ ...draft, rate: e.target.value })} className={`${inputCls} w-28`} />
              </label>
              <label className="block flex-1 min-w-[10rem] text-xs font-medium text-gray-600 dark:text-gray-400">
                <span className="block mb-1">Note (optional)</span>
                <input type="text" value={draft.note}
                  onChange={e => setDraft({ ...draft, note: e.target.value })} className={`${inputCls} w-full`} />
              </label>
            </div>
            {taken && <p className="text-sm text-red-700 dark:text-red-400">There is already a rate on this date: edit that one instead.</p>}
            {correcting && <p className="text-sm text-amber-700 dark:text-amber-400">⚠️ This changes the euro figures of the period it covers, including months already settled.</p>}
            <div className="flex gap-3">
              <button onClick={() => setDraft(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium text-sm">Cancel</button>
              <button onClick={save} disabled={!valid || saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No rate recorded yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {sorted.map((r, i) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
                <span className="w-32 tabular-nums text-gray-600 dark:text-gray-400">
                  {i === sorted.length - 1 ? 'Since the start' : `From ${fmtDate(r.valid_from)}`}
                </span>
                <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">1 € = {Number(r.rate).toLocaleString('en-US')} MZN</span>
                {i === 0 && <span className="px-1.5 py-0.5 rounded text-[11px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300">Current</span>}
                {r.note && <span className="text-gray-500 dark:text-gray-400">{r.note}</span>}
                <span className="ml-auto flex gap-1">
                  <button onClick={() => setDraft({ id: r.id, valid_from: r.valid_from, rate: String(r.rate), note: r.note ?? '' })}
                    aria-label="Edit rate" className="p-1 text-gray-400 hover:text-blue-600">✏</button>
                  {sorted.length > 1 && (
                    <button onClick={() => remove(r)} aria-label="Delete rate" className="p-1 text-gray-400 hover:text-red-500 text-lg leading-none">×</button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
