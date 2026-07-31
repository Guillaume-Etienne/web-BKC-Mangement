import { useState } from 'react'
import type { TaxiTrip, TaxiManagerPayment } from '../../types/database'

// ── Dual-currency helpers (MZN first, € translation beside) ──────────────────
const mznToEur = (mzn: number, rate: number) => Math.round(mzn / (rate || 1))
const fmtMzn   = (mzn: number) => `${mzn.toLocaleString()} MZN`

function MznWithEur({ mzn, rate, className }: { mzn: number; rate: number; className?: string }) {
  return (
    <span className={className}>
      {fmtMzn(mzn)}
      <span className="block text-[10px] font-normal text-gray-400 dark:text-gray-500">≈ {mznToEur(mzn, rate)}€</span>
    </span>
  )
}

// ── Summary table (copy from TaxiListView — avoids refactoring) ──────────────
function SummaryTable({ trips, rate }: { trips: TaxiTrip[]; rate: number }) {
  const today = new Date().toISOString().slice(0, 10)

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
      <table className="w-full text-sm">
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
      </table>
      <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800">
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
  const today = new Date().toISOString().slice(0, 10)
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
      <h3 className="font-semibold text-gray-800 dark:text-gray-200">Add Payment</h3>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date</label>
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
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
        <input type="text" value={notes} placeholder="Optional"
          onChange={e => setNotes(e.target.value)}
          className="w-full text-sm border rounded px-2 py-1.5" />
      </div>
      <button type="submit"
        className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold text-sm">
        + Add
      </button>
    </form>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
interface TaxiFinanceTabProps {
  trips:           TaxiTrip[]
  payments:        TaxiManagerPayment[]
  eurMznRate:      number
  onAddPayment:    (p: Omit<TaxiManagerPayment, 'id'>) => Promise<void>
  onDeletePayment: (id: string) => Promise<void>
}

export default function TaxiFinanceTab({ trips, payments, eurMznRate, onAddPayment, onDeletePayment }: TaxiFinanceTabProps) {
  const totalEarned = trips.reduce((s, t) => s + t.margin_manager_mzn, 0)
  const totalPaid   = payments.reduce((s, p) => s + p.amount_mzn, 0)
  const balance     = totalEarned - totalPaid  // >0 = we owe manager, <0 = manager overpaid

  const balanceColor =
    balance > 0 ? 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900' :
    balance < 0 ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900' :
                  'text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-800'

  const balanceLabel =
    balance > 0 ? '🟠 We owe the manager' :
    balance < 0 ? '🟢 Manager overpaid (credit)' :
                  '⚪ Balanced'

  async function handleDelete(id: string) {
    if (!confirm('Delete this payment?')) return
    await onDeletePayment(id)
  }

  return (
    <div className="space-y-6">
      {/* Financial Summary */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Financial Summary</h2>
        <SummaryTable trips={trips} rate={eurMznRate} />
      </div>

      {/* Manager Balance + Add Payment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Balance card */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200">Manager Balance</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center py-1 border-b">
              <span className="text-gray-600 dark:text-gray-400">Total earned ({trips.length} trip{trips.length !== 1 ? 's' : ''})</span>
              <MznWithEur mzn={totalEarned} rate={eurMznRate} className="font-bold text-purple-900 dark:text-purple-400 text-right" />
            </div>
            <div className="flex justify-between items-center py-1 border-b">
              <span className="text-gray-600 dark:text-gray-400">Total paid (advances)</span>
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
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Balance = total earned − total advances paid
          </p>
        </div>

        {/* Add payment form */}
        <AddPaymentForm onAdd={onAddPayment} />
      </div>

      {/* Payment History */}
      <div>
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">Payment History</h3>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 border-b text-xs">
                <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">Date</th>
                <th className="px-3 py-2 text-right font-semibold text-blue-700 dark:text-blue-400">Amount MZN</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">Notes</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-600 dark:text-gray-400">🗑</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500 italic">No payments recorded</td>
                </tr>
              ) : payments.map(p => (
                <tr key={p.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-800 dark:text-gray-200">{p.date}</td>
                  <td className="px-3 py-2 text-right font-semibold text-blue-900 dark:text-blue-400">{p.amount_mzn.toLocaleString()}</td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs">{p.notes ?? <span className="italic text-gray-300 dark:text-gray-600">—</span>}</td>
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
          </table>
        </div>
      </div>
    </div>
  )
}
