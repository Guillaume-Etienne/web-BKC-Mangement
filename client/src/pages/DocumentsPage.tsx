import { useState, useEffect } from 'react'
import { useBookings, useBookingRooms, useBookingParticipants } from '../hooks/useBookings'
import { useAccommodations, useRooms } from '../hooks/useAccommodations'
import type { Room, Accommodation, EmailLog, EmailLogType } from '../types/database'
import { defaultTravelGuideSections } from '../data/travelGuide'
import type { TravelGuideSection } from '../data/travelGuide'
import { printVisaLetter } from '../utils/printVisaLetter'
import { printBookingSummary } from '../utils/printBookingSummary'
import { printTravelGuide } from '../utils/printTravelGuide'
import { emailVisaLetter, emailBookingConfirmation, emailTravelGuide } from '../utils/emailTemplates'
import type { Lang } from '../utils/printBookingSummary'
import type { Booking } from '../types/database'
import { supabase } from '../lib/supabase'
import {
  computeAccommodationRevenue, computeLessonsRevenue, computeRentalsRevenue,
  computeTaxiRevenue, computeDiningForBooking, computeActivityRevenueForBooking,
} from '../components/accounting/utils'

// ── Guide sections — localStorage persistence ──────────────────────────────────

const GUIDE_KEY = 'bkc_guide_sections'

function loadGuideSections(): TravelGuideSection[] {
  try {
    const stored = localStorage.getItem(GUIDE_KEY)
    return stored ? (JSON.parse(stored) as TravelGuideSection[]) : defaultTravelGuideSections
  } catch {
    return defaultTravelGuideSections
  }
}

function saveGuideSections(sections: TravelGuideSection[]) {
  localStorage.setItem(GUIDE_KEY, JSON.stringify(sections))
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
  return `#${String(b.booking_number).padStart(3, '0')} — ${name}  (${b.check_in} → ${b.check_out})`
}

function clientEmail(b: Booking | undefined): string {
  return b?.client?.email ?? ''
}

// ── Email history display ──────────────────────────────────────────────────────

