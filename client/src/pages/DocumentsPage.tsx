import { useState, useEffect } from 'react'
import { useBookings, useBookingRooms, useBookingParticipants } from '../hooks/useBookings'
import { useAccommodations, useRooms } from '../hooks/useAccommodations'
import { useAgencies } from '../hooks/useAgencies'
import { useDocumentSections } from '../hooks/useDocumentTemplates'
import { agencyMarker } from '../components/accounting/utils'
import { useTable } from '../hooks/useSupabase'
import type { Room, Accommodation, EmailLog, EmailLogType, SharedLink } from '../types/database'
import { defaultTravelGuideSections } from '../data/travelGuide'
import { defaultWelcomeGuideSections } from '../data/welcomeGuide'
import type { TravelGuideSection } from '../data/travelGuide'
import { printVisaLetter } from '../utils/printVisaLetter'
import { printBookingSummary } from '../utils/printBookingSummary'
import { printTravelGuide, printWelcomeGuide } from '../utils/printTravelGuide'
import { emailVisaLetter, emailBookingConfirmation, emailTravelGuide, emailWelcomeGuide, emailClientAccount } from '../utils/emailTemplates'
import type { Lang } from '../utils/printBookingSummary'
import type { Booking } from '../types/database'
import { supabase } from '../lib/supabase'
import { fmtDate, todayISO } from '../utils/dates'

// ── Guide sections — legacy localStorage fallback ──────────────────────────────
// Sections now live in the document_templates table. This read-only fallback
// recovers content edited before 2026-07-09 (localStorage era) so the first
// Save migrates it to the DB instead of losing it.

const GUIDE_KEY = 'bkc_guide_sections'

