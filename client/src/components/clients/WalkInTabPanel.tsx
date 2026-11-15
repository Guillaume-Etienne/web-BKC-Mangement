import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'
import type { Booking, Payment, PaymentMethod } from '../../types/database'
import { fmtDate, todayISO } from '../../utils/dates'
import { useWalkInTab } from '../../hooks/useWalkInTab'
import { splitTabPayment, tabDue } from '../../utils/walkInTab'

// The walk-in tab on a client's file (gui, 2026-11-15): what he owes over all
// his visits, and one payment typed once, split oldest visit first
// (utils/walkInTab.ts). The client sees the same total on his "my visits" link.

const r2 = (n: number) => Math.round(n * 100) / 100
const eur = (n: number) => `€${r2(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

// No Palmeiras terminal here: its meticals figure belongs to ONE payment and
// cannot be split across visits. A walk-in paying on it goes through the booking.
const METHODS: PaymentMethod[] = ['cash_eur', 'cash_mzn', 'transfer']

interface Props {
  visits: Booking[]
  /** Called once the payments are in, so the timeline picks them up. */
  onPaid: () => void
}

export default function WalkInTabPanel({ visits, onPaid }: Props) {
  const { lang } = useLanguage()
  const tab = useWalkInTab(visits)
  const due = tabDue(tab.balances)
  const unpaid = tab.balances.filter(v => v.due > 0.005)

  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [method, setMethod] = useState<PaymentMethod>('cash_eur')
  const [receivedBy, setReceivedBy] = useState('')
  const [notes, setNotes] = useState('Walk-in tab')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const parsed = parseFloat(amount) || 0
  const split = splitTabPayment(tab.balances, parsed)
  const after = r2(due - parsed)

  function startPayment() {
    setAmount(due > 0 ? String(r2(due)) : '')
    setDate(todayISO())
    setSaveError(null)
    setOpen(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (saving || split.length === 0) return
    setSaving(true)
    setSaveError(null)
    const rows: Payment[] = split.map(s => ({
      id: crypto.randomUUID(),
      booking_id: s.bookingId,
      date,
      amount: s.amount,
      method,
      is_deposit: false,
      // Whoever types it is holding the money — same as a walk-in paid on the spot.
      is_verified: true,
      is_discount: false,
      notes: notes.trim() || null,
      ...(tab.associates.length > 0 ? { received_by_associate_id: receivedBy || null } : {}),
    }))
    // One request = one statement: either every share is recorded or none is,
    // never half a payment.
    const { error } = await supabase.from('payments').insert(rows)
    setSaving(false)
    if (error) { setSaveError(`The payment was NOT recorded: ${error.message}`); return }
    setOpen(false)
    tab.refresh()
    onPaid()
  }

  if (tab.loading && tab.balances.length === 0) {
    return <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">Loading balance…</p>
  }
  if (tab.error) {
    return <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{tab.error}</p>
  }

  const settled = Math.abs(due) < 0.005
  const visitDate = (id: string) => tab.balances.find(v => v.booking.id === id)?.booking.check_in ?? ''

  return (
    <div className="mt-1.5 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-sm font-semibold ${settled ? 'text-emerald-700 dark:text-emerald-400' : due > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-blue-700 dark:text-blue-400'}`}>
          {settled ? '✓ All settled'
            : due > 0 ? `Balance due: ${eur(due)}${unpaid.length > 1 ? ` · ${unpaid.length} visits` : ''}`
            : `In credit: ${eur(-due)}`}
        </span>
        {due > 0.005 && !open && (
          <button type="button" onClick={startPayment}
            className="text-xs px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">
            💶 Record payment
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={save} className="border rounded-lg p-3 space-y-3 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-400">Payment for the walk-in tab</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Amount (€)</label>
              <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <p className={`text-xs mt-1 ${after < 0 ? 'text-red-600 dark:text-red-400' : after === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {after < 0 ? `Overpaid by ${eur(-after)} (kept on the last visit)`
                  : after === 0 ? 'Tab settled'
                  : `${eur(after)} left to pay`}
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Method</label>
              <select value={method} onChange={e => setMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400">
                {METHODS.map(m => <option key={m} value={m}>{i18n.accounting[`method_${m}`][lang]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Notes</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            {tab.associates.length > 0 && (
              <div className="sm:col-span-2">
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Received by</label>
                <select value={receivedBy} onChange={e => setReceivedBy(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="">The centre</option>
                  {tab.associates.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {split.length > 0 && (
            <div className="text-xs text-gray-600 dark:text-gray-400">
              <p className="font-medium mb-1">Split over the visits (oldest first):</p>
              <ul className="space-y-0.5">
                {split.map(s => {
                  const v = tab.balances.find(b => b.booking.id === s.bookingId)!
                  const left = r2(v.due - s.amount)
                  return (
                    <li key={s.bookingId} className="flex justify-between gap-3">
                      <span>#{String(v.booking.booking_number).padStart(3, '0')} · {fmtDate(visitDate(s.bookingId))}</span>
                      <span className="font-semibold">
                        {eur(s.amount)}
                        <span className="font-normal text-gray-500 dark:text-gray-500">
                          {left > 0.005 ? ` (${eur(left)} left)` : left < -0.005 ? ` (${eur(-left)} over)` : ' ✓'}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {saveError && <p className="text-xs text-red-600 dark:text-red-400">{saveError}</p>}

          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)}
              className="flex-1 px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
              Cancel
            </button>
            <button type="submit" disabled={saving || split.length === 0}
              className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm font-semibold">
              {saving ? 'Saving…' : split.length > 1 ? `Save (${split.length} visits)` : 'Save payment'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