const STATUS_CFG: Record<EmailLog['status'], { bg: string; text: string; label: string }> = {
  pending:   { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
  sent:      { bg: 'bg-blue-100',   text: 'text-blue-800',   label: 'Sent' },
  delivered: { bg: 'bg-green-100',  text: 'text-green-800',  label: 'Delivered ✓' },
  opened:    { bg: 'bg-green-200',  text: 'text-green-900',  label: 'Opened ✓✓' },
  failed:    { bg: 'bg-red-100',    text: 'text-red-800',    label: 'Failed ✗' },
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
            <span className="text-gray-400 truncate">{log.recipient_email}</span>
            {date && <span className="text-gray-300 shrink-0">{date}</span>}
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
        <span className="text-xs font-medium text-gray-500 shrink-0">Editing language:</span>
        <div className="flex gap-1">
          {(['fr', 'en', 'es'] as Lang[]).map(l => (
            <button key={l} onClick={() => setEditLang(l)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${editLang === l ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {l === 'fr' ? '🇫🇷 FR' : l === 'en' ? '🇬🇧 EN' : '🇪🇸 ES'}
            </button>
          ))}
        </div>
      </div>

      {sections.map(sec => (
        <div key={sec.id} className="border border-gray-200 rounded-lg overflow-hidden">
          {/* Section header */}
          <button
            onClick={() => setOpenId(openId === sec.id ? null : sec.id)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
          >
            <span className="font-medium text-sm text-gray-800">{sec.title.en}</span>
            <span className="text-gray-400 text-xs">{openId === sec.id ? '▲' : '▼'}</span>
          </button>

          {openId === sec.id && (
            <div className="p-4 border-t border-gray-200 bg-white space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                <input
                  type="text"
                  value={sec.title[editLang]}
                  onChange={e => updateField(sec.id, 'title', editLang, e.target.value)}
                  className="w-full text-sm border rounded px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Content</label>
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
      <p className="text-sm text-gray-500 italic">
        Toggle sections on/off and edit per language. Changes are saved in your browser.
      </p>
      {sections.map(sec => (
        <div key={sec.id} className={`border rounded-lg overflow-hidden ${sec.is_active ? 'border-teal-300' : 'border-gray-200'}`}>
          <div className={`flex items-center gap-3 px-4 py-3 ${sec.is_active ? 'bg-teal-50' : 'bg-gray-50'}`}>
            <button onClick={() => toggle(sec.id)}
              className={`relative shrink-0 w-10 h-5 rounded-full transition-colors ${sec.is_active ? 'bg-teal-500' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${sec.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
            <span className="font-medium text-sm text-gray-800 flex-1">{sec.title.en}</span>
            <button onClick={() => setEditingId(editingId === sec.id ? null : sec.id)}
              className="text-xs px-2 py-1 rounded bg-white border border-gray-300 hover:bg-gray-100 text-gray-600">
              {editingId === sec.id ? 'Close' : '✏️ Edit'}
            </button>
          </div>

          {editingId === sec.id && (
            <div className="p-4 border-t border-gray-200 bg-white space-y-3">
              <div className="flex gap-1">
                {(['fr', 'en', 'es'] as Lang[]).map(l => (
                  <button key={l} onClick={() => setEditLang(l)}
                    className={`px-3 py-1 rounded text-xs font-medium ${editLang === l ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {l === 'fr' ? '🇫🇷 FR' : l === 'en' ? '🇬🇧 EN' : '🇪🇸 ES'}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                <input type="text" value={sec.title[editLang]}
                  onChange={e => updateField(sec.id, 'title', editLang, e.target.value)}
                  className="w-full text-sm border rounded px-2 py-1.5" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Content</label>
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
    <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
      <span className="text-sm font-medium text-gray-700">✉️ {label}</span>
      <div className="flex gap-2">
        <input
          type="email"
          value={emailValue}
          onChange={e => onEmailChange(e.target.value)}
          placeholder="client@email.com"
          className="flex-1 text-sm border rounded-lg px-3 py-2 bg-white"
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

// ── Main page ──────────────────────────────────────────────────────────────────

type Tab = 'visa' | 'summary' | 'guide' | 'templates'

export default function DocumentsPage() {
  const { data: allBookings, loading } = useBookings()
  const { data: bookingRooms } = useBookingRooms()
  const { data: bookingParticipants } = useBookingParticipants()
  const { data: rooms } = useRooms()
  const { data: accommodations } = useAccommodations()

  const [tab, setTab] = useState<Tab>('visa')
  const [visaBookingId,    setVisaBookingId]    = useState('')
  const [summaryBookingId, setSummaryBookingId] = useState('')
  const [lang, setLang]                         = useState<Lang>('en')
  const [totalAmountStr,   setTotalAmountStr]   = useState('')
  const [guideSections,    setGuideSections]    = useState<TravelGuideSection[]>(loadGuideSections)

  // Email state
  const [visaEmail,    setVisaEmail]    = useState('')
  const [summaryEmail, setSummaryEmail] = useState('')
  const [guideEmail,   setGuideEmail]   = useState('')
  const [sending,      setSending]      = useState<EmailLogType | null>(null)
  const [emailLogs,    setEmailLogs]    = useState<EmailLog[]>([])
  const [logsRefresh,  setLogsRefresh]  = useState(0)  // counter to trigger re-fetch

  const activeBookings = allBookings.filter(b => b.status !== 'cancelled')

  const effectiveVisaId    = visaBookingId    || activeBookings[0]?.id || ''
  const effectiveSummaryId = summaryBookingId || activeBookings[0]?.id || ''

  const visaBooking    = activeBookings.find(b => b.id === effectiveVisaId)
  const summaryBooking = activeBookings.find(b => b.id === effectiveSummaryId)
  const summaryRooms   = getRoomLabels(effectiveSummaryId, bookingRooms, rooms, accommodations)
  const totalAmount    = totalAmountStr !== '' ? parseFloat(totalAmountStr) : null
  const activeSections = guideSections.filter(s => s.is_active)

  // Pre-fill email when booking changes
  useEffect(() => {
    if (visaBooking) setVisaEmail(clientEmail(visaBooking))
  }, [effectiveVisaId])

  useEffect(() => {
    if (summaryBooking) {
      setSummaryEmail(clientEmail(summaryBooking))
      setGuideEmail(clientEmail(summaryBooking))
    }
  }, [effectiveSummaryId])

  // Pre-compute booking total for Summary tab
  useEffect(() => {
    if (!effectiveSummaryId || !summaryBooking) return
    const bId = effectiveSummaryId
    Promise.all([
      supabase.from('booking_room_prices').select('*').eq('booking_id', bId),
      supabase.from('lessons').select('*').eq('booking_id', bId),
      supabase.from('instructors').select('*'),
      supabase.from('lesson_rate_overrides').select('*'),
      supabase.from('equipment_rentals').select('*').eq('booking_id', bId),
      supabase.from('taxi_trips').select('*').eq('booking_id', bId),
      supabase.from('dining_events').select('*'),
      supabase.from('activity_bookings').select('*').eq('booking_id', bId),
      supabase.from('external_accommodation_bookings').select('*').eq('booking_id', bId),
    ]).then(([brp, lessons, instrs, lro, rentals, taxis, dining, activities, extAccom]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = (extra: object) => ({ ...extra } as any)
      const bkParts = bookingParticipants.filter(p => p.booking_id === bId)
      const bkRooms = bookingRooms.filter(br => br.booking_id === bId)
      const total =
        computeAccommodationRevenue(summaryBooking, d({ bookingRooms: bkRooms, bookingRoomPrices: brp.data ?? [], externalAccommodationBkgs: extAccom.data ?? [] })) +
        computeLessonsRevenue(summaryBooking, d({ lessons: lessons.data ?? [], instructors: instrs.data ?? [], lessonRateOverrides: lro.data ?? [] })) +
        computeRentalsRevenue(summaryBooking, d({ equipmentRentals: rentals.data ?? [] })) +
        computeTaxiRevenue(summaryBooking, d({ taxiTrips: taxis.data ?? [] })) +
        computeDiningForBooking(summaryBooking, dining.data ?? [], bkParts) +
        computeActivityRevenueForBooking(summaryBooking, d({ activityBookings: activities.data ?? [] }))
      setTotalAmountStr(Math.round(total).toString())
    })
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

  async function sendEmail(type: EmailLogType, to: string, subject: string, html: string) {
    const bookingId = type === 'visa_letter' ? effectiveVisaId : effectiveSummaryId
    if (!bookingId || !to.trim()) return
    setSending(type)
    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: { booking_id: bookingId, type, to: to.trim(), subject, html },
      })
      if (error) alert(`Failed to send email: ${error.message ?? String(error)}`)
      else setLogsRefresh(r => r + 1)
    } finally {
      setSending(null)
    }
  }

  function handleGuideSectionsChange(sections: TravelGuideSection[]) {
    setGuideSections(sections)
    saveGuideSections(sections)
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'visa',      label: '📋 Visa Letter' },
    { id: 'summary',   label: '📄 Booking Summary' },
    { id: 'guide',     label: '🌍 Travel Guide' },
    { id: 'templates', label: '✏️ Templates' },
  ]

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">📄 Documents</h1>
        <p className="text-gray-500">Loading bookings…</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">📄 Documents</h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              tab === t.id
                ? 'bg-white border border-b-white border-gray-200 text-blue-700 -mb-px'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Visa Letter ────────────────────────────────────────────── */}
      {tab === 'visa' && (
        <div className="space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            Official invitation letter in <strong>Portuguese</strong> for Mozambique visa purposes.
            Date is set to <strong>today</strong> automatically.
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
            <h2 className="font-semibold text-gray-700">Select booking</h2>

            {activeBookings.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No active bookings found.</p>
            ) : (
              <select value={effectiveVisaId} onChange={e => setVisaBookingId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                {activeBookings.map(b => <option key={b.id} value={b.id}>{bookingLabel(b)}</option>)}
              </select>
            )}

            {visaBooking && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded p-3">
                  <div className="text-xs text-gray-500 mb-1">Visa entry date</div>
                  <div className={`font-semibold ${!visaBooking.visa_entry_date ? 'text-red-500' : ''}`}>
                    {visaBooking.visa_entry_date ?? '⚠ Not set'}
                  </div>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <div className="text-xs text-gray-500 mb-1">Visa exit date</div>
                  <div className={`font-semibold ${!visaBooking.visa_exit_date ? 'text-red-500' : ''}`}>
                    {visaBooking.visa_exit_date ?? '⚠ Not set'}
                  </div>
                </div>
                <div className="bg-gray-50 rounded p-3 col-span-2">
                  {(() => {
                    const parts = bookingParticipants.filter(p => p.booking_id === visaBooking.id)
                    return (
                      <>
                        <div className="text-xs text-gray-500 mb-1">Guests ({parts.length})</div>
                        <div className={`font-semibold text-sm ${parts.length === 0 ? 'text-red-500' : ''}`}>
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
            <p className="text-xs text-gray-400">Opens in a new tab → use your browser's Print dialog → Save as PDF</p>

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
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            Client-facing confirmation with stay details, transport info and travel tips.
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Booking</label>
              {activeBookings.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No active bookings found.</p>
              ) : (
                <select value={effectiveSummaryId} onChange={e => setSummaryBookingId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                  {activeBookings.map(b => <option key={b.id} value={b.id}>{bookingLabel(b)}</option>)}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Language</label>
              <div className="flex gap-2">
                {(['fr', 'en', 'es'] as Lang[]).map(l => (
                  <button key={l} onClick={() => setLang(l)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      lang === l ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}>
                    {l === 'fr' ? '🇫🇷 Français' : l === 'en' ? '🇬🇧 English' : '🇪🇸 Español'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Estimated total — auto-computed, edit if needed
              </label>
              <div className="flex items-center gap-2 max-w-xs">
                <span className="text-gray-400">€</span>
                <input type="number" value={totalAmountStr} onChange={e => setTotalAmountStr(e.target.value)}
                  placeholder="Computing…" min={0}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Travel guide sections included ({activeSections.length} active)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {guideSections.map(sec => (
                  <span key={sec.id} className={`text-xs px-2 py-1 rounded-full ${
                    sec.is_active ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-gray-400 line-through'
                  }`}>
                    {sec.title.en}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => summaryBooking && printBookingSummary(summaryBooking, summaryRooms, lang, totalAmount, activeSections, bookingParticipants)}
                disabled={!summaryBooking}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors">
                🖨️ Generate PDF
              </button>
            </div>
            <p className="text-xs text-gray-400">Opens in a new tab → use your browser's Print dialog → Save as PDF</p>

            {summaryBooking && (
              <SendEmailRow
                label="Send booking confirmation by email"
                emailValue={summaryEmail}
                onEmailChange={setSummaryEmail}
                onSend={() => {
                  const html = emailBookingConfirmation(summaryBooking, summaryRooms, lang, totalAmount, activeSections, bookingParticipants)
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
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 text-sm text-teal-800">
            Configure the travel tips included in every Booking Summary.
            Changes are saved in your browser automatically.
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <TravelGuideEditor sections={guideSections} onChange={handleGuideSectionsChange} />
          </div>

          {activeBookings.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
              <h2 className="font-semibold text-gray-700">Send standalone travel guide</h2>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Booking</label>
                <select value={effectiveSummaryId} onChange={e => setSummaryBookingId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                  {activeBookings.map(b => <option key={b.id} value={b.id}>{bookingLabel(b)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Language</label>
                <div className="flex gap-2">
                  {(['fr', 'en', 'es'] as Lang[]).map(l => (
                    <button key={l} onClick={() => setLang(l)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        lang === l ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
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
              <p className="text-xs text-gray-400">Opens in a new tab → use your browser's Print dialog → Save as PDF</p>

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

      {/* ── Templates ──────────────────────────────────────────────── */}
      {tab === 'templates' && (
        <div className="space-y-5">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
            Edit the base content of travel guide sections in all languages.
            These texts are used in every Booking Summary and standalone Travel Guide.
            Toggle sections on/off per-send in the <button onClick={() => setTab('guide')} className="underline hover:text-gray-800">Travel Guide</button> tab.
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <TemplatesEditor sections={guideSections} onChange={handleGuideSectionsChange} />
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => printTravelGuide(null, 'fr', guideSections)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors">
              🖨️ Preview FR
            </button>
            <button
              onClick={() => printTravelGuide(null, 'en', guideSections)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors">
              🖨️ Preview EN
            </button>
            <button
              onClick={() => printTravelGuide(null, 'es', guideSections)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors">
              🖨️ Preview ES
            </button>
          </div>
          <p className="text-xs text-gray-400">Previews all sections (including inactive ones) in the selected language.</p>
        </div>
      )}
    </div>
  )
}