function loadLegacyGuideSections(): TravelGuideSection[] {
  try {
    const stored = localStorage.getItem(GUIDE_KEY)
    return stored ? (JSON.parse(stored) as TravelGuideSection[]) : defaultTravelGuideSections
  } catch {
    return defaultTravelGuideSections
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getRoomLabels(bookingId: string, bookingRooms: { booking_id: string; room_id: string }[], rooms: Room[], accommodations: Accommodation[]): string[] {
  return bookingRooms
    .filter(br => br.booking_id === bookingId)
    .map(br => {
      const room = rooms.find(r => r.id === br.room_id)
      const acc  = room ? accommodations.find(a => a.id === room.accommodation_id) : null
      return acc && room ? `${acc.name}/${room.name}` : '?'
    })
}

function bookingLabel(b: Booking): string {
  const name = b.client ? `${b.client.first_name} ${b.client.last_name}` : 'Unknown'
  return `#${String(b.booking_number).padStart(3, '0')} — ${name}  (${fmtDate(b.check_in)} → ${fmtDate(b.check_out)})`
}

function clientEmail(b: Booking | undefined): string {
  return b?.client?.email ?? ''
}

function filterByClientName(bookings: Booking[], search: string): Booking[] {
  const q = search.trim().toLowerCase()
  if (!q) return bookings
  return bookings.filter(b => {
    const first = b.client?.first_name?.toLowerCase() ?? ''
    const last  = b.client?.last_name?.toLowerCase() ?? ''
    return first.includes(q) || last.includes(q) || `${first} ${last}`.includes(q)
  })
}

// ── Email history display ──────────────────────────────────────────────────────

const STATUS_CFG: Record<EmailLog['status'], { bg: string; text: string; label: string }> = {
  pending:   { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-400', label: 'Pending' },
  sent:      { bg: 'bg-blue-100 dark:bg-blue-900/30',   text: 'text-blue-800 dark:text-blue-400',   label: 'Sent' },
  delivered: { bg: 'bg-green-100 dark:bg-green-900/30',  text: 'text-green-800 dark:text-green-400',  label: 'Delivered ✓' },
  opened:    { bg: 'bg-green-200 dark:bg-green-800',  text: 'text-green-900 dark:text-green-400',  label: 'Opened ✓✓' },
  failed:    { bg: 'bg-red-100 dark:bg-red-900/30',    text: 'text-red-800 dark:text-red-400',    label: 'Failed ✗' },
}

// ── Overview grid helpers ────────────────────────────────────────────────────

const DOC_TYPES: { type: EmailLogType; label: string }[] = [
  { type: 'booking_confirmation', label: 'Confirmation' },
  { type: 'visa_letter',          label: 'Visa Letter' },
  { type: 'travel_guide',         label: 'Travel Guide' },
  { type: 'welcome_guide',        label: 'Welcome Guide' },
  { type: 'client_account',       label: 'Client Account' },
]

function cellKey(bookingId: string, type: EmailLogType): string {
  return `${bookingId}:${type}`
}

// Same token shape as ManagementPage's Shared Links tab — kept local, like every
// other small pure helper on this page (bookingLabel, clientEmail, ...).
function generateClientToken(): string {
  return `client_${Math.random().toString(36).slice(2, 12)}`
}

function shareUrl(token: string): string {
  return `${window.location.origin}/?share=${token}`
}

function cellStatusClasses(log: EmailLog | undefined): string {
  if (!log) return 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700'
  if (log.status === 'failed') return 'bg-red-100 dark:bg-red-900/30 border-red-400 dark:border-red-700'
  if (log.status === 'pending') return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-400 dark:border-yellow-700'
  return 'bg-green-100 dark:bg-green-900/30 border-green-400 dark:border-green-700' // sent / delivered / opened
}

function cellTitle(log: EmailLog | undefined): string {
  if (!log) return 'Never sent'
  const date = log.sent_at ? new Date(log.sent_at).toLocaleString('en-GB') : ''
  return `${STATUS_CFG[log.status].label}${date ? ` — ${date}` : ''}`
}

function EmailHistory({ logs }: { logs: EmailLog[] }) {
  if (logs.length === 0) return null
  return (
    <div className="space-y-1.5 pt-1">
      {logs.slice(0, 3).map(log => {
        const { bg, text, label } = STATUS_CFG[log.status]
        const date = log.sent_at
          ? new Date(log.sent_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
          : ''
        return (
          <div key={log.id} className="flex items-center gap-2 text-xs">
            <span className={`px-2 py-0.5 rounded-full font-medium ${bg} ${text}`}>{label}</span>
            <span className="text-gray-400 dark:text-gray-400 truncate">{log.recipient_email}</span>
            {date && <span className="text-gray-300 dark:text-gray-500 shrink-0">{date}</span>}
          </div>
        )
      })}
    </div>
  )
}

// ── Templates Editor (base content, all languages) ────────────────────────────

function TemplatesEditor({
  sections, onChange,
}: {
  sections: TravelGuideSection[]
  onChange: (s: TravelGuideSection[]) => void
}) {
  const [editLang, setEditLang] = useState<Lang>('en')
  const [openId,   setOpenId]   = useState<string | null>(sections[0]?.id ?? null)

  function updateField(id: string, field: 'title' | 'content', lang: Lang, val: string) {
    onChange(sections.map(s => s.id === id ? { ...s, [field]: { ...s[field], [lang]: val } } : s))
  }

  return (
    <div className="space-y-3">
      {/* Global language switcher */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">Editing language:</span>
        <div className="flex gap-1">
          {(['fr', 'en', 'es'] as Lang[]).map(l => (
            <button key={l} onClick={() => setEditLang(l)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${editLang === l ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
              {l === 'fr' ? '🇫🇷 FR' : l === 'en' ? '🇬🇧 EN' : '🇪🇸 ES'}
            </button>
          ))}
        </div>
      </div>

      {sections.map(sec => (
        <div key={sec.id} className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
          {/* Section header */}
          <button
            onClick={() => setOpenId(openId === sec.id ? null : sec.id)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
          >
            <span className="font-medium text-sm text-gray-800 dark:text-gray-200">{sec.title.en}</span>
            <span className="text-gray-400 dark:text-gray-400 text-xs">{openId === sec.id ? '▲' : '▼'}</span>
          </button>

          {openId === sec.id && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Title</label>
                <input
                  type="text"
                  value={sec.title[editLang]}
                  onChange={e => updateField(sec.id, 'title', editLang, e.target.value)}
                  className="w-full text-sm border rounded px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Content</label>
                <textarea
                  value={sec.content[editLang]}
                  rows={5}
                  onChange={e => updateField(sec.id, 'content', editLang, e.target.value)}
                  className="w-full text-sm border rounded px-2 py-1.5 resize-y"
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Travel Guide Editor ────────────────────────────────────────────────────────

function TravelGuideEditor({
  sections, onChange,
}: {
  sections: TravelGuideSection[]
  onChange: (s: TravelGuideSection[]) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLang, setEditLang]   = useState<Lang>('en')

  function toggle(id: string) {
    onChange(sections.map(s => s.id === id ? { ...s, is_active: !s.is_active } : s))
  }

  function updateField(id: string, field: 'title' | 'content', lang: Lang, val: string) {
    onChange(sections.map(s => s.id === id ? { ...s, [field]: { ...s[field], [lang]: val } } : s))
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 dark:text-gray-400 italic">
        Toggle sections on/off and edit per language. Don't forget to Save below.
      </p>
      {sections.map(sec => (
        <div key={sec.id} className={`border rounded-lg overflow-hidden ${sec.is_active ? 'border-teal-300 dark:border-teal-800' : 'border-gray-200 dark:border-gray-800'}`}>
          <div className={`flex items-center gap-3 px-4 py-3 ${sec.is_active ? 'bg-teal-50 dark:bg-teal-950/40' : 'bg-gray-50 dark:bg-gray-800'}`}>
            <button onClick={() => toggle(sec.id)}
              className={`relative shrink-0 w-10 h-5 rounded-full transition-colors ${sec.is_active ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white dark:bg-gray-900 shadow transition-transform ${sec.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
            <span className="font-medium text-sm text-gray-800 dark:text-gray-200 flex-1">{sec.title.en}</span>
            <button onClick={() => setEditingId(editingId === sec.id ? null : sec.id)}
              className="text-xs px-2 py-1 rounded bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
              {editingId === sec.id ? 'Close' : '✏️ Edit'}
            </button>
          </div>

          {editingId === sec.id && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3">
              <div className="flex gap-1">
                {(['fr', 'en', 'es'] as Lang[]).map(l => (
                  <button key={l} onClick={() => setEditLang(l)}
                    className={`px-3 py-1 rounded text-xs font-medium ${editLang === l ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                    {l === 'fr' ? '🇫🇷 FR' : l === 'en' ? '🇬🇧 EN' : '🇪🇸 ES'}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Title</label>
                <input type="text" value={sec.title[editLang]}
                  onChange={e => updateField(sec.id, 'title', editLang, e.target.value)}
                  className="w-full text-sm border rounded px-2 py-1.5" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Content</label>
                <textarea value={sec.content[editLang]} rows={4}
                  onChange={e => updateField(sec.id, 'content', editLang, e.target.value)}
                  className="w-full text-sm border rounded px-2 py-1.5 resize-y" />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Save / Cancel bar for template editors ─────────────────────────────────────

function SaveBar({
  dirty, saving, neverSaved, onSave, onCancel,
}: {
  dirty: boolean
  saving: boolean
  neverSaved: boolean
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap pt-3 mt-3 border-t border-gray-100 dark:border-gray-800">
      {neverSaved ? (
        <span className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded px-2 py-1">
          ⚠️ Not stored in the database yet — click Save to publish these templates.
        </span>
      ) : dirty ? (
        <span className="text-xs font-medium text-amber-600 dark:text-amber-400">● Unsaved changes</span>
      ) : (
        <span className="text-xs text-gray-400 dark:text-gray-400">✓ All changes saved</span>
      )}
      <div className="flex gap-2 ml-auto">
        <button
          onClick={onCancel}
          disabled={!dirty || saving}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors">
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={!dirty || saving}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-40 transition-colors">
          {saving ? '⏳ Saving…' : '💾 Save'}
        </button>
      </div>
    </div>
  )
}

// ── Send email row ─────────────────────────────────────────────────────────────

function SendEmailRow({
  label, emailValue, onEmailChange, onSend, sending, logs,
}: {
  label: string
  emailValue: string
  onEmailChange: (v: string) => void
  onSend: () => void
  sending: boolean
  logs: EmailLog[]
}) {
  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 space-y-3 bg-gray-50 dark:bg-gray-800">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">✉️ {label}</span>
      <div className="flex gap-2">
        <input
          type="email"
          value={emailValue}
          onChange={e => onEmailChange(e.target.value)}
          placeholder="client@email.com"
          className="flex-1 text-sm border rounded-lg px-3 py-2 bg-white dark:bg-gray-900"
        />
        <button
          onClick={onSend}
          disabled={sending || !emailValue.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors whitespace-nowrap"
        >
          {sending ? '⏳ Sending…' : '📧 Send'}
        </button>
      </div>
      <EmailHistory logs={logs} />
    </div>
  )
}

// ── Booking picker (search + select) ───────────────────────────────────────────

function BookingPicker({
  bookings, search, onSearchChange, value, onChange,
}: {
  bookings: Booking[]
  search: string
  onSearchChange: (v: string) => void
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <input
        type="text"
        value={search}
        onChange={e => onSearchChange(e.target.value)}
        placeholder="🔍 Search by client name…"
        className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900"
      />
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900">
        {bookings.length === 0 ? (
          <option value="" disabled>No booking matches "{search}"</option>
        ) : (
          bookings.map(b => <option key={b.id} value={b.id}>{bookingLabel(b)}</option>)
        )}
      </select>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'visa' | 'summary' | 'guide' | 'welcome' | 'templates'

export default function DocumentsPage() {
  const { data: allBookings, loading } = useBookings()
  const { data: bookingRooms } = useBookingRooms()
  const { data: bookingParticipants } = useBookingParticipants()
  const { data: rooms } = useRooms()
  const { data: accommodations } = useAccommodations()
  const { data: agencies } = useAgencies()
  // Overview list only ever marks whole bookings (no invoice lines here), same
  // shortcut BookingsPage uses — agencyMarker falls straight through to agency_id.
  const agencyLookup = { agencies, bookings: allBookings, agencyBillingLines: [] }
  const { data: sharedLinksData, refresh: refreshSharedLinks } = useTable<SharedLink>('shared_links')
  const clientLinks = sharedLinksData.filter(l => l.type === 'client')
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null)

  const [tab, setTab] = useState<Tab>('overview')
  const [visaBookingId,    setVisaBookingId]    = useState('')
  const [visaSearch,       setVisaSearch]       = useState('')
  const [summaryBookingId, setSummaryBookingId] = useState('')
  const [summarySearch,    setSummarySearch]    = useState('')
  const [lang, setLang]                         = useState<Lang>('en')

  // Guide sections — DB-backed working copies (null until loaded)
  const guideDb   = useDocumentSections('travel_guide')
  const welcomeDb = useDocumentSections('welcome_guide')
  const [guideSections,   setGuideSections]   = useState<TravelGuideSection[] | null>(null)
  const [welcomeSections, setWelcomeSections] = useState<TravelGuideSection[] | null>(null)
  const [templatesDoc,    setTemplatesDoc]    = useState<'travel' | 'welcome'>('travel')

  useEffect(() => {
    if (!guideDb.loading && guideSections === null) {
      setGuideSections(guideDb.saved ?? loadLegacyGuideSections())
    }
  }, [guideDb.loading])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!welcomeDb.loading && welcomeSections === null) {
      setWelcomeSections(welcomeDb.saved ?? defaultWelcomeGuideSections)
    }
  }, [welcomeDb.loading])  // eslint-disable-line react-hooks/exhaustive-deps

  const guideDirty   = guideSections   !== null && (guideDb.saved   === null || JSON.stringify(guideSections)   !== JSON.stringify(guideDb.saved))
  const welcomeDirty = welcomeSections !== null && (welcomeDb.saved === null || JSON.stringify(welcomeSections) !== JSON.stringify(welcomeDb.saved))

  async function saveGuide() {
    if (!guideSections) return
    const err = await guideDb.save(guideSections)
    if (err) alert(`Failed to save templates: ${err}`)
  }
  async function saveWelcome() {
    if (!welcomeSections) return
    const err = await welcomeDb.save(welcomeSections)
    if (err) alert(`Failed to save templates: ${err}`)
  }
  function cancelGuide()   { setGuideSections(guideDb.saved ?? loadLegacyGuideSections()) }
  function cancelWelcome() { setWelcomeSections(welcomeDb.saved ?? defaultWelcomeGuideSections) }

  // Email state
  const [visaEmail,    setVisaEmail]    = useState('')
  const [summaryEmail, setSummaryEmail] = useState('')
  const [guideEmail,   setGuideEmail]   = useState('')
  const [welcomeEmail, setWelcomeEmail] = useState('')
  const [sending,      setSending]      = useState<EmailLogType | null>(null)
  const [emailLogs,    setEmailLogs]    = useState<EmailLog[]>([])
  const [logsRefresh,  setLogsRefresh]  = useState(0)  // counter to trigger re-fetch

  // Overview tab state — one grid, all bookings x all doc types
  const [overviewSearch,  setOverviewSearch]  = useState('')
  const [overviewLang,    setOverviewLang]    = useState<Lang>('en')
  const [selectedCells,   setSelectedCells]   = useState<Set<string>>(new Set())
  const [overviewLogs,    setOverviewLogs]    = useState<EmailLog[]>([])
  const [overviewRefresh, setOverviewRefresh] = useState(0)
  const [bulkBusy,        setBulkBusy]        = useState<{ kind: 'send' | 'mark'; done: number; total: number } | null>(null)

  const activeBookings = allBookings.filter(b => b.status !== 'cancelled')

  const effectiveVisaId    = visaBookingId    || activeBookings[0]?.id || ''
  const effectiveSummaryId = summaryBookingId || activeBookings[0]?.id || ''

  const visaSearchBookings    = filterByClientName(activeBookings, visaSearch)
  const summarySearchBookings = filterByClientName(activeBookings, summarySearch)

  const visaBooking    = activeBookings.find(b => b.id === effectiveVisaId)
  const summaryBooking = activeBookings.find(b => b.id === effectiveSummaryId)
  const summaryRooms   = getRoomLabels(effectiveSummaryId, bookingRooms, rooms, accommodations)
  const activeSections        = (guideSections   ?? []).filter(s => s.is_active)
  const activeWelcomeSections = (welcomeSections ?? []).filter(s => s.is_active)

  // Overview tab derived data
  const overviewBookings = filterByClientName(activeBookings, overviewSearch)
    .slice()
    .sort((a, b) => a.check_in.localeCompare(b.check_in))

  // overviewLogs is fetched newest-first, so the first entry seen per key is the latest.
  const latestLogByKey = new Map<string, EmailLog>()
  for (const log of overviewLogs) {
    const key = `${log.booking_id}:${log.type}`
    if (!latestLogByKey.has(key)) latestLogByKey.set(key, log)
  }

  // One client-account shared link per booking_number — first match wins, same
  // limitation ManagementPage already has if duplicates were ever created there.
  const clientLinkByBookingNumber = new Map<number, SharedLink>()
  for (const link of clientLinks) {
    const num = parseInt(link.params?.booking_number ?? '')
    if (!Number.isNaN(num) && !clientLinkByBookingNumber.has(num)) clientLinkByBookingNumber.set(num, link)
  }

  async function createClientLink(booking: Booking) {
    const clientName = booking.client ? `${booking.client.first_name} ${booking.client.last_name}` : `#${booking.booking_number}`
    const { error } = await supabase.from('shared_links').insert([{
      token: generateClientToken(),
      type: 'client' as const,
      label: `Client Account – ${clientName}`,
      params: { booking_number: String(booking.booking_number) },
      created_at: todayISO(),
      expires_at: null,
      is_active: true,
    }])
    if (error) { alert(`Failed to create link: ${error.message}`); return }
    refreshSharedLinks()
  }

  async function reactivateClientLink(link: SharedLink) {
    const { error } = await supabase.from('shared_links').update({ is_active: true }).eq('id', link.id)
    if (error) { alert(`Failed to reactivate link: ${error.message}`); return }
    refreshSharedLinks()
  }

  function copyClientLink(link: SharedLink) {
    navigator.clipboard.writeText(shareUrl(link.token)).catch(() => {})
    setCopiedLinkId(link.id)
    setTimeout(() => setCopiedLinkId(null), 2000)
  }

  function toggleCell(key: string) {
    setSelectedCells(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // null = nothing to send (only reachable for 'client_account' if the row's
  // checkbox got selected right as its link was deleted elsewhere — the cell
  // itself never renders a checkbox for a booking with no link).
  function buildDocumentEmail(type: EmailLogType, booking: Booking, lang: Lang): { subject: string; html: string } | null {
    const participants = bookingParticipants.filter(p => p.booking_id === booking.id)
    switch (type) {
      case 'visa_letter':
        return { subject: `Visa letter — Booking #${booking.booking_number}`, html: emailVisaLetter(booking, participants) }
      case 'booking_confirmation': {
        const roomLabels = getRoomLabels(booking.id, bookingRooms, rooms, accommodations)
        return {
          subject: `Booking confirmation #${booking.booking_number} — ${booking.client?.first_name ?? ''}`,
          html: emailBookingConfirmation(booking, roomLabels, lang, activeSections, participants),
        }
      }
      case 'travel_guide':
        return { subject: `Traveller's guide — BKC`, html: emailTravelGuide(booking, lang, activeSections) }
      case 'welcome_guide':
        return { subject: `Welcome guide — BKC`, html: emailWelcomeGuide(booking, lang, activeWelcomeSections) }
      case 'client_account': {
        const link = clientLinkByBookingNumber.get(booking.booking_number)
        if (!link) return null
        return {
          subject: `Your BKC account — Booking #${booking.booking_number}`,
          html: emailClientAccount(booking, lang, shareUrl(link.token)),
        }
      }
    }
  }

  // Keep the selection valid when search narrows the list past it — otherwise the
  // <select> shows a different booking than the one actually held in state.
  useEffect(() => {
    if (visaSearch.trim() && visaSearchBookings.length > 0 && !visaSearchBookings.some(b => b.id === effectiveVisaId)) {
      setVisaBookingId(visaSearchBookings[0].id)
    }
  }, [visaSearch, visaSearchBookings, effectiveVisaId])

  useEffect(() => {
    if (summarySearch.trim() && summarySearchBookings.length > 0 && !summarySearchBookings.some(b => b.id === effectiveSummaryId)) {
      setSummaryBookingId(summarySearchBookings[0].id)
    }
  }, [summarySearch, summarySearchBookings, effectiveSummaryId])

  // Pre-fill email when booking changes
  useEffect(() => {
    if (visaBooking) setVisaEmail(clientEmail(visaBooking))
  }, [effectiveVisaId])

  useEffect(() => {
    if (summaryBooking) {
      setSummaryEmail(clientEmail(summaryBooking))
      setGuideEmail(clientEmail(summaryBooking))
      setWelcomeEmail(clientEmail(summaryBooking))
    }
  }, [effectiveSummaryId])

  // Fetch email logs for the active booking — re-fetches after each send via logsRefresh
  const logsBookingId = tab === 'visa' ? effectiveVisaId : effectiveSummaryId
  useEffect(() => {
    if (!logsBookingId) return
    supabase
      .from('email_logs')
      .select('*')
      .eq('booking_id', logsBookingId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setEmailLogs((data ?? []) as EmailLog[]))
  }, [logsBookingId, logsRefresh])

  function logsForType(type: EmailLogType): EmailLog[] {
    return emailLogs.filter(l => l.type === type)
  }

  // Low-level send, shared by the single-booking tabs below and the Overview bulk send.
  async function invokeSendEmail(bookingId: string, type: EmailLogType, to: string, subject: string, html: string): Promise<string | null> {
    const { error } = await supabase.functions.invoke('send-email', {
      body: { booking_id: bookingId, type, to, subject, html },
    })
    return error ? (error.message ?? String(error)) : null
  }

  async function sendEmail(type: EmailLogType, to: string, subject: string, html: string) {
    const bookingId = type === 'visa_letter' ? effectiveVisaId : effectiveSummaryId
    if (!bookingId || !to.trim()) return
    setSending(type)
    try {
      const err = await invokeSendEmail(bookingId, type, to.trim(), subject, html)
      if (err) alert(`Failed to send email: ${err}`)
      else setLogsRefresh(r => r + 1)
    } finally {
      setSending(null)
    }
  }

  // Fetch every email_logs row for the Overview grid — small table, admin-only, no need to scope.
  useEffect(() => {
    if (tab !== 'overview') return
    supabase
      .from('email_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setOverviewLogs((data ?? []) as EmailLog[]))
  }, [tab, overviewRefresh])

  async function handleSendSelected() {
    const cells = Array.from(selectedCells)
    if (cells.length === 0) return
    setBulkBusy({ kind: 'send', done: 0, total: cells.length })
    let failures = 0
    let skipped = 0
    for (let i = 0; i < cells.length; i++) {
      const [bookingId, type] = cells[i].split(':') as [string, EmailLogType]
      const booking = activeBookings.find(b => b.id === bookingId)
      const to = clientEmail(booking)
      const built = booking ? buildDocumentEmail(type, booking, overviewLang) : null
      if (!booking || !to || !built) {
        skipped++
      } else {
        const err = await invokeSendEmail(bookingId, type, to, built.subject, built.html)
        if (err) failures++
      }
      setBulkBusy({ kind: 'send', done: i + 1, total: cells.length })
    }
    setBulkBusy(null)
    setSelectedCells(new Set())
    setOverviewRefresh(r => r + 1)
    const okCount = cells.length - failures - skipped
    if (failures > 0 || skipped > 0) {
      alert(`Sent ${okCount}/${cells.length}.${failures ? ` ${failures} failed.` : ''}${skipped ? ` ${skipped} skipped (no client email on file).` : ''}`)
    }
  }

  async function handleMarkSelected() {
    const cells = Array.from(selectedCells)
    if (cells.length === 0) return
    setBulkBusy({ kind: 'mark', done: 0, total: cells.length })
    const rows = cells.map(key => {
      const [bookingId, type] = key.split(':') as [string, EmailLogType]
      const booking = activeBookings.find(b => b.id === bookingId)
      return {
        booking_id: bookingId,
        type,
        status: 'sent' as const,
        recipient_email: clientEmail(booking) || '(manual — no address on file)',
        sent_at: new Date().toISOString(),
      }
    })
    const { error } = await supabase.from('email_logs').insert(rows)
    setBulkBusy(null)
    if (error) alert(`Failed to record: ${error.message}`)
    setSelectedCells(new Set())
    setOverviewRefresh(r => r + 1)
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview',  label: '📊 Overview' },
    { id: 'visa',      label: '📋 Visa Letter' },
    { id: 'summary',   label: '📄 Booking Summary' },
    { id: 'guide',     label: '🌍 Travel Guide' },
    { id: 'welcome',   label: '🏝️ Welcome Guide' },
    { id: 'templates', label: '✏️ Templates' },
  ]

  if (loading || !guideSections || !welcomeSections) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-6">📄 Documents</h1>
        <p className="text-gray-500 dark:text-gray-400">Loading bookings…</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">📄 Documents</h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              tab === t.id
                ? 'bg-white dark:bg-gray-900 border border-b-white border-gray-200 dark:border-gray-800 text-blue-700 dark:text-blue-400 -mb-px'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview ───────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 rounded-lg p-4 text-sm text-indigo-800 dark:text-indigo-400">
            One row per booking, one column per document. Check cells to select them, then send or mark as sent.
            Confirmation, Travel Guide and Welcome Guide go out in the language below — the Visa Letter is always Portuguese.
            The <strong>Client Account</strong> column creates the client's personal booking link the first time — once it exists, 👁 opens it and ⧉ copies it, and its checkbox sends/resends it like any other document.
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={overviewSearch}
              onChange={e => setOverviewSearch(e.target.value)}
              placeholder="🔍 Search by client name…"
              className="flex-1 min-w-[200px] border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900"
            />
            <div className="flex gap-1">
              {(['fr', 'en', 'es'] as Lang[]).map(l => (
                <button key={l} onClick={() => setOverviewLang(l)}
                  className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                    overviewLang === l ? 'bg-blue-600 text-white border-blue-600 dark:border-blue-500' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}>
                  {l === 'fr' ? '🇫🇷 FR' : l === 'en' ? '🇬🇧 EN' : '🇪🇸 ES'}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-x-auto">
            {overviewBookings.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-400 italic p-5">No active bookings found.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="text-left px-4 py-2 font-medium text-gray-500 dark:text-gray-400">Booking</th>
                    {DOC_TYPES.map(dt => (
                      <th key={dt.type} className="px-2 py-2 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">{dt.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {overviewBookings.map(b => (
                    <tr key={b.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="font-medium text-gray-700 dark:text-gray-300">
                          {agencyMarker({ booking_id: b.id }, agencyLookup) && (
                            <span className="mr-1 text-gray-500 dark:text-gray-400" title="Booking from a partner agency">
                              {agencyMarker({ booking_id: b.id }, agencyLookup)}
                            </span>
                          )}
                          {bookingLabel(b)}
                        </div>
                        {!clientEmail(b) && <div className="text-xs text-red-500 dark:text-red-400">⚠ no email on file</div>}
                      </td>
                      {DOC_TYPES.map(dt => {
                        const key = cellKey(b.id, dt.type)
                        const log = latestLogByKey.get(key)

                        if (dt.type === 'client_account') {
                          const link = clientLinkByBookingNumber.get(b.booking_number)
                          if (!link) {
                            return (
                              <td key={dt.type} className="text-center p-2">
                                <button
                                  onClick={() => createClientLink(b)}
                                  className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 whitespace-nowrap">
                                  + Create
                                </button>
                              </td>
                            )
                          }
                          if (!link.is_active) {
                            return (
                              <td key={dt.type} className="text-center p-2">
                                <button
                                  onClick={() => reactivateClientLink(link)}
                                  title="Link is deactivated"
                                  className="text-xs px-2 py-1 rounded border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 whitespace-nowrap">
                                  ⚠ Reactivate
                                </button>
                              </td>
                            )
                          }
                          return (
                            <td key={dt.type} className="p-2">
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="checkbox"
                                  title={cellTitle(log)}
                                  checked={selectedCells.has(key)}
                                  onChange={() => toggleCell(key)}
                                  className={`w-5 h-5 rounded border-2 cursor-pointer ${cellStatusClasses(log)}`}
                                />
                                <button onClick={() => window.open(shareUrl(link.token), '_blank')} title="Open" className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">👁</button>
                                <button onClick={() => copyClientLink(link)} title="Copy link" className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                                  {copiedLinkId === link.id ? '✓' : '⧉'}
                                </button>
                              </div>
                            </td>
                          )
                        }

                        return (
                          <td key={dt.type} className="text-center p-2">
                            <input
                              type="checkbox"
                              title={cellTitle(log)}
                              checked={selectedCells.has(key)}
                              onChange={() => toggleCell(key)}
                              className={`w-5 h-5 rounded border-2 cursor-pointer ${cellStatusClasses(log)}`}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSendSelected}
              disabled={selectedCells.size === 0 || bulkBusy !== null}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors">
              {bulkBusy?.kind === 'send' ? `⏳ Sending ${bulkBusy.done}/${bulkBusy.total}…` : `📧 Send selected (${selectedCells.size})`}
            </button>
            <button
              onClick={handleMarkSelected}
              disabled={selectedCells.size === 0 || bulkBusy !== null}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors">
              {bulkBusy?.kind === 'mark' ? '⏳ Recording…' : `✓ Mark as sent manually (${selectedCells.size})`}
            </button>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-400">
            "Mark as sent manually" logs the document as sent without emailing anything — use it when a guide was handed over in person or sent via WhatsApp.
          </p>
        </div>
      )}

      {/* ── Visa Letter ────────────────────────────────────────────── */}
      {tab === 'visa' && (
        <div className="space-y-5">
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-400">
            Official invitation letter in <strong>Portuguese</strong> for Mozambique visa purposes.
            Date is set to <strong>today</strong> automatically.
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5 space-y-4">
            <h2 className="font-semibold text-gray-700 dark:text-gray-300">Select booking</h2>

            {activeBookings.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-400 italic">No active bookings found.</p>
            ) : (
              <BookingPicker bookings={visaSearchBookings} search={visaSearch} onSearchChange={setVisaSearch}
                value={effectiveVisaId} onChange={setVisaBookingId} />
            )}

            {visaBooking && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 dark:bg-gray-800 rounded p-3">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Visa entry date</div>
                  <div className={`font-semibold ${!visaBooking.visa_entry_date ? 'text-red-500 dark:text-red-400' : ''}`}>
                    {visaBooking.visa_entry_date ?? '⚠ Not set'}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded p-3">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Visa exit date</div>
                  <div className={`font-semibold ${!visaBooking.visa_exit_date ? 'text-red-500 dark:text-red-400' : ''}`}>
                    {visaBooking.visa_exit_date ?? '⚠ Not set'}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded p-3 col-span-2">
                  {(() => {
                    const parts = bookingParticipants.filter(p => p.booking_id === visaBooking.id)
                    return (
                      <>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Guests ({parts.length})</div>
                        <div className={`font-semibold text-sm ${parts.length === 0 ? 'text-red-500 dark:text-red-400' : ''}`}>
                          {parts.length === 0
                            ? '⚠ No guests listed — add them in the booking wizard (step 3)'
                            : parts.map(p => `${p.first_name}${p.last_name ? ` ${p.last_name}` : ''}${p.passport_number ? ` (${p.passport_number})` : ''}`).join(', ')}
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => visaBooking && printVisaLetter(visaBooking, bookingParticipants.filter(p => p.booking_id === visaBooking.id))}
                disabled={!visaBooking}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors">
                🖨️ Generate PDF
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-400">Opens in a new tab → use your browser's Print dialog → Save as PDF</p>

            {visaBooking && (
              <SendEmailRow
                label="Send visa letter by email"
                emailValue={visaEmail}
                onEmailChange={setVisaEmail}
                onSend={() => {
                  const html = emailVisaLetter(visaBooking, bookingParticipants.filter(p => p.booking_id === visaBooking.id))
                  sendEmail('visa_letter', visaEmail, `Visa letter — Booking #${visaBooking.booking_number}`, html)
                }}
                sending={sending === 'visa_letter'}
                logs={logsForType('visa_letter')}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Booking Summary ────────────────────────────────────────── */}
      {tab === 'summary' && (
        <div className="space-y-5">
          <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-400">
            Client-facing confirmation with stay details, transport info and travel tips.
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Booking</label>
              {activeBookings.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-400 italic">No active bookings found.</p>
              ) : (
                <BookingPicker bookings={summarySearchBookings} search={summarySearch} onSearchChange={setSummarySearch}
                  value={effectiveSummaryId} onChange={setSummaryBookingId} />
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Language</label>
              <div className="flex gap-2">
                {(['fr', 'en', 'es'] as Lang[]).map(l => (
                  <button key={l} onClick={() => setLang(l)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      lang === l ? 'bg-blue-600 text-white border-blue-600 dark:border-blue-500' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}>
                    {l === 'fr' ? '🇫🇷 Français' : l === 'en' ? '🇬🇧 English' : '🇪🇸 Español'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Travel guide sections included ({activeSections.length} active)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {guideSections.map(sec => (
                  <span key={sec.id} className={`text-xs px-2 py-1 rounded-full ${
                    sec.is_active ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-400 line-through'
                  }`}>
                    {sec.title.en}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => summaryBooking && printBookingSummary(summaryBooking, summaryRooms, lang, activeSections, bookingParticipants)}
                disabled={!summaryBooking}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors">
                🖨️ Generate PDF
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-400">Opens in a new tab → use your browser's Print dialog → Save as PDF</p>

            {summaryBooking && (
              <SendEmailRow
                label="Send booking confirmation by email"
                emailValue={summaryEmail}
                onEmailChange={setSummaryEmail}
                onSend={() => {
                  const html = emailBookingConfirmation(summaryBooking, summaryRooms, lang, activeSections, bookingParticipants)
                  sendEmail('booking_confirmation', summaryEmail, `Booking confirmation #${summaryBooking.booking_number} — ${summaryBooking.client?.first_name ?? ''}`, html)
                }}
                sending={sending === 'booking_confirmation'}
                logs={logsForType('booking_confirmation')}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Travel Guide Editor ────────────────────────────────────── */}
      {tab === 'guide' && (
        <div className="space-y-5">
          <div className="bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900 rounded-lg p-4 text-sm text-teal-800 dark:text-teal-400">
            Configure the travel tips included in every Booking Summary.
            Changes are stored in the database once saved — shared across browsers and devices.
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5">
            <TravelGuideEditor sections={guideSections} onChange={setGuideSections} />
            <SaveBar dirty={guideDirty} saving={guideDb.saving} neverSaved={guideDb.saved === null}
              onSave={saveGuide} onCancel={cancelGuide} />
          </div>

          {activeBookings.length > 0 && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5 space-y-4">
              <h2 className="font-semibold text-gray-700 dark:text-gray-300">Send standalone travel guide</h2>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Booking</label>
                <BookingPicker bookings={summarySearchBookings} search={summarySearch} onSearchChange={setSummarySearch}
                  value={effectiveSummaryId} onChange={setSummaryBookingId} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Language</label>
                <div className="flex gap-2">
                  {(['fr', 'en', 'es'] as Lang[]).map(l => (
                    <button key={l} onClick={() => setLang(l)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        lang === l ? 'bg-blue-600 text-white border-blue-600 dark:border-blue-500' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}>
                      {l === 'fr' ? '🇫🇷 Français' : l === 'en' ? '🇬🇧 English' : '🇪🇸 Español'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => summaryBooking && printTravelGuide(summaryBooking, lang, activeSections)}
                  disabled={!summaryBooking}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors">
                  🖨️ Generate PDF
                </button>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-400">Opens in a new tab → use your browser's Print dialog → Save as PDF</p>

              {summaryBooking && (
                <SendEmailRow
                  label="Send travel guide by email"
                  emailValue={guideEmail}
                  onEmailChange={setGuideEmail}
                  onSend={() => {
                    const html = emailTravelGuide(summaryBooking, lang, activeSections)
                    sendEmail('travel_guide', guideEmail, `Traveller's guide — BKC`, html)
                  }}
                  sending={sending === 'travel_guide'}
                  logs={logsForType('travel_guide')}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Welcome Guide ──────────────────────────────────────────── */}
      {tab === 'welcome' && (
        <div className="space-y-5">
          <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 rounded-lg p-4 text-sm text-sky-800 dark:text-sky-400">
            On-site info for arriving clients — wifi, meals, drinking water, schedules…
            Everything guests always ask, handed over on arrival or emailed a few days before.
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5">
            <TravelGuideEditor sections={welcomeSections} onChange={setWelcomeSections} />
            <SaveBar dirty={welcomeDirty} saving={welcomeDb.saving} neverSaved={welcomeDb.saved === null}
              onSave={saveWelcome} onCancel={cancelWelcome} />
          </div>

          {activeBookings.length > 0 && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5 space-y-4">
              <h2 className="font-semibold text-gray-700 dark:text-gray-300">Send welcome guide</h2>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Booking</label>
                <BookingPicker bookings={summarySearchBookings} search={summarySearch} onSearchChange={setSummarySearch}
                  value={effectiveSummaryId} onChange={setSummaryBookingId} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Language</label>
                <div className="flex gap-2">
                  {(['fr', 'en', 'es'] as Lang[]).map(l => (
                    <button key={l} onClick={() => setLang(l)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        lang === l ? 'bg-blue-600 text-white border-blue-600 dark:border-blue-500' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}>
                      {l === 'fr' ? '🇫🇷 Français' : l === 'en' ? '🇬🇧 English' : '🇪🇸 Español'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => summaryBooking && printWelcomeGuide(summaryBooking, lang, activeWelcomeSections)}
                  disabled={!summaryBooking}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors">
                  🖨️ Generate PDF
                </button>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-400">Opens in a new tab → use your browser's Print dialog → Save as PDF</p>

              {summaryBooking && (
                <SendEmailRow
                  label="Send welcome guide by email"
                  emailValue={welcomeEmail}
                  onEmailChange={setWelcomeEmail}
                  onSend={() => {
                    const html = emailWelcomeGuide(summaryBooking, lang, activeWelcomeSections)
                    sendEmail('welcome_guide', welcomeEmail, `Welcome guide — BKC`, html)
                  }}
                  sending={sending === 'welcome_guide'}
                  logs={logsForType('welcome_guide')}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Templates ──────────────────────────────────────────────── */}
      {tab === 'templates' && (
        <div className="space-y-5">
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg p-4 text-sm text-gray-600 dark:text-gray-400">
            Edit the base content of guide sections in all languages.
            Toggle sections on/off per-send in the{' '}
            <button onClick={() => setTab('guide')} className="underline hover:text-gray-800 dark:hover:text-gray-200">Travel Guide</button> and{' '}
            <button onClick={() => setTab('welcome')} className="underline hover:text-gray-800 dark:hover:text-gray-200">Welcome Guide</button> tabs.
          </div>

          {/* Document switcher */}
          <div className="flex gap-2">
            {([['travel', '🌍 Travel Guide'], ['welcome', '🏝️ Welcome Guide']] as const).map(([doc, label]) => (
              <button key={doc} onClick={() => setTemplatesDoc(doc)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  templatesDoc === doc ? 'bg-blue-600 text-white border-blue-600 dark:border-blue-500' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}>
                {label}
              </button>
            ))}
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5">
            {templatesDoc === 'travel' ? (
              <>
                <TemplatesEditor sections={guideSections} onChange={setGuideSections} />
                <SaveBar dirty={guideDirty} saving={guideDb.saving} neverSaved={guideDb.saved === null}
                  onSave={saveGuide} onCancel={cancelGuide} />
              </>
            ) : (
              <>
                <TemplatesEditor sections={welcomeSections} onChange={setWelcomeSections} />
                <SaveBar dirty={welcomeDirty} saving={welcomeDb.saving} neverSaved={welcomeDb.saved === null}
                  onSave={saveWelcome} onCancel={cancelWelcome} />
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {(['fr', 'en', 'es'] as Lang[]).map(l => (
              <button key={l}
                onClick={() => templatesDoc === 'travel'
                  ? printTravelGuide(null, l, guideSections)
                  : printWelcomeGuide(null, l, welcomeSections)}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors">
                🖨️ Preview {l.toUpperCase()}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-400">Previews all sections (including inactive ones) in the selected language.</p>
        </div>
      )}
    </div>
  )
}
