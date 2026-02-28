import { useState } from 'react'
import type { SharedAccountingData, AccountingHandlers } from './types'
import type { PalmeirasRent, PalmeirasReversal } from '../../types/database'
import { fmtEur, fmtMonth } from './utils'

interface Props { data: SharedAccountingData; handlers: AccountingHandlers }

// ── Forms (module-scope) ───────────────────────────────────────────────────

interface RentFormProps {
  existing?: PalmeirasRent
  onSave: (r: PalmeirasRent) => void
  onCancel: () => void
}
function RentForm({ existing, onSave, onCancel }: RentFormProps) {
  const [month,  setMonth]  = useState(existing?.month  ?? new Date().toISOString().slice(0, 7))
  const [amount, setAmount] = useState(String(existing?.amount ?? 850))
  const [notes,  setNotes]  = useState(existing?.notes  ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!parsed) return
    onSave({ id: existing?.id ?? `pr_${Date.now()}`, month, amount: parsed, notes: notes || null })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
      <p className="text-sm font-semibold text-red-800">{existing ? 'Edit rent' : 'Add rent payment'}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Month</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Amount (€)</label>
          <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Notes</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional"
          className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
        <button type="submit"
          className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded text-sm font-semibold hover:bg-red-700">Save</button>
      </div>
    </form>
  )
}

