// One tab of /activities per partner hotel (Hotel CasaMoz, Maputo).
// Stays the hotel hosts for our guests, the money each one moves, and the
// settlements between the hotel and us. Design: .claude/docs/data-model.md
// § Partner hotels. Money logic (tested): utils/partnerHotel.ts.
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import type {
  PartnerHotel, PartnerHotelStay, PartnerHotelPayment, PartnerHotelRoom,
  PartnerHotelPaidBy, PartnerHotelDirection, SharedLink,
} from '../../types/database'
import { todayISO, addDaysISO, fmtDate } from '../../utils/dates'
import {
  stayNights, stayTotalMzn, stayCommissionMzn, stayExpectedMzn,
  hotelBalanceMzn, commissionEur, fmtMzn,
} from '../../utils/partnerHotel'

/** A booking as this tab needs it: enough to prefill a stay. */
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

type StayDraft = Omit<PartnerHotelStay, 'id' | 'created_at'>

const input = 'w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400'
const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

function bookingName(b: HotelBookingRef): string {
  return b.client ? `${b.client.first_name} ${b.client.last_name}`.trim() : `#${b.booking_number}`
}

function report(action: string, error: { message: string } | null): boolean {
  if (!error) return true
  console.error(`${action} failed:`, error.message)
  alert(`Could not ${action}.\n\n${error.message}`)
  return false
}

// ── Stay form ──────────────────────────────────────────────────────────────────

interface StayFormProps {
  hotel:             PartnerHotel
  initial:           StayDraft
  bookings:          HotelBookingRef[]
  participantCounts: Record<string, number>
  onSave:            (s: StayDraft) => Promise<void>
  onCancel:          () => void
}

