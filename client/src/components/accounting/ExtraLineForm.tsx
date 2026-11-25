import { useState } from 'react'
import type { BookingCharge, BookingChargeCategory, Lang } from '../../types/database'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'
import { fmtEur, chargeAmount } from './utils'
import { fmtDate } from '../../utils/dates'
import { extraNights, extraNightsLabel } from './extraNights'

// ── Extra line form — a hand-typed amount the guest owes ────────────────────
// Used by the bill (BookingFinances) and the day-by-day grid (BookingDayGrid).

const EXTRA_CATEGORIES: BookingChargeCategory[] = ['accommodation', 'food', 'equipment', 'other']

export function extraCategoryLabel(c: BookingChargeCategory, lang: Lang): string {
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
  /** The booking's travellers, for "For" (who the extra is for). */
  participants: { id: string; first_name: string; last_name: string | null }[]
  onSave: (c: BookingCharge) => void
  onCancel: () => void
  /** Pre-filled values of a NEW line (the grid's "Center access" shortcut, its traveller). */
  preset?: Partial<Pick<BookingCharge, 'label' | 'unit_price' | 'participant_id' | 'category'>>
  /** Several days picked in the grid: the date field gives way to the range, and
   *  the caller writes one line per day from the single line saved here. */
  dates?: string[]
}
export default function ExtraLineForm({ bookingId, initial, defaultDate, participants, onSave, onCancel, preset, dates }: ExtraLineFormProps) {
  const { lang } = useLanguage()
  const [label, setLabel]       = useState(initial?.label ?? preset?.label ?? '')
  const [date, setDate]         = useState(initial?.date ?? defaultDate)
  const [category, setCategory] = useState<BookingChargeCategory>(initial?.category ?? preset?.category ?? 'other')
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : '1')
  const [unitPrice, setUnitPrice] = useState(initial ? String(initial.unit_price) : preset?.unit_price != null ? String(preset.unit_price) : '')
  const [notes, setNotes]       = useState(initial?.notes ?? '')
  // '' = everyone (equal shares in the split per person). One traveller only:
  // nothing to choose, the extra is theirs either way.
  const [forWhom, setForWhom]   = useState(initial?.participant_id ?? preset?.participant_id ?? '')
  const range = dates && dates.length > 1 ? dates : null
  // "From → until": one line, nights = the difference (new single-day lines only;
  // a grid range already writes one line per day, an edit keeps its label as is).
  const [until, setUntil] = useState('')
  const canUntil = !initial && !range
  const nights = canUntil ? extraNights(date, until) : 0

  const q = nights > 0 ? nights : parseFloat(quantity)
  const p = parseFloat(unitPrice)
  const valid = label.trim() !== '' && q > 0 && !isNaN(p) && p >= 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      booking_id: bookingId,
      date, category,
      label: nights > 0 ? extraNightsLabel(label.trim(), date, until, lang) : label.trim(),
      quantity: q, unit_price: p,
      notes: notes.trim() || null,
      participant_id: forWhom || null,
    })
  }

  const input = 'w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400'
  return (
    <form onSubmit={handleSubmit} className="mt-2 mb-1 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder={i18n.accounting.bf_extra_label_ph[lang]} className={input} required autoFocus />
        {range ? (
          <span className="self-center text-sm text-gray-600 dark:text-gray-300">
            {i18n.accounting.bf_grid_days_range[lang]
              .replace('{count}', String(range.length))
              .replace('{from}', fmtDate(range[0]))
              .replace('{to}', fmtDate(range[range.length - 1]))}
          </span>
        ) : (
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={input} required />
        )}
      </div>
      {canUntil && (
        <label className="block text-xs text-gray-500 dark:text-gray-400">
          {i18n.accounting.bf_extra_until[lang]}
          <input type="date" value={until} min={date} onChange={e => setUntil(e.target.value)} className={input} />
          {nights > 0 && (
            <span className="block mt-1 text-gray-600 dark:text-gray-300">
              {extraNightsLabel(label.trim() || '…', date, until, lang)}
            </span>
          )}
        </label>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <select value={category} onChange={e => setCategory(e.target.value as BookingChargeCategory)} className={input}>
          {EXTRA_CATEGORIES.map(c => <option key={c} value={c}>{extraCategoryLabel(c, lang)}</option>)}
        </select>
        <label className="text-xs text-gray-500 dark:text-gray-400">
          {category === 'accommodation' ? i18n.accounting.bf_extra_nights[lang] : i18n.accounting.bf_extra_qty[lang]}
          <input type="number" min="0.01" step="any" className={input} required
            value={nights > 0 ? String(nights) : quantity} readOnly={nights > 0}
            onChange={e => setQuantity(e.target.value)} />
        </label>
        <label className="text-xs text-gray-500 dark:text-gray-400">
          {i18n.accounting.bf_extra_unit_price[lang]}
          <input type="number" min="0" step="0.01" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} className={input} required />
        </label>
      </div>
      {participants.length > 1 && (
        <label className="block text-xs text-gray-500 dark:text-gray-400">
          {i18n.accounting.bf_extra_for[lang]}
          <select value={forWhom} onChange={e => setForWhom(e.target.value)} className={input}>
            <option value="">{i18n.accounting.bf_extra_for_everyone[lang]}</option>
            {participants.map(p => <option key={p.id} value={p.id}>{`${p.first_name} ${p.last_name ?? ''}`.trim()}</option>)}
          </select>
        </label>
      )}
      <input value={notes} onChange={e => setNotes(e.target.value)} placeholder={i18n.accounting.bf_extra_notes_ph[lang]} className={input} />
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
          {i18n.common.btn_cancel[lang]}
        </button>
        <button type="submit" disabled={!valid}
          className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm font-semibold">
          {initial ? i18n.accounting.bf_update[lang] : i18n.accounting.bf_extra_add[lang]}
          {valid ? ` · ${range ? `${range.length} × ` : ''}${fmtEur(chargeAmount({ quantity: q, unit_price: p }))}` : ''}
        </button>
      </div>
    </form>
  )
}
