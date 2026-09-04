import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useTable } from '../../hooks/useSupabase'
import type { EnquirySource } from '../../types/database'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'

/** The "how did you hear about us?" choices on the public enquiry form.
 *
 *  In the database rather than in the code because the whole point of the
 *  question is the end-of-season count, and gui must be able to add
 *  "Paris boat show" one February morning without waiting for a deployment.
 *
 *  Trilingual because the public form is. And **no delete button on purpose**:
 *  enquiries keep the source they were given, so removing a row would take a
 *  slice of past statistics with it. Retiring hides it from the form and keeps
 *  the history — same reasoning as the locked rows in Options → Pricing. */

type Lang = 'fr' | 'en' | 'es'
const LANGS: { key: Lang; label: string }[] = [
  { key: 'en', label: 'English' },
  { key: 'fr', label: 'Français' },
  { key: 'es', label: 'Español' },
]

interface FormState { fr: string; en: string; es: string; sort_order: string }
const EMPTY: FormState = { fr: '', en: '', es: '', sort_order: '' }

/** Module scope, so typing never loses focus on re-render. */
function SourceForm({ initial, onSave, onCancel, saving }: {
  initial: FormState
  onSave: (f: FormState) => void
  onCancel: () => void
  saving: boolean
}) {
  const { lang } = useLanguage()
  const [form, setForm] = useState<FormState>(initial)
  // English is the fallback the form falls back to, so it is the one that must exist.
  const canSave = !!form.en.trim() && !saving

  return (
    <form
      onSubmit={e => { e.preventDefault(); if (canSave) onSave(form) }}
      className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg p-4 space-y-3"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {LANGS.map(({ key, label }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              {label}{key === 'en' && ' *'}
            </label>
            <input
              value={form[key]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              placeholder={key === 'en' ? 'Google search' : key === 'fr' ? 'Recherche Google' : 'Búsqueda en Google'}
              className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded px-2 py-1.5 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200"
            />
          </div>
        ))}
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Position</label>
          <input
            type="number" step="10" value={form.sort_order}
            onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
            placeholder="70"
            className="w-24 text-sm border border-gray-300 dark:border-gray-700 rounded px-2 py-1.5 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200"
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 flex-1 min-w-[12rem]">
          Lower comes first in the dropdown. Steps of 10 leave room to slip one in between.
        </p>
      </div>

      {!form.fr.trim() || !form.es.trim() ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          ⚠ A missing translation falls back to English on the form — readable, but not in the visitor's language.
        </p>
      ) : null}

      <div className="flex gap-2">
        <button type="submit" disabled={!canSave}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded font-semibold text-sm">
          {saving ? i18n.pages.btn_saving[lang] : i18n.common.btn_save[lang]}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded font-medium text-sm">
          {i18n.common.btn_cancel[lang]}
        </button>
      </div>
    </form>
  )
}

export default function SourcesTab() {
  const { lang } = useLanguage()
  const { data: sources, refresh } = useTable<EnquirySource>('enquiry_sources', { order: 'sort_order' })
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<EnquirySource | null>(null)
  const [saving, setSaving] = useState(false)

  async function save(f: FormState) {
    setSaving(true)
    const row = {
      label: { fr: f.fr.trim() || f.en.trim(), en: f.en.trim(), es: f.es.trim() || f.en.trim() },
      sort_order: f.sort_order.trim() === '' ? 0 : parseInt(f.sort_order, 10),
    }
    const { error } = editing
      ? await supabase.from('enquiry_sources').update(row).eq('id', editing.id)
      : await supabase.from('enquiry_sources').insert([row])
    setSaving(false)
    if (error) {
      // A source that looks saved but isn't would silently go missing from the
      // public form — and nobody looks at a dropdown they didn't change.
      alert(`The source was NOT saved.\n\n${error.message}`)
      return
    }
    setAdding(false); setEditing(null)
    refresh()
  }

  async function toggleActive(s: EnquirySource) {
    const { error } = await supabase
      .from('enquiry_sources').update({ is_active: !s.is_active }).eq('id', s.id)
    if (error) { alert(`Could not change the source.\n\n${error.message}`); return }
    refresh()
  }

  const active = sources.filter(s => s.is_active)
  const retired = sources.filter(s => !s.is_active)

  function Row({ s }: { s: EnquirySource }) {
    return (
      <div className={`rounded-lg border p-3 flex items-center justify-between gap-3 flex-wrap ${
        s.is_active
          ? 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
          : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 opacity-70'}`}>
        <div className="min-w-0">
          <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">
            <span className="text-xs text-gray-400 dark:text-gray-500 mr-2">{s.sort_order}</span>
            {s.label?.en || '(no English label)'}
            {!s.is_active && (
              <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                {i18n.management.label_retired[lang]}
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            🇫🇷 {s.label?.fr || '—'} · 🇪🇸 {s.label?.es || '—'}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => { setEditing(s); setAdding(false) }}
            className="px-3 py-1.5 text-sm rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">
            {i18n.common.btn_edit[lang]}
          </button>
          <button onClick={() => toggleActive(s)}
            className="px-3 py-1.5 text-sm rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">
            {s.is_active ? i18n.management.btn_retire[lang] : i18n.management.btn_restore[lang]}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{i18n.management.title_enquiry_sources[lang]}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            The choices behind “How did you hear about us?” on the public form. They are what the
            end-of-season attribution is counted from, so they are <strong>retired, never deleted</strong> —
            a removed source would take past statistics with it.
          </p>
        </div>
        {!adding && !editing && (
          <button onClick={() => setAdding(true)}
            className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm">
            + {i18n.management.btn_add_source[lang]}
          </button>
        )}
      </div>

      {(adding || editing) && (
        <SourceForm
          initial={editing
            ? { fr: editing.label?.fr ?? '', en: editing.label?.en ?? '', es: editing.label?.es ?? '', sort_order: String(editing.sort_order) }
            : { ...EMPTY, sort_order: String((sources.at(-1)?.sort_order ?? 0) + 10) }}
          onSave={save}
          onCancel={() => { setAdding(false); setEditing(null) }}
          saving={saving}
        />
      )}

      {sources.length === 0 && !adding && (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          {i18n.management.msg_no_sources[lang]}
        </p>
      )}

      <div className="space-y-2">
        {active.map(s => <Row key={s.id} s={s} />)}

        {/* Not a row anyone can edit or remove: the form always appends it. Shown
            here so the list on screen matches the list the visitor will see. */}
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-3">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Other (+ free text)</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Always offered, always last — it cannot be removed. Without it, someone who came through a
            friend gets pushed into a box that doesn’t fit, and the statistic looks clean while being wrong.
            What people type here tells you which source to add next.
          </p>
        </div>
      </div>

      {retired.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {i18n.management.label_retired_count[lang].replace('{count}', String(retired.length))}
          </p>
          {retired.map(s => <Row key={s.id} s={s} />)}
        </div>
      )}
    </div>
  )
}
