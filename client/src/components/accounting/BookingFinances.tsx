import { useState } from 'react'
import type { SharedAccountingData, AccountingHandlers } from './types'
import type { Payment, PaymentMethod, Booking, EquipmentRental, Lesson, LessonRateOverride } from '../../types/database'
import {
  computeBookingTotal, computeBookingPaid, computeAccommodationRevenue,
  computeLessonsRevenue, computeRentalsRevenue, computeTaxiRevenue,
  computeDiningForBooking, getLessonRate,
  fmtEur, suggestDeposit, countNights, getRoomNightlyRate,
} from './utils'

interface Props { data: SharedAccountingData; handlers: AccountingHandlers }

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash_eur:        'Cash EUR',
  cash_mzn:        'Cash MZN',
  transfer:        'Transfer',
  card_palmeiras:  'Card (Palmeiras)',
}

const METHOD_COLORS: Record<PaymentMethod, string> = {
  cash_eur:       'bg-emerald-100 text-emerald-800',
  cash_mzn:       'bg-teal-100 text-teal-800',
  transfer:       'bg-blue-100 text-blue-800',
  card_palmeiras: 'bg-purple-100 text-purple-800',
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
        className="w-24 px-2 py-0.5 border border-blue-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
      <span className="text-xs text-gray-400">€</span>
      <button type="submit" className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">✓</button>
      <button type="button" onClick={onCancel} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200">✕</button>
    </form>
  )
}

// ── Override Lesson Rate Form (module-scope) ────────────────────────────────

