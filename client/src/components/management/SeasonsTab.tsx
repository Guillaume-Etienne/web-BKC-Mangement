import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useTable } from '../../hooks/useSupabase'
import type { Season } from '../../types/database'
import { daysBetween, todayISO, fmtDate } from '../../utils/dates'

/** Seasons drive the accounting period filter, and until now nothing could
 *  create one — the table had only ever been seeded by a migration, so the
 *  first September without a new row would have left every "season" figure
 *  silently reporting the previous one. */

interface FormState { label: string; start_date: string; end_date: string }

const EMPTY: FormState = { label: '', start_date: '', end_date: '' }

/** Module scope, so typing in it never loses focus on re-render. */
function SeasonForm({ initial, existing, onSave, onCancel, saving }: {
  initial: FormState
  existing: Season[]          // to warn about overlaps
  onSave: (f: FormState) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<FormState>(initial)

  const badDates = !!form.start_date && !!form.end_date && form.end_date <= form.start_date
  // Overlapping seasons would make a booking belong to two periods at once.
  const overlap = existing.find(s =>
    !!form.start_date && !!form.end_date &&
    form.start_date <= s.end_date && form.end_date >= s.start_date
  )
  const nights = !badDates && form.start_date && form.end_date
    ? daysBetween(form.start_date, form.end_date) : 0
  const canSave = !!form.label.trim() && !!form.start_date && !!form.end_date && !badDates && !saving

  return (
    <form
      onSubmit={e => { e.preventDefault(); if (canSave) onSave(form) }}
      className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg p-4 space-y-3"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Label *</label>
          <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
            placeholder="2027-2028"
            className="w-full text-sm border rounded px-2 py-1.5" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Opens *</label>
          <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
            className="w-full text-sm border rounded px-2 py-1.5" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Closes *</label>
          <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
            className="w-full text-sm border rounded px-2 py-1.5" />
        </div>
      </div>

      {badDates && (
        <p className="text-xs text-red-600 dark:text-red-400">The closing date must come after the opening one.</p>
      )}
      {!badDates && overlap && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          ⚠️ Overlaps “{overlap.label}” ({fmtDate(overlap.start_date)} → {fmtDate(overlap.end_date)}). A booking can only be
          counted in one season, so overlapping ranges make the figures ambiguous.
        </p>
      )}
      {!badDates && nights > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{nights} days</p>
      )}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded font-medium text-sm">
          Cancel
        </button>
        <button type="submit" disabled={!canSave}
          className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm disabled:opacity-40">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}

export default function SeasonsTab() {
  // Sorted so "the latest season" is the last row — four accounting tabs read it
  // that way, and an unordered query made that a coin flip.
  const { data: seasons, refresh } = useTable<Season>('seasons', { order: 'start_date' })
  const [editing, setEditing] = useState<Season | null>(null)
  const [adding,  setAdding]  = useState(false)
  const [saving,  setSaving]  = useState(false)

  const today = todayISO()

  async function save(f: FormState) {
    setSaving(true)
    const row = { label: f.label.trim(), start_date: f.start_date, end_date: f.end_date }
    const { error } = editing
      ? await supabase.from('seasons').update(row).eq('id', editing.id)
      : await supabase.from('seasons').insert([row])
    setSaving(false)
    if (error) {
      // A season that looks saved but isn't would quietly send the accounting
      // filter back to the previous period.
      alert(`The season was NOT saved.\n\n${error.message}`)
      return
    }
    setEditing(null); setAdding(false)
    refresh()
  }

  async function remove(s: Season) {
    if (!confirm(`Delete the season “${s.label}”?\n\nNothing else is deleted — bookings, payments and expenses stay. Only the accounting period disappears.`)) return
    const { error } = await supabase.from('seasons').delete().eq('id', s.id)
    if (error) { alert(`Could not delete the season.\n\n${error.message}`); return }
    refresh()
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Seasons</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            The periods the accounting screens group by. A booking counts in the season containing
            its <strong>check-in</strong>, so a stay never splits across two.
          </p>
        </div>
        {!adding && !editing && (
          <button onClick={() => setAdding(true)}
            className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm">
            + New season
          </button>
        )}
      </div>

      {(adding || editing) && (
        <SeasonForm
          initial={editing ? { label: editing.label, start_date: editing.start_date, end_date: editing.end_date } : EMPTY}
          existing={seasons.filter(s => s.id !== editing?.id)}
          onSave={save}
          onCancel={() => { setAdding(false); setEditing(null) }}
          saving={saving}
        />
      )}

      {seasons.length === 0 && !adding && (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          No season yet — the accounting screens will only be able to show all-time totals.
        </p>
      )}

      <div className="space-y-2">
        {seasons.map(s => {
          const current = today >= s.start_date && today <= s.end_date
          return (
            <div key={s.id}
              className={`rounded-lg border p-4 ${current
                ? 'border-blue-400 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/40'
                : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'}`}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-bold text-gray-800 dark:text-gray-200">
                    {s.label}
                    {current && <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-600 text-white">Current</span>}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {fmtDate(s.start_date)} → {fmtDate(s.end_date)}
                    <span className="text-gray-400 dark:text-gray-500"> · {daysBetween(s.start_date, s.end_date)} days</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditing(s); setAdding(false) }}
                    className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded font-medium text-sm hover:bg-blue-200 dark:hover:bg-blue-800">
                    ✏️ Edit
                  </button>
                  <button onClick={() => remove(s)}
                    className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded font-medium text-sm hover:bg-red-200 dark:hover:bg-red-800">
                    🗑️ Delete
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
