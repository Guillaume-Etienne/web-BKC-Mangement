import { useState } from 'react'
import type { SharedAccountingData, AccountingHandlers } from './types'
import type { Payment, PaymentMethod, Booking, EquipmentRental } from '../../types/database'
import { lessonBillable } from '../../types/database'
import {
  computeBookingTotal, computeBookingPaid, computeBookingDiscounts,
  computeAccommodationRevenue, computeExternalAccommodationCost, computeLessonsRevenue, computeRentalsRevenue,
  computeTaxiRevenue, computeActivityRevenueForBooking, computeCenterAccessRevenue,
  computeDiningForBooking, getLessonClientRate, getConfiguredRate, computeStandaloneTaxiRevenue,
  fmtEur, suggestDeposit, countNights, getRoomNightlyRate,
} from './utils'
import { todayISO } from '../../utils/dates'

interface Props { data: SharedAccountingData; handlers: AccountingHandlers }

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash_eur:        'Cash EUR',
  cash_mzn:        'Cash MZN',
  transfer:        'Transfer',
  card_palmeiras:  'Card (Palmeiras)',
}

const METHOD_COLORS: Record<PaymentMethod, string> = {
  cash_eur:       'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400',
  cash_mzn:       'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-400',
  transfer:       'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400',
  card_palmeiras: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400',
}

// ── Edit Room Price Form (module-scope) ────────────────────────────────────

interface EditRoomPriceFormProps {
  bookingId: string
  roomId: string
  currentPrice: number
  currentNote: string | null
  onSave: (p: { booking_id: string; room_id: string; price_per_night: number; override_note: string | null }) => void
  onCancel: () => void
}
function EditRoomPriceForm({ bookingId, roomId, currentPrice, currentNote, onSave, onCancel }: EditRoomPriceFormProps) {
  const [price, setPrice] = useState(String(currentPrice))
  const [note, setNote] = useState(currentNote ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(price)
    if (isNaN(parsed) || parsed < 0) return
    onSave({
      booking_id: bookingId,
      room_id: roomId,
      price_per_night: parsed,
      override_note: note.trim() || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-1">
      <input type="number" min="0" step="0.5" value={price} onChange={e => setPrice(e.target.value)}
        autoFocus
        className="w-20 px-2 py-0.5 border border-blue-300 dark:border-blue-800 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
      <span className="text-xs text-gray-400 dark:text-gray-500">€/n</span>
      <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Note"
        className="w-28 px-2 py-0.5 border border-gray-300 dark:border-gray-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
      <button type="submit" className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">✓</button>
      <button type="button" onClick={onCancel} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-700">✕</button>
    </form>
  )
}

// ── Edit Rental Price Form (module-scope) ──────────────────────────────────

interface EditRentalFormProps {
  rental: EquipmentRental
  onSave: (r: EquipmentRental) => void
  onCancel: () => void
}
function EditRentalForm({ rental, onSave, onCancel }: EditRentalFormProps) {
  const [price, setPrice] = useState(String(rental.price))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(price)
    if (isNaN(parsed) || parsed < 0) return
    onSave({ ...rental, price: parsed })
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-1">
      <input type="number" min="0" step="0.5" value={price} onChange={e => setPrice(e.target.value)}
        autoFocus
        className="w-24 px-2 py-0.5 border border-blue-300 dark:border-blue-800 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
      <span className="text-xs text-gray-400 dark:text-gray-500">€</span>
      <button type="submit" className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">✓</button>
      <button type="button" onClick={onCancel} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-700">✕</button>
    </form>
  )
}

// ── Lesson client price form (module-scope) ─────────────────────────────────
// Edits what the CLIENT is billed for this lesson. The instructor payout is a
// separate scale, adjusted from the Instructors tab.

interface LessonPriceFormProps {
  currentRate: number
  isCustom: boolean
  listRate: number
  onSave: (pricePerHour: number) => void
  onReset: () => void
  onCancel: () => void
}
function LessonPriceForm({ currentRate, isCustom, listRate, onSave, onReset, onCancel }: LessonPriceFormProps) {
  const [rate, setRate] = useState(String(currentRate))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(rate)
    if (isNaN(parsed) || parsed < 0) return
    onSave(parsed)
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1 p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded space-y-1.5">
      <div className="flex items-end gap-2">
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">Client price (€/h)</label>
          <input type="number" min="0" step="0.5" value={rate} onChange={e => setRate(e.target.value)} autoFocus
            className="w-24 px-2 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 pb-1">Price list: {fmtEur(listRate)}/h</p>
      </div>
      <div className="flex gap-1">
        <button type="button" onClick={onCancel}
          className="px-2 py-0.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
        {isCustom && (
          <button type="button" onClick={onReset}
            className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs hover:bg-red-200 dark:hover:bg-red-800">Back to price list</button>
        )}
        <button type="submit"
          className="flex-1 px-2 py-0.5 bg-amber-600 text-white rounded text-xs font-semibold hover:bg-amber-700">Save</button>
      </div>
    </form>
  )
}

