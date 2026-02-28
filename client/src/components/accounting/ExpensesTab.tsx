import { useState, useMemo } from 'react'
import type { SharedAccountingData, AccountingHandlers } from './types'
import type { Expense, ExpenseCategory } from '../../types/database'
import { fmtEur } from './utils'

interface Props {
  data:     SharedAccountingData
  handlers: AccountingHandlers
}

const CATEGORIES: { id: ExpenseCategory; label: string; color: string; bg: string }[] = [
  { id: 'equipment',     label: 'Equipment',     color: 'text-blue-700',    bg: 'bg-blue-100' },
  { id: 'maintenance',   label: 'Maintenance',   color: 'text-orange-700',  bg: 'bg-orange-100' },
  { id: 'accommodation', label: 'Accommodation', color: 'text-purple-700',  bg: 'bg-purple-100' },
  { id: 'transport',     label: 'Transport',     color: 'text-emerald-700', bg: 'bg-emerald-100' },
  { id: 'other',         label: 'Other',         color: 'text-gray-700',    bg: 'bg-gray-100' },
]

// ── Add form (module-scope to avoid focus loss) ──────────────────────────────
interface AddFormProps {
  onAdd: (e: Expense) => void
  onCancel: () => void
}
function AddExpenseForm({ onAdd, onCancel }: AddFormProps) {
  const [date,        setDate]        = useState(new Date().toISOString().slice(0, 10))
  const [category,   setCategory]    = useState<ExpenseCategory>('equipment')
  const [amount,     setAmount]      = useState('')
  const [description,setDescription] = useState('')
  const [palmeiras,  setPalmeiras]   = useState(false)

  const submit = () => {
    const amt = parseFloat(amount)
    if (!date || !description.trim() || isNaN(amt) || amt <= 0) return
    onAdd({
      id: crypto.randomUUID(),
      date,
      category,
      amount: amt,
      description: description.trim(),
      palmeiras_related: palmeiras,
    })
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
      <p className="font-semibold text-blue-800">New expense</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Category</label>
          <select value={category} onChange={e => setCategory(e.target.value as ExpenseCategory)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Amount (€)</label>
          <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div className="flex items-end pb-0.5">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={palmeiras} onChange={e => setPalmeiras(e.target.checked)}
              className="w-4 h-4 rounded" />
            Palmeiras-related
          </label>
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Description</label>
        <input type="text" value={description} onChange={e => setDescription(e.target.value)}
          placeholder="What was this expense for?"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          Cancel
        </button>
        <button onClick={submit}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
          Add expense
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ExpensesTab({ data, handlers }: Props) {
  const { expenses } = data

  const [showForm,      setShowForm]      = useState(false)
  const [filterCat,     setFilterCat]     = useState<ExpenseCategory | 'all'>('all')
  const [filterPalm,    setFilterPalm]    = useState<'all' | 'yes' | 'no'>('all')
  const [filterMonth,   setFilterMonth]   = useState('')
  const [search,        setSearch]        = useState('')

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return expenses
      .filter(e => filterCat === 'all'  || e.category === filterCat)
      .filter(e => filterPalm === 'all' || (filterPalm === 'yes' ? e.palmeiras_related : !e.palmeiras_related))
      .filter(e => !filterMonth         || e.date.startsWith(filterMonth))
      .filter(e => !search              || e.description.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [expenses, filterCat, filterPalm, filterMonth, search])

  // ── Totals ────────────────────────────────────────────────────────────────
  const grandTotal = filtered.reduce((s, e) => s + e.amount, 0)

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of expenses) {
      map[e.category] = (map[e.category] ?? 0) + e.amount
    }
    return map
  }, [expenses])
  const grandAll = Object.values(byCategory).reduce((s, v) => s + v, 0) || 1

  const handleAdd = (e: Expense) => {
    handlers.addExpense(e)
    setShowForm(false)
  }

  const catInfo = (id: ExpenseCategory) => CATEGORIES.find(c => c.id === id)!

  return (
    <div className="space-y-6">

      {/* Category breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">Expenses by category (all time)</h2>
        <div className="space-y-3">
          {CATEGORIES.map(c => {
            const val = byCategory[c.id] ?? 0
            const pct = val / grandAll * 100
            return (
              <div key={c.id} className="flex items-center gap-3">
                <button
                  onClick={() => setFilterCat(filterCat === c.id ? 'all' : c.id)}
                  className={`w-28 text-left text-sm px-2 py-0.5 rounded-full font-medium transition-colors ${
                    filterCat === c.id ? `${c.bg} ${c.color} ring-2 ring-offset-1 ring-current` : 'text-gray-500 hover:bg-gray-100'
                  }`}>
                  {c.label}
                </button>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div className={`h-full ${c.bg} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                </div>
                <p className="w-24 text-right text-sm font-semibold text-gray-700">{fmtEur(val)}</p>
              </div>
            )
          })}
          <p className="text-right text-xs text-gray-400 pt-1">
            Total all time: <strong className="text-gray-600">{fmtEur(grandAll)}</strong>
          </p>
        </div>
      </div>

      {/* Filters + Add button */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search description…"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-52" />

        <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />

        <select value={filterPalm} onChange={e => setFilterPalm(e.target.value as typeof filterPalm)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="all">All (Palmeiras or not)</option>
          <option value="yes">Palmeiras-related</option>
          <option value="no">Non-Palmeiras</option>
        </select>

        {(filterCat !== 'all' || filterPalm !== 'all' || filterMonth || search) && (
          <button onClick={() => { setFilterCat('all'); setFilterPalm('all'); setFilterMonth(''); setSearch('') }}
            className="text-xs text-blue-600 hover:underline">
            Clear filters
          </button>
        )}

        <div className="ml-auto">
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            <span>+</span> Add expense
          </button>
        </div>
      </div>

      {showForm && (
        <AddExpenseForm onAdd={handleAdd} onCancel={() => setShowForm(false)} />
      )}

      {/* Expense list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Date</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Category</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Description</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-400">Palmeiras</th>
              <th className="px-4 py-3 text-right font-semibold text-red-500">Amount</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">No expenses match the current filters.</td>
              </tr>
            )}
            {filtered.map(e => {
              const cat = catInfo(e.category)
              return (
                <tr key={e.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{e.date}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cat.bg} ${cat.color}`}>
                      {cat.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-800">{e.description}</td>
                  <td className="px-4 py-3 text-center">
                    {e.palmeiras_related
                      ? <span className="text-purple-500 text-xs font-medium">🏨 Yes</span>
                      : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">− {fmtEur(e.amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handlers.deleteExpense(e.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none">
                      ×
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {filtered.length > 0 && (
            <tfoot className="bg-gray-50 border-t">
              <tr className="font-semibold">
                <td colSpan={4} className="px-4 py-3 text-gray-600">
                  {filtered.length} expense{filtered.length !== 1 ? 's' : ''} shown
                </td>
                <td className="px-4 py-3 text-right text-red-600">− {fmtEur(grandTotal)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
