import { useState } from 'react'
import type { DossierEvent, DossierEventKind } from '../../utils/dossier'
import { fmtDate } from '../../utils/dates'

/** The person's file, one column, newest first.
 *
 *  The whole point is that nothing has to be looked up anywhere else: the first
 *  message, the notes, the forms, the bookings, the money, the documents sent
 *  and the transfers are the same list. Kinds can be filtered because a long
 *  file is otherwise unreadable — but the default is everything, since "I don't
 *  know what I'm looking for" is the normal case here. */

interface Props {
  events: DossierEvent[]
  loading: boolean
  error: string | null
  /** Days since the last thing that happened, null when nothing has. */
  silence: number | null
  /** Saves a dated note; resolves to an error message or null. */
  onAddNote: (body: string) => Promise<string | null>
  /** The client_notes table does not exist on this database yet. */
  notesTableMissing: boolean
}

const FILTERS: { key: DossierEventKind | 'all'; label: string }[] = [
  { key: 'all', label: 'Everything' },
  { key: 'note', label: '📝 Words' },
  { key: 'stay', label: '🏠 Stays' },
  { key: 'payment', label: '💰 Money' },
  { key: 'email', label: '📧 Documents' },
]

/** "Words" groups the three places a sentence can be written or received. */
const WORD_KINDS: DossierEventKind[] = ['note', 'enquiry', 'submission']

export default function ClientTimeline({ events, loading, error, silence, onAddNote, notesTableMissing }: Props) {
  const [filter, setFilter] = useState<DossierEventKind | 'all'>('all')
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)

  async function save() {
    if (!draft.trim() || saving) return
    setSaving(true)
    const err = await onAddNote(draft)
    setSaving(false)
    setNoteError(err)
    if (!err) setDraft('')
  }

  const shown = events.filter(e => {
    if (filter === 'all') return true
    if (filter === 'note') return WORD_KINDS.includes(e.kind)
    if (filter === 'stay') return e.kind === 'stay' || e.kind === 'booking' || e.kind === 'taxi' || e.kind === 'activity'
    return e.kind === filter
  })

  return (
    <div className="p-4 space-y-3 overflow-y-auto flex-1">
      {silence !== null && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Last activity{' '}
          <span className={silence >= 14 ? 'font-semibold text-amber-600 dark:text-amber-400' : ''}>
            {silence === 0 ? 'today' : `${silence} day${silence > 1 ? 's' : ''} ago`}
          </span>
        </p>
      )}

      {/* The one place to write. Above the file, not buried under it: the
          whole point is that gui never has to wonder where a sentence goes. */}
      <div className="space-y-1">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save() }}
          rows={draft ? 3 : 1}
          disabled={notesTableMissing}
          placeholder={notesTableMissing ? 'Notes not available yet' : 'Write a note about this person…'}
          className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded px-2 py-1.5 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400"
        />
        {draft.trim() && (
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={saving}
              className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold">
              {saving ? 'Saving…' : 'Save note'}
            </button>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">⌘/Ctrl + Enter</span>
          </div>
        )}
        {notesTableMissing && (
          <p className="text-[11px] text-amber-700 dark:text-amber-400">
            Notes on a client are not stored yet — the <span className="font-mono">2026-09-03_client_notes.sql</span>{' '}
            migration has not been applied to this database. Everything below still reads correctly.
          </p>
        )}
        {noteError && <p className="text-[11px] text-rose-600 dark:text-rose-400">{noteError}</p>}
      </div>

      <div className="flex flex-wrap gap-1">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-2 py-1 rounded-full text-[11px] font-medium transition-colors ${
              filter === f.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Said out loud rather than shown as an empty file — see useClientDossier. */}
      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded p-2">
          {error}
        </p>
      )}

      {loading && events.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">Loading the file…</p>
      )}

      {!loading && shown.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500">
          {events.length === 0 ? 'Nothing recorded yet for this person.' : 'Nothing of that kind in this file.'}
        </p>
      )}

      <ol className="space-y-0">
        {shown.map((e, i) => (
          <li key={e.id} className="flex gap-3">
            {/* The rail: a dot per event, a line between them. */}
            <div className="flex flex-col items-center shrink-0">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                e.tone === 'warn'
                  ? 'bg-amber-100 dark:bg-amber-900/40 ring-1 ring-amber-300 dark:ring-amber-800'
                  : 'bg-gray-100 dark:bg-gray-800'
              }`}>{e.icon}</span>
              {i < shown.length - 1 && <span className="w-px flex-1 bg-gray-200 dark:bg-gray-800" />}
            </div>

            <div className="pb-4 min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className={`text-sm font-medium ${
                  e.tone === 'warn' ? 'text-amber-700 dark:text-amber-400' : 'text-gray-800 dark:text-gray-200'
                }`}>
                  {e.title}
                  {e.amount != null && e.amount > 0 && (
                    <span className="ml-1.5 font-semibold text-gray-600 dark:text-gray-300">€{e.amount}</span>
                  )}
                </p>
                <span className="text-[11px] text-gray-400 dark:text-gray-500 shrink-0">{fmtDate(e.at.slice(0, 10))}</span>
              </div>
              {e.detail && (
                <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words mt-0.5">
                  {e.detail}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
