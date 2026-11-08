import { useEffect, useState } from 'react'
import type { TaxiTrip, TaxiBookingRef, BookingParticipant } from '../../types/database'
import { supabase } from '../../lib/supabase'
import { taxiTripLabel } from '../../data/taxiTripTypes'
import { useBookingRooms } from '../../hooks/useBookings'
import { useAccommodations, useRooms } from '../../hooks/useAccommodations'
import { tripSyncProposals, type TripProposal } from '../../utils/taxiBookingSync'
import { fmtDate } from '../../utils/dates'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'
import { isTravelBy, travelLabel, travelToStore } from '../../utils/travelMode'
import TravelBadge from '../common/TravelBadge'

// The booking behind a taxi trip, opened from the ⓘ of a trip without leaving
// the Taxis page (gui, 2026-11-08): what the booking sheet says about the
// transfer, and the fields worth correcting from here. Saving the booking does
// NOT touch its trips — each keeps its own time and bags — but the panel then
// proposes, trip by trip, to carry the change over (utils/taxiBookingSync.ts).
//
// Docked on the right from md up (the list stays visible beside it: clicking
// another ⓘ is the way to move on); a bottom sheet on a phone, where it covers
// the list — hence the ‹ › arrows there only.

interface Draft {
  notes: string
  arrival_time: string
  departure_time: string
  /** Flight number (or the guest's words when they come another way) — 2026-11-08b. */
  arrival_detail: string
  departure_detail: string
  luggage_count: number
  boardbag_count: number
}

function draftOf(b: TaxiBookingRef): Draft {
  return {
    notes:          b.notes ?? '',
    arrival_time:   b.arrival_time ?? '',
    departure_time: b.departure_time ?? '',
    arrival_detail:   b.arrival_detail ?? '',
    departure_detail: b.departure_detail ?? '',
    luggage_count:  b.luggage_count,
    boardbag_count: b.boardbag_count,
  }
}

function sameDraft(a: Draft, b: Draft): boolean {
  return a.notes === b.notes && a.arrival_time === b.arrival_time && a.departure_time === b.departure_time
    && a.arrival_detail === b.arrival_detail && a.departure_detail === b.departure_detail
    && a.luggage_count === b.luggage_count && a.boardbag_count === b.boardbag_count
}

function transferFields(d: Draft) {
  return {
    arrival_time:   d.arrival_time || null,
    departure_time: d.departure_time || null,
    luggage_count:  d.luggage_count,
    boardbag_count: d.boardbag_count,
  }
}

/** A number typed here makes the leg a flight — unless the guest said "other"
 *  (then it is their words); emptied, the leg keeps the mode it had. */
function travelEdit(by: string | null | undefined, detail: string) {
  const next = detail.trim() ? (by === 'other' ? 'other' : 'flight') : (isTravelBy(by) ? by : null)
  return travelToStore(next, detail)
}

/** Only what changed: a column the database does not have yet (2026-11-08b not
 *  passed) must not be named, or PostgREST rejects the whole save. */
function travelChanges(b: TaxiBookingRef, base: Draft, d: Draft) {
  const out: Record<string, string | null> = {}
  if (d.arrival_detail !== base.arrival_detail) {
    const t = travelEdit(b.arrival_by, d.arrival_detail)
    out.arrival_by = t.by; out.arrival_detail = t.detail
  }
  if (d.departure_detail !== base.departure_detail) {
    const t = travelEdit(b.departure_by, d.departure_detail)
    out.departure_by = t.by; out.departure_detail = t.detail
  }
  return out
}

interface BookingPeekPanelProps {
  trip: TaxiTrip
  booking: TaxiBookingRef | undefined
  /** Every trip of this booking, filters ignored — the ones a change may concern. */
  bookingTrips: TaxiTrip[]
  participants: BookingParticipant[]
  /** Phone arrows: position of this trip among the ones the list shows. */
  position: { index: number; total: number } | null
  onPrev: (() => void) | null
  onNext: (() => void) | null
  onClose: () => void
  onOpenBooking?: (bookingId: string) => void
  onDirtyChange: (dirty: boolean) => void
  onBookingSaved: () => void
  onUpdateTrip: (trip: TaxiTrip) => Promise<boolean>
}

/** The ⓘ that opens the panel, on every trip linked to a booking (list, cards,
 *  kanban). Stops the click: the row/card underneath opens the trip editor. */
