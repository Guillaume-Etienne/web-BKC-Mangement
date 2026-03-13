import { useState } from 'react'
import { useBookings, useBookingRooms, useBookingParticipants } from '../hooks/useBookings'
import { useAccommodations, useRooms } from '../hooks/useAccommodations'
import type { Room, Accommodation } from '../types/database'
import { defaultTravelGuideSections } from '../data/travelGuide'
import type { TravelGuideSection } from '../data/travelGuide'
import { printVisaLetter } from '../utils/printVisaLetter'
import { printBookingSummary } from '../utils/printBookingSummary'
import type { Lang } from '../utils/printBookingSummary'
import type { Booking } from '../types/database'

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
        These sections appear in the Booking Summary PDF. Toggle on/off and edit per language.
      </p>
      {sections.map(sec => (
        <div key={sec.id} className={`border rounded-lg overflow-hidden ${sec.is_active ? 'border-teal-300' : 'border-gray-200'}`}>
          <div className={`flex items-center gap-3 px-4 py-3 ${sec.is_active ? 'bg-teal-50' : 'bg-gray-50'}`}>
            {/* Toggle */}
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

// ── Main page ──────────────────────────────────────────────────────────────────

type Tab = 'visa' | 'summary' | 'guide'

export default function DocumentsPage() {
  const { data: allBookings, loading } = useBookings()
  const { data: bookingRooms } = useBookingRooms()
  const { data: bookingParticipants } = useBookingParticipants()
  const { data: rooms } = useRooms()
  const { data: accommodations } = useAccommodations()

  const [tab, setTab] = useState<Tab>('visa')
  const [visaBookingId, setVisaBookingId]     = useState('')
  const [summaryBookingId, setSummaryBookingId] = useState('')
  const [lang, setLang]                         = useState<Lang>('en')
  const [totalAmountStr, setTotalAmountStr]      = useState('')
  const [guideSections, setGuideSections]        = useState<TravelGuideSection[]>(defaultTravelGuideSections)

  const activeBookings = allBookings.filter(b => b.status !== 'cancelled')

  // Auto-select first booking once loaded
  const effectiveVisaId    = visaBookingId    || activeBookings[0]?.id || ''
  const effectiveSummaryId = summaryBookingId || activeBookings[0]?.id || ''

  const visaBooking    = activeBookings.find(b => b.id === effectiveVisaId)
  const summaryBooking = activeBookings.find(b => b.id === effectiveSummaryId)
  const summaryRooms   = getRoomLabels(effectiveSummaryId, bookingRooms, rooms, accommodations)
  const totalAmount    = totalAmountStr !== '' ? parseFloat(totalAmountStr) : null
  const activeSections = guideSections.filter(s => s.is_active)

  const tabs: { id: Tab; label: string }[] = [
    { id: 'visa',    label: '📋 Visa Letter' },
    { id: 'summary', label: '📄 Booking Summary' },
    { id: 'guide',   label: '✏️ Travel Guide' },
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

            <button
              onClick={() => visaBooking && printVisaLetter(visaBooking, bookingParticipants.filter(p => p.booking_id === visaBooking.id))}
              disabled={!visaBooking}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors">
              🖨️ Generate Visa Letter
            </button>
            <p className="text-xs text-gray-400">Opens in a new tab → use your browser's Print dialog → Save as PDF</p>
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
            {/* Booking */}
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

            {/* Language */}
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

            {/* Total */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Estimated total — optional, leave blank to omit
              </label>
              <div className="flex items-center gap-2 max-w-xs">
                <span className="text-gray-400">€</span>
                <input type="number" value={totalAmountStr} onChange={e => setTotalAmountStr(e.target.value)}
                  placeholder="e.g. 1200" min={0}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            {/* Guide chips */}
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

            <button
              onClick={() => summaryBooking && printBookingSummary(summaryBooking, summaryRooms, lang, totalAmount, activeSections, bookingParticipants)}
              disabled={!summaryBooking}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors">
              🖨️ Generate Booking Summary
            </button>
            <p className="text-xs text-gray-400">Opens in a new tab → use your browser's Print dialog → Save as PDF</p>
          </div>
        </div>
      )}

      {/* ── Travel Guide Editor ────────────────────────────────────── */}
      {tab === 'guide' && (
        <div className="space-y-5">
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 text-sm text-teal-800">
            Configure the travel tips included in every Booking Summary.
            Changes apply immediately to all documents generated this session.
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <TravelGuideEditor sections={guideSections} onChange={setGuideSections} />
          </div>
        </div>
      )}
    </div>
  )
}
