import { useState } from 'react'
import type { SharedAccountingData, AccountingHandlers } from './types'
import type { Instructor, InstructorDebt, InstructorPayment, LessonRateOverride, PaymentMethod } from '../../types/database'
import {
  computeInstructorEarned, computeInstructorDebts,
  computeInstructorPaid, computeInstructorBalance,
  getLessonRate, fmtEur,
} from './utils'

interface Props { data: SharedAccountingData; handlers: AccountingHandlers }

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash_eur:       'Cash EUR',
  cash_mzn:       'Cash MZN',
  transfer:       'Transfer',
  card_palmeiras: 'Card (Palmeiras)',
}

// ── Forms (module-scope) ───────────────────────────────────────────────────

interface AddDebtFormProps {
  instructorId: string
  onAdd: (d: InstructorDebt) => void
  onCancel: () => void
}
function AddDebtForm({ instructorId, onAdd, onCancel }: AddDebtFormProps) {
  const [date, setDate]              = useState(new Date().toISOString().slice(0, 10))
  const [amount, setAmount]          = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!parsed || !description.trim()) return
    onAdd({ id: `debt_${Date.now()}`, instructor_id: instructorId, date, amount: parsed, description: description.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
      <p className="text-sm font-semibold text-red-800">Add debt / advance</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Amount (€)</label>
          <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Description *</label>
        <input type="text" value={description} onChange={e => setDescription(e.target.value)}
          placeholder="e.g. Dinner Al-Farouk, Boat trip advance..."
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

interface AddPaymentFormProps {
  instructorId: string
  suggestedAmount: number
  onAdd: (p: InstructorPayment) => void
  onCancel: () => void
}
function AddPaymentForm({ instructorId, suggestedAmount, onAdd, onCancel }: AddPaymentFormProps) {
  const [date, setDate]     = useState(new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState(String(Math.max(0, Math.round(suggestedAmount))))
  const [method, setMethod] = useState<PaymentMethod>('cash_eur')
  const [notes, setNotes]   = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) return
    onAdd({ id: `ipay_${Date.now()}`, instructor_id: instructorId, date, amount: parsed, method, notes: notes || null })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-3">
      <p className="text-sm font-semibold text-emerald-800">Pay instructor</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Amount (€)</label>
          <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Method</label>
          <select value={method} onChange={e => setMethod(e.target.value as PaymentMethod)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
            {(Object.entries(METHOD_LABELS) as [PaymentMethod, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Notes</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional"
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
        <button type="submit"
          className="flex-1 px-3 py-1.5 bg-emerald-600 text-white rounded text-sm font-semibold hover:bg-emerald-700">Pay</button>
      </div>
    </form>
  )
}

interface OverrideFormProps {
  lessonId: string
  currentRate: number
  onSave: (o: LessonRateOverride) => void
  onRemove: () => void
  onCancel: () => void
  hasOverride: boolean
}
function OverrideForm({ lessonId, currentRate, onSave, onRemove, onCancel, hasOverride }: OverrideFormProps) {
  const [rate, setRate] = useState(String(currentRate))
  const [note, setNote] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(rate)
    if (!parsed || !note.trim()) return
    onSave({ id: `lro_${Date.now()}`, lesson_id: lessonId, rate: parsed, note: note.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Rate (€/h)</label>
          <input type="number" min="0" step="0.5" value={rate} onChange={e => setRate(e.target.value)}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Justification *</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Required"
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50">Cancel</button>
        {hasOverride && (
          <button type="button" onClick={onRemove}
            className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">Remove override</button>
        )}
        <button type="submit"
          className="flex-1 px-2 py-1 bg-amber-600 text-white rounded text-xs font-semibold hover:bg-amber-700">Save override</button>
      </div>
    </form>
  )
}

// ── Instructor detail panel ────────────────────────────────────────────────

interface DetailPanelProps {
  instructor: Instructor
  data: SharedAccountingData
  handlers: AccountingHandlers
}

function InstructorDetailPanel({ instructor, data, handlers }: DetailPanelProps) {
  const [showAddDebt, setShowAddDebt]       = useState(false)
  const [showAddPayment, setShowAddPayment] = useState(false)
  const [overridingLesson, setOverridingLesson] = useState<string | null>(null)

  const earned  = computeInstructorEarned(instructor.id, data)
  const debts   = computeInstructorDebts(instructor.id, data)
  const paid    = computeInstructorPaid(instructor.id, data)
  const balance = computeInstructorBalance(instructor.id, data)

  const lessons  = data.lessons.filter(l => l.instructor_id === instructor.id)
    .sort((a, b) => a.date.localeCompare(b.date))
  const iDebts   = data.instructorDebts.filter(d => d.instructor_id === instructor.id)
    .sort((a, b) => a.date.localeCompare(b.date))
  const iPayments = data.instructorPayments.filter(p => p.instructor_id === instructor.id)
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">

      {/* Balance header */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Lessons earned', value: earned,  color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Debts / advances', value: -debts, color: 'text-red-700',    bg: 'bg-red-50' },
          { label: 'Already paid',   value: -paid,   color: 'text-red-700',    bg: 'bg-red-50' },
          { label: 'To pay',         value: balance, color: balance >= 0 ? 'text-emerald-700' : 'text-red-700', bg: balance >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
        ].map(kpi => (
          <div key={kpi.label} className={`${kpi.bg} rounded-lg p-3 text-center`}>
            <p className="text-xs text-gray-400 mb-1">{kpi.label}</p>
            <p className={`text-lg font-bold ${kpi.color}`}>
              {kpi.value >= 0 ? '+' : ''}{fmtEur(kpi.value)}
            </p>
          </div>
        ))}
      </div>

      {/* Lessons */}
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-2">Lessons</p>
        {lessons.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No lessons recorded.</p>
        ) : (
          <div className="space-y-1">
            {lessons.map(l => {
              const baseRate = l.type === 'private' ? instructor.rate_private
                : l.type === 'group' ? instructor.rate_group
                : instructor.rate_supervision
              const override = data.lessonRateOverrides.find(o => o.lesson_id === l.id)
              const effectiveRate = getLessonRate(l, instructor, data.lessonRateOverrides)
              const total = effectiveRate * l.duration_hours
              const isOverriding = overridingLesson === l.id

              return (
                <div key={l.id} className="rounded-lg border border-gray-100 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-gray-400 text-xs w-24 flex-shrink-0">{l.date}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        l.type === 'private'    ? 'bg-blue-100 text-blue-700' :
                        l.type === 'group'      ? 'bg-emerald-100 text-emerald-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>{l.type}</span>
                      <span className="text-gray-500">{l.duration_hours}h</span>
                      {override ? (
                        <span className="text-amber-600 text-xs">
                          {fmtEur(effectiveRate)}/h <span className="line-through text-gray-400">{fmtEur(baseRate)}</span>
                          <span className="ml-1 italic text-gray-400">({override.note})</span>
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">{fmtEur(effectiveRate)}/h</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-gray-700">{fmtEur(total)}</span>
                      <button
                        onClick={() => setOverridingLesson(isOverriding ? null : l.id)}
                        className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                          override
                            ? 'border-amber-300 text-amber-600 hover:bg-amber-50'
                            : 'border-gray-200 text-gray-400 hover:border-amber-300 hover:text-amber-600'
                        }`}
                      >
                        {override ? '✏️ override' : '± rate'}
                      </button>
                    </div>
                  </div>
                  {isOverriding && (
                    <div className="px-4 pb-3">
                      <OverrideForm
                        lessonId={l.id}
                        currentRate={effectiveRate}
                        hasOverride={!!override}
                        onSave={(o) => { handlers.setLessonOverride(o); setOverridingLesson(null) }}
                        onRemove={() => { handlers.removeLessonOverride(l.id); setOverridingLesson(null) }}
                        onCancel={() => setOverridingLesson(null)}
                      />
                    </div>
                  )}
                </div>
              )
            })}
            <div className="flex justify-between px-4 py-2 bg-gray-50 rounded-lg text-sm font-semibold">
              <span className="text-gray-600">Total lessons</span>
              <span className="text-emerald-700">{fmtEur(earned)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Debts */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-semibold text-gray-600">Debts & advances</p>
          {!showAddDebt && (
            <button onClick={() => setShowAddDebt(true)}
              className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium">
              + Add debt
            </button>
          )}
        </div>
        {showAddDebt && (
          <AddDebtForm
            instructorId={instructor.id}
            onAdd={(d) => { handlers.addInstructorDebt(d); setShowAddDebt(false) }}
            onCancel={() => setShowAddDebt(false)}
          />
        )}
        {iDebts.length === 0 && !showAddDebt ? (
          <p className="text-sm text-gray-400 italic">No debts recorded.</p>
        ) : (
          <div className="space-y-1 mt-2">
            {iDebts.map(d => (
              <div key={d.id} className="flex items-center justify-between bg-red-50 rounded-lg px-4 py-2 text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 text-xs">{d.date}</span>
                  <span className="text-gray-700">{d.description}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-red-700">− {fmtEur(d.amount)}</span>
                  <button onClick={() => handlers.deleteInstructorDebt(d.id)}
                    className="text-gray-300 hover:text-red-500 text-xs">✕</button>
                </div>
              </div>
            ))}
            <div className="flex justify-between px-4 py-2 bg-red-50 rounded-lg text-sm font-semibold border-t border-red-100">
              <span className="text-gray-600">Total debts</span>
              <span className="text-red-700">− {fmtEur(debts)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Payments */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-semibold text-gray-600">Payments made</p>
          {!showAddPayment && balance > 0 && (
            <button onClick={() => setShowAddPayment(true)}
              className="text-xs px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 font-medium">
              + Pay {fmtEur(balance)}
            </button>
          )}
          {!showAddPayment && balance <= 0 && (
            <button onClick={() => setShowAddPayment(true)}
              className="text-xs px-3 py-1 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 font-medium">
              + Add payment
            </button>
          )}
        </div>
        {showAddPayment && (
          <AddPaymentForm
            instructorId={instructor.id}
            suggestedAmount={balance}
            onAdd={(p) => { handlers.addInstructorPayment(p); setShowAddPayment(false) }}
            onCancel={() => setShowAddPayment(false)}
          />
        )}
        {iPayments.length === 0 && !showAddPayment ? (
          <p className="text-sm text-gray-400 italic">No payments made yet.</p>
        ) : (
          <div className="space-y-1 mt-2">
            {iPayments.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-emerald-50 rounded-lg px-4 py-2 text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 text-xs">{p.date}</span>
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">
                    {METHOD_LABELS[p.method]}
                  </span>
                  {p.notes && <span className="text-gray-400 text-xs italic">{p.notes}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-emerald-700">− {fmtEur(p.amount)}</span>
                  <button onClick={() => handlers.deleteInstructorPayment(p.id)}
                    className="text-gray-300 hover:text-red-500 text-xs">✕</button>
                </div>
              </div>
            ))}
            <div className="flex justify-between px-4 py-2 bg-emerald-50 rounded-lg text-sm font-semibold border-t border-emerald-100">
              <span className="text-gray-600">Total paid</span>
              <span className="text-emerald-700">− {fmtEur(paid)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Final balance */}
      <div className={`flex justify-between items-center px-5 py-3 rounded-xl text-base font-bold ${
        balance >= 0 ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
      }`}>
        <span>Balance to pay</span>
        <span>{fmtEur(balance)}</span>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function InstructorPayroll({ data, handlers }: Props) {
  const { instructors } = data
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const rows = instructors.map(i => ({
    instructor: i,
    earned:  computeInstructorEarned(i.id, data),
    debts:   computeInstructorDebts(i.id, data),
    paid:    computeInstructorPaid(i.id, data),
    balance: computeInstructorBalance(i.id, data),
  }))

  const totalOwed = rows.reduce((s, r) => s + Math.max(0, r.balance), 0)

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total lessons</p>
          <p className="text-xl font-bold text-gray-800">{fmtEur(rows.reduce((s, r) => s + r.earned, 0))}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Already paid</p>
          <p className="text-xl font-bold text-gray-800">{fmtEur(rows.reduce((s, r) => s + r.paid, 0))}</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 px-5 py-4">
          <p className="text-xs text-amber-500 uppercase tracking-wide mb-1">To pay (total)</p>
          <p className="text-xl font-bold text-amber-700">{fmtEur(totalOwed)}</p>
        </div>
      </div>

      {/* Instructor list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Instructor</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Rates</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Earned</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Debts</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Paid</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ instructor: i, earned, debts, paid, balance }) => {
              const isExpanded = expandedId === i.id
              return (
                <>
                  <tr
                    key={i.id}
                    onClick={() => setExpandedId(isExpanded ? null : i.id)}
                    className={`border-b cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {i.first_name} {i.last_name}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {i.rate_private}€ / {i.rate_group}€ / {i.rate_supervision}€/h
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-700 font-medium">{fmtEur(earned)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{debts > 0 ? `− ${fmtEur(debts)}` : '–'}</td>
                    <td className="px-4 py-3 text-right text-red-600">{paid > 0 ? `− ${fmtEur(paid)}` : '–'}</td>
                    <td className={`px-4 py-3 text-right font-bold ${balance > 0 ? 'text-amber-600' : balance < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {balance === 0 ? '✓' : fmtEur(balance)}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${i.id}-detail`}>
                      <td colSpan={6} className="px-4 py-4 bg-gray-50 border-b">
                        <InstructorDetailPanel instructor={i} data={data} handlers={handlers} />
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
