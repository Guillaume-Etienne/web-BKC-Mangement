import { useEffect, useState, type ReactNode } from 'react'
import Modal from '../common/Modal'
import type { ActivityBooking, DayActivity, DaySlot } from '../../types/database'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'
import { supabase } from '../../lib/supabase'
import { billedActivityFormValues, type BillActivityRequest } from '../../utils/billedActivities'

interface Props {
  activity: DayActivity
  /** Booking of a guest ('' when unknown) — the bill goes to that booking. */
  bookingOf: (participantId: string) => string
  /** The Daily's own guest chips + "in the country / all guests" switches. */
  renderGuests: (selectedIds: string[], onToggle: (id: string) => void) => ReactNode
  onSave: (a: DayActivity, bill: { request: BillActivityRequest | null; existing: ActivityBooking[] }) => void
  onClose: () => void
}

const SLOTS: DaySlot[] = ['morning', 'afternoon', 'evening']

const inputCls = 'w-full text-sm border rounded px-2 py-2 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700'
const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

type Billed = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; rows: ActivityBooking[] }

/** Edit a Daily activity like it was created: name, slot, notes AND who is
 *  billed, at what price, at what cost to us. The bills are the
 *  activity_bookings rows linked to the card (day_activity_id, 2026-11-19);
 *  saving rewrites them booking by booking (utils/billedActivities.ts). */
export default function EditActivityModal({ activity, bookingOf, renderGuests, onSave, onClose }: Props) {
  const { lang } = useLanguage()
  const t = i18n.planning
  const [name, setName] = useState(activity.name)
  const [notes, setNotes] = useState(activity.notes ?? '')
  const [slot, setSlot] = useState<DaySlot>(activity.slot)
  const [billed, setBilled] = useState<Billed>({ state: 'loading' })
  const [bill, setBill] = useState(false)
  const [guests, setGuests] = useState<string[]>([])
  const [pricePP, setPricePP] = useState('')
  const [cost, setCost] = useState('')
  const [mixedPrices, setMixedPrices] = useState(false)

  // The bills are read here, not kept by the planning: they change from the
  // Accounting and Activities pages too, and this form must start from what is
  // really billed now.
  useEffect(() => {
    let alive = true
    supabase.from('activity_bookings').select('*').eq('day_activity_id', activity.id).then(({ data, error }) => {
      if (!alive) return
      if (error) { setBilled({ state: 'error', message: error.message }); return }
      const rows = (data ?? []) as ActivityBooking[]
      const v = billedActivityFormValues(rows)
      setBilled({ state: 'ready', rows })
      setBill(rows.length > 0)
      setGuests(v.participantIds)
      setPricePP(v.pricePerPerson === null ? '' : String(v.pricePerPerson))
      setCost(v.totalCost > 0 ? String(v.totalCost) : '')
      setMixedPrices(v.mixedPrices)
    })
    return () => { alive = false }
  }, [activity.id])

  const price = parseFloat(pricePP)
  const costNum = cost.trim() === '' ? 0 : parseFloat(cost)
  const billReady = guests.length > 0 && !isNaN(price) && price >= 0 && !isNaN(costNum) && costNum >= 0
  const wasBilled = billed.state === 'ready' && billed.rows.length > 0
  const canSave = name.trim() !== '' && billed.state === 'ready' && (!bill || billReady)

  function toggleGuest(id: string) {
    setGuests(g => g.includes(id) ? g.filter(x => x !== id) : [...g, id])
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave || billed.state !== 'ready') return
    const a: DayActivity = { ...activity, name: name.trim(), notes: notes.trim() || null, slot }
    const request: BillActivityRequest | null = bill ? {
      date: activity.date,
      label: a.name,
      pricePerPerson: price,
      totalCost: costNum,
      notes: a.notes,
      guests: guests.map(id => ({ participantId: id, bookingId: bookingOf(id) })).filter(g => g.bookingId),
    } : null
    onSave(a, { request, existing: billed.rows })
  }

  return (
    <Modal onClose={onClose} label={t.edit_activity_title[lang]} className="items-end sm:items-center justify-center sm:p-4">
      <form
        onSubmit={submit}
        className="bg-white dark:bg-gray-900 w-full sm:max-w-md max-h-[90dvh] overflow-y-auto rounded-t-xl sm:rounded-xl shadow-xl p-4 space-y-3"
      >
        <div>
          <h3 className="font-bold text-gray-800 dark:text-gray-200">{t.edit_activity_title[lang]}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{activity.date}</p>
        </div>

        <div>
          <label className={labelCls}>{t.edit_activity_name[lang]}</label>
          <input data-autofocus className={inputCls} value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>{t.edit_activity_slot[lang]}</label>
          <select className={inputCls} value={slot} onChange={e => setSlot(e.target.value as DaySlot)}>
            {SLOTS.map(s => <option key={s} value={s}>{t[`slot_${s}` as const][lang]}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <textarea className={inputCls} rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        {billed.state === 'loading' && (
          <p className="text-xs text-gray-400 dark:text-gray-400">{t.edit_activity_loading_bills[lang]}</p>
        )}
        {billed.state === 'error' && (
          <p className="text-xs text-red-600 dark:text-red-400">{t.edit_activity_bills_error[lang]} {billed.message}</p>
        )}
        {billed.state === 'ready' && (
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input type="checkbox" checked={bill} onChange={e => setBill(e.target.checked)} />
              {t.label_bill_guests[lang]}
            </label>
            {bill && (
              <>
                {renderGuests(guests, toggleGuest)}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>{t.ph_price_per_guest[lang]}</label>
                    <input type="number" min="0" step="0.01" inputMode="decimal" className={inputCls}
                      value={pricePP} onChange={e => setPricePP(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>{t.ph_our_cost[lang]}</label>
                    <input type="number" min="0" step="0.01" inputMode="decimal" className={inputCls}
                      value={cost} onChange={e => setCost(e.target.value)} />
                  </div>
                </div>
                {billReady && (
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    {t.msg_bill_total[lang]
                      .replace('{count}', String(guests.length))
                      .replace('{total}', `${Math.round(price * guests.length * 100) / 100} €`)}
                  </p>
                )}
                {mixedPrices && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">{t.edit_activity_mixed_prices[lang]}</p>
                )}
              </>
            )}
            {!bill && wasBilled && (
              <p className="text-xs text-amber-700 dark:text-amber-400">{t.edit_activity_unbill_warning[lang]}</p>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 font-medium text-sm">{i18n.common.btn_cancel[lang]}</button>
          <button type="submit" disabled={!canSave} className="flex-1 py-2.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm disabled:opacity-40">{i18n.common.btn_save[lang]}</button>
        </div>
      </form>
    </Modal>
  )
}