interface ReversalFormProps {
  existing?: PalmeirasReversal
  onSave: (r: PalmeirasReversal) => void
  onCancel: () => void
}
function ReversalForm({ existing, onSave, onCancel }: ReversalFormProps) {
  const [month,   setMonth]   = useState(existing?.month   ?? new Date().toISOString().slice(0, 7))
  const [gross,   setGross]   = useState(String(existing?.gross_amount ?? ''))
  const [percent, setPercent] = useState(String(existing?.percent      ?? 15))
  const [notes,   setNotes]   = useState(existing?.notes   ?? '')

  const grossNum  = parseFloat(gross)   || 0
  const pctNum    = parseFloat(percent) || 0
  const netAmount = Math.round(grossNum * pctNum / 100 * 100) / 100

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!grossNum || !pctNum) return
    onSave({
      id: existing?.id ?? `prev_${Date.now()}`,
      month, gross_amount: grossNum, percent: pctNum,
      net_amount: netAmount, notes: notes || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-3">
      <p className="text-sm font-semibold text-emerald-800">{existing ? 'Edit reversal' : 'Add reversal'}</p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Month</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Palmeiras gross (€)</label>
          <input type="number" min="0" step="0.01" value={gross} onChange={e => setGross(e.target.value)}
            placeholder="Total they collected"
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">% owed to us</label>
          <input type="number" min="0" max="100" step="0.1" value={percent} onChange={e => setPercent(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
      </div>
      {/* Live margin preview */}
      {grossNum > 0 && (
        <div className="bg-white rounded-lg px-4 py-2 flex justify-between items-center border border-emerald-200">
          <span className="text-sm text-gray-600">We receive</span>
          <span className="text-lg font-bold text-emerald-700">{fmtEur(netAmount)}</span>
          <span className="text-xs text-gray-400">({pctNum}% of {fmtEur(grossNum)})</span>
        </div>
      )}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Notes</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional"
          className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
        <button type="submit"
          className="flex-1 px-3 py-1.5 bg-emerald-600 text-white rounded text-sm font-semibold hover:bg-emerald-700">Save</button>
      </div>
    </form>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function PalmeirasTab({ data, handlers }: Props) {
  const { palmeirasRents, palmeirasReversals } = data

  const [showAddRent,      setShowAddRent]      = useState(false)
  const [showAddReversal,  setShowAddReversal]  = useState(false)
  const [editingRent,      setEditingRent]      = useState<PalmeirasRent | null>(null)
  const [editingReversal,  setEditingReversal]  = useState<PalmeirasReversal | null>(null)

  const totalRent      = palmeirasRents.reduce((s, r) => s + r.amount, 0)
  const totalReversals = palmeirasReversals.reduce((s, r) => s + r.net_amount, 0)
  const net            = totalReversals - totalRent

  // All months that appear in either table
  const allMonths = [...new Set([
    ...palmeirasRents.map(r => r.month),
    ...palmeirasReversals.map(r => r.month),
  ])].sort().reverse()

  const handlePrint = () => {
    const rows = allMonths.map(month => {
      const rent     = palmeirasRents.find(r => r.month === month)
      const reversal = palmeirasReversals.find(r => r.month === month)
      const monthNet = (reversal?.net_amount ?? 0) - (rent?.amount ?? 0)
      return { month, rent, reversal, monthNet }
    })

    const html = `
      <!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Palmeiras — Monthly Report</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 13px; padding: 24px; color: #1f2937; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        p.sub { color: #6b7280; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f3f4f6; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; }
        td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; }
        tr:last-child td { border-bottom: none; }
        tfoot td { background: #f9fafb; font-weight: bold; border-top: 2px solid #e5e7eb; }
        .pos { color: #059669; } .neg { color: #dc2626; }
        .right { text-align: right; }
      </style></head><body>
      <h1>Palmeiras — Monthly Report</h1>
      <p class="sub">Generated ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
      <table>
        <thead><tr>
          <th>Month</th><th class="right">Rent paid</th>
          <th class="right">Gross (Palmeiras)</th><th class="right">%</th>
          <th class="right">Reversal received</th><th class="right">Monthly net</th>
        </tr></thead>
        <tbody>
          ${rows.map(({ month, rent, reversal, monthNet }) => `
            <tr>
              <td>${fmtMonth(month)}</td>
              <td class="right neg">${rent ? `− ${fmtEur(rent.amount)}` : '–'}</td>
              <td class="right">${reversal ? fmtEur(reversal.gross_amount) : '–'}</td>
              <td class="right">${reversal ? `${reversal.percent}%` : '–'}</td>
              <td class="right pos">${reversal ? `+ ${fmtEur(reversal.net_amount)}` : '–'}</td>
              <td class="right ${monthNet >= 0 ? 'pos' : 'neg'}">${monthNet >= 0 ? '+' : ''}${fmtEur(monthNet)}</td>
            </tr>`).join('')}
        </tbody>
        <tfoot><tr>
          <td>Total</td>
          <td class="right neg">− ${fmtEur(totalRent)}</td>
          <td class="right">${fmtEur(palmeirasReversals.reduce((s, r) => s + r.gross_amount, 0))}</td>
          <td></td>
          <td class="right pos">+ ${fmtEur(totalReversals)}</td>
          <td class="right ${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '+' : ''}${fmtEur(net)}</td>
        </tr></tfoot>
      </table>
      </body></html>`

    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }

  return (
    <div className="space-y-6">

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-400 mb-1">Rent paid (total)</p>
          <p className="text-2xl font-bold text-red-700">− {fmtEur(totalRent)}</p>
          <p className="text-xs text-red-400 mt-1">{palmeirasRents.length} months recorded</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400 mb-1">Reversals received</p>
          <p className="text-2xl font-bold text-emerald-700">+ {fmtEur(totalReversals)}</p>
          <p className="text-xs text-emerald-400 mt-1">{palmeirasReversals.length} months recorded</p>
        </div>
        <div className={`border rounded-xl p-5 ${net >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            Net balance
          </p>
          <p className={`text-2xl font-bold ${net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {net >= 0 ? '+' : ''}{fmtEur(net)}
          </p>
          <p className="text-xs text-gray-400 mt-1">reversals − rent</p>
        </div>
      </div>

      {/* Monthly table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex justify-between items-center px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-800">Monthly breakdown</h2>
          <div className="flex gap-2">
            <button onClick={() => { setShowAddRent(true); setShowAddReversal(false) }}
              className="text-xs px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium">
              + Rent
            </button>
            <button onClick={() => { setShowAddReversal(true); setShowAddRent(false) }}
              className="text-xs px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 font-medium">
              + Reversal
            </button>
            <button onClick={handlePrint}
              className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 font-medium">
              🖨 Export
            </button>
          </div>
        </div>

        {/* Add forms */}
        {(showAddRent || showAddReversal) && (
          <div className="px-5 py-4 border-b bg-gray-50">
            {showAddRent && (
              <RentForm
                onSave={r => { handlers.addPalmeirasRent(r); setShowAddRent(false) }}
                onCancel={() => setShowAddRent(false)}
              />
            )}
            {showAddReversal && (
              <ReversalForm
                onSave={r => { handlers.addPalmeirasReversal(r); setShowAddReversal(false) }}
                onCancel={() => setShowAddReversal(false)}
              />
            )}
          </div>
        )}

        {/* Edit forms */}
        {(editingRent || editingReversal) && (
          <div className="px-5 py-4 border-b bg-gray-50">
            {editingRent && (
              <RentForm
                existing={editingRent}
                onSave={r => { handlers.updatePalmeirasRent(r); setEditingRent(null) }}
                onCancel={() => setEditingRent(null)}
              />
            )}
            {editingReversal && (
              <ReversalForm
                existing={editingReversal}
                onSave={r => { handlers.updatePalmeirasReversal(r); setEditingReversal(null) }}
                onCancel={() => setEditingReversal(null)}
              />
            )}
          </div>
        )}

        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Month</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Rent</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Gross (Palmeiras)</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">%</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">We receive</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Monthly net</th>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {allMonths.map(month => {
              const rent     = palmeirasRents.find(r => r.month === month)
              const reversal = palmeirasReversals.find(r => r.month === month)
              const monthNet = (reversal?.net_amount ?? 0) - (rent?.amount ?? 0)
              return (
                <tr key={month} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{fmtMonth(month)}</td>

                  {/* Rent cell */}
                  <td className="px-4 py-3 text-right">
                    {rent ? (
                      <span className="text-red-600 font-medium">− {fmtEur(rent.amount)}</span>
                    ) : (
                      <span className="text-gray-300">–</span>
                    )}
                  </td>

                  {/* Reversal cells */}
                  <td className="px-4 py-3 text-right text-gray-500">
                    {reversal ? fmtEur(reversal.gross_amount) : <span className="text-gray-300">–</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">
                    {reversal ? `${reversal.percent}%` : ''}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {reversal ? (
                      <span className="text-emerald-700 font-medium">+ {fmtEur(reversal.net_amount)}</span>
                    ) : (
                      <span className="text-gray-300">–</span>
                    )}
                  </td>

                  {/* Monthly net */}
                  <td className={`px-4 py-3 text-right font-bold ${monthNet > 0 ? 'text-emerald-700' : monthNet < 0 ? 'text-red-700' : 'text-gray-400'}`}>
                    {rent || reversal ? `${monthNet >= 0 ? '+' : ''}${fmtEur(monthNet)}` : '–'}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      {rent && (
                        <button onClick={() => { setEditingRent(rent); setEditingReversal(null); setShowAddRent(false); setShowAddReversal(false) }}
                          title="Edit rent" className="text-xs text-gray-300 hover:text-red-500 transition-colors px-1">✏️</button>
                      )}
                      {reversal && (
                        <button onClick={() => { setEditingReversal(reversal); setEditingRent(null); setShowAddRent(false); setShowAddReversal(false) }}
                          title="Edit reversal" className="text-xs text-gray-300 hover:text-emerald-600 transition-colors px-1">✏️</button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="bg-gray-50 border-t">
            <tr>
              <td className="px-4 py-3 font-semibold text-gray-700">Total</td>
              <td className="px-4 py-3 text-right font-semibold text-red-700">− {fmtEur(totalRent)}</td>
              <td className="px-4 py-3 text-right font-semibold text-gray-600">
                {fmtEur(palmeirasReversals.reduce((s, r) => s + r.gross_amount, 0))}
              </td>
              <td />
              <td className="px-4 py-3 text-right font-semibold text-emerald-700">+ {fmtEur(totalReversals)}</td>
              <td className={`px-4 py-3 text-right font-bold ${net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {net >= 0 ? '+' : ''}{fmtEur(net)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Notes section */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800 space-y-1">
        <p className="font-semibold">💡 About Palmeiras accounting</p>
        <p>These figures are included in the global dashboard totals.</p>
        <p>Reversal = % of Palmeiras' own bookings they owe us · Rent = monthly lease for our house.</p>
        <p>Bungalow sub-leases appear in Booking finances (accommodation section per booking).</p>
      </div>
    </div>
  )
}
