import { useState } from 'react'
import type { TaxiTrip, TaxiManagerPayment } from '../../types/database'

// ── Summary table (copy from TaxiListView — avoids refactoring) ──────────────
function SummaryTable({ trips }: { trips: TaxiTrip[] }) {
  const today = new Date().toISOString().slice(0, 10)

  function stats(subset: TaxiTrip[]) {
    return {
      count:      subset.length,
      clientMzn:  subset.reduce((s, t) => s + t.price_client_mzn,   0),
      clientEur:  subset.reduce((s, t) => s + t.price_eur,           0),
      driverMzn:  subset.reduce((s, t) => s + t.price_driver_mzn,   0),
      managerMzn: subset.reduce((s, t) => s + t.margin_manager_mzn, 0),
      centreMzn:  subset.reduce((s, t) => s + t.margin_centre_mzn,  0),
    }
  }

  const done    = stats(trips.filter(t => t.date <  today))
  const planned = stats(trips.filter(t => t.date >= today))
  const total   = stats(trips)

  const rows = [
    { label: '✅ Completed', bg: 'bg-green-50',  ...done    },
    { label: '📅 Planned',   bg: 'bg-blue-50',   ...planned },
  ]

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b text-xs">
            <th className="px-3 py-2 text-left font-medium text-gray-500"></th>
            <th className="px-3 py-2 text-right font-semibold text-blue-700">Client MZN</th>
            <th className="px-3 py-2 text-right font-semibold text-blue-500">EUR</th>
            <th className="px-3 py-2 text-right font-semibold text-amber-700">Driver MZN</th>
            <th className="px-3 py-2 text-right font-semibold text-purple-700">Manager MZN</th>
            <th className="px-3 py-2 text-right font-semibold text-green-700">Centre MZN</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-500">Trips</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label} className={`border-b ${r.bg}`}>
              <td className="px-3 py-2 font-semibold text-gray-700 whitespace-nowrap">{r.label}</td>
              <td className="px-3 py-2 text-right font-bold text-blue-900">{r.clientMzn.toLocaleString()}</td>
              <td className="px-3 py-2 text-right text-blue-700">≈ {r.clientEur}€</td>
              <td className="px-3 py-2 text-right text-amber-900">{r.driverMzn.toLocaleString()}</td>
              <td className="px-3 py-2 text-right text-purple-900">{r.managerMzn.toLocaleString()}</td>
              <td className="px-3 py-2 text-right font-semibold text-green-900">{r.centreMzn.toLocaleString()}</td>
              <td className="px-3 py-2 text-right text-gray-600">{r.count}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold">
            <td className="px-3 py-2 text-gray-800">Total</td>
            <td className="px-3 py-2 text-right text-blue-900">{total.clientMzn.toLocaleString()}</td>
            <td className="px-3 py-2 text-right text-blue-700">≈ {total.clientEur}€</td>
            <td className="px-3 py-2 text-right text-amber-900">{total.driverMzn.toLocaleString()}</td>
            <td className="px-3 py-2 text-right text-purple-900">{total.managerMzn.toLocaleString()}</td>
            <td className="px-3 py-2 text-right text-green-900">{total.centreMzn.toLocaleString()}</td>
            <td className="px-3 py-2 text-right text-gray-600">{total.count}</td>
          </tr>
        </tfoot>
      </table>
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
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      <h3 className="font-semibold text-gray-800">Add Payment</h3>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
        <input type="date" value={date} required
          onChange={e => setDate(e.target.value)}
          className="w-full text-sm border rounded px-2 py-1.5" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Amount (MZN)</label>
        <input type="number" min="1" value={amount} required placeholder="e.g. 5000"
          onChange={e => setAmount(e.target.value)}
          className="w-full text-sm border rounded px-2 py-1.5" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
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
  onAddPayment:    (p: Omit<TaxiManagerPayment, 'id'>) => Promise<void>
  onDeletePayment: (id: string) => Promise<void>
}

export default function TaxiFinanceTab({ trips, payments, onAddPayment, onDeletePayment }: TaxiFinanceTabProps) {
  const today    = new Date().toISOString().slice(0, 10)
  const upcoming = trips.filter(t => t.date >= today)
  const toEarn   = upcoming.reduce((s, t) => s + t.margin_manager_mzn, 0)
  const paid     = payments.reduce((s, p) => s + p.amount_mzn, 0)
  const debt     = paid - toEarn

  const debtColor =
    debt > 0 ? 'text-red-700 bg-red-50 border-red-200' :
    debt < 0 ? 'text-green-700 bg-green-50 border-green-200' :
               'text-gray-700 bg-gray-50 border-gray-200'

  const debtLabel =
    debt > 0 ? '🔴 Still owes after upcoming trips' :
    debt < 0 ? '🟢 Will have surplus after upcoming trips' :
               '⚪ Balanced'

  async function handleDelete(id: string) {
    if (!confirm('Delete this payment?')) return
    await onDeletePayment(id)
  }

  return (
    <div className="space-y-6">
      {/* Financial Summary */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Financial Summary</h2>
        <SummaryTable trips={trips} />
      </div>

      {/* Manager Balance + Add Payment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Balance card */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <h3 className="font-semibold text-gray-800">Manager Balance</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center py-1 border-b">
              <span className="text-gray-600">Paid (advances)</span>
              <span className="font-bold text-blue-900">{paid.toLocaleString()} MZN</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b">
              <span className="text-gray-600">Will earn ({upcoming.length} upcoming trips)</span>
              <span className="font-bold text-purple-900">{toEarn.toLocaleString()} MZN</span>
            </div>
            <div className={`flex justify-between items-center p-3 rounded border font-bold ${debtColor}`}>
              <span>{debtLabel}</span>
              <span className="text-lg">{Math.abs(debt).toLocaleString()} MZN</span>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Balance = advances paid − manager margin on upcoming trips
          </p>
        </div>

        {/* Add payment form */}
        <AddPaymentForm onAdd={onAddPayment} />
      </div>

      {/* Payment History */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-3">Payment History</h3>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-xs">
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Date</th>
                <th className="px-3 py-2 text-right font-semibold text-blue-700">Amount MZN</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Notes</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-600">🗑</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400 italic">No payments recorded</td>
                </tr>
              ) : payments.map(p => (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-800">{p.date}</td>
                  <td className="px-3 py-2 text-right font-semibold text-blue-900">{p.amount_mzn.toLocaleString()}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{p.notes ?? <span className="italic text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => handleDelete(p.id)}
                      className="text-red-400 hover:text-red-600 text-sm px-2 py-1 rounded hover:bg-red-50">
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {payments.length > 0 && (
              <tfoot>
                <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold">
                  <td className="px-3 py-2 text-gray-800">Total</td>
                  <td className="px-3 py-2 text-right text-blue-900">{paid.toLocaleString()} MZN</td>
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