// ── Discount Form (module-scope) ────────────────────────────────────────────

interface DiscountFormProps {
  bookingId: string
  initial?: Payment
  onSave: (p: Payment) => void
  onCancel: () => void
}

function DiscountForm({ bookingId, initial, onSave, onCancel }: DiscountFormProps) {
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [notes,  setNotes]  = useState(initial?.notes ?? '')
  const [date,   setDate]   = useState(initial?.date ?? todayISO())

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) return
    onSave({
      id:          initial?.id ?? `pay_${Date.now()}`,
      booking_id:  bookingId,
      date,
      amount:      parsed,
      method:      'transfer',
      is_deposit:  false,
      is_verified: true,
      is_discount: true,
      notes:       notes || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 rounded-lg p-4 space-y-3">
      <p className="text-sm font-semibold text-purple-800 dark:text-purple-400">{initial ? 'Edit discount' : 'Add discount'}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Amount (€)</label>
          <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} autoFocus
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Reason</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Loyalty discount"
          className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
          Cancel
        </button>
        <button type="submit"
          className="flex-1 px-3 py-1.5 bg-purple-600 text-white rounded text-sm font-semibold hover:bg-purple-700">
          {initial ? 'Update' : 'Save discount'}
        </button>
      </div>
    </form>
  )
}

// ── Payment Form (module-scope) — used for Add and Edit ────────────────────

interface PaymentFormProps {
  bookingId: string
  initial?: Payment
  suggestedDeposit?: number
  onSave: (p: Payment) => void
  onCancel: () => void
}