function StayForm({ hotel, initial, bookings, participantCounts, onSave, onCancel }: StayFormProps) {
  const [s, setS] = useState<StayDraft>(initial)
  const set = <K extends keyof StayDraft>(k: K, v: StayDraft[K]) => setS(prev => ({ ...prev, [k]: v }))

  // Picking a booking prefills what the booking already knows; every field
  // stays editable — not all the group necessarily goes through Maputo.
  function pickBooking(id: string) {
    const b = bookings.find(x => x.id === id)
    if (!b) { set('booking_id', null); return }
    setS(prev => ({
      ...prev,
      booking_id:     b.id,
      display_name:   bookingName(b),
      nb_persons:     participantCounts[b.id] || prev.nb_persons,
      couples_count:  b.couples_count ?? 0,
      children_count: b.children_count ?? 0,
      big_bags:       b.boardbag_count ?? 0,
    }))
  }

  function setRoom(i: number, patch: Partial<PartnerHotelRoom>) {
    set('rooms', s.rooms.map((r, j) => j === i ? { ...r, ...patch } : r))
  }

  const nights = s.check_in && s.check_out ? stayNights(s) : 0
  const total = stayTotalMzn(s)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (s.check_out <= s.check_in) { alert('Check-out must be after check-in.'); return }
    await onSave({
      ...s,
      display_name:  s.display_name.trim(),
      transfer_time: s.airport_transfer ? (s.transfer_time || null) : null,
      notes:          s.notes?.trim() || null,
      internal_notes: s.internal_notes?.trim() || null,
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="col-span-2">
          <label className={labelCls}>Booking</label>
          <select value={s.booking_id ?? ''} onChange={e => pickBooking(e.target.value)} className={input}>
            <option value="">— None —</option>
            {bookings.map(b => (
              <option key={b.id} value={b.id}>#{b.booking_number} {bookingName(b)} · {fmtDate(b.check_in)}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Name shown to the hotel *</label>
          <input required value={s.display_name} onChange={e => set('display_name', e.target.value)} className={input} />
        </div>
        <div>
          <label className={labelCls}>Check-in *</label>
          <input type="date" required value={s.check_in} onChange={e => set('check_in', e.target.value)} className={input} />
        </div>
        <div>
          <label className={labelCls}>Check-out *</label>
          <input type="date" required value={s.check_out} onChange={e => set('check_out', e.target.value)} className={input} />
        </div>
        <div>
          <label className={labelCls}>Persons</label>
          <input type="number" min={0} value={s.nb_persons} onChange={e => set('nb_persons', Number(e.target.value))} className={input} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Couples</label>
            <input type="number" min={0} value={s.couples_count} onChange={e => set('couples_count', Number(e.target.value))} className={input} />
          </div>
          <div>
            <label className={labelCls}>Children</label>
            <input type="number" min={0} value={s.children_count} onChange={e => set('children_count', Number(e.target.value))} className={input} />
          </div>
        </div>
      </div>

      {/* Rooms */}
      <div>
        <label className={labelCls}>Rooms (price per night, MZN)</label>
        <div className="space-y-2">
          {s.rooms.map((r, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input placeholder="Room (e.g. Double)" value={r.label} onChange={e => setRoom(i, { label: e.target.value })} className={input} />
              <input type="number" min={0} value={r.rate_mzn} onChange={e => setRoom(i, { rate_mzn: Number(e.target.value) })} className={`${input} max-w-[9rem]`} />
              <button type="button" onClick={() => set('rooms', s.rooms.filter((_, j) => j !== i))}
                className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 px-2">✕</button>
            </div>
          ))}
          <button type="button"
            onClick={() => set('rooms', [...s.rooms, { label: '', rate_mzn: hotel.default_room_rate_mzn }])}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline">+ Add a room</button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          {nights} night{nights === 1 ? '' : 's'} · total {fmtMzn(total)} · our {s.commission_pct}% = {fmtMzn(stayCommissionMzn(s))}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input type="checkbox" checked={s.airport_transfer} onChange={e => set('airport_transfer', e.target.checked)} className="w-4 h-4 rounded" />
          Airport transfer
        </label>
        <div>
          <label className={labelCls}>Transfer time</label>
          <input type="time" disabled={!s.airport_transfer} value={s.transfer_time ?? ''}
            onChange={e => set('transfer_time', e.target.value)} className={`${input} disabled:opacity-40`} />
        </div>
        <div>
          <label className={labelCls}>Big bags</label>
          <input type="number" min={0} value={s.big_bags} onChange={e => set('big_bags', Number(e.target.value))} className={input} />
        </div>
        <div>
          <label className={labelCls}>Guests pay</label>
          <select value={s.paid_by} onChange={e => set('paid_by', e.target.value as PartnerHotelPaidBy)} className={input}>
            <option value="guest_to_hotel">The hotel</option>
            <option value="guest_to_us">Us</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input type="checkbox" checked={s.hotel_confirmed} onChange={e => set('hotel_confirmed', e.target.checked)} className="w-4 h-4 rounded" />
          Confirmed by the hotel
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input type="checkbox" checked={s.guests_paid} onChange={e => set('guests_paid', e.target.checked)} className="w-4 h-4 rounded" />
          Guests have paid
        </label>
        <div>
          <label className={labelCls}>Commission %</label>
          <input type="number" min={0} max={100} step="0.5" value={s.commission_pct}
            onChange={e => set('commission_pct', Number(e.target.value))} className={input} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Notes (visible to the hotel)</label>
          <textarea rows={2} value={s.notes ?? ''} onChange={e => set('notes', e.target.value)} className={input} />
        </div>
        <div>
          <label className={labelCls}>Internal notes (never shown to the hotel)</label>
          <textarea rows={2} value={s.internal_notes ?? ''} onChange={e => set('internal_notes', e.target.value)} className={input} />
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
  shareLink:         SharedLink | undefined
  eurMznRate:        number
  onStaysChanged:    () => void
  onPaymentsChanged: () => void
  onHotelChanged:    () => void
  onLinksChanged:    () => void
}

type Period = 'upcoming' | 'past' | 'all'

export default function PartnerHotelTab({
  hotel, stays, payments, bookings, participantCounts, shareLink, eurMznRate,
  onStaysChanged, onPaymentsChanged, onHotelChanged, onLinksChanged,
}: Props) {
  const [period,      setPeriod]      = useState<Period>('upcoming')
  const [editing,     setEditing]     = useState<{ id: string | null; draft: StayDraft } | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [rate,        setRate]        = useState(String(hotel.default_room_rate_mzn))
  const [pct,         setPct]         = useState(String(hotel.commission_pct))
  const [copied,      setCopied]      = useState(false)

  const today = todayISO()
  const visible = stays
    .filter(s => period === 'all' || (period === 'upcoming' ? s.check_out >= today : s.check_out < today))
    .sort((a, b) => period === 'past' ? b.check_in.localeCompare(a.check_in) : a.check_in.localeCompare(b.check_in))

  // Group the stays of one booking together (before / after the safari),
  // ordered by the first stay of each group.
  const groups: PartnerHotelStay[][] = []
  for (const s of visible) {
    const key = s.booking_id ?? `solo-${s.id}`
    const g = groups.find(g => (g[0].booking_id ?? `solo-${g[0].id}`) === key)
    if (g) g.push(s); else groups.push([s])
  }

  const balance = hotelBalanceMzn(stays, payments)
  const visibleCommission = visible.reduce((s, st) => s + stayCommissionMzn(st), 0)

  function blankDraft(): StayDraft {
    return {
      hotel_id: hotel.id, booking_id: null, display_name: '',
      check_in: '', check_out: '',
      nb_persons: 2, couples_count: 0, children_count: 0,
      rooms: [{ label: '', rate_mzn: hotel.default_room_rate_mzn }],
      commission_pct: hotel.commission_pct,
      airport_transfer: false, transfer_time: null, big_bags: 0,
      hotel_confirmed: false, guests_paid: false, paid_by: 'guest_to_hotel',
      notes: null, internal_notes: null,
    }
  }

  function draftOf(s: PartnerHotelStay): StayDraft {
    const { id: _id, created_at: _c, ...rest } = s
    return rest
  }

  async function saveStay(d: StayDraft) {
    const { error } = editing?.id
      ? await supabase.from('partner_hotel_stays').update(d).eq('id', editing.id)
      : await supabase.from('partner_hotel_stays').insert([d])
    if (!report('save the stay', error)) return
    setEditing(null)
    onStaysChanged()
  }

  async function toggle(s: PartnerHotelStay, field: 'hotel_confirmed' | 'guests_paid') {
    const { error } = await supabase.from('partner_hotel_stays').update({ [field]: !s[field] }).eq('id', s.id)
    report('update the stay', error)
    onStaysChanged()
  }

  async function deleteStay(id: string) {
    if (!confirm('Delete this stay?')) return
    const { error } = await supabase.from('partner_hotel_stays').delete().eq('id', id)
    report('delete the stay', error)
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
        <button onClick={() => setEditing({ id: null, draft: blankDraft() })}
          className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold text-sm">+ Add stay</button>
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
          <p className="text-xs text-gray-500 dark:text-gray-400 basis-full">Applies to new stays only — existing stays keep their own prices and commission.</p>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Our commission ({period})</p>
          <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{fmtMzn(visibleCommission)}</p>
          <p className="text-xs text-gray-400">≈ {commissionEur(visible, eurMznRate)} €</p>
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
          <p className="text-xs text-gray-500 dark:text-gray-400">Waiting for hotel confirmation</p>
          <p className="text-lg font-bold text-gray-800 dark:text-gray-200">
            {stays.filter(s => !s.hotel_confirmed && s.check_out >= today).length} stay(s)
          </p>
        </div>
      </div>

      {showPayment && (
        <PaymentForm hotelId={hotel.id} suggested={balance}
          onSave={addPayment} onCancel={() => setShowPayment(false)} />
      )}

      {editing && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">{editing.id ? 'Edit stay' : 'New stay'}</h3>
          <StayForm key={editing.id ?? JSON.stringify(editing.draft)} hotel={hotel} initial={editing.draft}
            bookings={bookings} participantCounts={participantCounts}
            onSave={saveStay} onCancel={() => setEditing(null)} />
        </div>
      )}

      {/* Stays */}
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
        <p className="text-sm text-gray-400 italic py-8 text-center">No stays.</p>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 border-b text-gray-500 dark:text-gray-400 text-xs text-left whitespace-nowrap">
                <th className="px-3 py-3 font-medium">Booking</th>
                <th className="px-3 py-3 font-medium">Pax</th>
                <th className="px-3 py-3 font-medium">Dates</th>
                <th className="px-3 py-3 font-medium text-center">Nights</th>
                <th className="px-3 py-3 font-medium">Rooms</th>
                <th className="px-3 py-3 font-medium">Airport transfer</th>
                <th className="px-3 py-3 font-medium text-center">Big bags</th>
                <th className="px-3 py-3 font-medium text-center">{hotel.name.replace(/^Hotel\s+/i, '')} confirmed?</th>
                <th className="px-3 py-3 font-medium text-center">Guests paid?</th>
                <th className="px-3 py-3 font-medium text-right">Total</th>
                <th className="px-3 py-3 font-medium text-right">Our share</th>
                <th className="px-3 py-3 font-medium text-right">Owed</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {groups.map(g => g.map((s, i) => {
                const expected = stayExpectedMzn(s)
                return (
                  <tr key={s.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${i === g.length - 1 ? 'border-b' : ''}`}>
                    <td className="px-3 py-2 align-top">
                      {i === 0 && (
                        <>
                          <div className="font-medium text-gray-800 dark:text-gray-200">{s.display_name}</div>
                          {s.booking_id && (
                            <div className="text-xs text-gray-400">#{bookings.find(b => b.id === s.booking_id)?.booking_number ?? '?'}</div>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {s.nb_persons}
                      {(s.couples_count > 0 || s.children_count > 0) && (
                        <span className="text-xs text-gray-400"> ({[
                          s.couples_count > 0 && `${s.couples_count} couple${s.couples_count > 1 ? 's' : ''}`,
                          s.children_count > 0 && `${s.children_count} child${s.children_count > 1 ? 'ren' : ''}`,
                        ].filter(Boolean).join(', ')})</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmtDate(s.check_in)} → {fmtDate(s.check_out)}</td>
                    <td className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">{stayNights(s)}</td>
                    <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                      {s.rooms.map((r, j) => <div key={j}>{r.label || 'Room'} · {fmtMzn(r.rate_mzn)}</div>)}
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {s.airport_transfer ? `✈️ ${s.transfer_time ?? 'time?'}` : '–'}
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
                      <div className="text-[10px] text-gray-400 mt-0.5">{s.paid_by === 'guest_to_hotel' ? 'to the hotel' : 'to us'}</div>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmtMzn(stayTotalMzn(s))}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {fmtMzn(stayCommissionMzn(s))}
                      <div className="text-[10px] text-gray-400">{s.commission_pct}%</div>
                    </td>
                    <td className={`px-3 py-2 text-right whitespace-nowrap text-xs ${s.guests_paid ? 'font-semibold' : 'text-gray-400 italic'} ${
                      expected > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-orange-700 dark:text-orange-400'}`}>
                      {expected > 0 ? `Hotel → us ${fmtMzn(expected)}` : `Us → hotel ${fmtMzn(-expected)}`}
                      {!s.guests_paid && <div>(once paid)</div>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex gap-1 justify-end">
                        <button title="Edit" onClick={() => setEditing({ id: s.id, draft: draftOf(s) })}
                          className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 px-1">✏️</button>
                        <button title="Add the next stay of this booking (after the safari)"
                          onClick={() => setEditing({ id: null, draft: {
                            ...draftOf(s), check_in: '', check_out: '',
                            hotel_confirmed: false, guests_paid: false, airport_transfer: false, transfer_time: null,
                          } })}
                          className="text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 px-1">⧉</button>
                        <button title="Delete" onClick={() => deleteStay(s.id)}
                          className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 px-1">✕</button>
                      </div>
                    </td>
                  </tr>
                )
              }))}
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