interface LessonRateFormProps {
  lesson: Lesson
  currentRate: number
  hasOverride: boolean
  onSave: (o: LessonRateOverride) => void
  onRemove: () => void
  onCancel: () => void
}
function LessonRateForm({ lesson, currentRate, hasOverride, onSave, onRemove, onCancel }: LessonRateFormProps) {
  const [rate, setRate] = useState(String(currentRate))
  const [note, setNote] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(rate)
    if (!parsed || !note.trim()) return
    onSave({ id: `lro_${Date.now()}`, lesson_id: lesson.id, rate: parsed, note: note.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1 p-2 bg-amber-50 border border-amber-200 rounded space-y-1.5">
      <div className="flex gap-2">
        <div>
          <label className="text-xs text-gray-500 block mb-0.5">Rate (€/h)</label>
          <input type="number" min="0" step="0.5" value={rate} onChange={e => setRate(e.target.value)} autoFocus
            className="w-20 px-2 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 block mb-0.5">Reason *</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Required"
            className="w-full px-2 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
        </div>
      </div>
      <div className="flex gap-1">
        <button type="button" onClick={onCancel}
          className="px-2 py-0.5 bg-white border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50">Cancel</button>
        {hasOverride && (
          <button type="button" onClick={onRemove}
            className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">Remove override</button>
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
  const [date,   setDate]   = useState(initial?.date ?? new Date().toISOString().slice(0, 10))

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
    <form onSubmit={handleSubmit} className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
      <p className="text-sm font-semibold text-purple-800">{initial ? 'Edit discount' : 'Add discount'}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Amount (€)</label>
          <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} autoFocus
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Reason</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Loyalty discount"
          className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50">
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
  const [date,       setDate]       = useState(initial?.date ?? new Date().toISOString().slice(0, 10))

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
    <form onSubmit={handleSubmit} className={`border rounded-lg p-4 space-y-3 ${isEdit ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
      <p className={`text-sm font-semibold ${isEdit ? 'text-amber-800' : 'text-blue-800'}`}>
        {isEdit ? 'Edit payment' : 'Add payment'}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Amount (€)</label>
          <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Method</label>
          <select value={method} onChange={e => setMethod(e.target.value as PaymentMethod)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
            {(Object.entries(METHOD_LABELS) as [PaymentMethod, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Notes</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional"
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={isDeposit} onChange={e => setIsDeposit(e.target.checked)} className="rounded" />
          Deposit
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={isVerified} onChange={e => setIsVerified(e.target.checked)} className="rounded" />
          Verified
        </label>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50">
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
  const [editingRentalId, setEditingRentalId] = useState<string | null>(null)
  const [overridingLessonId, setOverridingLessonId] = useState<string | null>(null)

  const total        = computeBookingTotal(b, data)
  const paid         = computeBookingPaid(b.id, data.payments)
  const due          = total - paid
  const sugDeposit   = suggestDeposit(total)
  const nights       = countNights(b.check_in, b.check_out)
  const bkPayments   = data.payments.filter(p => p.booking_id === b.id)
    .sort((a, b) => a.date.localeCompare(b.date))

  // Breakdown lines
  const accommodationRev = computeAccommodationRevenue(b, data)
  const lessonsRev       = computeLessonsRevenue(b, data)
  const rentalsRev       = computeRentalsRevenue(b, data)
  const taxiRev          = computeTaxiRevenue(b, data)
  const diningRev        = computeDiningForBooking(b, data.diningEvents, data.bookingParticipants)

  // Room detail
  const bkRooms = data.bookingRooms.filter(br => br.booking_id === b.id)
  const extAccomm = data.externalAccommodationBkgs.filter(e => e.booking_id === b.id)

  // Lessons detail
  const bkLessons = data.lessons.filter(l => l.booking_id === b.id)

  // Rental detail
  const bkRentals = data.equipmentRentals.filter(r => r.booking_id === b.id)

  // Taxi detail
  const bkTaxis = data.taxiTrips.filter(t => t.booking_id === b.id)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">

      {/* Header totals */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total</p>
          <p className="text-xl font-bold text-gray-800">{fmtEur(total)}</p>
          {nights > 0 && <p className="text-xs text-gray-400 mt-1">{nights} nights</p>}
        </div>
        <div className="bg-emerald-50 rounded-lg p-4 text-center">
          <p className="text-xs text-emerald-500 uppercase tracking-wide mb-1">Paid</p>
          <p className="text-xl font-bold text-emerald-700">{fmtEur(paid)}</p>
          {paid === 0 && <p className="text-xs text-amber-500 mt-1">Deposit suggested: {fmtEur(sugDeposit)}</p>}
        </div>
        <div className={`rounded-lg p-4 text-center ${due > 0 ? 'bg-amber-50' : 'bg-emerald-50'}`}>
          <p className={`text-xs uppercase tracking-wide mb-1 ${due > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
            {due > 0 ? 'Outstanding' : 'Settled ✓'}
          </p>
          <p className={`text-xl font-bold ${due > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{fmtEur(due)}</p>
        </div>
      </div>

      {/* Price breakdown */}
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-3">Price breakdown</p>
        <div className="space-y-2">

          {/* Accommodation */}
          {accommodationRev > 0 && (
            <div className="rounded-lg border border-gray-100 overflow-hidden">
              <div className="flex justify-between items-center px-4 py-2 bg-gray-50">
                <span className="text-sm font-medium text-gray-700">🏠 Accommodation</span>
                <span className="text-sm font-semibold text-gray-800">{fmtEur(accommodationRev)}</span>
              </div>
              <div className="px-4 py-2 space-y-1">
                {bkRooms.map(br => {
                  const room = data.rooms.find(r => r.id === br.room_id)
                  const rate = getRoomNightlyRate(b.id, br.room_id, data)
                  const snap = data.bookingRoomPrices.find(p => p.booking_id === b.id && p.room_id === br.room_id)
                  return (
                    <div key={br.room_id} className="flex justify-between text-xs text-gray-500">
                      <span>
                        Room {room?.name ?? br.room_id} × {nights}n @ {fmtEur(rate)}/n
                        {snap?.override_note && <span className="ml-2 text-amber-500 italic">({snap.override_note})</span>}
                      </span>
                      <span>{fmtEur(rate * nights)}</span>
                    </div>
                  )
                })}
                {extAccomm.map(e => {
                  const acc = data.externalAccommodations.find(a => a.id === e.external_accommodation_id)
                  const n = countNights(e.check_in, e.check_out)
                  return (
                    <div key={e.id} className="flex justify-between text-xs text-gray-500">
                      <span>{acc?.name ?? 'External'} × {n}n @ {fmtEur(e.sell_price_per_night)}/n</span>
                      <span>{fmtEur(e.sell_price_per_night * n)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Lessons */}
          {lessonsRev > 0 && (
            <div className="rounded-lg border border-gray-100 overflow-hidden">
              <div className="flex justify-between items-center px-4 py-2 bg-gray-50">
                <span className="text-sm font-medium text-gray-700">🏄 Lessons</span>
                <span className="text-sm font-semibold text-gray-800">{fmtEur(lessonsRev)}</span>
              </div>
              <div className="px-4 py-2 space-y-1">
                {bkLessons.map(l => {
                  const instr = data.instructors.find(i => i.id === l.instructor_id)
                  if (!instr) return null
                  const override = data.lessonRateOverrides.find(o => o.lesson_id === l.id)
                  const rate = getLessonRate(l, instr, data.lessonRateOverrides)
                  const isOverriding = overridingLessonId === l.id
                  return (
                    <div key={l.id} className="text-xs text-gray-500">
                      <div className="flex justify-between items-center">
                        <span>
                          {l.type} · {l.duration_hours}h · {l.date} ({instr.first_name})
                          {override && <span className="ml-1 text-amber-500 italic">(override)</span>}
                        </span>
                        <div className="flex items-center gap-2">
                          <span>{fmtEur(rate * l.duration_hours)}</span>
                          <button onClick={() => setOverridingLessonId(isOverriding ? null : l.id)}
                            className={`transition-colors ${override ? 'text-amber-400 hover:text-amber-600' : 'text-gray-300 hover:text-amber-500'}`}>✏️</button>
                        </div>
                      </div>
                      {isOverriding && (
                        <LessonRateForm
                          lesson={l}
                          currentRate={rate}
                          hasOverride={!!override}
                          onSave={o => { handlers.setLessonOverride(o); setOverridingLessonId(null) }}
                          onRemove={() => { handlers.removeLessonOverride(l.id); setOverridingLessonId(null) }}
                          onCancel={() => setOverridingLessonId(null)}
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
            <div className="rounded-lg border border-gray-100 overflow-hidden">
              <div className="flex justify-between items-center px-4 py-2 bg-gray-50">
                <span className="text-sm font-medium text-gray-700">🎿 Equipment rentals</span>
                <span className="text-sm font-semibold text-gray-800">{fmtEur(rentalsRev)}</span>
              </div>
              <div className="px-4 py-2 space-y-1">
                {bkRentals.map(r => {
                  const equip = data.equipment.find(e => e.id === r.equipment_id)
                  const typeLabel = equip ? equip.category : (r.equipment_id ?? 'equipment')
                  const isEditing = editingRentalId === r.id
                  return (
                    <div key={r.id} className="text-xs text-gray-500">
                      <div className="flex justify-between items-center">
                        <span>{r.date} · <span className="capitalize">{typeLabel}</span> · {r.slot}</span>
                        <div className="flex items-center gap-2">
                          <span>{fmtEur(r.price)}</span>
                          <button onClick={() => setEditingRentalId(isEditing ? null : r.id)}
                            className="text-gray-300 hover:text-blue-500 transition-colors">✏️</button>
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
            <div className="rounded-lg border border-gray-100 overflow-hidden">
              <div className="flex justify-between items-center px-4 py-2 bg-gray-50">
                <span className="text-sm font-medium text-gray-700">🚕 Taxis</span>
                <span className="text-sm font-semibold text-gray-800">{fmtEur(taxiRev)}</span>
              </div>
              <div className="px-4 py-2 space-y-1">
                {bkTaxis.map(t => (
                  <div key={t.id} className="flex justify-between text-xs text-gray-500">
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
              <div className="rounded-lg border border-gray-100 overflow-hidden">
                <div className="flex justify-between items-center px-4 py-2 bg-gray-50">
                  <span className="text-sm font-medium text-gray-700">🍽️ Dining events</span>
                  <span className="text-sm font-semibold text-gray-800">{fmtEur(diningRev)}</span>
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
                      <div key={ev.id} className="flex justify-between text-xs text-gray-500">
                        <span>{ev.date} · {ev.name || '(unnamed)'} · {attending.length}p @ {fmtEur(ev.price_per_person)}</span>
                        <span>{fmtEur(evTotal)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Total line */}
          <div className="flex justify-between items-center px-4 py-2 bg-gray-800 rounded-lg text-white text-sm font-bold">
            <span>Total</span>
            <span>{fmtEur(total)}</span>
          </div>
        </div>
      </div>

      {/* Payments */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <p className="text-sm font-semibold text-gray-600">Payments</p>
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
          <p className="text-sm text-gray-400 italic">No payments recorded yet.</p>
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
                  <div className={`flex items-center justify-between text-sm rounded-lg px-4 py-2 ${p.is_discount ? 'bg-purple-50' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-gray-400 text-xs">{p.date}</span>
                      {p.is_discount ? (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-700">Discount</span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${METHOD_COLORS[p.method]}`}>
                          {METHOD_LABELS[p.method]}
                        </span>
                      )}
                      {p.is_deposit && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700">Deposit</span>
                      )}
                      {!p.is_discount && (
                        p.is_verified
                          ? <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">✓ Verified</span>
                          : <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700">⚠ To verify</span>
                      )}
                      {p.notes && <span className="text-gray-400 text-xs italic">{p.notes}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${p.is_discount ? 'text-purple-700' : 'text-emerald-700'}`}>
                        {p.is_discount ? '-' : ''}{fmtEur(p.amount)}
                      </span>
                      <button onClick={() => setEditingPaymentId(p.id)}
                        className="text-gray-300 hover:text-amber-500 transition-colors text-xs">✏️</button>
                      <button onClick={() => handlers.deletePayment(p.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors text-xs">✕</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div className="flex justify-between items-center px-4 py-2 border-t text-sm font-semibold">
              <span className="text-gray-600">Total paid</span>
              <span className="text-emerald-700">{fmtEur(paid)}</span>
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

  const rows = bookings
    .filter(b => showCancelled || b.status !== 'cancelled')
    .map(b => {
      const client = clients.find(c => c.id === b.client_id)
      const total  = computeBookingTotal(b, data)
      const paid   = computeBookingPaid(b.id, payments)
      const due    = total - paid
      return { booking: b, client, total, paid, due }
    })
    .sort((a, b) => a.booking.check_in.localeCompare(b.booking.check_in))

  const activeRows = rows.filter(r => r.booking.status !== 'cancelled')

  return (
    <div className="space-y-4">
      {/* Totals bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total billed',    value: activeRows.reduce((s, r) => s + r.total, 0), color: 'text-gray-800' },
          { label: 'Total collected', value: activeRows.reduce((s, r) => s + r.paid, 0),  color: 'text-emerald-700' },
          { label: 'Total outstanding', value: activeRows.reduce((s, r) => s + r.due, 0), color: 'text-amber-700' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{kpi.label}</p>
            <p className={`text-xl font-bold ${kpi.color}`}>{fmtEur(kpi.value)}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 w-12">#</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Client</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Dates</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Total</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Paid</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Balance</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Status</th>
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
                      isExpanded ? 'bg-blue-50' : 'hover:bg-gray-50'
                    } ${b.status === 'cancelled' ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-3 text-gray-400">#{String(b.booking_number).padStart(3, '0')}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {client ? `${client.first_name} ${client.last_name}` : '–'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {b.check_in} → {b.check_out}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmtEur(total)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{fmtEur(paid)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${
                      b.status === 'cancelled' ? 'text-gray-400' :
                      due <= 0 ? 'text-emerald-600' : 'text-amber-600'
                    }`}>
                      {due <= 0 ? '✓' : fmtEur(due)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        b.status === 'confirmed'   ? 'bg-emerald-100 text-emerald-800' :
                        b.status === 'provisional' ? 'bg-amber-100 text-amber-800' :
                        'bg-gray-100 text-gray-400'
                      }`}>{b.status}</span>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${b.id}-detail`}>
                      <td colSpan={7} className="px-4 py-4 bg-gray-50 border-b">
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
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          {showCancelled ? 'Hide cancelled bookings' : `Show cancelled bookings`}
        </button>
      </div>
    </div>
  )
}
