import { useState, useMemo } from 'react'
import type { SharedAccountingData, AccountingHandlers } from './types'
import type { Expense } from '../../types/database'
import { mockExpenseCategories } from '../../data/mock'
import { fmtEur, fmtMonth } from './utils'

interface Props {
  data:     SharedAccountingData
  handlers: AccountingHandlers
}

type View = 'list' | 'summary'

// Palette de couleurs cyclique pour les catégories
const PALETTE = [
  '#60a5fa', '#34d399', '#f97316', '#a78bfa', '#facc15',
  '#f472b6', '#38bdf8', '#4ade80', '#fb923c', '#c084fc',
]

// ── Add expense form (module-scope) ──────────────────────────────────────────
interface AddFormProps {
  categories: string[]
  onAdd: (e: Expense) => void
  onCancel: () => void
}
function AddExpenseForm({ categories, onAdd, onCancel }: AddFormProps) {
  const [date,        setDate]        = useState(new Date().toISOString().slice(0, 10))
  const [category,   setCategory]    = useState(categories[0] ?? 'Other')
  const [amount,     setAmount]      = useState('')
  const [description,setDescription] = useState('')

  const submit = () => {
    const amt = parseFloat(amount)
    if (!date || !description.trim() || isNaN(amt) || amt <= 0) return
    onAdd({ id: crypto.randomUUID(), date, category, amount: amt, description: description.trim() })
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
      <p className="font-semibold text-blue-800">New expense</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Amount (€)</label>
          <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
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

// ── Add category form (module-scope) ─────────────────────────────────────────
interface AddCatProps { onAdd: (name: string) => void; onCancel: () => void }
function AddCategoryForm({ onAdd, onCancel }: AddCatProps) {
  const [name, setName] = useState('')
  return (
    <div className="flex items-center gap-2">
      <input type="text" value={name} onChange={e => setName(e.target.value)}
        placeholder="Category name…"
        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-44" />
      <button onClick={() => { if (name.trim()) { onAdd(name.trim()); } }}
        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
        Add
      </button>
      <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ExpensesTab({ data, handlers }: Props) {
  const { expenses, seasons } = data
  const currentSeason = seasons[seasons.length - 1]

  const [view,        setView]        = useState<View>('list')
  const [categories,  setCategories]  = useState<string[]>(mockExpenseCategories)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showAddCat,  setShowAddCat]  = useState(false)

  // List filters
  const [filterCat,   setFilterCat]   = useState<string>('all')
  const [filterMonth, setFilterMonth] = useState('')
  const [search,      setSearch]      = useState('')

  // Summary period
  type SummaryPeriod = 'all' | 'season' | 'custom'
  const [sumPeriod,   setSumPeriod]   = useState<SummaryPeriod>('season')
  const [sumFrom,     setSumFrom]     = useState(currentSeason?.start_date.slice(0, 7) ?? '')
  const [sumTo,       setSumTo]       = useState(currentSeason?.end_date.slice(0, 7) ?? '')

  // Color map for categories
  const colorOf = (cat: string) => {
    const idx = categories.indexOf(cat)
    return PALETTE[(idx >= 0 ? idx : categories.length) % PALETTE.length]
  }

  // ── Category management ───────────────────────────────────────────────────
  const addCategory = (name: string) => {
    if (!categories.includes(name)) setCategories(prev => [...prev, name])
    setShowAddCat(false)
  }
  const removeCategory = (name: string) => {
    if (expenses.some(e => e.category === name)) return // used
    setCategories(prev => prev.filter(c => c !== name))
  }

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => expenses
    .filter(e => filterCat === 'all' || e.category === filterCat)
    .filter(e => !filterMonth || e.date.startsWith(filterMonth))
    .filter(e => !search || e.description.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date))
  , [expenses, filterCat, filterMonth, search])

  // ── Summary data ──────────────────────────────────────────────────────────
  const summaryExpenses = useMemo(() => {
    if (sumPeriod === 'season' && currentSeason) {
      const from = currentSeason.start_date.slice(0, 7)
      const to   = currentSeason.end_date.slice(0, 7)
      return expenses.filter(e => e.date.slice(0, 7) >= from && e.date.slice(0, 7) <= to)
    }
    if (sumPeriod === 'custom' && sumFrom && sumTo) {
      return expenses.filter(e => e.date.slice(0, 7) >= sumFrom && e.date.slice(0, 7) <= sumTo)
    }
    return expenses
  }, [expenses, sumPeriod, currentSeason, sumFrom, sumTo])

  // months × categories matrix
  const summaryMatrix = useMemo(() => {
    const months = [...new Set(summaryExpenses.map(e => e.date.slice(0, 7)))].sort()
    const cats   = [...new Set(summaryExpenses.map(e => e.category))]
    // totals[month][cat] = amount
    const totals: Record<string, Record<string, number>> = {}
    for (const e of summaryExpenses) {
      const m = e.date.slice(0, 7)
      if (!totals[m]) totals[m] = {}
      totals[m][e.category] = (totals[m][e.category] ?? 0) + e.amount
    }
    const monthTotals = months.map(m => Object.values(totals[m] ?? {}).reduce((s, v) => s + v, 0))
    const catTotals: Record<string, number> = {}
    for (const c of cats) {
      catTotals[c] = summaryExpenses.filter(e => e.category === c).reduce((s, e) => s + e.amount, 0)
    }
    const grandTotal = summaryExpenses.reduce((s, e) => s + e.amount, 0)
    return { months, cats, totals, monthTotals, catTotals, grandTotal }
  }, [summaryExpenses])

  // ── Grand totals for list ─────────────────────────────────────────────────
  const listTotal = filtered.reduce((s, e) => s + e.amount, 0)

  // ── Totals by category (all time, for breakdown bar) ─────────────────────
  const allByCat = useMemo(() => {
    const m: Record<string, number> = {}
    for (const e of expenses) m[e.category] = (m[e.category] ?? 0) + e.amount
    return m
  }, [expenses])
  const allTotal = Object.values(allByCat).reduce((s, v) => s + v, 0) || 1

  return (
    <div className="space-y-6">

      {/* View toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1">
          {(['list', 'summary'] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors capitalize ${
                view === v ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}>
              {v === 'list' ? '📋 List' : '📊 Summary'}
            </button>
          ))}
        </div>

        {/* Category manager */}
        <div className="flex items-center gap-2 flex-wrap">
          {categories.map(c => {
            const used = expenses.some(e => e.category === c)
            return (
              <span key={c} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium"
                style={{ backgroundColor: colorOf(c) + '33', color: colorOf(c) }}>
                {c}
                {!used && (
                  <button onClick={() => removeCategory(c)} className="opacity-50 hover:opacity-100 leading-none">×</button>
                )}
              </span>
            )
          })}
          {showAddCat
            ? <AddCategoryForm onAdd={addCategory} onCancel={() => setShowAddCat(false)} />
            : <button onClick={() => setShowAddCat(true)}
                className="text-xs px-2 py-1 border border-dashed border-gray-300 rounded-full text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors">
                + category
              </button>
          }
        </div>
      </div>

      {/* ── LIST VIEW ─────────────────────────────────────────────────────── */}
      {view === 'list' && (<>

        {/* Category breakdown bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <p className="text-sm font-semibold text-gray-600">All-time breakdown</p>
          {Object.entries(allByCat).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
            <div key={cat} className="flex items-center gap-3">
              <button onClick={() => setFilterCat(filterCat === cat ? 'all' : cat)}
                className={`w-28 text-left text-xs px-2 py-0.5 rounded-full font-semibold truncate transition-all ${
                  filterCat === cat ? 'ring-2 ring-offset-1' : 'opacity-70 hover:opacity-100'
                }`}
                style={{ backgroundColor: colorOf(cat) + '33', color: colorOf(cat),
                         ...(filterCat === cat ? { ringColor: colorOf(cat) } : {}) }}>
                {cat}
              </button>
              <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(val / allTotal) * 100}%`, backgroundColor: colorOf(cat) }} />
              </div>
              <p className="w-24 text-right text-sm font-semibold text-gray-700">{fmtEur(val)}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-48" />
          <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="all">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {(filterCat !== 'all' || filterMonth || search) && (
            <button onClick={() => { setFilterCat('all'); setFilterMonth(''); setSearch('') }}
              className="text-xs text-blue-600 hover:underline">Clear</button>
          )}
          <div className="ml-auto">
            <button onClick={() => setShowAddForm(v => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              + Add expense
            </button>
          </div>
        </div>

        {showAddForm && <AddExpenseForm categories={categories} onAdd={e => { handlers.addExpense(e); setShowAddForm(false) }} onCancel={() => setShowAddForm(false)} />}

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[540px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Category</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Description</th>
                <th className="px-4 py-3 text-right font-semibold text-red-500">Amount</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">No expenses match the current filters.</td></tr>
              )}
              {filtered.map(e => (
                <tr key={e.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{e.date}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: colorOf(e.category) + '33', color: colorOf(e.category) }}>
                      {e.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-800">{e.description}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">− {fmtEur(e.amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handlers.deleteExpense(e.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-gray-50 border-t font-semibold">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-gray-600">{filtered.length} expense{filtered.length !== 1 ? 's' : ''}</td>
                  <td className="px-4 py-3 text-right text-red-600">− {fmtEur(listTotal)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </>)}

      {/* ── SUMMARY VIEW ──────────────────────────────────────────────────── */}
      {view === 'summary' && (<>

        {/* Period selector */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1">
            {([
              { id: 'all',    label: 'All time' },
              { id: 'season', label: `Season ${currentSeason?.label ?? ''}` },
              { id: 'custom', label: 'Custom' },
            ] as { id: SummaryPeriod; label: string }[]).map(opt => (
              <button key={opt.id} onClick={() => setSumPeriod(opt.id)}
                className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                  sumPeriod === opt.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
          {sumPeriod === 'custom' && (
            <div className="flex items-center gap-2 text-sm">
              <input type="month" value={sumFrom} onChange={e => setSumFrom(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <span className="text-gray-400">→</span>
              <input type="month" value={sumTo} onChange={e => setSumTo(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          )}
        </div>

        {/* KPI cards by category */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {summaryMatrix.cats.sort((a, b) => (summaryMatrix.catTotals[b] ?? 0) - (summaryMatrix.catTotals[a] ?? 0)).map(cat => (
            <div key={cat} className="rounded-xl border p-4"
              style={{ borderColor: colorOf(cat) + '66', backgroundColor: colorOf(cat) + '11' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: colorOf(cat) }}>{cat}</p>
              <p className="text-xl font-bold text-gray-800">− {fmtEur(summaryMatrix.catTotals[cat] ?? 0)}</p>
            </div>
          ))}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Total</p>
            <p className="text-xl font-bold text-red-700">− {fmtEur(summaryMatrix.grandTotal)}</p>
          </div>
        </div>

        {/* Month × Category table */}
        {summaryMatrix.months.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">Month</th>
                  {summaryMatrix.cats.map(cat => (
                    <th key={cat} className="px-4 py-3 text-right font-semibold whitespace-nowrap"
                      style={{ color: colorOf(cat) }}>
                      {cat}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {[...summaryMatrix.months].reverse().map((m, mi) => {
                  const monthTotal = summaryMatrix.monthTotals[summaryMatrix.months.length - 1 - mi]
                  return (
                    <tr key={m} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-700 whitespace-nowrap">{fmtMonth(m)}</td>
                      {summaryMatrix.cats.map(cat => {
                        const val = summaryMatrix.totals[m]?.[cat] ?? 0
                        return (
                          <td key={cat} className="px-4 py-3 text-right text-gray-500">
                            {val ? `− ${fmtEur(val)}` : '–'}
                          </td>
                        )
                      })}
                      <td className="px-4 py-3 text-right font-semibold text-red-600">− {fmtEur(monthTotal)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t font-semibold">
                <tr>
                  <td className="px-4 py-3 text-gray-600">Total</td>
                  {summaryMatrix.cats.map(cat => (
                    <td key={cat} className="px-4 py-3 text-right" style={{ color: colorOf(cat) }}>
                      − {fmtEur(summaryMatrix.catTotals[cat] ?? 0)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right text-red-700">− {fmtEur(summaryMatrix.grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </>)}
    </div>
  )
}
