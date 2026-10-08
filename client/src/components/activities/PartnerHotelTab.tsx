// One tab of /activities per partner hotel (Hotel CasaMoz, Maputo).
// Reservations the hotel hosts for our guests — most often two separate
// nights around a safari, one row each, tied by `group_id` — the money each
// one moves, and the settlements between the hotel and us.
// Design: .claude/docs/data-model.md § Partner hotels. Logic (tested):
// utils/partnerHotel.ts.
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import type {
  ActivityBooking, PartnerHotel, PartnerHotelStay, PartnerHotelPayment, PartnerHotelRoom,
  PartnerHotelPaidBy, PartnerHotelDirection, SharedLink,
} from '../../types/database'
import { todayISO, addDaysISO, fmtDate } from '../../utils/dates'
import {
  stayNights, stayTotalMzn, stayCommissionMzn, stayExpectedMzn,
  hotelBalanceMzn, commissionEur, fmtMzn, groupStays, stayGroupKey, nightsAroundSafari,
} from '../../utils/partnerHotel'
import { safariEnd } from '../../utils/safariChain'

/** A booking as this tab needs it: enough to prefill a reservation. */
export interface HotelBookingRef {
  id:             string
  booking_number: number
  check_in:       string
  check_out:      string
  status:         string
  couples_count:  number | null
  children_count: number | null
  boardbag_count: number | null
  client?: { first_name: string; last_name: string } | null
}

/** What every night of a reservation shares. */
type Common = Pick<PartnerHotelStay,
  'booking_id' | 'display_name' | 'nb_persons' | 'couples_count' | 'children_count' | 'rooms'
  | 'commission_pct' | 'paid_by' | 'guests_paid' | 'notes' | 'internal_notes'>

/** What is proper to one night (its own dates, transfer, confirmation). */
interface Night {
  id?:              string   // set = an existing row
  check_in:         string
  check_out:        string
  airport_transfer: boolean
  transfer_time:    string | null
  departure_transfer:      boolean
  departure_transfer_time: string | null
  big_bags:         number
  hotel_confirmed:  boolean
}

interface Draft { groupId: string | null; common: Common; nights: Night[] }

const input = 'w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400'
const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

const blankNight = (): Night => ({
  check_in: '', check_out: '', airport_transfer: false, transfer_time: null,
  departure_transfer: false, departure_transfer_time: null, big_bags: 0, hotel_confirmed: false,
})

function bookingName(b: HotelBookingRef): string {
  return b.client ? `${b.client.first_name} ${b.client.last_name}`.trim() : `#${b.booking_number}`
}

function nightLabel(i: number, count: number): string {
  if (count === 1) return 'Night(s)'
  if (i === 0) return 'Arrival'
  if (i === count - 1) return 'Return'
  return `Stay ${i + 1}`
}

function report(action: string, error: { message: string } | null): boolean {
  if (!error) return true
  console.error(`${action} failed:`, error.message)
  alert(`Could not ${action}.\n\n${error.message}`)
  return false
}

function paxLabel(s: Pick<PartnerHotelStay, 'nb_persons' | 'couples_count' | 'children_count'>): string {
  const extra = [
    s.couples_count > 0 && `${s.couples_count} couple${s.couples_count > 1 ? 's' : ''}`,
    s.children_count > 0 && `${s.children_count} child${s.children_count > 1 ? 'ren' : ''}`,
  ].filter(Boolean).join(', ')
  return `${s.nb_persons} pax${extra ? ` (${extra})` : ''}`
}

// ── Reservation form ───────────────────────────────────────────────────────────

interface FormProps {
  hotel:             PartnerHotel
  initial:           Draft
  bookings:          HotelBookingRef[]
  participantCounts: Record<string, number>
  safaris:           ActivityBooking[]
  onSave:            (d: Draft) => Promise<void>
  onCancel:          () => void
}