function PaymentForm({ bookingId, initial, suggestedDeposit = 0, onSave, onCancel }: PaymentFormProps) {
  const [amount,     setAmount]     = useState(initial ? String(initial.amount) : String(suggestedDeposit))
  const [method,     setMethod]     = useState<PaymentMethod>(initial?.method ?? 'transfer')
  const [isDeposit,  setIsDeposit]  = useState(initial?.is_deposit ?? false)
  const [isVerified, setIsVerified] = useState(initial?.is_verified ?? true)
  const [notes,      setNotes]      = useState(initial?.notes ?? '')
  const [date,       setDate]       = useState(initial?.date ?? todayISO())

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) return
    onSave({
      id:          initial?.id ?? `pay_${Date.now()}`,
      booking_id:  bookingId,
      date,
      amount:      parsed,
      method,
      is_deposit:  isDeposit,
      is_verified: isVerified,
      is_discount: false,
      notes:       notes || null,
    })
  }

  const isEdit = !!initial

  return (
    <form onSubmit={handleSubmit} className={`border rounded-lg p-4 space-y-3 ${isEdit ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900' : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900'}`}>
      <p className={`text-sm font-semibold ${isEdit ? 'text-amber-800 dark:text-amber-400' : 'text-blue-800 dark:text-blue-400'}`}>
        {isEdit ? 'Edit payment' : 'Add payment'}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Amount (€)</label>
          <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Method</label>
          <select value={method} onChange={e => setMethod(e.target.value as PaymentMethod)}
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-900">
            {(Object.entries(METHOD_LABELS) as [PaymentMethod, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Notes</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional"
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
          <input type="checkbox" checked={isDeposit} onChange={e => setIsDeposit(e.target.checked)} className="rounded" />
          Deposit
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
          <input type="checkbox" checked={isVerified} onChange={e => setIsVerified(e.target.checked)} className="rounded" />
          Verified
        </label>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
          Cancel
        </button>
        <button type="submit"
          className={`flex-1 px-3 py-1.5 text-white rounded text-sm font-semibold ${isEdit ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
          {isEdit ? 'Update' : 'Save payment'}
        </button>
      </div>
    </form>
  )
}

// ── Booking detail panel ───────────────────────────────────────────────────

interface DetailPanelProps {
  booking: Booking
  data: SharedAccountingData
  handlers: AccountingHandlers
}

function BookingDetailPanel({ booking: b, data, handlers }: DetailPanelProps) {
  const [showAddPayment, setShowAddPayment] = useState(false)
  const [showAddDiscount, setShowAddDiscount] = useState(false)
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [editingRoomPriceId, setEditingRoomPriceId] = useState<string | null>(null)
  const [editingRentalId, setEditingRentalId] = useState<string | null>(null)
  const [editingLessonPriceId, setEditingLessonPriceId] = useState<string | null>(null)

  const total        = computeBookingTotal(b, data)
  const discounts    = computeBookingDiscounts(b.id, data.payments)
  const paid         = computeBookingPaid(b.id, data.payments)
  const due          = total - discounts - paid
  const sugDeposit   = suggestDeposit(total)
  const nights       = countNights(b.check_in, b.check_out)
  const bkPayments   = data.payments.filter(p => p.booking_id === b.id)
    .sort((a, b) => a.date.localeCompare(b.date))

  // Breakdown lines
  const accommodationRev = computeAccommodationRevenue(b, data)
  void computeExternalAccommodationCost(b, data) // cost display is inline per external acc
  const lessonsRev       = computeLessonsRevenue(b, data)
  const rentalsRev       = computeRentalsRevenue(b, data)
  const taxiRev          = computeTaxiRevenue(b, data)
  const diningRev        = computeDiningForBooking(b, data.diningEvents, data.bookingParticipants)
  const activityRev      = computeActivityRevenueForBooking(b, data)
  const centerAccessRev  = computeCenterAccessRevenue(b)

  // Room detail
  const bkRooms = data.bookingRooms.filter(br => br.booking_id === b.id)
  const extAccomm = data.externalAccommodationBkgs.filter(e => e.booking_id === b.id)

  // Lessons detail
  const bkLessons = data.lessons.filter(l => l.booking_id === b.id)

  // Rental detail
  const bkRentals = data.equipmentRentals.filter(r => r.booking_id === b.id)

  // Taxi detail
  const bkTaxis = data.taxiTrips.filter(t => t.booking_id === b.id)

  // Activity detail (only we_pay_provider — client pays us)
  const bkActivities = data.activityBookings.filter(a => a.booking_id === b.id && a.payment_flow === 'we_pay_provider')

  // Participant name resolver
  const bkParts = data.bookingParticipants.filter(p => p.booking_id === b.id)
  const partName = (id: string) => {
    const p = bkParts.find(p => p.id === id)
    return p ? p.first_name : null
  }
  const partNames = (ids: string[]) => ids.map(partName).filter(Boolean).join(', ')

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-6">

      {/* Header totals */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Total</p>
          <p className="text-xl font-bold text-gray-800 dark:text-gray-200">{fmtEur(total)}</p>
          {nights > 0 && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{nights} nights</p>}
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-lg p-4 text-center">
          <p className="text-xs text-emerald-500 dark:text-emerald-400 uppercase tracking-wide mb-1">Paid</p>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{fmtEur(paid)}</p>
          {paid === 0 && <p className="text-xs text-amber-500 dark:text-amber-400 mt-1">Deposit suggested: {fmtEur(sugDeposit)}</p>}
        </div>
        <div className={`rounded-lg p-4 text-center ${due > 0 ? 'bg-amber-50 dark:bg-amber-950/40' : 'bg-emerald-50 dark:bg-emerald-950/40'}`}>
          <p className={`text-xs uppercase tracking-wide mb-1 ${due > 0 ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-500 dark:text-emerald-400'}`}>
            {due > 0 ? 'Outstanding' : 'Settled ✓'}
          </p>
          <p className={`text-xl font-bold ${due > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{fmtEur(due)}</p>
        </div>
      </div>

      {/* Price breakdown */}
      <div>
        <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">Price breakdown</p>
        <div className="space-y-2">

          {/* Accommodation */}
          {(bkRooms.length > 0 || extAccomm.length > 0) && (
            <div className="rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="flex justify-between items-center px-4 py-2 bg-gray-50 dark:bg-gray-800">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">🏠 Accommodation</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{fmtEur(accommodationRev)}</span>
              </div>
              <div className="px-4 py-2 space-y-1">
                {bkRooms.map(br => {
                  const room = data.rooms.find(r => r.id === br.room_id)
                  const acc = room ? data.accommodations.find(a => a.id === room.accommodation_id) : null
                  const rate = getRoomNightlyRate(b.id, br.room_id, data)
                  const snap = data.bookingRoomPrices.find(p => p.booking_id === b.id && p.room_id === br.room_id)
                  const isEditing = editingRoomPriceId === br.room_id
                  const roomLabel = acc ? `${acc.name}/${room?.name}` : (room?.name ?? br.room_id)
                  const hasNoPrice = !snap
                  return (
                    <div key={br.room_id} className="text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex justify-between items-center">
                        <span>
                          {roomLabel} × {nights}N @ {fmtEur(rate)}/N
                          {snap?.override_note && <span className="ml-2 text-amber-500 dark:text-amber-400 italic">({snap.override_note})</span>}
                          {hasNoPrice && (
                            <span className="ml-2 text-red-400 dark:text-red-300 font-medium">
                              {rate > 0 ? '⚠ base rate' : '⚠ no price'}
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <span>{fmtEur(rate * nights)}</span>
                          <button onClick={() => setEditingRoomPriceId(isEditing ? null : br.room_id)}
                            className={`transition-colors ${hasNoPrice ? 'text-red-400 dark:text-red-300 hover:text-red-600 dark:hover:text-red-400' : 'text-gray-300 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400'}`}>✏️</button>
                        </div>
                      </div>
                      {isEditing && (
                        <EditRoomPriceForm
                          bookingId={b.id}
                          roomId={br.room_id}
                          currentPrice={rate}
                          currentNote={snap?.override_note ?? null}
                          onSave={p => { handlers.upsertBookingRoomPrice(p); setEditingRoomPriceId(null) }}
                          onCancel={() => setEditingRoomPriceId(null)}
                        />
                      )}
                    </div>
                  )
                })}
                {extAccomm.map(e => {
                  const acc = data.externalAccommodations.find(a => a.id === e.external_accommodation_id)
                  const n = countNights(e.check_in, e.check_out)
                  const revenue = e.sell_price_per_night * n
                  const cost    = e.cost_per_night * n
                  return (
                    <div key={e.id} className="space-y-0.5">
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>{acc?.name ?? 'External'} × {n}N @ {fmtEur(e.sell_price_per_night)}/N</span>
                        <span>{fmtEur(revenue)}</span>
                      </div>
                      {cost > 0 && (
                        <>
                          <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 pl-4">
                            <span>Cost @ {fmtEur(e.cost_per_night)}/N</span>
                            <span className="text-red-400 dark:text-red-300">−{fmtEur(cost)}</span>
                          </div>
                          <div className="flex justify-between text-xs font-medium pl-4">
                            <span className="text-emerald-600 dark:text-emerald-400">Margin</span>
                            <span className="text-emerald-600 dark:text-emerald-400">{fmtEur(revenue - cost)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Lessons */}
          {lessonsRev > 0 && (
            <div className="rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="flex justify-between items-center px-4 py-2 bg-gray-50 dark:bg-gray-800">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">🏄 Lessons</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{fmtEur(lessonsRev)}</span>
              </div>
              <div className="px-4 py-2 space-y-1">
                {bkLessons.map(l => {
                  const instr = data.instructors.find(i => i.id === l.instructor_id)
                  const rate = getLessonClientRate(l, data.priceItems)
                  const listRate = getConfiguredRate(data.priceItems, lessonBillable(l.type)) ?? 0
                  const isCustom = l.price_per_hour !== null && l.price_per_hour !== listRate
                  const heads = l.type === 'group' ? l.participant_ids.length : 1
                  const isEditing = editingLessonPriceId === l.id
                  return (
                    <div key={l.id} className="text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex justify-between items-center">
                        <span>
                          {l.type} · {l.duration_hours}h · {l.date}{instr ? ` (${instr.first_name})` : ''}
                          {l.type === 'group' && <span className="ml-1">× {heads}</span>}
                          {l.participant_ids.length > 0 && (
                            <span className="ml-1 text-blue-400 dark:text-blue-300">— {partNames(l.participant_ids)}</span>
                          )}
                          {isCustom && <span className="ml-1 text-amber-500 dark:text-amber-400 italic">(custom price)</span>}
                          {rate === 0 && (
                            <span className="ml-2 text-red-400 dark:text-red-300 font-medium">no price configured</span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <span>{fmtEur(rate * l.duration_hours * heads)}</span>
                          <button onClick={() => setEditingLessonPriceId(isEditing ? null : l.id)}
                            className={`transition-colors ${isCustom ? 'text-amber-400 dark:text-amber-300 hover:text-amber-600 dark:hover:text-amber-400' : 'text-gray-300 dark:text-gray-600 hover:text-amber-500 dark:hover:text-amber-400'}`}>✏️</button>
                        </div>
                      </div>
                      {isEditing && (
                        <LessonPriceForm
                          currentRate={rate}
                          isCustom={isCustom}
                          listRate={listRate}
                          onSave={p => { handlers.setLessonPrice(l.id, p); setEditingLessonPriceId(null) }}
                          onReset={() => { handlers.setLessonPrice(l.id, null); setEditingLessonPriceId(null) }}
                          onCancel={() => setEditingLessonPriceId(null)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Rentals */}
          {rentalsRev > 0 && (
            <div className="rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="flex justify-between items-center px-4 py-2 bg-gray-50 dark:bg-gray-800">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">🎿 Equipment rentals</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{fmtEur(rentalsRev)}</span>
              </div>
              <div className="px-4 py-2 space-y-1">
                {bkRentals.map(r => {
                  const equip = data.equipment.find(e => e.id === r.equipment_id)
                  const typeLabel = equip ? equip.category : (r.equipment_id ?? 'equipment')
                  const isEditing = editingRentalId === r.id
                  return (
                    <div key={r.id} className="text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex justify-between items-center">
                        <span>
                          {r.date} · <span className="capitalize">{typeLabel}</span> · {r.slot}
                          {r.participant_id && partName(r.participant_id) && (
                            <span className="ml-1 text-blue-400 dark:text-blue-300">— {partName(r.participant_id)}</span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <span>{fmtEur(r.price)}</span>
                          <button onClick={() => setEditingRentalId(isEditing ? null : r.id)}
                            className="text-gray-300 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">✏️</button>
                        </div>
                      </div>
                      {isEditing && (
                        <EditRentalForm
                          rental={r}
                          onSave={updated => { handlers.updateRental(updated); setEditingRentalId(null) }}
                          onCancel={() => setEditingRentalId(null)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Taxis */}
          {taxiRev > 0 && (
            <div className="rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="flex justify-between items-center px-4 py-2 bg-gray-50 dark:bg-gray-800">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">🚕 Taxis</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{fmtEur(taxiRev)}</span>
              </div>
              <div className="px-4 py-2 space-y-1">
                {bkTaxis.map(t => (
                  <div key={t.id} className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{t.date} · {t.type} · {t.nb_persons}p</span>
                    <span>{fmtEur(t.price_eur)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dining events */}
          {diningRev > 0 && (() => {
            const bParts = data.bookingParticipants.filter(p => p.booking_id === b.id)
            const hasParticipants = bParts.length > 0
            const matchIds = new Set(
              hasParticipants
                ? bParts.map(p => p.id)
                : [b.client_id]
            )
            return (
              <div className="rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="flex justify-between items-center px-4 py-2 bg-gray-50 dark:bg-gray-800">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">🍽️ Dining events</span>
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{fmtEur(diningRev)}</span>
                </div>
                <div className="px-4 py-2 space-y-1">
                  {data.diningEvents.filter(ev => ev.price_per_person > 0 && (ev.attendees ?? []).some(
                    a => a.is_attending && a.person_type === 'participant' && matchIds.has(a.person_id)
                  )).map(ev => {
                    const attending = (ev.attendees ?? []).filter(
                      a => a.is_attending && a.person_type === 'participant' && matchIds.has(a.person_id)
                    )
                    const evTotal = attending.reduce((s, a) => s + (a.price_override ?? ev.price_per_person), 0)
                    return (
                      <div key={ev.id} className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>
                          {ev.date} · {ev.name || '(unnamed)'} · {attending.length}p @ {fmtEur(ev.price_per_person)}
                          <span className="ml-1 text-blue-400 dark:text-blue-300">— {attending.map(a => partName(a.person_id) ?? a.person_name).join(', ')}</span>
                        </span>
                        <span>{fmtEur(evTotal)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Activities */}
          {activityRev > 0 && (
            <div className="rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="flex justify-between items-center px-4 py-2 bg-gray-50 dark:bg-gray-800">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">🎯 Activities</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{fmtEur(activityRev)}</span>
              </div>
              <div className="px-4 py-2 space-y-1">
                {bkActivities.map(a => (
                  <div key={a.id} className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>
                      {a.date} · {a.label} · {a.nb_persons}p
                      {a.participant_ids.length > 0 && (
                        <span className="ml-1 text-blue-400 dark:text-blue-300">— {partNames(a.participant_ids)}</span>
                      )}
                    </span>
                    <span>{fmtEur(a.price_client)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Center access */}
          {centerAccessRev > 0 && (
            <div className="rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="flex justify-between items-center px-4 py-2 bg-gray-50 dark:bg-gray-800">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">🏖️ Center access</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{fmtEur(centerAccessRev)}</span>
              </div>
              <div className="px-4 py-2">
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{b.num_center_access} person{b.num_center_access > 1 ? 's' : ''} × {nights}N @ {fmtEur(b.center_access_rate)}/day</span>
                  <span>{fmtEur(centerAccessRev)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Total line */}
          <div className="flex justify-between items-center px-4 py-2 bg-gray-800 rounded-lg text-white text-sm font-bold">
            <span>Total</span>
            <span>{fmtEur(total)}</span>
          </div>
          {discounts > 0 && (
            <div className="flex justify-between items-center px-4 py-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-700 dark:text-purple-400 text-sm font-bold">
              <span>Discounts</span>
              <span>-{fmtEur(discounts)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Per-guest breakdown (collapsible) */}
      {(() => {
        const bkParts = data.bookingParticipants.filter(p => p.booking_id === b.id)
        if (bkParts.length === 0) return null

        type Line = { date: string; label: string; amount: number }
        const guestData = bkParts.map(part => {
          const lines: Line[] = []

          // Lessons where this participant is listed
          for (const l of bkLessons) {
            if (!l.participant_ids.includes(part.id)) continue
            const instr = data.instructors.find(i => i.id === l.instructor_id)
            // Group lessons are billed per head, so each participant carries one share
            const rate = getLessonClientRate(l, data.priceItems)
            lines.push({
              date: l.date,
              label: `${l.type} lesson ${l.duration_hours}h${instr ? ` (${instr.first_name})` : ''}`,
              amount: rate * l.duration_hours,
            })
          }

          // Rentals assigned to this participant
          for (const r of bkRentals) {
            if (r.participant_id !== part.id) continue
            const equip = data.equipment.find(e => e.id === r.equipment_id)
            lines.push({ date: r.date, label: `${equip?.category ?? 'rental'} · ${r.slot}`, amount: r.price })
          }

          // Dining events where this participant attended
          for (const ev of data.diningEvents) {
            const att = (ev.attendees ?? []).find(a => a.is_attending && a.person_type === 'participant' && a.person_id === part.id)
            if (!att) continue
            const amount = att.price_override ?? ev.price_per_person
            if (amount === 0) continue
            lines.push({ date: ev.date, label: ev.name || 'dining', amount })
          }

          // Activities where this participant is listed
          for (const a of bkActivities) {
            if (!a.participant_ids.includes(part.id)) continue
            lines.push({ date: a.date, label: a.label, amount: a.price_client / a.nb_persons })
          }

          lines.sort((a, b) => a.date.localeCompare(b.date))
          const total = lines.reduce((s, l) => s + l.amount, 0)
          return { participant: part, lines, total }
        }).filter(g => g.lines.length > 0)

        if (guestData.length === 0) return null

        return (
          <details className="group">
            <summary className="cursor-pointer select-none flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors py-2">
              <span className="transition-transform group-open:rotate-90">▶</span>
              Per-guest breakdown
            </summary>
            <div className="mt-2 space-y-3">
              {guestData.map(({ participant: p, lines, total }) => (
                <div key={p.id} className="rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
                  <div className="flex justify-between items-center px-4 py-2 bg-blue-50 dark:bg-blue-950/40">
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-400">{p.first_name} {p.last_name ?? ''}</span>
                    <span className="text-sm font-semibold text-blue-800 dark:text-blue-400">{fmtEur(total)}</span>
                  </div>
                  <div className="px-4 py-2 space-y-1">
                    {lines.map((l, i) => (
                      <div key={i} className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>{l.date} · {l.label}</span>
                        <span>{fmtEur(l.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )
      })()}

      {/* Payments */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Payments</p>
          {!showAddPayment && !showAddDiscount && (
            <div className="flex gap-2">
              <button onClick={() => setShowAddDiscount(true)}
                className="text-xs px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium">
                + Discount
              </button>
              <button onClick={() => setShowAddPayment(true)}
                className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                + Payment
              </button>
            </div>
          )}
        </div>

        {showAddPayment && (
          <PaymentForm
            bookingId={b.id}
            suggestedDeposit={sugDeposit}
            onSave={(p) => { handlers.addPayment(p); setShowAddPayment(false) }}
            onCancel={() => setShowAddPayment(false)}
          />
        )}

        {showAddDiscount && (
          <DiscountForm
            bookingId={b.id}
            onSave={(p) => { handlers.addPayment(p); setShowAddDiscount(false) }}
            onCancel={() => setShowAddDiscount(false)}
          />
        )}

        {bkPayments.length === 0 && !showAddPayment ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">No payments recorded yet.</p>
        ) : (
          <div className="space-y-2 mt-2">
            {bkPayments.map(p => (
              <div key={p.id}>
                {editingPaymentId === p.id ? (
                  p.is_discount ? (
                    <DiscountForm
                      bookingId={b.id}
                      initial={p}
                      onSave={(updated) => { handlers.updatePayment(updated); setEditingPaymentId(null) }}
                      onCancel={() => setEditingPaymentId(null)}
                    />
                  ) : (
                    <PaymentForm
                      bookingId={b.id}
                      initial={p}
                      onSave={(updated) => { handlers.updatePayment(updated); setEditingPaymentId(null) }}
                      onCancel={() => setEditingPaymentId(null)}
                    />
                  )
                ) : (
                  <div className={`flex items-center justify-between text-sm rounded-lg px-4 py-2 ${p.is_discount ? 'bg-purple-50 dark:bg-purple-950/40' : 'bg-gray-50 dark:bg-gray-800'}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-gray-400 dark:text-gray-500 text-xs">{p.date}</span>
                      {p.is_discount ? (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">Discount</span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${METHOD_COLORS[p.method]}`}>
                          {METHOD_LABELS[p.method]}
                        </span>
                      )}
                      {p.is_deposit && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Deposit</span>
                      )}
                      {!p.is_discount && (
                        p.is_verified
                          ? <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">✓ Verified</span>
                          : <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">⚠ To verify</span>
                      )}
                      {p.notes && <span className="text-gray-400 dark:text-gray-500 text-xs italic">{p.notes}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${p.is_discount ? 'text-purple-700 dark:text-purple-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                        {p.is_discount ? '-' : ''}{fmtEur(p.amount)}
                      </span>
                      <button onClick={() => setEditingPaymentId(p.id)}
                        className="text-gray-300 dark:text-gray-600 hover:text-amber-500 dark:hover:text-amber-400 transition-colors text-xs">✏️</button>
                      <button onClick={() => handlers.deletePayment(p.id)}
                        className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors text-xs">✕</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div className="flex justify-between items-center px-4 py-2 border-t text-sm font-semibold">
              <span className="text-gray-600 dark:text-gray-400">Total paid</span>
              <span className="text-emerald-700 dark:text-emerald-400">{fmtEur(paid)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function BookingFinances({ data, handlers }: Props) {
  const { bookings, clients, payments } = data
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showCancelled, setShowCancelled] = useState(false)

  const standaloneTrips = data.taxiTrips.filter(t => t.booking_id === null)
  const standaloneRev   = computeStandaloneTaxiRevenue(data)

  const rows = bookings
    .filter(b => showCancelled || b.status !== 'cancelled')
    .map(b => {
      const client    = clients.find(c => c.id === b.client_id)
      const total     = computeBookingTotal(b, data)
      const discount  = computeBookingDiscounts(b.id, payments)
      const paid      = computeBookingPaid(b.id, payments)
      const due       = total - discount - paid
      return { booking: b, client, total, paid, due }
    })
    .sort((a, b) => a.booking.check_in.localeCompare(b.booking.check_in))

  const activeRows = rows.filter(r => r.booking.status !== 'cancelled')

  return (
    <div className="space-y-4">
      {/* Totals bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total billed',    value: activeRows.reduce((s, r) => s + r.total, 0), color: 'text-gray-800 dark:text-gray-200' },
          { label: 'Total collected', value: activeRows.reduce((s, r) => s + r.paid, 0),  color: 'text-emerald-700 dark:text-emerald-400' },
          { label: 'Total outstanding', value: activeRows.reduce((s, r) => s + r.due, 0), color: 'text-amber-700 dark:text-amber-400' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-5 py-4">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">{kpi.label}</p>
            <p className={`text-xl font-bold ${kpi.color}`}>{fmtEur(kpi.value)}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400 w-12">#</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Client</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Dates</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Total</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Paid</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Balance</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ booking: b, client, total, paid, due }) => {
              const isExpanded = expandedId === b.id
              return (
                <>
                  <tr
                    key={b.id}
                    onClick={() => setExpandedId(isExpanded ? null : b.id)}
                    className={`border-b cursor-pointer transition-colors ${
                      isExpanded ? 'bg-blue-50 dark:bg-blue-950/40' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    } ${b.status === 'cancelled' ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-3 text-gray-400 dark:text-gray-500">#{String(b.booking_number).padStart(3, '0')}</td>
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                      {client ? `${client.first_name} ${client.last_name}` : '–'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                      {b.check_in} → {b.check_out}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-gray-200">{fmtEur(total)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-400">{fmtEur(paid)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${
                      b.status === 'cancelled' ? 'text-gray-400 dark:text-gray-500' :
                      due <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {due <= 0 ? '✓' : fmtEur(due)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        b.status === 'confirmed'   ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400' :
                        b.status === 'provisional' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400' :
                        'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                      }`}>{b.status}</span>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${b.id}-detail`}>
                      <td colSpan={7} className="px-4 py-4 bg-gray-50 dark:bg-gray-800 border-b">
                        <BookingDetailPanel booking={b} data={data} handlers={handlers} />
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Show cancelled toggle */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowCancelled(s => !s)}
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
        >
          {showCancelled ? 'Hide cancelled bookings' : `Show cancelled bookings`}
        </button>
      </div>

      {/* Unlinked taxi trips */}
      {standaloneTrips.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-amber-200 dark:border-amber-900 overflow-hidden">
          <div className="flex justify-between items-center px-5 py-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900">
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">Unlinked taxi trips</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">Not attached to any booking</p>
            </div>
            <p className="text-sm font-bold text-amber-800 dark:text-amber-400">{fmtEur(standaloneRev)}</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400 text-xs">Date</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400 text-xs">Type</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400 text-xs">Persons</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400 text-xs">Notes</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500 dark:text-gray-400 text-xs">Amount</th>
              </tr>
            </thead>
            <tbody>
              {standaloneTrips.map(t => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{t.date}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{t.type}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{t.nb_persons}p</td>
                  <td className="px-4 py-2 text-gray-400 dark:text-gray-500 italic text-xs">{t.notes ?? '–'}</td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">{fmtEur(t.price_eur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
