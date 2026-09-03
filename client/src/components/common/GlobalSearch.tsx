import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  searchEverything, EMPTY_INDEX,
  type SearchHit, type SearchIndex, type SearchKind,
} from '../../utils/globalSearch'

/** ⌘K / Ctrl-K: find a person anywhere, without knowing which screen they are on.
 *
 *  The index is fetched the first time the palette is opened, never at startup:
 *  Clients, Bookings and Requests are already three separate page loads, and
 *  paying for a fourth on every login to serve a box nobody may open would undo
 *  the July 31 startup work. Reloaded on each open — a few hundred rows at this
 *  scale, and a stale palette that cannot find the booking made five minutes
 *  ago is worse than a 200 ms wait. */

export interface SearchTarget { kind: SearchKind; id: string }

interface Props {
  open: boolean
  onClose: () => void
  onGo: (target: SearchTarget) => void
}

const KIND_META: Record<SearchKind, { icon: string; label: string }> = {
  client: { icon: '👤', label: 'Client' },
  booking: { icon: '📋', label: 'Booking' },
  enquiry: { icon: '📣', label: 'Enquiry' },
}

export default function GlobalSearch({ open, onClose, onGo }: Props) {
  const [index, setIndex] = useState<SearchIndex>(EMPTY_INDEX)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setCursor(0)
    inputRef.current?.focus()

    let cancelled = false
    setLoading(true)
    setError(null)
    const run = async () => {
      // Narrow selects: this is a lookup index, not a data screen.
      const [cl, bk, en, nt] = await Promise.all([
        supabase.from('clients').select('id, first_name, last_name, email, phone, passport_number, notes'),
        supabase.from('bookings').select('id, booking_number, client_id, check_in, check_out, status, notes'),
        supabase.from('enquiries').select('id, name, email, phone, message, status, arrival_month'),
        supabase.from('enquiry_notes').select('enquiry_id, body'),
      ])
      if (cancelled) return
      const failed = [cl.error, bk.error, en.error, nt.error].filter(Boolean)
      // A search that silently indexes half the database answers "no results"
      // for someone who is right there. Say it instead.
      if (failed.length) setError(`Some records could not be searched: ${failed.map(f => f!.message).join(', ')}`)
      const notesByEnquiry: Record<string, string[]> = {}
      for (const n of (nt.data ?? []) as { enquiry_id: string; body: string }[]) {
        (notesByEnquiry[n.enquiry_id] ??= []).push(n.body)
      }
      setIndex({
        clients: (cl.data ?? []) as SearchIndex['clients'],
        bookings: (bk.data ?? []) as SearchIndex['bookings'],
        enquiries: (en.data ?? []) as SearchIndex['enquiries'],
        notesByEnquiry,
      })
      setLoading(false)
    }
    run()
    return () => { cancelled = true }
  }, [open])

  if (!open) return null

  const hits: SearchHit[] = searchEverything(index, query)
  const active = hits[Math.min(cursor, hits.length - 1)]

  function go(hit: SearchHit | undefined) {
    if (!hit) return
    onGo({ kind: hit.kind, id: hit.targetId })
    onClose()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, hits.length - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); return }
    if (e.key === 'Enter') { e.preventDefault(); go(active); return }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-start justify-center pt-[12vh] px-4"
      onClick={onClose}>
      <div className="w-full max-w-xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <span className="text-gray-400 dark:text-gray-500">🔍</span>
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={e => { setQuery(e.target.value); setCursor(0) }}
            onKeyDown={onKeyDown}
            placeholder="Search anyone — name, email, booking number, a word from a message…"
            className="flex-1 bg-transparent outline-none text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-600"
          />
          <kbd className="text-[10px] text-gray-400 dark:text-gray-600 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5">esc</kbd>
        </div>

        {error && (
          <p className="px-4 py-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30">{error}</p>
        )}

        <div className="max-h-[55vh] overflow-y-auto">
          {loading && index.clients.length === 0 && (
            <p className="px-4 py-6 text-sm text-gray-400 dark:text-gray-500 italic">Loading…</p>
          )}

          {!loading && query.trim().length >= 2 && hits.length === 0 && (
            <p className="px-4 py-6 text-sm text-gray-400 dark:text-gray-500">
              Nothing found for “{query.trim()}”. This looks in clients, bookings, enquiries, their
              messages and their notes.
            </p>
          )}

          {query.trim().length < 2 && !loading && (
            <p className="px-4 py-6 text-xs text-gray-400 dark:text-gray-500">
              Type at least two characters. Works on names, emails, phone numbers, passports,
              booking numbers (<span className="font-mono">#023</span>) and anything written in a
              message or a note.
            </p>
          )}

          {hits.map((h, i) => (
            <button key={h.id}
              onMouseEnter={() => setCursor(i)}
              onClick={() => go(h)}
              className={`w-full text-left px-4 py-2.5 flex items-start gap-3 border-b border-gray-100 dark:border-gray-800/60 last:border-0 ${
                i === Math.min(cursor, hits.length - 1)
                  ? 'bg-blue-50 dark:bg-blue-950/40'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
              }`}>
              <span className="text-base leading-5 shrink-0">{KIND_META[h.kind].icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{h.title}</span>
                {h.subtitle && (
                  <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">{h.subtitle}</span>
                )}
                {h.why && (
                  <span className="block text-xs text-gray-400 dark:text-gray-500 italic truncate">“{h.why}”</span>
                )}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-gray-300 dark:text-gray-600 shrink-0 mt-1">
                {KIND_META[h.kind].label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