export function BookingPeekButton({ active, onClick, withLabel = false }: { active: boolean; onClick: () => void; withLabel?: boolean }) {
  const { lang } = useLanguage()
  return (
    <button type="button" onClick={e => { e.stopPropagation(); onClick() }} aria-pressed={active}
      title={i18n.taxis.peek_btn_title[lang]}
      className={`inline-flex items-center justify-center gap-1 shrink-0 rounded-full border text-xs font-semibold transition-colors ${
        withLabel ? 'px-2.5 py-1' : 'w-6 h-6'
      } ${
        active
          ? 'bg-blue-600 border-blue-600 text-white'
          : 'bg-white dark:bg-gray-900 border-blue-300 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40'
      }`}>
      ⓘ{withLabel && <span>{i18n.taxis.peek_btn_short[lang]}</span>}
    </button>
  )
}

const inputCls = 'w-full text-sm border border-gray-300 dark:border-gray-700 rounded px-2 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100'
const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

export default function BookingPeekPanel({
  trip, booking, bookingTrips, participants, position, onPrev, onNext, onClose,
  onOpenBooking, onDirtyChange, onBookingSaved, onUpdateTrip,
}: BookingPeekPanelProps) {
  const { lang } = useLanguage()
  const tx = i18n.taxis
  const { data: bookingRooms }   = useBookingRooms()
  const { data: rooms }          = useRooms()
  const { data: accommodations } = useAccommodations()

  const [draft, setDraft]         = useState<Draft | null>(() => booking ? draftOf(booking) : null)
  const [baseline, setBaseline]   = useState<Draft | null>(() => booking ? draftOf(booking) : null)
  const [saving, setSaving]       = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [proposals, setProposals] = useState<TripProposal[]>([])
  const [applying, setApplying]   = useState<string | null>(null)

  const dirty = !!draft && !!baseline && !sameDraft(draft, baseline)
  useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])

  // Follow the booking as it changes (first load, our own save coming back, the
  // other admin) — except while something typed here is not saved yet.
  // (State adjusted during render, React's pattern for "reset when a prop changes".)
  const fresh = booking ? draftOf(booking) : null
  const freshKey = fresh ? JSON.stringify(fresh) : ''
  const [syncedKey, setSyncedKey] = useState(freshKey)
  if (fresh && freshKey !== syncedKey && !dirty) {
    setSyncedKey(freshKey)
    setDraft(fresh)
    setBaseline(fresh)
  }

  function update(patch: Partial<Draft>) {
    setDraft(d => d ? { ...d, ...patch } : d)
    setJustSaved(false)
  }

  async function save() {
    if (!booking || !draft || !baseline || !dirty) return
    setSaving(true)
    const { error } = await supabase.from('bookings').update({
      notes: draft.notes.trim() ? draft.notes : null,
      ...transferFields(draft),
      ...travelChanges(booking, baseline, draft),
    }).eq('id', booking.id)
    setSaving(false)
    if (error) { alert(`${i18n.common.msg_error[lang]}: ${error.message}`); return }
    setProposals(tripSyncProposals(bookingTrips, transferFields(baseline), transferFields(draft)))
    setBaseline(draft)
    setJustSaved(true)
    onBookingSaved()
  }

  async function applyProposal(p: TripProposal) {
    const current = bookingTrips.find(t => t.id === p.tripId)
    if (!current) { setProposals(ps => ps.filter(x => x.tripId !== p.tripId)); return }
    setApplying(p.tripId)
    const ok = await onUpdateTrip({
      ...current,
      ...(p.start_time   !== undefined ? { start_time:   p.start_time }   : {}),
      ...(p.nb_luggage   !== undefined ? { nb_luggage:   p.nb_luggage }   : {}),
      ...(p.nb_boardbags !== undefined ? { nb_boardbags: p.nb_boardbags } : {}),
    })
    setApplying(null)
    if (ok) setProposals(ps => ps.filter(x => x.tripId !== p.tripId))
  }

  function confirmLeave(): boolean {
    return !dirty || confirm(tx.peek_msg_discard[lang])
  }

  const clientName = booking?.client ? `${booking.client.first_name} ${booking.client.last_name}` : '—'
  const roomLabels = booking
    ? bookingRooms.filter(br => br.booking_id === booking.id).map(br => {
        const room = rooms.find(r => r.id === br.room_id)
        const acc  = room ? accommodations.find(a => a.id === room.accommodation_id) : undefined
        if (!room) return '?'
        return !acc || acc.name === room.name ? room.name : `${acc.name} · ${room.name}`
      })
    : []

  return (
    <aside
      className="fixed z-40 inset-x-0 bottom-0 max-h-[80vh] rounded-t-2xl border-t md:rounded-none md:border-t-0 md:border-l
                 md:inset-x-auto md:right-0 md:top-16 md:bottom-0 md:max-h-none md:w-[26rem]
                 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col"
      aria-label={tx.peek_btn_title[lang]}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <div className="min-w-0">
          <div className="font-bold text-gray-900 dark:text-gray-100 truncate">
            {booking ? `#${String(booking.booking_number).padStart(3, '0')} — ${clientName}` : tx.peek_btn_title[lang]}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            🚕 {taxiTripLabel(trip.type, { icon: true })} · {fmtDate(trip.date)} · {trip.start_time}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {position && (
            <div className="md:hidden flex items-center gap-1">
              <button type="button" disabled={!onPrev} onClick={() => onPrev?.()} title={tx.peek_prev[lang]}
                className="w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-700 text-lg text-gray-700 dark:text-gray-300 disabled:opacity-30">‹</button>
              <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{position.index + 1}/{position.total}</span>
              <button type="button" disabled={!onNext} onClick={() => onNext?.()} title={tx.peek_next[lang]}
                className="w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-700 text-lg text-gray-700 dark:text-gray-300 disabled:opacity-30">›</button>
            </div>
          )}
          <button type="button" onClick={() => { if (confirmLeave()) onClose() }} title={i18n.common.btn_close[lang]}
            className="w-9 h-9 rounded-lg text-xl font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">✕</button>
        </div>
      </div>

      {!booking || !draft ? (
        <p className="p-4 text-sm italic text-gray-500 dark:text-gray-400">{tx.peek_not_found[lang]}</p>
      ) : (
        <>
          <div className="overflow-y-auto flex-1 p-4 space-y-4 text-sm">
            {booking.status === 'cancelled' && (
              <div className="rounded-lg px-3 py-2 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 font-semibold text-xs">
                {tx.peek_cancelled[lang]}
              </div>
            )}

            {/* What the sheet says — read only */}
            <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5 text-gray-800 dark:text-gray-200">
              <dt className="text-gray-500 dark:text-gray-400">{tx.peek_label_stay[lang]}</dt>
              <dd>
                {fmtDate(booking.check_in)} → {fmtDate(booking.check_out)}
                <span className="text-gray-500 dark:text-gray-400"> · {roomLabels.length > 0 ? roomLabels.join(', ') : tx.peek_no_room[lang]}</span>
              </dd>
              <dt className="text-gray-500 dark:text-gray-400">{tx.peek_label_travelers[lang]}</dt>
              <dd>
                {participants.length}
                {participants.length > 0 && <span className="text-gray-500 dark:text-gray-400"> · {participants.map(p => p.first_name).join(', ')}</span>}
                {booking.children_count > 0 && <span className="text-gray-500 dark:text-gray-400"> · {booking.children_count} {tx.peek_label_children[lang]}</span>}
              </dd>
              <dt className="text-gray-500 dark:text-gray-400">{tx.peek_label_transfers[lang]}</dt>
              <dd>
                {tx.peek_label_arrival[lang]} {booking.taxi_arrival ? '✓' : '✗'}
                <span className="text-gray-400 dark:text-gray-500"> · </span>
                {tx.peek_label_departure[lang]} {booking.taxi_departure ? '✓' : '✗'}
              </dd>
            </dl>

            {/* What can be corrected from here */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{`✈️ ${tx.peek_label_arr_flight_no[lang]}`}</label>
                <input value={draft.arrival_detail} placeholder="TM 302" autoComplete="off" spellCheck={false}
                  onChange={e => update({ arrival_detail: e.target.value })} className={inputCls} />
                <TravelBadge t={travelLabel(travelEdit(booking.arrival_by, draft.arrival_detail).by, draft.arrival_detail)} className="text-xs mt-1 inline-block" />
              </div>
              <div>
                <label className={labelCls}>{`✈️ ${tx.peek_label_dep_flight_no[lang]}`}</label>
                <input value={draft.departure_detail} placeholder="TM 301" autoComplete="off" spellCheck={false}
                  onChange={e => update({ departure_detail: e.target.value })} className={inputCls} />
                <TravelBadge t={travelLabel(travelEdit(booking.departure_by, draft.departure_detail).by, draft.departure_detail)} className="text-xs mt-1 inline-block" />
              </div>
              <div>
                <label className={labelCls}>✈️ {tx.peek_label_arr_flight[lang]}</label>
                <input type="time" value={draft.arrival_time} onChange={e => update({ arrival_time: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>✈️ {tx.peek_label_dep_flight[lang]}</label>
                <input type="time" value={draft.departure_time} onChange={e => update({ departure_time: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>🧳 {tx.peek_label_luggage[lang]}</label>
                <input type="number" min="0" value={draft.luggage_count}
                  onChange={e => update({ luggage_count: Math.max(0, parseInt(e.target.value) || 0) })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>🏄 {tx.peek_label_boardbags[lang]}</label>
                <input type="number" min="0" value={draft.boardbag_count}
                  onChange={e => update({ boardbag_count: Math.max(0, parseInt(e.target.value) || 0) })} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>📝 {tx.peek_label_notes[lang]}</label>
              <textarea value={draft.notes} rows={8} onChange={e => update({ notes: e.target.value })}
                className={`${inputCls} whitespace-pre-wrap`} />
            </div>

            <div className="flex items-center gap-3">
              <button type="button" onClick={save} disabled={!dirty || saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm disabled:opacity-40 disabled:hover:bg-blue-600">
                {saving ? tx.peek_saving[lang] : tx.peek_btn_save[lang]}
              </button>
              {justSaved && !dirty && <span className="text-xs text-green-700 dark:text-green-400">{tx.peek_saved[lang]}</span>}
            </div>

            {/* After a save: the trips still on the old values, one proposal each */}
            {proposals.length > 0 && (
              <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-3">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">{tx.peek_sync_title[lang]}</p>
                {proposals.map(p => {
                  const t = bookingTrips.find(x => x.id === p.tripId)
                  if (!t) return null
                  const bagsChange = p.nb_luggage !== undefined || p.nb_boardbags !== undefined
                  return (
                    <div key={p.tripId} className="space-y-1.5 text-xs text-gray-800 dark:text-gray-200">
                      <div className="font-semibold">{taxiTripLabel(t.type, { icon: true })} · {fmtDate(t.date)}</div>
                      {p.start_time !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 dark:text-gray-400 w-12">{tx.peek_label_time[lang]}</span>
                          <span className="line-through text-gray-500 dark:text-gray-400">{t.start_time}</span>
                          <span>→</span>
                          <input type="time" value={p.start_time}
                            onChange={e => setProposals(ps => ps.map(x => x.tripId === p.tripId ? { ...x, start_time: e.target.value } : x))}
                            className="text-xs border border-gray-300 dark:border-gray-700 rounded px-1.5 py-1 bg-white dark:bg-gray-900" />
                        </div>
                      )}
                      {bagsChange && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 dark:text-gray-400 w-12">{tx.peek_label_bags[lang]}</span>
                          <span className="line-through text-gray-500 dark:text-gray-400">{t.nb_luggage} + {t.nb_boardbags} bb</span>
                          <span>→</span>
                          <span className="font-semibold">{p.nb_luggage ?? t.nb_luggage} + {p.nb_boardbags ?? t.nb_boardbags} bb</span>
                        </div>
                      )}
                      <div className="flex gap-2 pt-0.5">
                        <button type="button" onClick={() => applyProposal(p)} disabled={applying === p.tripId || p.start_time === ''}
                          className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-semibold disabled:opacity-50">
                          {applying === p.tripId ? tx.peek_saving[lang] : tx.peek_btn_update_trip[lang]}
                        </button>
                        <button type="button" onClick={() => setProposals(ps => ps.filter(x => x.tripId !== p.tripId))}
                          className="px-3 py-1.5 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                          {tx.peek_btn_keep[lang]}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {onOpenBooking && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
              <button type="button" onClick={() => { if (confirmLeave()) onOpenBooking(booking.id) }}
                className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                {tx.peek_btn_open_booking[lang]} →
              </button>
            </div>
          )}
        </>
      )}
    </aside>
  )
}
