import { useState } from 'react'
import type { Booking, BookingParticipant, Client } from '../../types/database'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'
import { fmtDateShort } from '../../utils/dates'
import { isInCountryOn, isOnSiteOn } from '../../utils/dayVisitor'

// Stable per-person color + initials for the little avatar circle, so the same
// participant looks the same everywhere (picker and card) without needing a
// color stored anywhere — just hashed from their id.
const AVATAR_COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-pink-500', 'bg-cyan-600', 'bg-orange-500', 'bg-teal-500']
function avatarColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
function participantInitials(p: { first_name: string; last_name?: string | null }): string {
  const a = p.first_name?.[0] ?? ''
  const b = p.last_name?.[0] ?? ''
  return (a + b).toUpperCase() || '?'
}
export function Avatar({ id, first_name, last_name }: { id: string; first_name: string; last_name?: string | null }) {
  return (
    <span className={`w-5 h-5 rounded-full ${avatarColor(id)} text-white text-[10px] font-bold flex items-center justify-center shrink-0`}>
      {participantInitials({ first_name, last_name })}
    </span>
  )
}

interface GuestPickerProps {
  /** The day of the form: decides who is "checked in". */
  date: string
  selectedIds: string[]
  onToggle: (id: string) => void
  bookings: Booking[]
  bookingParticipants: BookingParticipant[]
  clients: Client[]
}

/** Guest chips grouped by booking, with the two escape hatches under them:
 *  "In the country" (guests in Mozambique but not lodged that day) and "Show all
 *  guests". By default only the guests checked in on `date` are listed — plus
 *  whoever is already picked, so an edit never hides the person it is about. */
export default function GuestPicker({ date, selectedIds, onToggle, bookings, bookingParticipants, clients }: GuestPickerProps) {
  const { lang } = useLanguage()
  const [showAll, setShowAll] = useState(false)
  const [showInCountry, setShowInCountry] = useState(false)

  const inCountryIds = new Set(bookings.filter(b => isInCountryOn(b, date)).map(b => b.id))
  const inCountry = bookingParticipants.filter(p => inCountryIds.has(p.booking_id))
  const lodgedIds = new Set(bookings.filter(b => isOnSiteOn(b, date)).map(b => b.id))
  const lodged = bookingParticipants.filter(p => lodgedIds.has(p.booking_id))
  const active = showInCountry ? [...lodged, ...inCountry] : lodged
  const missing = bookingParticipants.filter(p => selectedIds.includes(p.id) && !active.some(a => a.id === p.id))
  const candidates = showAll ? bookingParticipants : missing.length ? [...active, ...missing] : active

  const byBooking = new Map<string, BookingParticipant[]>()
  for (const p of candidates) {
    const arr = byBooking.get(p.booking_id) ?? []
    arr.push(p)
    byBooking.set(p.booking_id, arr)
  }

  return (
    <div>
      {candidates.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-400 italic px-0.5">
          {i18n.planning.msg_no_guests_checked_in[lang]}
        </p>
      ) : (
        <div className="space-y-1.5">
          {[...byBooking.entries()].map(([bookingId, people]) => {
            const booking = bookings.find(b => b.id === bookingId)
            const primary = clients.find(c => c.id === booking?.client_id)
            const away = booking && isInCountryOn(booking, date)
              ? booking.check_in > date
                ? `${i18n.planning.tag_not_lodged_until[lang]} ${fmtDateShort(booking.check_in)}`
                : `${i18n.planning.tag_not_lodged_since[lang]} ${fmtDateShort(booking.check_out)}`
              : null
            return (
              <div key={bookingId} className="border border-gray-100 dark:border-gray-800 rounded-lg p-1.5 bg-gray-50/50 dark:bg-gray-800/30">
                <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-400 uppercase tracking-wide mb-1 px-0.5">
                  {primary ? `${primary.first_name} ${primary.last_name ?? ''}` : 'Booking'}
                  {away && <span className="ml-1.5 normal-case tracking-normal font-medium text-amber-700 dark:text-amber-400">{`✈️ ${away}`}</span>}
                </div>
                <div className="flex flex-wrap gap-1">
                  {people.map(p => {
                    const selected = selectedIds.includes(p.id)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onToggle(p.id)}
                        className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border text-sm transition-colors ${
                          selected
                            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-300 ring-1 ring-blue-300 dark:ring-blue-700'
                            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <Avatar id={p.id} first_name={p.first_name} last_name={p.last_name} />
                        {p.first_name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400 px-0.5 mt-1">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={showInCountry} onChange={e => setShowInCountry(e.target.checked)} />
          {inCountry.length > 0 ? `${i18n.planning.label_show_in_country[lang]} (${inCountry.length})` : i18n.planning.label_show_in_country[lang]}
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
          {i18n.planning.label_show_all_guests[lang]}
        </label>
      </div>
    </div>
  )
}
