import { useState } from 'react'
import type { SharedAccountingData, AccountingHandlers } from './types'
import type { Payment, PaymentMethod, Booking, EquipmentRental, Associate, BookingCharge, BookingChargeCategory } from '../../types/database'
import { rentalKind, rentalLabel } from '../planning/rentalTypes'
import { lessonBillable, lessonDiscipline } from '../../types/database'
import {
  computeBookingTotal, computeBookingPaid, computeBookingDiscounts,
  computeAccommodationRevenue, computeExternalAccommodationCost, computeLessonsRevenue, computeRentalsRevenue,
  computeTaxiRevenue, computeActivityRevenueForBooking, computeCenterAccessRevenue,
  computeDiningForBooking, getLessonClientRate, lessonHeadsFor, lessonsForBooking, getConfiguredRate, computeStandaloneTaxiRevenue, agencyMarker, agencyPackageHours, agencyHoursPool,
  fmtEur, suggestDeposit, countNights, getRoomNightlyRate, computeExtrasRevenue, chargeAmount,
} from './utils'
import { todayISO, addDaysISO, fmtDate } from '../../utils/dates'
import { lessonGearText, rentalGearText, inParens } from '../../utils/gearLabel'
import AgencyBillingPanel from './AgencyBillingPanel'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'
import type { Lang } from '../../types/database'
import ClientShareLink from '../common/ClientShareLink'

interface Props { data: SharedAccountingData; handlers: AccountingHandlers }

function methodLabels(lang: Lang): Record<PaymentMethod, string> {
  return {
    cash_eur:       i18n.accounting.method_cash_eur[lang],
    cash_mzn:       i18n.accounting.method_cash_mzn[lang],
    transfer:       i18n.accounting.method_transfer[lang],
    card_palmeiras: i18n.accounting.method_card_palmeiras[lang],
  }
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
  const { lang } = useLanguage()
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
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 mt-1">
      <input type="number" min="0" step="0.5" value={price} onChange={e => setPrice(e.target.value)}
        autoFocus
        className="w-20 px-2 py-0.5 border border-blue-300 dark:border-blue-800 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
      <span className="text-xs text-gray-400 dark:text-gray-400">€/n</span>
      <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder={i18n.accounting.bf_note_short[lang]}
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
  const { lang } = useLanguage()
  const [price, setPrice] = useState(String(rental.price))
  const [notes, setNotes] = useState(rental.notes ?? '')
  const [clientNote, setClientNote] = useState(rental.client_note ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(price)
    if (isNaN(parsed) || parsed < 0) return
    onSave({ ...rental, price: parsed, notes: notes.trim() || null, client_note: clientNote.trim() || null })
  }

  const noteInput = 'flex-1 min-w-[10rem] px-2 py-0.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-400'
  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 mt-1">
      <input type="number" min="0" step="0.5" value={price} onChange={e => setPrice(e.target.value)}
        autoFocus
        className="w-24 px-2 py-0.5 border border-blue-300 dark:border-blue-800 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
      <span className="text-xs text-gray-400 dark:text-gray-400">€</span>
      <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
        placeholder={i18n.accounting.bf_rental_note_ph[lang]} className={noteInput} />
      <input type="text" value={clientNote} onChange={e => setClientNote(e.target.value)}
        placeholder={i18n.accounting.bf_rental_client_note_ph[lang]} className={noteInput} />
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
  const { lang } = useLanguage()
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
          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">{i18n.accounting.bf_client_price_label[lang]}</label>
          <input type="number" min="0" step="0.5" value={rate} onChange={e => setRate(e.target.value)} autoFocus
            className="w-24 px-2 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-400 pb-1">{i18n.accounting.bf_price_list[lang].replace('{rate}', fmtEur(listRate))}</p>
      </div>
      <div className="flex gap-1">
        <button type="button" onClick={onCancel}
          className="px-2 py-0.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">{i18n.common.btn_cancel[lang]}</button>
        {isCustom && (
          <button type="button" onClick={onReset}
            className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs hover:bg-red-200 dark:hover:bg-red-800">{i18n.accounting.bf_back_to_price_list[lang]}</button>
        )}
        <button type="submit"
          className="flex-1 px-2 py-0.5 bg-amber-600 text-white rounded text-xs font-semibold hover:bg-amber-700">{i18n.common.btn_save[lang]}</button>
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
  const { lang } = useLanguage()
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [notes,  setNotes]  = useState(initial?.notes ?? '')
  const [date,   setDate]   = useState(initial?.date ?? todayISO())

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) return
    onSave({
      id:          initial?.id ?? crypto.randomUUID(),
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
    <form onSubmit={handleSubmit} className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 rounded-lg p-3 sm:p-4 space-y-3">
      <p className="text-sm font-semibold text-purple-800 dark:text-purple-400">{initial ? i18n.accounting.bf_edit_discount[lang] : i18n.accounting.bf_add_discount[lang]}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{i18n.common.label_date[lang]}</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{i18n.accounting.bf_amount_eur[lang]}</label>
          <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} autoFocus
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{i18n.accounting.bf_reason[lang]}</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder={i18n.accounting.bf_placeholder_discount_reason[lang]}
          className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
          {i18n.common.btn_cancel[lang]}
        </button>
        <button type="submit"
          className="flex-1 px-3 py-1.5 bg-purple-600 text-white rounded text-sm font-semibold hover:bg-purple-700">
          {initial ? i18n.accounting.bf_update[lang] : i18n.accounting.bf_save_discount[lang]}
        </button>
      </div>
    </form>
  )
}

// ── Payment Form (module-scope) — used for Add and Edit ────────────────────

interface PaymentFormProps {
  bookingId: string
  initial?: Payment
  /** What the guest still owes before this payment (total − discounts − paid, the
   *  amount of the payment being edited added back): pre-fills a new payment and
   *  drives the "remaining after" preview. */
  outstanding: number
  /** Empty until the associates migration is in: the selector then stays hidden
   *  and the column is never written. */
  associates: Associate[]
  onSave: (p: Payment) => void
  onCancel: () => void
}

