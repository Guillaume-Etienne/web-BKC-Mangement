import { useEffect, useMemo, useState } from 'react'
import { useTable } from '../hooks/useSupabase'
import type { Booking, Enquiry, EnquiryNote, EnquirySource, EnquiryStatus, Season } from '../types/database'
import type { AttributionSubmission } from '../utils/attribution'
import EnquiryPanel from '../components/enquiries/EnquiryPanel'
import AttributionPanel from '../components/enquiries/AttributionPanel'
import {
  STATUS_META, STATUS_ORDER, silenceDays, silenceTone, fmtArrivalMonth,
  isSettled, isQualified, monthBand, groupByArrivalMonth, matchesSearch, SILENCE_WARN_DAYS,
} from '../utils/enquiries'
import { thisMonthISO } from '../utils/dates'

/** Just enough of a booking to say "somebody came, and from where". */
type AttributionBooking = Pick<Booking, 'id' | 'status' | 'check_in' | 'referral_source' | 'source_id'>
type AttributionSubmissionRow = AttributionSubmission

/** Everything that happens before a booking exists.
 *
 *  Touches neither the planning nor the accounts: an enquiry is someone who
 *  wrote in, not a reservation. Design: .claude/docs/ENQUIRIES.md
 *
 *  The table is built to be *scanned*, not read. Two columns do that work: the
 *  arrival band, which shows the season filling up as the eye runs down it, and
 *  Silence, which says who to chase today. */

const WANTS = [
  { key: 'wants_lessons', icon: '🪁' },
  { key: 'wants_rental', icon: '🎿' },
  { key: 'wants_accommodation', icon: '🛏' },
] as const

type Chip = 'chase' | 'new' | 'nodate'

interface Props {
  /** Set by the global search: open this enquiry's panel straight away. */
  initialEnquiryId?: string | null
  onEnquiryOpened?: () => void
}

