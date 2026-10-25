import { useState } from 'react'
import type { TaxiTrip, TaxiManagerPayment, TaxiDriver, BookingRef } from '../../types/database'
import { todayISO, fmtDate } from '../../utils/dates'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'

// ── Dual-currency helpers (MZN first, € translation beside) ──────────────────
const mznToEur = (mzn: number, rate: number) => Math.round(mzn / (rate || 1))
const fmtMzn   = (mzn: number) => `${mzn.toLocaleString()} MZN`

function MznWithEur({ mzn, rate, className }: { mzn: number; rate: number; className?: string }) {
  return (
    <span className={className}>
      {fmtMzn(mzn)}
      <span className="block text-[10px] font-normal text-gray-400 dark:text-gray-400">≈ {mznToEur(mzn, rate)}€</span>
    </span>
  )
}

// ── Summary table (copy from TaxiListView — avoids refactoring) ──────────────
function SummaryTable({ trips, rate }: { trips: TaxiTrip[]; rate: number }) {
  const today = todayISO()

  function stats(subset: TaxiTrip[]) {
    const clientEur  = subset.reduce((s, t) => s + t.price_eur,          0)
    const driverMzn  = subset.reduce((s, t) => s + t.price_driver_mzn,   0)
    const managerMzn = subset.reduce((s, t) => s + t.margin_manager_mzn, 0)
    return {
      count: subset.length,
      clientEur, driverMzn, managerMzn,
      // what the center keeps once driver + manager are paid
      marginEur: clientEur - (driverMzn + managerMzn) / (rate || 1),
    }
  }

  const done    = stats(trips.filter(t => t.date <  today))
  const planned = stats(trips.filter(t => t.date >= today))
  const total   = stats(trips)

  const rows = [
    { label: '✅ Completed', bg: 'bg-green-50 dark:bg-green-950/40',  ...done    },
    { label: '📅 Planned',   bg: 'bg-blue-50 dark:bg-blue-950/40',   ...planned },
  ]

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden mb-6">
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800 border-b text-xs">
            <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400"></th>
            <th className="px-3 py-2 text-right font-semibold text-blue-700 dark:text-blue-400">Client EUR</th>
            <th className="px-3 py-2 text-right font-semibold text-amber-700 dark:text-amber-400">Driver MZN</th>
            <th className="px-3 py-2 text-right font-semibold text-purple-700 dark:text-purple-400">Manager MZN</th>
            <th className="px-3 py-2 text-right font-semibold text-emerald-700 dark:text-emerald-400">Centre margin</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-500 dark:text-gray-400">Trips</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label} className={`border-b ${r.bg}`}>
              <td className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">{r.label}</td>
              <td className="px-3 py-2 text-right font-bold text-blue-900 dark:text-blue-400">{r.clientEur}€</td>
              <td className="px-3 py-2 text-right text-amber-900 dark:text-amber-400"><MznWithEur mzn={r.driverMzn} rate={rate} /></td>
              <td className="px-3 py-2 text-right text-purple-900 dark:text-purple-400"><MznWithEur mzn={r.managerMzn} rate={rate} /></td>
              <td className="px-3 py-2 text-right font-bold text-emerald-700 dark:text-emerald-400">{Math.round(r.marginEur)}€</td>
              <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">{r.count}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-700 font-bold">
            <td className="px-3 py-2 text-gray-800 dark:text-gray-200">Total</td>
            <td className="px-3 py-2 text-right text-blue-900 dark:text-blue-400">{total.clientEur}€</td>
            <td className="px-3 py-2 text-right text-amber-900 dark:text-amber-400"><MznWithEur mzn={total.driverMzn} rate={rate} /></td>
            <td className="px-3 py-2 text-right text-purple-900 dark:text-purple-400"><MznWithEur mzn={total.managerMzn} rate={rate} /></td>
            <td className="px-3 py-2 text-right text-emerald-700 dark:text-emerald-400">{Math.round(total.marginEur)}€</td>
            <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">{total.count}</td>
          </tr>
        </tfoot>
      </table></div>
      <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800">
        Centre margin = Client € − (Driver + Manager MZN → € at global rate {rate})
      </p>
    </div>
  )
}

