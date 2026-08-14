import { useMemo, useState } from 'react'
import { useTable } from '../hooks/useSupabase'
import type { Enquiry, EnquirySource } from '../types/database'
import EnquiryPanel from '../components/enquiries/EnquiryPanel'
import {
  STATUS_META, silenceDays, silenceTone, fmtArrivalMonth, wantsLabels, isSettled, isQualified,
} from '../utils/enquiries'

/** Everything that happens before a booking exists.
 *
 *  Deliberately touches neither the planning nor the accounts: an enquiry is
 *  someone who wrote in, not a reservation. Design: .claude/docs/ENQUIRIES.md
 *
 *  Step 1 of the build — the working list, the qualification screen and manual
 *  entry. The scannable table (arrival band, grouping, search, colour filters)
 *  is step 2. */

export default function EnquiriesPage() {
  const { data: enquiries, refresh } = useTable<Enquiry>('enquiries', { order: 'last_contact_at' })
  const { data: sources } = useTable<EnquirySource>('enquiry_sources', { order: 'sort_order' })

  const [selected, setSelected] = useState<Enquiry | null>(null)
  const [creating, setCreating] = useState(false)
  const [showSettled, setShowSettled] = useState(false)

  // The working list first, longest silence at the top: that is the order of
  // "who do I chase today", which is the only question this screen answers.
  const working = useMemo(
    () => enquiries.filter(e => !isSettled(e.status))
      .sort((a, b) => a.last_contact_at.localeCompare(b.last_contact_at)),
    [enquiries])
  const settled = useMemo(
    () => enquiries.filter(e => isSettled(e.status))
      .sort((a, b) => b.last_contact_at.localeCompare(a.last_contact_at)),
    [enquiries])

  const shown = showSettled ? settled : working
  const people = working.reduce((n, e) => n + (e.party_size ?? 0), 0)
  const toChase = working.filter(e => silenceDays(e.last_contact_at) >= 7).length

  // The selected row must follow the data after a save, or the panel keeps
  // showing what the record used to be.
  const current = selected ? enquiries.find(e => e.id === selected.id) ?? null : null

  function closePanel() { setSelected(null); setCreating(false) }

  function Row({ e }: { e: Enquiry }) {
    const days = silenceDays(e.last_contact_at)
    const active = current?.id === e.id
    const qualified = isQualified(e)
    return (
      <button
        onClick={() => { setSelected(e); setCreating(false) }}
        className={`w-full text-left rounded-lg border p-3 transition-colors ${active
          ? 'border-blue-400 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/40'
          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700'}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">
            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${STATUS_META[e.status].dot}`} />
            {e.name}
            {e.party_size != null && (
              <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">{e.party_size} pers</span>
            )}
          </span>
          <span className={`text-xs shrink-0 ${silenceTone(days)}`}>{days} j</span>
        </div>

        {qualified ? (
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
            <span>{fmtArrivalMonth(e.arrival_month)}</span>
            {wantsLabels(e).length > 0 && <span>· {wantsLabels(e).join(' · ')}</span>}
            {e.budget_eur != null && <span>· {e.budget_eur} €</span>}
          </div>
        ) : (
          /* Not read yet: show what they wrote rather than a row of dashes. A
             table full of em-dashes looks broken; here the missing information
             IS the information, and this is the day's pile. */
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-medium mr-2">
              to qualify
            </span>
            <span className="italic">{(e.message ?? '').slice(0, 90) || 'no message'}</span>
          </div>
        )}
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-gray-200">Enquiries</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              People who wrote in and have not booked. Nothing here touches the planning or the accounts.
            </p>
          </div>
          <button onClick={() => { setCreating(true); setSelected(null) }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm">
            + New enquiry
          </button>
        </div>

        {/* Counters — what the season looks like from here */}
        <div className="grid grid-cols-3 gap-3 mt-6 max-w-lg">
          {[
            { label: 'Open', value: working.length },
            { label: 'People expected', value: people },
            { label: 'To chase', value: toChase, tone: toChase > 0 ? 'text-amber-600 dark:text-amber-400' : '' },
          ].map(c => (
            <div key={c.label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">{c.label}</p>
              <p className={`text-xl font-bold text-gray-800 dark:text-gray-200 ${c.tone ?? ''}`}>{c.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
          {/* ── Left: the list ─────────────────────────────────────────────── */}
          <div className="xl:col-span-1 space-y-2">
            <div className="flex gap-1.5 mb-1">
              {([[false, `Working (${working.length})`], [true, `Archive (${settled.length})`]] as const).map(([v, label]) => (
                <button key={String(v)} onClick={() => setShowSettled(v)}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${showSettled === v
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                  {label}
                </button>
              ))}
            </div>

            {shown.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic py-6 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
                {showSettled ? 'Nothing archived yet.' : 'No open enquiry.'}
              </p>
            ) : shown.map(e => <Row key={e.id} e={e} />)}
          </div>

          {/* ── Right: qualification ───────────────────────────────────────── */}
          <div className="xl:col-span-2">
            {creating || current ? (
              <EnquiryPanel
                key={current?.id ?? 'new'}
                enquiry={current}
                sources={sources.filter(s => s.is_active)}
                onSaved={() => { refresh(); if (creating) closePanel() }}
                onClose={closePanel}
                onDeleted={() => { closePanel(); refresh() }}
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
                <p className="text-sm">Pick an enquiry to read and qualify it</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