function ReservationForm({ hotel, initial, bookings, participantCounts, safaris, onSave, onCancel }: FormProps) {
  const [c, setC] = useState<Common>(initial.common)
  const [nights, setNights] = useState<Night[]>(initial.nights)
  const setCommon = <K extends keyof Common>(k: K, v: Common[K]) => setC(prev => ({ ...prev, [k]: v }))

  // A booking prefills what it already knows — and, when it has a safari, the
  // nights around it. Everything stays editable.
  function pickBooking(id: string) {
    const b = bookings.find(x => x.id === id)
    if (!b) { setCommon('booking_id', null); return }
    setC(prev => ({
      ...prev,
      booking_id:     b.id,
      display_name:   bookingName(b),
      nb_persons:     participantCounts[b.id] || prev.nb_persons,
      couples_count:  b.couples_count ?? 0,
      children_count: b.children_count ?? 0,
    }))
    const safari = safaris.filter(s => s.booking_id === b.id).sort((x, y) => x.date.localeCompare(y.date))[0]
    setNights(prev => {
      const next = prev.map(n => ({ ...n }))
      if (next[0] && !next[0].big_bags) next[0].big_bags = b.boardbag_count ?? 0
      if (safari && next.length === 2 && next.every(n => !n.check_in && !n.check_out)) {
        const s = nightsAroundSafari(safari.date, safariEnd(safari))
        Object.assign(next[0], s.arrival)
        Object.assign(next[1], s.ret)
      }
      return next
    })
  }

  function setNight(i: number, patch: Partial<Night>) {
    setNights(prev => prev.map((n, j) => {
      if (j !== i) return n
      const next = { ...n, ...patch }
      // One night by default: a check-in pushes the check-out to the next day.
      if (patch.check_in && (!next.check_out || next.check_out <= patch.check_in)) {
        next.check_out = addDaysISO(patch.check_in, 1)
      }
      return next
    }))
  }

  function setRoom(i: number, patch: Partial<PartnerHotelRoom>) {
    setCommon('rooms', c.rooms.map((r, j) => j === i ? { ...r, ...patch } : r))
  }

  const nightly = c.rooms.reduce((s, r) => s + (Number(r.rate_mzn) || 0), 0)
  const totalNights = nights.reduce((s, n) => s + (n.check_in && n.check_out ? stayNights(n) : 0), 0)
  const total = nightly * totalNights

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (nights.length === 0) { alert('Add at least one night.'); return }
    for (const n of nights) {
      if (!n.check_in || !n.check_out || n.check_out <= n.check_in) {
        alert('Each night needs a check-in and a later check-out.'); return
      }
    }
    await onSave({
      groupId: initial.groupId,
      common: { ...c, display_name: c.display_name.trim(), notes: c.notes?.trim() || null, internal_notes: c.internal_notes?.trim() || null },
      nights: nights.map(n => ({
        ...n,
        transfer_time:           n.airport_transfer   ? (n.transfer_time || null)           : null,
        departure_transfer_time: n.departure_transfer ? (n.departure_transfer_time || null) : null,
      })),
    })
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Who */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="col-span-2">
          <label className={labelCls}>Booking</label>
          <select value={c.booking_id ?? ''} onChange={e => pickBooking(e.target.value)} className={input}>
            <option value="">— None —</option>
            {bookings.map(b => (
              <option key={b.id} value={b.id}>#{b.booking_number} {bookingName(b)} · {fmtDate(b.check_in)}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Name shown to the hotel *</label>
          <input required value={c.display_name} onChange={e => setCommon('display_name', e.target.value)} className={input} />
        </div>
        <div>
          <label className={labelCls}>Persons</label>
          <input type="number" min={0} value={c.nb_persons} onChange={e => setCommon('nb_persons', Number(e.target.value))} className={input} />
        </div>
        <div>
          <label className={labelCls}>Couples</label>
          <input type="number" min={0} value={c.couples_count} onChange={e => setCommon('couples_count', Number(e.target.value))} className={input} />
        </div>
        <div>
          <label className={labelCls}>Children</label>
          <input type="number" min={0} value={c.children_count} onChange={e => setCommon('children_count', Number(e.target.value))} className={input} />
        </div>
      </div>

      {/* Nights */}
      <div>
        <label className={labelCls}>Nights at the hotel</label>
        <div className="space-y-2">
          {nights.map((n, i) => (
            <div key={i} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 space-y-2">
              {/* Line 1 — when */}
              <div className="flex flex-wrap items-end gap-3">
                <span className="w-full sm:w-20 text-xs font-semibold text-gray-700 dark:text-gray-300 sm:pb-2">
                  {nightLabel(i, nights.length)}
                  {n.check_in && n.check_out && n.check_out > n.check_in && (
                    <span className="font-normal text-gray-400"> · {stayNights(n)} night{stayNights(n) > 1 ? 's' : ''}</span>
                  )}
                </span>
                <div className="flex-1 min-w-[9rem]">
                  <label className={labelCls}>Check-in</label>
                  <input type="date" value={n.check_in} onChange={e => setNight(i, { check_in: e.target.value })} className={input} />
                </div>
                <div className="flex-1 min-w-[9rem]">
                  <label className={labelCls}>Check-out</label>
                  <input type="date" min={n.check_in || undefined} value={n.check_out} onChange={e => setNight(i, { check_out: e.target.value })} className={input} />
                </div>
                <label className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer whitespace-nowrap pb-2">
                  <input type="checkbox" checked={n.hotel_confirmed} onChange={e => setNight(i, { hotel_confirmed: e.target.checked })} className="w-4 h-4 rounded" />
                  Confirmed by the hotel
                </label>
                <button type="button" disabled={nights.length === 1} title="Remove this night"
                  onClick={() => setNights(nights.filter((_, j) => j !== i))}
                  className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 px-2 pb-2 disabled:opacity-20">✕</button>
              </div>
              {/* Line 2 — airport and luggage */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:pl-[5.75rem]">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer whitespace-nowrap"
                    title="Airport → hotel, on the check-in day">
                    <input type="checkbox" checked={n.airport_transfer} onChange={e => setNight(i, { airport_transfer: e.target.checked })} className="w-4 h-4 rounded" />
                    🛬 Airport pick-up
                  </label>
                  <input type="time" aria-label="Pick-up time" disabled={!n.airport_transfer} value={n.transfer_time ?? ''}
                    onChange={e => setNight(i, { transfer_time: e.target.value })} className={`${input} w-28 disabled:opacity-40`} />
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer whitespace-nowrap"
                    title="Hotel → airport, on the check-out day">
                    <input type="checkbox" checked={n.departure_transfer} onChange={e => setNight(i, { departure_transfer: e.target.checked })} className="w-4 h-4 rounded" />
                    🛫 Airport drop-off
                  </label>
                  <input type="time" aria-label="Drop-off time" disabled={!n.departure_transfer} value={n.departure_transfer_time ?? ''}
                    onChange={e => setNight(i, { departure_transfer_time: e.target.value })} className={`${input} w-28 disabled:opacity-40`} />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  🧳 Big bags
                  <input type="number" min={0} value={n.big_bags}
                    onChange={e => setNight(i, { big_bags: Number(e.target.value) })} className={`${input} w-20`} />
                </label>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setNights([...nights, blankNight()])}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline">+ Add a night</button>
        </div>
        <p className="text-[11px] text-gray-400 mt-1">Pick-up happens on the check-in day, drop-off on the check-out day.</p>
      </div>

      {/* Rooms */}
      <div>
        <label className={labelCls}>Rooms (price per night, MZN) — same for every night</label>
        <div className="space-y-2">
          {c.rooms.map((r, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input placeholder="Room (e.g. Double)" value={r.label} onChange={e => setRoom(i, { label: e.target.value })} className={input} />
              <input type="number" min={0} value={r.rate_mzn} onChange={e => setRoom(i, { rate_mzn: Number(e.target.value) })} className={`${input} max-w-[9rem]`} />
              <button type="button" onClick={() => setCommon('rooms', c.rooms.filter((_, j) => j !== i))}
                className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 px-2">✕</button>
            </div>
          ))}
          <button type="button"
            onClick={() => setCommon('rooms', [...c.rooms, { label: '', rate_mzn: hotel.default_room_rate_mzn }])}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline">+ Add a room</button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          {totalNights} night{totalNights === 1 ? '' : 's'} · total {fmtMzn(total)} · our {c.commission_pct}% = {fmtMzn(Math.round(total * c.commission_pct / 100))}
        </p>
      </div>

      {/* Money */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className={labelCls}>Guests pay</label>
          <select value={c.paid_by} onChange={e => setCommon('paid_by', e.target.value as PartnerHotelPaidBy)} className={input}>
            <option value="guest_to_hotel">The hotel</option>
            <option value="guest_to_us">Us</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input type="checkbox" checked={c.guests_paid} onChange={e => setCommon('guests_paid', e.target.checked)} className="w-4 h-4 rounded" />
          Guests have paid
        </label>
        <div>
          <label className={labelCls}>Commission %</label>
          <input type="number" min={0} max={100} step="0.5" value={c.commission_pct}
            onChange={e => setCommon('commission_pct', Number(e.target.value))} className={input} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Notes (visible to the hotel)</label>
          <textarea rows={2} value={c.notes ?? ''} onChange={e => setCommon('notes', e.target.value)} className={input} />
        </div>
        <div>
          <label className={labelCls}>Internal notes (never shown to the hotel)</label>
          <textarea rows={2} value={c.internal_notes ?? ''} onChange={e => setCommon('internal_notes', e.target.value)} className={input} />
        </div>
      </div>

      <div className="flex gap-3 pt-2 border-t">
        <button type="button" onClick={onCancel}
          className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-sm font-medium">Cancel</button>
        <button type="submit"
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">Save</button>
      </div>
    </form>
  )
}

// ── Settlement form ────────────────────────────────────────────────────────────

function PaymentForm({ hotelId, suggested, onSave, onCancel }: {
  hotelId:   string
  suggested: number   // the current balance, signed
  onSave:    (p: Omit<PartnerHotelPayment, 'id' | 'created_at'>) => Promise<void>
  onCancel:  () => void
}) {
  const [date,      setDate]      = useState(todayISO())
  const [amount,    setAmount]    = useState(suggested ? String(Math.abs(Math.round(suggested))) : '')
  const [direction, setDirection] = useState<PartnerHotelDirection>(suggested < 0 ? 'us_to_hotel' : 'hotel_to_us')
  const [notes,     setNotes]     = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const n = Number(amount)
    if (!(n > 0)) { alert('Enter an amount above 0.'); return }
    await onSave({ hotel_id: hotelId, date, amount_mzn: n, direction, notes: notes.trim() || null })
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
      <div>
        <label className={labelCls}>Date</label>
        <input type="date" required value={date} onChange={e => setDate(e.target.value)} className={input} />
      </div>
      <div>
        <label className={labelCls}>Amount (MZN)</label>
        <input type="number" min={0} required value={amount} onChange={e => setAmount(e.target.value)} className={input} />
      </div>
      <div>
        <label className={labelCls}>Direction</label>
        <select value={direction} onChange={e => setDirection(e.target.value as PartnerHotelDirection)} className={input}>
          <option value="hotel_to_us">Hotel paid us</option>
          <option value="us_to_hotel">We paid the hotel</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>Note</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} className={input} />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm">Cancel</button>
        <button type="submit" className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium">Save</button>
      </div>
    </form>
  )
}

// ── Tab ────────────────────────────────────────────────────────────────────────

interface Props {
  hotel:             PartnerHotel
  stays:             PartnerHotelStay[]     // this hotel's only
  payments:          PartnerHotelPayment[]  // this hotel's only
  bookings:          HotelBookingRef[]
  participantCounts: Record<string, number>
  safaris:           ActivityBooking[]      // to prefill the nights around a safari
  shareLink:         SharedLink | undefined
  eurMznRate:        number
  onStaysChanged:    () => void
  onPaymentsChanged: () => void
  onHotelChanged:    () => void
  onLinksChanged:    () => void
}

type Period = 'upcoming' | 'past' | 'all'

export default function PartnerHotelTab({
  hotel, stays, payments, bookings, participantCounts, safaris, shareLink, eurMznRate,
  onStaysChanged, onPaymentsChanged, onHotelChanged, onLinksChanged,
}: Props) {
  const [period,      setPeriod]      = useState<Period>('upcoming')
  const [editing,     setEditing]     = useState<{ key: string; draft: Draft } | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [rate,        setRate]        = useState(String(hotel.default_room_rate_mzn))
  const [pct,         setPct]         = useState(String(hotel.commission_pct))
  const [copied,      setCopied]      = useState(false)

  const today = todayISO()
  const groups = groupStays(stays)
    .filter(g => period === 'all' || (period === 'upcoming' ? g.end >= today : g.end < today))
  if (period === 'past') groups.reverse()
  const visibleStays = groups.flatMap(g => g.stays)

  const balance = hotelBalanceMzn(stays, payments)
  const visibleCommission = groups.reduce((s, g) => s + g.commissionMzn, 0)

  function newDraft(): Draft {
    return {
      groupId: null,
      common: {
        booking_id: null, display_name: '', nb_persons: 2, couples_count: 0, children_count: 0,
        rooms: [{ label: '', rate_mzn: hotel.default_room_rate_mzn }],
        commission_pct: hotel.commission_pct, paid_by: 'guest_to_hotel', guests_paid: false,
        notes: null, internal_notes: null,
      },
      // The usual case: arrival night, safari, return night.
      nights: [blankNight(), blankNight()],
    }
  }

  function draftOf(groupStays: PartnerHotelStay[]): Draft {
    const f = groupStays[0]
    return {
      groupId: stayGroupKey(f),
      common: {
        booking_id: f.booking_id, display_name: f.display_name,
        nb_persons: f.nb_persons, couples_count: f.couples_count, children_count: f.children_count,
        rooms: f.rooms, commission_pct: f.commission_pct, paid_by: f.paid_by,
        guests_paid: groupStays.every(s => s.guests_paid),
        notes: f.notes, internal_notes: f.internal_notes,
      },
      nights: groupStays.map(s => ({
        id: s.id, check_in: s.check_in, check_out: s.check_out,
        airport_transfer: s.airport_transfer, transfer_time: s.transfer_time,
        departure_transfer: s.departure_transfer ?? false, departure_transfer_time: s.departure_transfer_time ?? null,
        big_bags: s.big_bags, hotel_confirmed: s.hotel_confirmed,
      })),
    }
  }

  // One reservation = one row per night, all carrying the shared fields and
  // the same group_id. Existing nights are updated, new ones inserted, removed
  // ones deleted; every failure is reported together.
  async function saveReservation(d: Draft) {
    const groupId = d.groupId ?? crypto.randomUUID()
    const before = editing ? stays.filter(s => stayGroupKey(s) === editing.key) : []
    const keptIds = new Set(d.nights.map(n => n.id).filter(Boolean))
    const errors: string[] = []

    for (const n of d.nights) {
      const { id, ...night } = n
      const row = { ...d.common, ...night, hotel_id: hotel.id, group_id: groupId }
      const { error } = id
        ? await supabase.from('partner_hotel_stays').update(row).eq('id', id)
        : await supabase.from('partner_hotel_stays').insert([row])
      if (error) errors.push(error.message)
    }
    for (const s of before.filter(s => !keptIds.has(s.id))) {
      const { error } = await supabase.from('partner_hotel_stays').delete().eq('id', s.id)
      if (error) errors.push(error.message)
    }

    onStaysChanged()
    if (errors.length) { report('save the whole reservation', { message: errors.join('\n') }); return }
    setEditing(null)
  }

  async function toggle(s: PartnerHotelStay, field: 'hotel_confirmed' | 'guests_paid') {
    const { error } = await supabase.from('partner_hotel_stays').update({ [field]: !s[field] }).eq('id', s.id)
    report('update the stay', error)
    onStaysChanged()
  }

  async function deleteStays(ids: string[], what: string) {
    if (!confirm(`Delete ${what}?`)) return
    const { error } = await supabase.from('partner_hotel_stays').delete().in('id', ids)
    report(`delete ${what}`, error)
    onStaysChanged()
  }

  async function addPayment(p: Omit<PartnerHotelPayment, 'id' | 'created_at'>) {
    const { error } = await supabase.from('partner_hotel_payments').insert([p])
    if (!report('record the payment', error)) return
    setShowPayment(false)
    onPaymentsChanged()
  }

  async function deletePayment(id: string) {
    if (!confirm('Delete this payment?')) return
    const { error } = await supabase.from('partner_hotel_payments').delete().eq('id', id)
    report('delete the payment', error)
    onPaymentsChanged()
  }

  async function saveSettings() {
    const { error } = await supabase.from('partner_hotels')
      .update({ default_room_rate_mzn: Number(rate) || 0, commission_pct: Number(pct) || 0 })
      .eq('id', hotel.id)
    if (!report('save the hotel settings', error)) return
    setShowSettings(false)
    onHotelChanged()
  }

  async function createLink() {
    const { error } = await supabase.from('shared_links').insert([{
      token:      `partner_hotel_${crypto.randomUUID()}`,
      type:       'partner_hotel',
      label:      `Partner hotel: ${hotel.name}`,
      params:     { hotel_id: hotel.id },
      created_at: todayISO(),
      expires_at: addDaysISO(todayISO(), 365), is_active: true,
    }])
    if (!report('create the share link', error)) return
    onLinksChanged()
  }

  const shareUrl = shareLink
    ? `${window.location.protocol}//${window.location.host}?share=${shareLink.token}`
    : null

  function copyLink() {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  const shortName = hotel.name.replace(/^Hotel\s+/i, '')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[12rem]">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">🏨 {hotel.name}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Default {fmtMzn(hotel.default_room_rate_mzn)} / room / night · our commission {hotel.commission_pct}%
            <button onClick={() => setShowSettings(v => !v)} className="ml-2 text-blue-600 dark:text-blue-400 hover:underline">edit</button>
          </p>
        </div>
        {shareUrl ? (
          <button onClick={copyLink}
            className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
            {copied ? '✓ Copied' : '🔗 Copy hotel link'}
          </button>
        ) : (
          <button onClick={createLink}
            className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
            🔗 Create hotel link
          </button>
        )}
        <button onClick={() => setEditing({ key: 'new', draft: newDraft() })}
          className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold text-sm">+ Add reservation</button>
      </div>

      {showSettings && (
        <div className="flex flex-wrap gap-3 items-end bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <div>
            <label className={labelCls}>Default room rate (MZN / night)</label>
            <input type="number" min={0} value={rate} onChange={e => setRate(e.target.value)} className={input} />
          </div>
          <div>
            <label className={labelCls}>Commission %</label>
            <input type="number" min={0} max={100} step="0.5" value={pct} onChange={e => setPct(e.target.value)} className={input} />
          </div>
          <button onClick={saveSettings} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">Save</button>
          <p className="text-xs text-gray-500 dark:text-gray-400 basis-full">Applies to new reservations only — existing ones keep their own prices and commission.</p>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Our commission ({period})</p>
          <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{fmtMzn(visibleCommission)}</p>
          <p className="text-xs text-gray-400">≈ {commissionEur(visibleStays, eurMznRate)} €</p>
        </div>
        <div className={`rounded-xl border p-4 ${balance > 0
          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
          : balance < 0 ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'}`}>
          <p className="text-xs text-gray-500 dark:text-gray-400">Balance (stays the guests have paid)</p>
          <p className="text-lg font-bold text-gray-800 dark:text-gray-200">
            {balance === 0 ? 'Settled' : balance > 0 ? `Hotel owes us ${fmtMzn(balance)}` : `We owe the hotel ${fmtMzn(-balance)}`}
          </p>
          <button onClick={() => setShowPayment(true)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">+ Record a payment</button>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Nights waiting for hotel confirmation</p>
          <p className="text-lg font-bold text-gray-800 dark:text-gray-200">
            {stays.filter(s => !s.hotel_confirmed && s.check_out >= today).length}
          </p>
        </div>
      </div>

      {showPayment && (
        <PaymentForm hotelId={hotel.id} suggested={balance}
          onSave={addPayment} onCancel={() => setShowPayment(false)} />
      )}

      {editing && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">{editing.draft.groupId ? 'Edit reservation' : 'New reservation'}</h3>
          <ReservationForm key={editing.key} hotel={hotel} initial={editing.draft}
            bookings={bookings} participantCounts={participantCounts} safaris={safaris}
            onSave={saveReservation} onCancel={() => setEditing(null)} />
        </div>
      )}

      {/* Reservations */}
      <div className="flex gap-2">
        {(['upcoming', 'past', 'all'] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${period === p
              ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
            {p === 'upcoming' ? 'Upcoming' : p === 'past' ? 'Past' : 'All'}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-8 text-center">No reservations.</p>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 border-b text-gray-500 dark:text-gray-400 text-xs text-left whitespace-nowrap">
                <th className="px-3 py-3 font-medium">Night</th>
                <th className="px-3 py-3 font-medium">Dates</th>
                <th className="px-3 py-3 font-medium text-center">Nights</th>
                <th className="px-3 py-3 font-medium">Airport transfers</th>
                <th className="px-3 py-3 font-medium text-center">Big bags</th>
                <th className="px-3 py-3 font-medium text-center">{shortName} confirmed?</th>
                <th className="px-3 py-3 font-medium text-center">Guests paid?</th>
                <th className="px-3 py-3 font-medium text-right">Total</th>
                <th className="px-3 py-3 font-medium text-right">Our share</th>
                <th className="px-3 py-3 font-medium text-right">Owed</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {groups.map(g => {
                const f = g.first
                const owed = g.stays.reduce((s, st) => s + stayExpectedMzn(st), 0)
                const bookingNo = f.booking_id ? bookings.find(b => b.id === f.booking_id)?.booking_number : null
                return [
                  // Reservation header: what every night shares.
                  <tr key={g.key} className="bg-sky-50/60 dark:bg-sky-900/10 border-t-2 border-gray-200 dark:border-gray-700">
                    <td colSpan={7} className="px-3 py-2">
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{f.display_name}</span>
                      {bookingNo != null && <span className="text-xs text-gray-400 ml-2">#{bookingNo}</span>}
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-3">{paxLabel(f)}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-3">
                        {f.rooms.map(r => `${r.label || 'Room'} ${fmtMzn(r.rate_mzn)}`).join(' + ') || 'no room'}
                      </span>
                      <span className="text-xs text-gray-400 ml-3">guests pay {f.paid_by === 'guest_to_hotel' ? 'the hotel' : 'us'}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">{fmtMzn(g.totalMzn)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">{fmtMzn(g.commissionMzn)}</td>
                    <td className={`px-3 py-2 text-right text-xs font-semibold whitespace-nowrap ${owed > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-orange-700 dark:text-orange-400'}`}>
                      {owed > 0 ? `Hotel → us ${fmtMzn(owed)}` : `Us → hotel ${fmtMzn(-owed)}`}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex gap-1 justify-end">
                        <button title="Edit the reservation" onClick={() => setEditing({ key: g.key, draft: draftOf(g.stays) })}
                          className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 px-1">✏️</button>
                        <button title="Delete the whole reservation" onClick={() => deleteStays(g.stays.map(s => s.id), 'this reservation (all its nights)')}
                          className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 px-1">✕</button>
                      </div>
                    </td>
                  </tr>,
                  ...g.stays.flatMap((s, i) => {
                    const expected = stayExpectedMzn(s)
                    const absence = i > 0 ? g.absences.find(a => a.to === s.check_in) : undefined
                    return [
                      ...(absence ? [
                        <tr key={`${s.id}-away`}>
                          <td colSpan={11} className="px-3 py-1 text-xs text-gray-400 italic text-center">
                            — away {fmtDate(absence.from)} → {fmtDate(absence.to)} (safari) —
                          </td>
                        </tr>,
                      ] : []),
                      <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-3 py-2 pl-6 text-xs font-medium text-gray-500 dark:text-gray-400">{nightLabel(i, g.stays.length)}</td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmtDate(s.check_in)} → {fmtDate(s.check_out)}</td>
                        <td className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">{stayNights(s)}</td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {!s.airport_transfer && !s.departure_transfer && '–'}
                          {s.airport_transfer && <div title="Airport pick-up, check-in day">🛬 {fmtDate(s.check_in)} {s.transfer_time ?? 'time?'}</div>}
                          {s.departure_transfer && <div title="Airport drop-off, check-out day">🛫 {fmtDate(s.check_out)} {s.departure_transfer_time ?? 'time?'}</div>}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">{s.big_bags || '–'}</td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => toggle(s, 'hotel_confirmed')}
                            className={`px-2 py-0.5 rounded text-xs font-medium ${s.hotel_confirmed
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'}`}>
                            {s.hotel_confirmed ? '✓ Yes' : 'Pending'}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => toggle(s, 'guests_paid')}
                            className={`px-2 py-0.5 rounded text-xs font-medium ${s.guests_paid
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                            {s.guests_paid ? '✓ Paid' : 'No'}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">{fmtMzn(stayTotalMzn(s))}</td>
                        <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">
                          {fmtMzn(stayCommissionMzn(s))} <span className="text-[10px] text-gray-400">({s.commission_pct}%)</span>
                        </td>
                        <td className={`px-3 py-2 text-right whitespace-nowrap text-xs ${s.guests_paid ? '' : 'text-gray-400 italic'} ${
                          expected > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-orange-700 dark:text-orange-400'}`}>
                          {expected > 0 ? `+${fmtMzn(expected)}` : `−${fmtMzn(-expected)}`}
                          {!s.guests_paid && <div>(once paid)</div>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {g.stays.length > 1 && (
                            <button title="Delete this night only" onClick={() => deleteStays([s.id], 'this night')}
                              className="text-gray-300 dark:text-gray-600 hover:text-red-600 dark:hover:text-red-400 px-1 text-xs">✕</button>
                          )}
                        </td>
                      </tr>,
                    ]
                  }),
                ]
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Settlements */}
      <div>
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-2">Payments between {hotel.name} and us</h3>
        {payments.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No payment recorded yet.</p>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmtDate(p.date)}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${p.direction === 'hotel_to_us'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'}`}>
                        {p.direction === 'hotel_to_us' ? 'Hotel paid us' : 'We paid the hotel'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">{fmtMzn(p.amount_mzn)}</td>
                    <td className="px-3 py-2 text-gray-400 italic text-xs">{p.notes ?? ''}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => deletePayment(p.id)} className="text-gray-300 dark:text-gray-500 hover:text-red-500">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