// ── Add Payment Form — module scope to avoid focus loss ──────────────────────
interface AddPaymentFormProps {
  onAdd: (p: Omit<TaxiManagerPayment, 'id'>) => void
}

function AddPaymentForm({ onAdd }: AddPaymentFormProps) {
  const { lang } = useLanguage()
  const today = todayISO()
  const [date,   setDate]   = useState(today)
  const [amount, setAmount] = useState('')
  const [notes,  setNotes]  = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseInt(amount)
    if (!amt || amt <= 0) return
    onAdd({ date, amount_mzn: amt, notes: notes.trim() || null })
    setAmount('')
    setNotes('')
    setDate(today)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
      <h3 className="font-semibold text-gray-800 dark:text-gray-200">{i18n.taxis.btn_add_payment[lang]}</h3>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{i18n.common.label_date[lang]}</label>
        <input type="date" value={date} required
          onChange={e => setDate(e.target.value)}
          className="w-full text-sm border rounded px-2 py-1.5" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Amount (MZN)</label>
        <input type="number" min="1" value={amount} required placeholder="e.g. 5000"
          onChange={e => setAmount(e.target.value)}
          className="w-full text-sm border rounded px-2 py-1.5" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{i18n.common.label_notes[lang]}</label>
        <input type="text" value={notes} placeholder="Optional"
          onChange={e => setNotes(e.target.value)}
          className="w-full text-sm border rounded px-2 py-1.5" />
      </div>
      <button type="submit"
        className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold text-sm">
        + {i18n.common.btn_add[lang]}
      </button>
    </form>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
interface TaxiFinanceTabProps {
  trips:           TaxiTrip[]
  drivers:         TaxiDriver[]
  bookings:        BookingRef[]
  payments:        TaxiManagerPayment[]
  eurMznRate:      number
  onAddPayment:    (p: Omit<TaxiManagerPayment, 'id'>) => Promise<void>
  onDeletePayment: (id: string) => Promise<void>
}

export default function TaxiFinanceTab({ trips, drivers, bookings, payments, eurMznRate, onAddPayment, onDeletePayment }: TaxiFinanceTabProps) {
  const { lang } = useLanguage()

  // A trip marked "Paid" (status `done`) = the driver has been paid. The centre pays on
  // the day, the client pays at the end of the stay — so the gap is money advanced.
  const today        = todayISO()
  const paidTrips    = trips.filter(t => t.status === 'done')
  const unpaidPast   = trips.filter(t => t.status !== 'done' && t.date <= today)
  const sumDriver    = (ts: TaxiTrip[]) => ts.reduce((s, t) => s + t.price_driver_mzn, 0)
  const driverRows   = [...drivers.map(d => ({ id: d.id as string | null, name: d.name })), { id: null, name: '—' }]
    .map(d => {
      const paid = paidTrips.filter(t => t.taxi_driver_id === d.id)
      const todo = unpaidPast.filter(t => t.taxi_driver_id === d.id)
      return { ...d, paidCount: paid.length, paidMzn: sumDriver(paid), todoCount: todo.length, todoMzn: sumDriver(todo) }
    })
    .filter(r => r.paidCount > 0 || r.todoCount > 0)
  const totalPaidMzn = sumDriver(paidTrips)
  const totalTodoMzn = sumDriver(unpaidPast)

  const advancedRows = [...new Set(paidTrips.map(t => t.booking_id).filter((id): id is string => !!id))]
    .map(id => {
      const ts = paidTrips.filter(t => t.booking_id === id)
      const b  = bookings.find(x => x.id === id)
      const outEur    = sumDriver(ts) / (eurMznRate || 1)
      const billedEur = ts.reduce((s, t) => s + t.price_eur, 0)
      return {
        id, outEur, billedEur,
        label: b ? `#${String(b.booking_number).padStart(3, '0')}${b.client ? ` ${b.client.first_name} ${b.client.last_name}` : ''}` : '—',
        num: b?.booking_number ?? 0,
      }
    })
    .sort((a, b) => b.num - a.num)
  const totalEarned = trips.reduce((s, t) => s + t.margin_manager_mzn, 0)
  const totalPaid   = payments.reduce((s, p) => s + p.amount_mzn, 0)
  const balance     = totalEarned - totalPaid  // >0 = we owe manager, <0 = manager overpaid

  const balanceColor =
    balance > 0 ? 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900' :
    balance < 0 ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900' :
                  'text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-800'

  const balanceLabel =
    balance > 0 ? i18n.taxis.label_balance_owe[lang] :
    balance < 0 ? i18n.taxis.label_balance_credit[lang] :
                  i18n.taxis.label_balanced[lang]

  async function handleDelete(id: string) {
    if (!confirm(i18n.taxis.msg_confirm_delete_payment[lang])) return
    await onDeletePayment(id)
  }

  return (
    <div className="space-y-6">
      {/* Financial Summary */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">{i18n.taxis.title_financial_summary[lang]}</h2>
        <SummaryTable trips={trips} rate={eurMznRate} />
      </div>

      {/* Drivers: paid to date, and what is still to pay */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">{i18n.taxis.section_drivers_paid[lang]}</h2>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 border-b text-xs">
                <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">Driver</th>
                <th className="px-3 py-2 text-right font-semibold text-emerald-700 dark:text-emerald-400">{i18n.taxis.label_drv_paid[lang]}</th>
                <th className="px-3 py-2 text-right font-semibold text-orange-700 dark:text-orange-400">{i18n.taxis.label_drv_to_pay[lang]}</th>
              </tr>
            </thead>
            <tbody>
              {driverRows.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400 italic">{i18n.taxis.msg_drv_unpaid_hint[lang]}</td></tr>
              ) : driverRows.map(r => (
                <tr key={r.id ?? 'none'} className="border-b">
                  <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{r.name}</td>
                  <td className="px-3 py-2 text-right text-emerald-800 dark:text-emerald-400">
                    {r.paidCount > 0 ? <><MznWithEur mzn={r.paidMzn} rate={eurMznRate} /><span className="text-[10px] text-gray-400">{r.paidCount} trip{r.paidCount > 1 ? 's' : ''}</span></> : '–'}
                  </td>
                  <td className="px-3 py-2 text-right text-orange-800 dark:text-orange-400">
                    {r.todoCount > 0 ? <><MznWithEur mzn={r.todoMzn} rate={eurMznRate} /><span className="text-[10px] text-gray-400">{r.todoCount} trip{r.todoCount > 1 ? 's' : ''}</span></> : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-700 font-bold">
                <td className="px-3 py-2 text-gray-800 dark:text-gray-200">Total</td>
                <td className="px-3 py-2 text-right text-emerald-800 dark:text-emerald-400"><MznWithEur mzn={totalPaidMzn} rate={eurMznRate} /></td>
                <td className="px-3 py-2 text-right text-orange-800 dark:text-orange-400"><MznWithEur mzn={totalTodoMzn} rate={eurMznRate} /></td>
              </tr>
            </tfoot>
          </table></div>
        </div>
      </div>

      {/* Advanced for clients: taxis we paid, per booking */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">{i18n.taxis.section_advanced[lang]}</h2>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          {advancedRows.length === 0 ? (
            <p className="px-4 py-6 text-center text-gray-400 italic text-sm">{i18n.taxis.msg_adv_empty[lang]}</p>
          ) : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b text-xs">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">{i18n.taxis.label_adv_booking[lang]}</th>
                  <th className="px-3 py-2 text-right font-semibold text-amber-700 dark:text-amber-400">{i18n.taxis.label_adv_out[lang]}</th>
                  <th className="px-3 py-2 text-right font-semibold text-blue-700 dark:text-blue-400">{i18n.taxis.label_adv_billed[lang]}</th>
                  <th className="px-3 py-2 text-right font-semibold text-emerald-700 dark:text-emerald-400">{i18n.taxis.label_adv_gap[lang]}</th>
                </tr>
              </thead>
              <tbody>
                {advancedRows.map(r => (
                  <tr key={r.id} className="border-b">
                    <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{r.label}</td>
                    <td className="px-3 py-2 text-right text-amber-900 dark:text-amber-400">{Math.round(r.outEur)}€</td>
                    <td className="px-3 py-2 text-right text-blue-900 dark:text-blue-400">{r.billedEur}€</td>
                    <td className="px-3 py-2 text-right text-emerald-700 dark:text-emerald-400">{Math.round(r.billedEur - r.outEur)}€</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-700 font-bold">
                  <td className="px-3 py-2 text-gray-800 dark:text-gray-200">Total</td>
                  <td className="px-3 py-2 text-right text-amber-900 dark:text-amber-400">{Math.round(advancedRows.reduce((s, r) => s + r.outEur, 0))}€</td>
                  <td className="px-3 py-2 text-right text-blue-900 dark:text-blue-400">{advancedRows.reduce((s, r) => s + r.billedEur, 0)}€</td>
                  <td className="px-3 py-2 text-right text-emerald-700 dark:text-emerald-400">{Math.round(advancedRows.reduce((s, r) => s + r.billedEur - r.outEur, 0))}€</td>
                </tr>
              </tfoot>
            </table></div>
          )}
          <p className="px-3 py-2 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-800">{i18n.taxis.msg_adv_hint[lang]}</p>
        </div>
      </div>

      {/* Manager Balance + Add Payment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Balance card */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200">{i18n.taxis.section_manager_balance[lang]}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center py-1 border-b">
              <span className="text-gray-600 dark:text-gray-400">{i18n.taxis.label_total_earned[lang]} ({trips.length} trip{trips.length !== 1 ? 's' : ''})</span>
              <MznWithEur mzn={totalEarned} rate={eurMznRate} className="font-bold text-purple-900 dark:text-purple-400 text-right" />
            </div>
            <div className="flex justify-between items-center py-1 border-b">
              <span className="text-gray-600 dark:text-gray-400">{i18n.taxis.label_total_paid[lang]}</span>
              <MznWithEur mzn={totalPaid} rate={eurMznRate} className="font-bold text-blue-900 dark:text-blue-400 text-right" />
            </div>
            <div className={`flex justify-between items-center p-3 rounded border font-bold ${balanceColor}`}>
              <span>{balanceLabel}</span>
              <span className="text-lg text-right">
                {Math.abs(balance).toLocaleString()} MZN
                <span className="block text-xs font-normal opacity-60">≈ {mznToEur(Math.abs(balance), eurMznRate)}€</span>
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-400">
            Balance = total earned − total advances paid
          </p>
        </div>

        {/* Add payment form */}
        <AddPaymentForm onAdd={onAddPayment} />
      </div>

      {/* Payment History */}
      <div>
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">{i18n.taxis.section_payment_history[lang]}</h3>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 border-b text-xs">
                <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">{i18n.common.label_date[lang]}</th>
                <th className="px-3 py-2 text-right font-semibold text-blue-700 dark:text-blue-400">Amount MZN</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">{i18n.common.label_notes[lang]}</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-600 dark:text-gray-400">🗑</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400 dark:text-gray-400 italic">{i18n.taxis.msg_no_payments[lang]}</td>
                </tr>
              ) : payments.map(p => (
                <tr key={p.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-800 dark:text-gray-200">{fmtDate(p.date)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-blue-900 dark:text-blue-400">{p.amount_mzn.toLocaleString()}</td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs">{p.notes ?? <span className="italic text-gray-300 dark:text-gray-500">—</span>}</td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => handleDelete(p.id)}
                      className="text-red-400 dark:text-red-300 hover:text-red-600 dark:hover:text-red-400 text-sm px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40">
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {payments.length > 0 && (
              <tfoot>
                <tr className="bg-gray-100 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-700 font-bold">
                  <td className="px-3 py-2 text-gray-800 dark:text-gray-200">Total</td>
                  <td className="px-3 py-2 text-right text-blue-900 dark:text-blue-400"><MznWithEur mzn={totalPaid} rate={eurMznRate} /></td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table></div>
        </div>
      </div>
    </div>
  )
}