function PaymentForm({ bookingId, initial, outstanding, associates, onSave, onCancel }: PaymentFormProps) {
  const { lang } = useLanguage()
  const [amount,     setAmount]     = useState(initial ? String(initial.amount) : outstanding > 0 ? String(Math.round(outstanding * 100) / 100) : '')
  const [method,     setMethod]     = useState<PaymentMethod>(initial?.method ?? 'transfer')
  const [isDeposit,  setIsDeposit]  = useState(initial?.is_deposit ?? false)
  const [isVerified, setIsVerified] = useState(initial?.is_verified ?? true)
  const [notes,      setNotes]      = useState(initial?.notes ?? '')
  const [date,       setDate]       = useState(initial?.date ?? todayISO())
  const [receivedBy, setReceivedBy] = useState(initial?.received_by_associate_id ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) return
    onSave({
      id:          initial?.id ?? crypto.randomUUID(),
      booking_id:  bookingId,
      date,
      amount:      parsed,
      method,
      is_deposit:  isDeposit,
      is_verified: isVerified,
      is_discount: false,
      notes:       notes || null,
      // Only named once the column exists — an insert naming an unmigrated
      // column is refused whole, and the payment would be lost with it.
      ...(associates.length > 0 ? { received_by_associate_id: receivedBy || null } : {}),
    })
  }

  const isEdit = !!initial
  const after = Math.round((outstanding - (parseFloat(amount) || 0)) * 100) / 100

  return (
    <form onSubmit={handleSubmit} className={`border rounded-lg p-3 sm:p-4 space-y-3 ${isEdit ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900' : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900'}`}>
      <p className={`text-sm font-semibold ${isEdit ? 'text-amber-800 dark:text-amber-400' : 'text-blue-800 dark:text-blue-400'}`}>
        {isEdit ? i18n.accounting.bf_edit_payment[lang] : i18n.accounting.bf_add_payment[lang]}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{i18n.common.label_date[lang]}</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{i18n.accounting.bf_amount_eur[lang]}</label>
          <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <p className={`text-xs mt-1 ${after < 0 ? 'text-red-600 dark:text-red-400' : after === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
            {after < 0
              ? i18n.accounting.bf_overpaid_after[lang].replace('{amount}', fmtEur(-after))
              : after === 0 ? i18n.accounting.bf_settled[lang]
              : i18n.accounting.bf_remaining_after[lang].replace('{amount}', fmtEur(after))}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{i18n.accounting.bf_method[lang]}</label>
          <select value={method} onChange={e => setMethod(e.target.value as PaymentMethod)}
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-900">
            {(Object.entries(methodLabels(lang)) as [PaymentMethod, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{i18n.common.label_notes[lang]}</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder={i18n.common.msg_optional[lang]}
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
      </div>
      {associates.length > 0 && (
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{i18n.accounting.as_received_by[lang]}</label>
          <select value={receivedBy} onChange={e => setReceivedBy(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-900">
            <option value="">{i18n.accounting.as_the_centre[lang]}</option>
            {associates.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      )}
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
          <input type="checkbox" checked={isDeposit} onChange={e => setIsDeposit(e.target.checked)} className="rounded" />
          {i18n.accounting.bf_deposit[lang]}
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
          <input type="checkbox" checked={isVerified} onChange={e => setIsVerified(e.target.checked)} className="rounded" />
          {i18n.accounting.bf_verified[lang]}
        </label>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
          {i18n.common.btn_cancel[lang]}
        </button>
        <button type="submit"
          className={`flex-1 px-3 py-1.5 text-white rounded text-sm font-semibold ${isEdit ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
          {isEdit ? i18n.accounting.bf_update[lang] : i18n.accounting.bf_save_payment[lang]}
        </button>
      </div>
    </form>
  )
}

// ── Activity line on the bill (add / edit) ─────────────────────────────────
// A boat trip, an outing… billed straight onto this booking. A new line is
// filed under the in-house provider; editing keeps the line's provider.

interface ActivityLineValues {
  date: string
  label: string
  nb_persons: number
  participant_ids: string[]
  price_client: number
  price_provider: number
}
interface ActivityLineFormProps {
  initial?: ActivityLineValues
  defaultDate: string
  participants: { id: string; first_name: string; last_name: string | null }[]
  onSave: (v: ActivityLineValues) => void
  onCancel: () => void
}
function ActivityLineForm({ initial, defaultDate, participants, onSave, onCancel }: ActivityLineFormProps) {
  const { lang } = useLanguage()
  const [label, setLabel] = useState(initial?.label ?? '')
  const [date, setDate]   = useState(initial?.date ?? defaultDate)
  const [picked, setPicked] = useState<string[]>(initial?.participant_ids ?? [])
  const [price, setPrice] = useState(initial ? String(initial.price_client) : '')
  const [cost, setCost]   = useState(initial && initial.price_provider ? String(initial.price_provider) : '')
  const toggle = (id: string) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const p = parseFloat(price)
    const c = cost.trim() === '' ? 0 : parseFloat(cost)
    if (!label.trim() || isNaN(p) || p < 0 || isNaN(c) || c < 0) return
    onSave({
      date, label: label.trim(),
      // No guest ticked: keep the head count the line already had (lines made
      // in the Activities page may carry a count without names).
      nb_persons: picked.length || initial?.nb_persons || 1,
      participant_ids: picked,
      price_client: p,
      price_provider: c,
    })
  }

  const input = 'w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400'
  return (
    <form onSubmit={handleSubmit} className="mt-2 mb-1 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder={i18n.accounting.bf_act_label_ph[lang]} className={input} required autoFocus />
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={input} required />
      </div>
      {participants.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {participants.map(p => (
            <label key={p.id} className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
              <input type="checkbox" checked={picked.includes(p.id)} onChange={() => toggle(p.id)} />
              {p.first_name} {p.last_name ?? ''}
            </label>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-500 dark:text-gray-400">
          {i18n.accounting.bf_act_total_price[lang]}
          <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className={input} required />
        </label>
        <label className="text-xs text-gray-500 dark:text-gray-400">
          {i18n.accounting.bf_act_cost[lang]}
          <input type="number" min="0" step="0.01" value={cost} onChange={e => setCost(e.target.value)} placeholder="0" className={input} />
        </label>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
          {i18n.common.btn_cancel[lang]}
        </button>
        <button type="submit" className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-semibold">
          {initial ? i18n.accounting.bf_update[lang] : i18n.accounting.bf_act_add[lang]}
        </button>
      </div>
    </form>
  )
}

// ── Extra line form (module-scope) — a hand-typed amount the guest owes ────

const EXTRA_CATEGORIES: BookingChargeCategory[] = ['accommodation', 'food', 'equipment', 'other']

function extraCategoryLabel(c: BookingChargeCategory, lang: Lang): string {
  return {
    accommodation: i18n.accounting.extra_cat_accommodation[lang],
    food:          i18n.accounting.extra_cat_food[lang],
    equipment:     i18n.accounting.extra_cat_equipment[lang],
    other:         i18n.accounting.extra_cat_other[lang],
  }[c]
}

interface ExtraLineFormProps {
  bookingId: string
  initial?: BookingCharge
  defaultDate: string
  onSave: (c: BookingCharge) => void
  onCancel: () => void
}
function ExtraLineForm({ bookingId, initial, defaultDate, onSave, onCancel }: ExtraLineFormProps) {
  const { lang } = useLanguage()
  const [label, setLabel]       = useState(initial?.label ?? '')
  const [date, setDate]         = useState(initial?.date ?? defaultDate)
  const [category, setCategory] = useState<BookingChargeCategory>(initial?.category ?? 'other')
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : '1')
  const [unitPrice, setUnitPrice] = useState(initial ? String(initial.unit_price) : '')
  const [notes, setNotes]       = useState(initial?.notes ?? '')

  const q = parseFloat(quantity)
  const p = parseFloat(unitPrice)
  const valid = label.trim() !== '' && q > 0 && !isNaN(p) && p >= 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      booking_id: bookingId,
      date, label: label.trim(), category,
      quantity: q, unit_price: p,
      notes: notes.trim() || null,
    })
  }

  const input = 'w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400'
  return (
    <form onSubmit={handleSubmit} className="mt-2 mb-1 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder={i18n.accounting.bf_extra_label_ph[lang]} className={input} required autoFocus />
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={input} required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <select value={category} onChange={e => setCategory(e.target.value as BookingChargeCategory)} className={input}>
          {EXTRA_CATEGORIES.map(c => <option key={c} value={c}>{extraCategoryLabel(c, lang)}</option>)}
        </select>
        <label className="text-xs text-gray-500 dark:text-gray-400">
          {category === 'accommodation' ? i18n.accounting.bf_extra_nights[lang] : i18n.accounting.bf_extra_qty[lang]}
          <input type="number" min="0.01" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} className={input} required />
        </label>
        <label className="text-xs text-gray-500 dark:text-gray-400">
          {i18n.accounting.bf_extra_unit_price[lang]}
          <input type="number" min="0" step="0.01" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} className={input} required />
        </label>
      </div>
      <input value={notes} onChange={e => setNotes(e.target.value)} placeholder={i18n.accounting.bf_extra_notes_ph[lang]} className={input} />
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
          {i18n.common.btn_cancel[lang]}
        </button>
        <button type="submit" disabled={!valid}
          className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm font-semibold">
          {initial ? i18n.accounting.bf_update[lang] : i18n.accounting.bf_extra_add[lang]}
          {valid ? ` · ${fmtEur(chargeAmount({ quantity: q, unit_price: p }))}` : ''}
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
  const { lang } = useLanguage()
  const [showAddPayment, setShowAddPayment] = useState(false)
  const [showAddDiscount, setShowAddDiscount] = useState(false)
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [editingRoomPriceId, setEditingRoomPriceId] = useState<string | null>(null)
  const [editingRentalId, setEditingRentalId] = useState<string | null>(null)
  const [editingLessonPriceId, setEditingLessonPriceId] = useState<string | null>(null)
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null)
  const [showAddActivity, setShowAddActivity] = useState(false)
  const [editingExtraId, setEditingExtraId] = useState<string | null>(null)
  const [showAddExtra, setShowAddExtra] = useState(false)

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
  const extrasRev        = computeExtrasRevenue(b, data)
  const bkExtras         = (data.bookingCharges ?? []).filter(c => c.booking_id === b.id)
    .sort((x, y) => x.date.localeCompare(y.date))

  // Room detail
  const bkRooms = data.bookingRooms.filter(br => br.booking_id === b.id)
  const extAccomm = data.externalAccommodationBkgs.filter(e => e.booking_id === b.id)

  // Lessons detail
  // Own lessons + group lessons where one of this booking's riders sits (billed per head)
  const bkLessons = lessonsForBooking(b.id, data.lessons, data.bookingParticipants)

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
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3 sm:p-6 space-y-5 sm:space-y-6">

      <ClientShareLink bookingNumber={b.booking_number} clientName={b.client ? `${b.client.first_name} ${b.client.last_name}` : ''} />

      {/* Header totals */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 sm:p-4 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-400 uppercase tracking-wide mb-1">{i18n.common.label_total[lang]}</p>
          <p className="text-base sm:text-xl font-bold text-gray-800 dark:text-gray-200">{fmtEur(total)}</p>
          {nights > 0 && <p className="text-xs text-gray-400 dark:text-gray-400 mt-1">{i18n.accounting.bf_nights[lang].replace('{count}', String(nights))}</p>}
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-lg p-2 sm:p-4 text-center">
          <p className="text-xs text-emerald-500 dark:text-emerald-400 uppercase tracking-wide mb-1">{i18n.accounting.label_paid[lang]}</p>
          <p className="text-base sm:text-xl font-bold text-emerald-700 dark:text-emerald-400">{fmtEur(paid)}</p>
          {paid === 0 && <p className="text-xs text-amber-500 dark:text-amber-400 mt-1">{i18n.accounting.bf_deposit_suggested[lang].replace('{amount}', fmtEur(sugDeposit))}</p>}
        </div>
        <div className={`rounded-lg p-2 sm:p-4 text-center ${due > 0 ? 'bg-amber-50 dark:bg-amber-950/40' : 'bg-emerald-50 dark:bg-emerald-950/40'}`}>
          <p className={`text-xs uppercase tracking-wide mb-1 ${due > 0 ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-500 dark:text-emerald-400'}`}>
            {due > 0 ? i18n.accounting.label_outstanding[lang] : i18n.accounting.bf_settled[lang]}
          </p>
          <p className={`text-base sm:text-xl font-bold ${due > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{fmtEur(due)}</p>
        </div>
      </div>

      {/* Price breakdown */}
      <div>
        <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">{i18n.accounting.bf_price_breakdown[lang]}</p>
        <div className="space-y-2">

          {/* Accommodation */}
          {(bkRooms.length > 0 || extAccomm.length > 0) && (
            <div className="rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="flex justify-between items-center px-4 py-2 bg-gray-50 dark:bg-gray-800">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">🏠 {i18n.accounting.rev_accommodation[lang]}</span>
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
                  const isBungalow = acc?.type === 'bungalow'
                  const paidToOwner = snap?.paid_to_owner === true
                  // Narrow row on purpose: a spread of `snap` would carry the
                  // GENERATED share_price_per_night column and fail the upsert.
                  const togglePaidToOwner = () => handlers.upsertBookingRoomPrice({
                    booking_id: b.id,
                    room_id: br.room_id,
                    price_per_night: rate,
                    override_note: snap?.override_note ?? null,
                    paid_to_owner: !paidToOwner,
                  })
                  // A spot in an externally-billed place holds no nightly rate by
                  // design: showing it at 0 €/N next to the flat line below would
                  // read as a missing price, which is exactly the alarm we want to
                  // keep meaningful elsewhere.
                  if (acc?.external_billing) {
                    return (
                      <div key={br.room_id} className="flex justify-between text-xs text-gray-400 dark:text-gray-400">
                        <span>{roomLabel} × {nights}N</span>
                        <span className="italic">{i18n.accounting.bf_billed_per_stay[lang]}</span>
                      </div>
                    )
                  }
                  return (
                    <div key={br.room_id} className="text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex justify-between items-center">
                        <span>
                          {roomLabel} × {nights}N @ {fmtEur(rate)}/N
                          {snap?.override_note && <span className="ml-2 text-amber-500 dark:text-amber-400 italic">({snap.override_note})</span>}
                          {hasNoPrice && (
                            <span className="ml-2 text-red-400 dark:text-red-300 font-medium">
                              {rate > 0 ? i18n.accounting.bf_warn_base_rate[lang] : i18n.accounting.bf_warn_no_price[lang]}
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={paidToOwner ? 'line-through text-gray-300 dark:text-gray-500' : ''}>{fmtEur(rate * nights)}</span>
                          <button onClick={() => setEditingRoomPriceId(isEditing ? null : br.room_id)}
                            className={`p-1 -m-1 transition-colors ${hasNoPrice ? 'text-red-400 dark:text-red-300 hover:text-red-600 dark:hover:text-red-400' : 'text-gray-300 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400'}`}>✏️</button>
                        </div>
                      </div>
                      {isBungalow && (
                        <label className="flex items-center gap-1.5 mt-0.5 cursor-pointer w-fit" title={i18n.accounting.bf_paid_to_owner_hint[lang]}>
                          <input type="checkbox" checked={paidToOwner} onChange={togglePaidToOwner} className="accent-purple-600" />
                          <span className={paidToOwner ? 'text-purple-700 dark:text-purple-400 font-medium' : 'text-gray-400 dark:text-gray-500'}>
                            {i18n.accounting.bf_paid_to_owner[lang]}
                          </span>
                        </label>
                      )}
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
                  const acc = data.accommodations.find(a => a.id === e.accommodation_id)
                  const n = countNights(e.check_in, e.check_out)
                  // Flat rate for the whole stay — the night count is shown for
                  // context only, it never multiplies anything.
                  const revenue = e.total_sell_price
                  const cost    = e.total_cost
                  return (
                    <div key={e.id} className="space-y-0.5">
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>{acc?.name ?? i18n.accounting.label_external[lang]} × {n}N — {i18n.accounting.bf_flat_rate[lang]}</span>
                        <span>{fmtEur(revenue)}</span>
                      </div>
                      {cost > 0 && (
                        <>
                          <div className="flex justify-between text-xs text-gray-400 dark:text-gray-400 pl-4">
                            <span>{i18n.accounting.bf_cost[lang]}</span>
                            <span className="text-red-400 dark:text-red-300">−{fmtEur(cost)}</span>
                          </div>
                          <div className="flex justify-between text-xs font-medium pl-4">
                            <span className="text-emerald-600 dark:text-emerald-400">{i18n.accounting.bf_margin[lang]}</span>
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
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">🏄 {i18n.accounting.rev_lessons[lang]}</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{fmtEur(lessonsRev)}</span>
              </div>
              <div className="px-4 py-2 space-y-1">
                {bkLessons.map(l => {
                  const instr = data.instructors.find(i => i.id === l.instructor_id)
                  const rate = getLessonClientRate(l, data.priceItems, { tiers: data.priceTiers, allLessons: data.lessons, bookingParticipants: data.bookingParticipants })
                  const listRate = getConfiguredRate(data.priceItems, lessonBillable(l.type, lessonDiscipline(l))) ?? 0
                  const isCustom = l.price_per_hour !== null && l.price_per_hour !== listRate
                  const heads = l.type === 'group' ? lessonHeadsFor(l, b.id, data.bookingParticipants) : 1
                  const isShared = l.booking_id !== b.id
                  const ownerNr = isShared ? data.bookings.find(x => x.id === l.booking_id)?.booking_number : undefined
                  const isEditing = editingLessonPriceId === l.id
                  return (
                    <div key={l.id} className="text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex justify-between items-center">
                        <span>
                          {l.type} · {l.duration_hours}h · {fmtDate(l.date)}{instr ? ` (${instr.first_name})` : ''}
                          {lessonGearText(l, null, data.equipment) && (
                            <span className="ml-1 text-gray-400 dark:text-gray-500">({lessonGearText(l, null, data.equipment)})</span>
                          )}
                          {l.type === 'group' && <span className="ml-1">× {heads}</span>}
                          {isShared && (
                            <span className="ml-1 italic text-gray-400 dark:text-gray-500">
                              (shared lesson, booked on #{ownerNr !== undefined ? String(ownerNr).padStart(3, '0') : '?'})
                            </span>
                          )}
                          {l.participant_ids.length > 0 && (
                            <span className="ml-1 text-blue-400 dark:text-blue-300">— {partNames(l.participant_ids)}</span>
                          )}
                          {isCustom && <span className="ml-1 text-amber-500 dark:text-amber-400 italic">({i18n.accounting.bf_custom_price[lang]})</span>}
                          {rate === 0 && (
                            <span className="ml-2 text-red-400 dark:text-red-300 font-medium">{i18n.accounting.bf_no_price_configured[lang]}</span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <span>{fmtEur(rate * l.duration_hours * heads)}</span>
                          {/* The price is edited on the booking that owns the lesson, so it never moves under the other account */}
                          {!isShared && (
                            <button onClick={() => setEditingLessonPriceId(isEditing ? null : l.id)}
                              className={`p-1 -m-1 transition-colors ${isCustom ? 'text-amber-400 dark:text-amber-300 hover:text-amber-600 dark:hover:text-amber-400' : 'text-gray-300 dark:text-gray-500 hover:text-amber-500 dark:hover:text-amber-400'}`}>✏️</button>
                          )}
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
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">🎿 {i18n.accounting.bf_equipment_rentals[lang]}</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{fmtEur(rentalsRev)}</span>
              </div>
              <div className="px-4 py-2 space-y-1">
                {bkRentals.map(r => {
                  const typeLabel = rentalLabel(rentalKind(r, data.equipment), 'staff')
                  const isEditing = editingRentalId === r.id
                  return (
                    <div key={r.id} className="text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex justify-between items-center">
                        <span>
                          {fmtDate(r.date)} · {typeLabel}{inParens(rentalGearText(r, data.equipment))} · {r.slot}
                          {r.participant_id && partName(r.participant_id) && (
                            <span className="ml-1 text-blue-400 dark:text-blue-300">— {partName(r.participant_id)}</span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <span>
                            {r.list_price != null && r.list_price > r.price && (
                              <span className="line-through opacity-60 mr-1" title="Grid price">{fmtEur(r.list_price)}</span>
                            )}
                            {fmtEur(r.price)}
                          </span>
                          <button onClick={() => setEditingRentalId(isEditing ? null : r.id)}
                            className="p-1 -m-1 text-gray-300 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">✏️</button>
                        </div>
                      </div>
                      {(r.notes || r.client_note) && (
                        <div className="italic text-gray-400 dark:text-gray-400">
                          {r.list_price != null && r.list_price > r.price && (
                            <span className="not-italic font-medium text-purple-600 dark:text-purple-400 mr-1">
                              -{fmtEur(r.list_price - r.price)} {i18n.accounting.bf_rental_discount[lang]} ·
                            </span>
                          )}
                          {[r.notes, r.client_note].filter(Boolean).join(' · ')}
                        </div>
                      )}
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
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">🚕 {i18n.accounting.bf_taxis[lang]}</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{fmtEur(taxiRev)}</span>
              </div>
              <div className="px-4 py-2 space-y-1">
                {bkTaxis.map(t => (
                  <div key={t.id} className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{fmtDate(t.date)} · {t.type} · {t.nb_persons}p</span>
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
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">🍽️ {i18n.accounting.bf_dining_events[lang]}</span>
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
                          {fmtDate(ev.date)} · {ev.name || i18n.accounting.bf_unnamed[lang]} · {attending.length}p @ {fmtEur(ev.price_per_person)}
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
          {/* Always shown, even empty: it is where an outing gets billed. */}
          {(() => {
            const today = todayISO()
            const defaultDate = today >= b.check_in && today <= b.check_out ? today : b.check_in
            return (
            <div className="rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="flex justify-between items-center px-4 py-2 bg-gray-50 dark:bg-gray-800">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">🎯 {i18n.accounting.rev_activities[lang]}</span>
                <div className="flex items-center gap-3">
                  {!showAddActivity && (
                    <button onClick={() => { setShowAddActivity(true); setEditingActivityId(null) }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline">+ {i18n.accounting.bf_act_add[lang]}</button>
                  )}
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{fmtEur(activityRev)}</span>
                </div>
              </div>
              <div className="px-4 py-2 space-y-1">
                {bkActivities.map(a => (
                  <div key={a.id}>
                    <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                      <span>
                        {fmtDate(a.date)} · {a.label} · {a.nb_persons}p
                        {a.participant_ids.length > 0 && (
                          <span className="ml-1 text-blue-400 dark:text-blue-300">— {partNames(a.participant_ids)}</span>
                        )}
                        {a.price_provider > 0 && (
                          <span className="ml-1 text-gray-400 dark:text-gray-500">({i18n.accounting.bf_act_cost_short[lang]} {fmtEur(a.price_provider)})</span>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        <span>{fmtEur(a.price_client)}</span>
                        <button onClick={() => { setEditingActivityId(editingActivityId === a.id ? null : a.id); setShowAddActivity(false) }}
                          className="p-1 -m-1 text-gray-300 dark:text-gray-500 hover:text-amber-500 dark:hover:text-amber-400 transition-colors">✏️</button>
                        <button onClick={() => handlers.deleteActivityBooking(a.id)} title={i18n.accounting.bf_act_delete[lang]}
                          className="p-1 -m-1 text-gray-300 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors">✕</button>
                      </div>
                    </div>
                    {editingActivityId === a.id && (
                      <ActivityLineForm
                        initial={a}
                        defaultDate={defaultDate}
                        participants={bkParts}
                        onSave={v => { handlers.updateActivityBooking({ ...a, ...v }); setEditingActivityId(null) }}
                        onCancel={() => setEditingActivityId(null)}
                      />
                    )}
                  </div>
                ))}
                {bkActivities.length === 0 && !showAddActivity && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 italic">{i18n.accounting.bf_act_none[lang]}</p>
                )}
                {showAddActivity && (
                  <ActivityLineForm
                    defaultDate={defaultDate}
                    participants={bkParts}
                    onSave={v => {
                      handlers.addInHouseActivity({
                        id: crypto.randomUUID(), booking_id: b.id, payment_flow: 'we_pay_provider', notes: null, ...v,
                      })
                      setShowAddActivity(false)
                    }}
                    onCancel={() => setShowAddActivity(false)}
                  />
                )}
              </div>
            </div>
            )
          })()}

          {/* Center access */}
          {centerAccessRev > 0 && (
            <div className="rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="flex justify-between items-center px-4 py-2 bg-gray-50 dark:bg-gray-800">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">🏖️ {i18n.accounting.rev_center_access[lang]}</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{fmtEur(centerAccessRev)}</span>
              </div>
              <div className="px-4 py-2">
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{b.num_center_access} {b.num_center_access > 1 ? i18n.accounting.bf_persons[lang] : i18n.accounting.bf_person[lang]} × {nights}N @ {fmtEur(b.center_access_rate)}/day</span>
                  <span>{fmtEur(centerAccessRev)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Extras — hand-typed lines. Always shown, like Activities: it is
              where an unplanned night or a breakage gets billed. Never part of
              an agency invoice: the guest pays them directly. */}
          {(() => {
            const today = todayISO()
            const defaultDate = today >= b.check_in && today <= b.check_out ? today : b.check_in
            return (
            <div className="rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="flex justify-between items-center px-4 py-2 bg-gray-50 dark:bg-gray-800">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">➕ {i18n.accounting.bf_extras[lang]}</span>
                <div className="flex items-center gap-3">
                  {!showAddExtra && (
                    <button onClick={() => { setShowAddExtra(true); setEditingExtraId(null) }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline">+ {i18n.accounting.bf_extra_add[lang]}</button>
                  )}
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{fmtEur(extrasRev)}</span>
                </div>
              </div>
              <div className="px-4 py-2 space-y-1">
                {b.agency_id && (
                  <p className="text-xs text-indigo-500 dark:text-indigo-400">{i18n.accounting.bf_extra_agency_hint[lang]}</p>
                )}
                {bkExtras.map(c => (
                  <div key={c.id}>
                    <div className="flex justify-between items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>
                        {fmtDate(c.date)} · {c.label}
                        <span className="ml-1 text-gray-400 dark:text-gray-500">
                          ({extraCategoryLabel(c.category, lang)} · {c.quantity} × {fmtEur(c.unit_price)})
                        </span>
                        {c.notes && <span className="ml-1 italic text-gray-400 dark:text-gray-500">— {c.notes}</span>}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span>{fmtEur(chargeAmount(c))}</span>
                        <button onClick={() => { setEditingExtraId(editingExtraId === c.id ? null : c.id); setShowAddExtra(false) }}
                          className="p-1 -m-1 text-gray-300 dark:text-gray-500 hover:text-amber-500 dark:hover:text-amber-400 transition-colors">✏️</button>
                        <button onClick={() => handlers.deleteBookingCharge(c.id)} title={i18n.accounting.bf_extra_delete[lang]}
                          className="p-1 -m-1 text-gray-300 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors">✕</button>
                      </div>
                    </div>
                    {editingExtraId === c.id && (
                      <ExtraLineForm
                        bookingId={b.id}
                        initial={c}
                        defaultDate={defaultDate}
                        onSave={v => { handlers.updateBookingCharge(v); setEditingExtraId(null) }}
                        onCancel={() => setEditingExtraId(null)}
                      />
                    )}
                  </div>
                ))}
                {bkExtras.length === 0 && !showAddExtra && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 italic">{i18n.accounting.bf_extra_none[lang]}</p>
                )}
                {showAddExtra && (
                  <ExtraLineForm
                    bookingId={b.id}
                    defaultDate={defaultDate}
                    onSave={v => { handlers.addBookingCharge(v); setShowAddExtra(false) }}
                    onCancel={() => setShowAddExtra(false)}
                  />
                )}
              </div>
            </div>
            )
          })()}

          {/* Total line */}
          <div className="flex justify-between items-center px-4 py-2 bg-gray-800 rounded-lg text-white text-sm font-bold">
            <span>{i18n.common.label_total[lang]}</span>
            <span>{fmtEur(total)}</span>
          </div>
          {discounts > 0 && (
            <div className="flex justify-between items-center px-4 py-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-700 dark:text-purple-400 text-sm font-bold">
              <span>{i18n.accounting.bf_discount_badge[lang]}</span>
              <span>-{fmtEur(discounts)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Partner agency — only for a booking tagged with one in the wizard.
          Everything it takes over disappears from the breakdown above: the total
          right there is what the GUEST owes, never the whole stay's value. */}
      <AgencyBillingPanel booking={b} data={data} handlers={handlers} />

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
            const rate = getLessonClientRate(l, data.priceItems, { tiers: data.priceTiers, allLessons: data.lessons, bookingParticipants: data.bookingParticipants })
            lines.push({
              date: l.date,
              label: `${l.type} ${i18n.accounting.bf_word_lesson[lang]} ${l.duration_hours}h${instr ? ` (${instr.first_name})` : ''}${inParens(lessonGearText(l, part.id, data.equipment))}`,
              amount: rate * l.duration_hours,
            })
          }

          // Rentals assigned to this participant
          for (const r of bkRentals) {
            if (r.participant_id !== part.id) continue
            // Per-guest breakdown: the guest's wording ("Kite + bar + board"), not our "Full".
            const kind = rentalKind(r, data.equipment)
            lines.push({ date: r.date, label: `${kind ? rentalLabel(kind, 'client') : i18n.accounting.bf_word_rental[lang]}${inParens(rentalGearText(r, data.equipment))} · ${r.slot}`, amount: r.price })
          }

          // Dining events where this participant attended
          for (const ev of data.diningEvents) {
            const att = (ev.attendees ?? []).find(a => a.is_attending && a.person_type === 'participant' && a.person_id === part.id)
            if (!att) continue
            const amount = att.price_override ?? ev.price_per_person
            if (amount === 0) continue
            lines.push({ date: ev.date, label: ev.name || i18n.accounting.bf_word_dining[lang], amount })
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
              {i18n.accounting.bf_per_guest_breakdown[lang]}
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
                        <span>{fmtDate(l.date)} · {l.label}</span>
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
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">{i18n.accounting.bf_payments_header[lang]}</p>
          {!showAddPayment && !showAddDiscount && (
            <div className="flex gap-2">
              <button onClick={() => setShowAddDiscount(true)}
                className="text-xs px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium">
                {i18n.accounting.bf_plus_discount[lang]}
              </button>
              <button onClick={() => setShowAddPayment(true)}
                className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                {i18n.accounting.bf_plus_payment[lang]}
              </button>
            </div>
          )}
        </div>

        {showAddPayment && (
          <PaymentForm
            bookingId={b.id}
            outstanding={due}
            associates={data.associates}
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
          <p className="text-sm text-gray-400 dark:text-gray-400 italic">{i18n.accounting.bf_no_payments[lang]}</p>
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
                      outstanding={due + p.amount}
                      associates={data.associates}
                      onSave={(updated) => { handlers.updatePayment(updated); setEditingPaymentId(null) }}
                      onCancel={() => setEditingPaymentId(null)}
                    />
                  )
                ) : (
                  <div className={`flex items-center justify-between text-sm rounded-lg px-4 py-2 ${p.is_discount ? 'bg-purple-50 dark:bg-purple-950/40' : 'bg-gray-50 dark:bg-gray-800'}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-gray-400 dark:text-gray-400 text-xs">{fmtDate(p.date)}</span>
                      {p.is_discount ? (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">{i18n.accounting.bf_discount_badge[lang]}</span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${METHOD_COLORS[p.method]}`}>
                          {methodLabels(lang)[p.method]}
                        </span>
                      )}
                      {p.is_deposit && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">{i18n.accounting.bf_deposit[lang]}</span>
                      )}
                      {!p.is_discount && p.received_by_associate_id && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">
                          → {data.associates.find(a => a.id === p.received_by_associate_id)?.name ?? '?'}
                        </span>
                      )}
                      {!p.is_discount && (
                        p.is_verified
                          ? <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">{i18n.accounting.bf_status_verified[lang]}</span>
                          : <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">{i18n.accounting.bf_status_to_verify[lang]}</span>
                      )}
                      {p.notes && <span className="text-gray-400 dark:text-gray-400 text-xs italic">{p.notes}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${p.is_discount ? 'text-purple-700 dark:text-purple-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                        {p.is_discount ? '-' : ''}{fmtEur(p.amount)}
                      </span>
                      <button onClick={() => setEditingPaymentId(p.id)}
                        className="p-1 -m-1 text-gray-300 dark:text-gray-500 hover:text-amber-500 dark:hover:text-amber-400 transition-colors text-xs">✏️</button>
                      {/* One click used to erase money received, with nothing to undo it. */}
                      <button onClick={() => {
                        const msg = (p.is_discount ? i18n.accounting.bf_confirm_delete_discount : i18n.accounting.bf_confirm_delete_payment)[lang]
                          .replace('{amount}', fmtEur(p.amount)).replace('{date}', fmtDate(p.date))
                        if (confirm(msg)) handlers.deletePayment(p.id)
                      }}
                        className="p-1 -m-1 text-gray-300 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors text-xs">✕</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div className="flex justify-between items-center px-4 py-2 border-t text-sm font-semibold">
              <span className="text-gray-600 dark:text-gray-400">{i18n.accounting.bf_total_paid[lang]}</span>
              <span className="text-emerald-700 dark:text-emerald-400">{fmtEur(paid)}</span>
            </div>
            <div className="flex justify-between items-center px-4 pb-2 text-sm font-semibold">
              <span className="text-gray-600 dark:text-gray-400">{i18n.accounting.bf_remaining[lang]}</span>
              <span className={due > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}>
                {due > 0 ? fmtEur(due) : i18n.accounting.bf_settled[lang]}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

/** Under the guest's name on an agency booking: which agency, and how much of
 *  its lesson packages is used — with ⚠️ when lessons are billed to the guest
 *  although hours are left (the #022 trap). Shown in both renders (table + cards). */
function AgencySummary({ bookingId, data }: { bookingId: string; data: SharedAccountingData }) {
  const b = data.bookings.find(x => x.id === bookingId)
  const agency = b?.agency_id ? data.agencies.find(a => a.id === b.agency_id) : undefined
  if (!agency) return null
  const pool = agencyHoursPool(bookingId, agencyPackageHours(bookingId, data.agencyBillingLines), data.lessons)
  const warn = pool != null && pool.extra > 0 && pool.left > 0
  return (
    <div className="text-xs font-normal text-indigo-600 dark:text-indigo-400">
      🤝 {agency.name}
      {pool && <span className="text-gray-500 dark:text-gray-400"> · 🏄 {pool.used}/{pool.included} h</span>}
      {warn && (
        <span className="ml-1 text-red-600 dark:text-red-400"
          title={`${pool.extra} h billed to the guest while ${pool.left} h are left on the package`}>
          ⚠️ {pool.extra} h not on the package
        </span>
      )}
    </div>
  )
}

export default function BookingFinances({ data, handlers }: Props) {
  const { lang } = useLanguage()
  const { bookings, clients, payments } = data
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showCancelled, setShowCancelled] = useState(false)
  const [presentOnly, setPresentOnly] = useState(false)
  const [daysBefore, setDaysBefore] = useState('')  // window start: x days before today
  const [daysAfter, setDaysAfter] = useState('')    // window end: y days after today
  const [search, setSearch] = useState('')

  const standaloneTrips = data.taxiTrips.filter(t => t.booking_id === null)
  const standaloneRev   = computeStandaloneTaxiRevenue(data)

  // Accent- and case-insensitive; matches the booker, any guest on the booking,
  // or the booking number ("47", "#047").
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const q = norm(search.trim().replace(/^#/, ''))

  const rows = bookings
    .filter(b => showCancelled || b.status !== 'cancelled')
    .filter(b => {
      if (!q) return true
      const client = clients.find(c => c.id === b.client_id)
      const names = [
        client ? `${client.first_name} ${client.last_name ?? ''}` : '',
        ...data.bookingParticipants.filter(p => p.booking_id === b.id).map(p => `${p.first_name} ${p.last_name ?? ''}`),
        String(b.booking_number).padStart(3, '0'),
      ]
      return names.some(n => norm(n).includes(q))
    })
    .filter(b => {
      if (presentOnly) {
        const today = todayISO()
        if (b.check_in > today || b.check_out < today) return false
      }
      // Presence window relative to today: keep stays that overlap it.
      // An empty bound leaves that side open.
      const before = parseInt(daysBefore, 10)
      const after  = parseInt(daysAfter, 10)
      if (!isNaN(before) && b.check_out < addDaysISO(todayISO(), -before)) return false
      if (!isNaN(after)  && b.check_in  > addDaysISO(todayISO(), after))   return false
      return true
    })
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
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: i18n.bookings.label_total_billed[lang],    value: activeRows.reduce((s, r) => s + r.total, 0), color: 'text-gray-800 dark:text-gray-200' },
          { label: i18n.bookings.label_total_collected[lang], value: activeRows.reduce((s, r) => s + r.paid, 0),  color: 'text-emerald-700 dark:text-emerald-400' },
          { label: i18n.bookings.label_total_outstanding[lang], value: activeRows.reduce((s, r) => s + r.due, 0), color: 'text-amber-700 dark:text-amber-400' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-3 sm:px-5 py-3 sm:py-4">
            <p className="text-xs text-gray-400 dark:text-gray-400 uppercase tracking-wide mb-1">{kpi.label}</p>
            <p className={`text-base sm:text-xl font-bold ${kpi.color}`}>{fmtEur(kpi.value)}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-600 dark:text-gray-400">
        <input type="search" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={i18n.accounting.bf_filter_search_ph[lang]}
          className="w-full sm:w-56 px-3 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400" />
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={presentOnly} onChange={e => setPresentOnly(e.target.checked)} className="rounded" />
          {i18n.accounting.bf_filter_present[lang]}
        </label>
        <label className="flex items-center gap-2">
          {i18n.accounting.bf_filter_from[lang]}
          <input type="number" min="0" value={daysBefore} onChange={e => setDaysBefore(e.target.value)}
            className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400" />
          {i18n.accounting.bf_filter_days_before[lang]}
        </label>
        <label className="flex items-center gap-2">
          {i18n.accounting.bf_filter_to[lang]}
          <input type="number" min="0" value={daysAfter} onChange={e => setDaysAfter(e.target.value)}
            className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400" />
          {i18n.accounting.bf_filter_days_after[lang]}
        </label>
      </div>

      {/* Mobile: one card per booking, tap = open its account */}
      <div className="md:hidden space-y-2">
        {rows.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-400 italic text-center py-6">–</p>}
        {rows.map(({ booking: b, client, total, paid, due }) => {
          const isExpanded = expandedId === b.id
          const marker = agencyMarker({ booking_id: b.id }, data)
          return (
            <div key={b.id}
              className={`bg-white dark:bg-gray-900 rounded-xl border overflow-hidden ${
                isExpanded ? 'border-blue-300 dark:border-blue-800' : 'border-gray-200 dark:border-gray-800'
              } ${b.status === 'cancelled' ? 'opacity-50' : ''}`}>
              <button type="button" onClick={() => setExpandedId(isExpanded ? null : b.id)}
                className="w-full text-left p-3 active:bg-gray-50 dark:active:bg-gray-800">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-gray-400 dark:text-gray-400">#{String(b.booking_number).padStart(3, '0')}</div>
                    <div className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                      {marker && <span className="mr-1 text-gray-500 dark:text-gray-400">{marker}</span>}
                      {client ? `${client.first_name} ${client.last_name}` : '–'}
                    </div>
                    <AgencySummary bookingId={b.id} data={data} />
                    <div className="text-xs text-gray-500 dark:text-gray-400">{fmtDate(b.check_in)} → {fmtDate(b.check_out)}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      b.status === 'confirmed'   ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400' :
                      b.status === 'provisional' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400' :
                      'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-400'
                    }`}>{b.status === 'confirmed' ? i18n.bookings.status_confirmed[lang] : b.status === 'provisional' ? i18n.bookings.status_provisional[lang] : i18n.bookings.status_cancelled[lang]}</span>
                    <span className="text-gray-400 dark:text-gray-500 text-xs">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800 py-1.5">
                    <div className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-400">{i18n.common.label_total[lang]}</div>
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{fmtEur(total)}</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800 py-1.5">
                    <div className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-400">{i18n.accounting.label_paid[lang]}</div>
                    <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{fmtEur(paid)}</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800 py-1.5">
                    <div className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-400">{i18n.accounting.bf_balance[lang]}</div>
                    <div className={`text-sm font-bold ${
                      b.status === 'cancelled' ? 'text-gray-400 dark:text-gray-400' :
                      due <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                    }`}>{due <= 0 ? '✓' : fmtEur(due)}</div>
                  </div>
                </div>
              </button>
              {isExpanded && (
                <div className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 p-2">
                  <BookingDetailPanel booking={b} data={data} handlers={handlers} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400 w-12">#</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">{i18n.bookings.col_client[lang]}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">{i18n.bookings.col_dates[lang]}</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">{i18n.common.label_total[lang]}</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">{i18n.accounting.label_paid[lang]}</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">{i18n.accounting.bf_balance[lang]}</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">{i18n.common.label_status[lang]}</th>
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
                    <td className="px-4 py-3 text-gray-400 dark:text-gray-400">#{String(b.booking_number).padStart(3, '0')}</td>
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                      {/* Explains at a glance why this booking's total can be lower
                          than the stay is worth: part of it is billed to an agency. */}
                      {agencyMarker({ booking_id: b.id }, data) && (
                        <span className="mr-1 text-gray-500 dark:text-gray-400" title="Booking from a partner agency">
                          {agencyMarker({ booking_id: b.id }, data)}
                        </span>
                      )}
                      {client ? `${client.first_name} ${client.last_name}` : '–'}
                      <AgencySummary bookingId={b.id} data={data} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                      {fmtDate(b.check_in)} → {fmtDate(b.check_out)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-gray-200">{fmtEur(total)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-400">{fmtEur(paid)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${
                      b.status === 'cancelled' ? 'text-gray-400 dark:text-gray-400' :
                      due <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {due <= 0 ? '✓' : fmtEur(due)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        b.status === 'confirmed'   ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400' :
                        b.status === 'provisional' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400' :
                        'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-400'
                      }`}>{b.status === 'confirmed' ? i18n.bookings.status_confirmed[lang] : b.status === 'provisional' ? i18n.bookings.status_provisional[lang] : i18n.bookings.status_cancelled[lang]}</span>
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
          className="text-xs text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-400"
        >
          {showCancelled ? i18n.accounting.bf_hide_cancelled[lang] : i18n.accounting.bf_show_cancelled[lang]}
        </button>
      </div>

      {/* Unlinked taxi trips */}
      {standaloneTrips.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-amber-200 dark:border-amber-900 overflow-hidden">
          <div className="flex justify-between items-center gap-3 px-3 sm:px-5 py-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900">
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">{i18n.accounting.bf_unlinked_taxi_trips[lang]}</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">{i18n.accounting.bf_not_attached[lang]}</p>
            </div>
            <p className="text-sm font-bold text-amber-800 dark:text-amber-400">{fmtEur(standaloneRev)}</p>
          </div>
          {/* Mobile: one line per trip */}
          <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
            {standaloneTrips.map(t => (
              <div key={t.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="text-gray-700 dark:text-gray-300">{fmtDate(t.date)} · {t.type} · {t.nb_persons}p</div>
                  {t.notes && <div className="text-xs italic text-gray-400 dark:text-gray-400">{t.notes}</div>}
                </div>
                <span className="font-semibold text-gray-700 dark:text-gray-300 shrink-0">{fmtEur(t.price_eur)}</span>
              </div>
            ))}
          </div>
          <table className="hidden md:table w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400 text-xs">{i18n.common.label_date[lang]}</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400 text-xs">{i18n.accounting.bf_type[lang]}</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400 text-xs">{i18n.accounting.bf_persons_col[lang]}</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400 text-xs">{i18n.common.label_notes[lang]}</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500 dark:text-gray-400 text-xs">{i18n.common.label_amount[lang]}</th>
              </tr>
            </thead>
            <tbody>
              {standaloneTrips.map(t => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{fmtDate(t.date)}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{t.type}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{t.nb_persons}p</td>
                  <td className="px-4 py-2 text-gray-400 dark:text-gray-400 italic text-xs">{t.notes ?? '–'}</td>
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