export default function EnquiriesPage({ initialEnquiryId, onEnquiryOpened }: Props) {
  const { data: enquiries, refresh } = useTable<Enquiry>('enquiries', { order: 'last_contact_at' })
  const { data: sources } = useTable<EnquirySource>('enquiry_sources', { order: 'sort_order' })
  // Loaded whole so the search box can look inside the conversation. Fine at a
  // few dozen enquiries a season; if this ever grows, it moves server-side.
  const { data: allNotes } = useTable<EnquiryNote>('enquiry_notes')

  // For the attribution panel on the archive view. Narrow selects: this is a
  // counting job, not a data screen, and the page should not pay for columns it
  // will never show.
  const { data: statBookings } = useTable<AttributionBooking>('bookings',
    { select: 'id, status, check_in, referral_source, source_id' })
  const { data: statSubmissions } = useTable<AttributionSubmissionRow>('form_submissions',
    { select: 'created_booking_id, payload' })
  const { data: seasons } = useTable<Season>('seasons', { order: 'start_date', ascending: false })

  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [showSettled, setShowSettled] = useState(false)
  const [query, setQuery] = useState('')
  const [chips, setChips] = useState<Set<Chip>>(new Set())
  const [statusFilter, setStatusFilter] = useState<Set<EnquiryStatus>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const notesById = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const n of allNotes) m.set(n.enquiry_id, [...(m.get(n.enquiry_id) ?? []), n.body])
    return m
  }, [allNotes])

  const scope = useMemo(
    () => enquiries.filter(e => isSettled(e.status) === showSettled),
    [enquiries, showSettled])

  const filtered = useMemo(() => scope.filter(e => {
    if (!matchesSearch(e, notesById.get(e.id) ?? [], query)) return false
    if (statusFilter.size > 0 && !statusFilter.has(e.status)) return false
    if (chips.has('chase') && silenceDays(e.last_contact_at) < SILENCE_WARN_DAYS) return false
    if (chips.has('new') && e.status !== 'new') return false
    if (chips.has('nodate') && e.arrival_month != null) return false
    return true
  }), [scope, notesById, query, statusFilter, chips])

  const groups = useMemo(() => groupByArrivalMonth(filtered), [filtered])
  // One band for every row, so the columns line up and the empty months show.
  const band = useMemo(() => monthBand(scope.map(e => e.arrival_month)), [scope])

  const working = useMemo(() => enquiries.filter(e => !isSettled(e.status)), [enquiries])
  const people = working.reduce((n, e) => n + (e.party_size ?? 0), 0)
  const toChase = working.filter(e => silenceDays(e.last_contact_at) >= SILENCE_WARN_DAYS).length

  // Memoised so the panel does not recompute on every keystroke in the search box.
  const attributionData = useMemo(
    () => ({ enquiries, bookings: statBookings as Booking[], submissions: statSubmissions, sources }),
    [enquiries, statBookings, statSubmissions, sources])

  const current = selected ? enquiries.find(e => e.id === selected) ?? null : null

  // Arriving from ⌘K. A won or lost enquiry lives in the archived list, so the
  // scope has to follow — otherwise the panel opens over a list that does not
  // contain it, and closing it lands gui nowhere.
  useEffect(() => {
    if (!initialEnquiryId) return
    const target = enquiries.find(e => e.id === initialEnquiryId)
    if (!target) return
    setShowSettled(isSettled(target.status))
    setSelected(target.id)
    onEnquiryOpened?.()
  }, [initialEnquiryId, enquiries, onEnquiryOpened])
  const nowMonth = thisMonthISO()

  function toggle<T>(set: Set<T>, v: T, apply: (s: Set<T>) => void) {
    const next = new Set(set)
    next.has(v) ? next.delete(v) : next.add(v)
    apply(next)
  }

  const chipDefs: { key: Chip; label: string }[] = [
    { key: 'chase', label: `To chase (${toChase})` },
    { key: 'new', label: 'New' },
    { key: 'nodate', label: 'No dates' },
  ]

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

        <div className="grid grid-cols-3 gap-3 mt-6 max-w-lg">
          {[
            { label: 'Open', value: working.length, tone: '' },
            { label: 'People expected', value: people, tone: '' },
            { label: 'To chase', value: toChase, tone: toChase > 0 ? 'text-amber-600 dark:text-amber-400' : '' },
          ].map(c => (
            <div key={c.label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">{c.label}</p>
              <p className={`text-xl font-bold text-gray-800 dark:text-gray-200 ${c.tone}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* ── Toolbar: one search box, a few chips, the colours ─────────────── */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search names, messages, notes…"
            className="flex-1 min-w-[14rem] text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200"
          />

          {chipDefs.map(c => (
            <button key={c.key} onClick={() => toggle(chips, c.key, setChips)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${chips.has(c.key)
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
              {c.label}
            </button>
          ))}

          {/* Filter by colour — gui reads this table by colour, so the colour is
              the control, not a decoration on one. */}
          <div className="flex gap-1">
            {STATUS_ORDER.map(s => (
              <button key={s} onClick={() => toggle(statusFilter, s, setStatusFilter)}
                title={STATUS_META[s].label}
                className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                  statusFilter.has(s) ? 'border-gray-800 dark:border-gray-200 scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                <span className={`w-3.5 h-3.5 rounded-full ${STATUS_META[s].dot}`} />
              </button>
            ))}
          </div>

          <div className="flex gap-1 ml-auto">
            {([[false, `Working (${enquiries.filter(e => !isSettled(e.status)).length})`],
               [true, `Archive (${enquiries.filter(e => isSettled(e.status)).length})`]] as const).map(([v, label]) => (
              <button key={String(v)} onClick={() => setShowSettled(v)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${showSettled === v
                  ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* On the archive only — this is the end-of-season reading, and it would
            be noise above the list of people still waiting for an answer. */}
        {showSettled && (
          <div className="mt-4">
            <AttributionPanel data={attributionData} seasons={seasons} />
          </div>
        )}

        {/* ── The table ─────────────────────────────────────────────────────── */}
        <div className="mt-4 space-y-4">
          {groups.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic py-10 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
              {query || chips.size || statusFilter.size ? 'Nothing matches.' : showSettled ? 'Nothing archived yet.' : 'No open enquiry.'}
            </p>
          )}

          {groups.map(g => {
            const key = g.key ?? '__none__'
            // Past months start folded; the undated group never does — it is the
            // pile nobody has read yet. `toggled` holds the groups gui flipped
            // away from that default, so one key means one group whichever way
            // it opens.
            const startsFolded = g.key != null && g.key < nowMonth
            const isFolded = collapsed.has(key) ? !startsFolded : startsFolded
            return (
              <div key={key} className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
                <button
                  onClick={() => toggle(collapsed, key, setCollapsed)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 text-left">
                  <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">
                    {isFolded ? '▸' : '▾'} {g.key ? fmtArrivalMonth(g.key) : 'No dates yet'}
                  </span>
                  {/* The header carries the totals even folded — otherwise closing
                      a group hides the very thing you wanted to compare. */}
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {g.items.length} enquir{g.items.length === 1 ? 'y' : 'ies'}
                    {g.people > 0 && ` · ${g.people} people`}
                    {g.won > 0 && ` · ${g.won} won`}
                  </span>
                </button>

                {!isFolded && (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {g.items.map(e => {
                      const days = silenceDays(e.last_contact_at)
                      const noteCount = (notesById.get(e.id) ?? []).length
                      return (
                        <button key={e.id} onClick={() => { setSelected(e.id); setCreating(false) }}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors">
                          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                            {/* Who */}
                            <span className="min-w-0 flex-1 sm:flex-none sm:w-56 truncate font-semibold text-sm text-gray-800 dark:text-gray-200">
                              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${STATUS_META[e.status].dot}`} />
                              {e.name}
                              {e.party_size != null && (
                                <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">{e.party_size} pers</span>
                              )}
                            </span>

                            {/* When — the band */}
                            <span className="hidden md:flex items-center gap-0.5 w-40 shrink-0">
                              {band.map(m => (
                                <span key={m} title={fmtArrivalMonth(m)}
                                  className={`h-3 flex-1 rounded-sm ${m === e.arrival_month
                                    ? 'bg-blue-500 dark:bg-blue-400'
                                    : 'bg-gray-200 dark:bg-gray-700'}`} />
                              ))}
                              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 w-16 shrink-0">
                                {fmtArrivalMonth(e.arrival_month)}
                              </span>
                            </span>

                            {/* Wants — fixed slots, so absence reads as fast as presence */}
                            <span className="flex gap-1 w-16 shrink-0">
                              {WANTS.map(w => (
                                <span key={w.key} className={e[w.key] ? '' : 'opacity-20 grayscale'}>{w.icon}</span>
                              ))}
                            </span>

                            {/* Budget */}
                            <span className="hidden lg:block w-20 shrink-0 text-xs text-right text-gray-600 dark:text-gray-400">
                              {e.budget_eur != null ? `${e.budget_eur} €` : ''}
                            </span>

                            {/* Status */}
                            <span className={`hidden sm:inline-block shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_META[e.status].pill}`}>
                              {STATUS_META[e.status].label}
                            </span>

                            {/* Silence */}
                            <span className={`w-12 shrink-0 text-xs text-right ${silenceTone(days)}`}>{days} j</span>
                          </div>

                          {!isQualified(e) && (
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-medium mr-2">
                                to qualify
                              </span>
                              <span className="italic">{(e.message ?? '').slice(0, 120) || 'no message'}</span>
                            </div>
                          )}
                          {noteCount > 0 && (
                            <span className="text-[11px] text-gray-400 dark:text-gray-500">💬 {noteCount}</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Qualification, as an overlay: it is a focused act ───────────────── */}
      {(creating || current) && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto"
          onClick={() => { setSelected(null); setCreating(false) }}>
          <div className="w-full max-w-5xl my-8" onClick={ev => ev.stopPropagation()}>
            <EnquiryPanel
              key={current?.id ?? 'new'}
              enquiry={current}
              sources={sources.filter(s => s.is_active)}
              onSaved={() => { refresh(); if (creating) { setCreating(false) } }}
              onClose={() => { setSelected(null); setCreating(false) }}
              onDeleted={() => { setSelected(null); setCreating(false); refresh() }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
