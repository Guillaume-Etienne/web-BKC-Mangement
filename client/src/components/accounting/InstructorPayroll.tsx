import { useState } from 'react'
import type { SharedAccountingData, AccountingHandlers } from './types'
import type { Instructor, InstructorDebt, InstructorPayment, LessonRateOverride, PaymentMethod } from '../../types/database'
import {
  computeInstructorEarned, computeInstructorDebts,
  computeInstructorPaid, computeInstructorBalance,
  computeInstructorDiningCharges,
  getInstructorRate, fmtEur,
} from './utils'
import { todayISO, fmtDate } from '../../utils/dates'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'
import type { Lang } from '../../types/database'

interface Props { data: SharedAccountingData; handlers: AccountingHandlers }

const methodLabels = (lang: Lang): Record<PaymentMethod, string> => ({
  cash_eur:       i18n.accounting.method_cash_eur[lang],
  cash_mzn:       i18n.accounting.method_cash_mzn[lang],
  transfer:       i18n.accounting.method_transfer[lang],
  card_palmeiras: i18n.accounting.method_card_palmeiras[lang],
})

// ── Forms (module-scope) ───────────────────────────────────────────────────

interface AddDebtFormProps {
  instructorId: string
  onAdd: (d: InstructorDebt) => void
  onCancel: () => void
}
function AddDebtForm({ instructorId, onAdd, onCancel }: AddDebtFormProps) {
  const { lang } = useLanguage()
  const [date, setDate]              = useState(todayISO())
  const [amount, setAmount]          = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!parsed || !description.trim()) return
    onAdd({ id: `debt_${Date.now()}`, instructor_id: instructorId, date, amount: parsed, description: description.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg p-4 space-y-3">
      <p className="text-sm font-semibold text-red-800 dark:text-red-400">{i18n.accounting.ip_add_debt_advance[lang]}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{i18n.common.label_date[lang]}</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{i18n.accounting.bf_amount_eur[lang]}</label>
          <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{i18n.accounting.ip_description_required[lang]}</label>
        <input type="text" value={description} onChange={e => setDescription(e.target.value)}
          placeholder="e.g. Dinner Al-Farouk, Boat trip advance..."
          className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">{i18n.common.btn_cancel[lang]}</button>
        <button type="submit"
          className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded text-sm font-semibold hover:bg-red-700">{i18n.common.btn_save[lang]}</button>
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
  const { lang } = useLanguage()
  const [date, setDate]     = useState(todayISO())
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
    <form onSubmit={handleSubmit} className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg p-4 space-y-3">
      <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">{i18n.accounting.ip_pay_instructor[lang]}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{i18n.common.label_date[lang]}</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{i18n.accounting.bf_amount_eur[lang]}</label>
          <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{i18n.accounting.ip_method[lang]}</label>
          <select value={method} onChange={e => setMethod(e.target.value as PaymentMethod)}
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white dark:bg-gray-900">
            {(Object.entries(methodLabels(lang)) as [PaymentMethod, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{i18n.common.label_notes[lang]}</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional"
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">{i18n.common.btn_cancel[lang]}</button>
        <button type="submit"
          className="flex-1 px-3 py-1.5 bg-emerald-600 text-white rounded text-sm font-semibold hover:bg-emerald-700">{i18n.accounting.ip_pay_btn[lang]}</button>
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
  const { lang } = useLanguage()
  const [rate, setRate] = useState(String(currentRate))
  const [note, setNote] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(rate)
    if (!parsed || !note.trim()) return
    onSave({ id: `lro_${Date.now()}`, lesson_id: lessonId, rate: parsed, note: note.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{i18n.accounting.ip_rate_per_hour[lang]}</label>
          <input type="number" min="0" step="0.5" value={rate} onChange={e => setRate(e.target.value)}
            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{i18n.accounting.ip_justification[lang]}</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Required"
            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="px-2 py-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">{i18n.common.btn_cancel[lang]}</button>
        {hasOverride && (
          <button type="button" onClick={onRemove}
            className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs hover:bg-red-200 dark:hover:bg-red-800">{i18n.accounting.ip_remove_override[lang]}</button>
        )}
        <button type="submit"
          className="flex-1 px-2 py-1 bg-amber-600 text-white rounded text-xs font-semibold hover:bg-amber-700">{i18n.accounting.ip_save_override[lang]}</button>
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
  const { lang } = useLanguage()
  const [showAddDebt, setShowAddDebt]       = useState(false)
  const [showAddPayment, setShowAddPayment] = useState(false)
  const [overridingLesson, setOverridingLesson] = useState<string | null>(null)

  const earned  = computeInstructorEarned(instructor.id, data)
  const debts   = computeInstructorDebts(instructor.id, data)
  const dining  = computeInstructorDiningCharges(instructor.id, data.diningEvents)
  const paid    = computeInstructorPaid(instructor.id, data)
  const balance = computeInstructorBalance(instructor.id, data)

  const lessons  = data.lessons.filter(l => l.instructor_id === instructor.id)
    .sort((a, b) => a.date.localeCompare(b.date))
  const iDebts   = data.instructorDebts.filter(d => d.instructor_id === instructor.id)
    .sort((a, b) => a.date.localeCompare(b.date))
  const iPayments = data.instructorPayments.filter(p => p.instructor_id === instructor.id)
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-6">

      {/* Balance header */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: i18n.accounting.ip_lessons_earned[lang],  value: earned,   color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
          { label: i18n.accounting.ip_debts_advances[lang], value: -debts,  color: 'text-red-700 dark:text-red-400',     bg: 'bg-red-50 dark:bg-red-950/40' },
          { label: i18n.accounting.ip_dining_charges[lang],  value: -dining,  color: 'text-rose-700 dark:text-rose-400',    bg: 'bg-rose-50 dark:bg-rose-950/40' },
          { label: i18n.accounting.ip_already_paid[lang],    value: -paid,    color: 'text-red-700 dark:text-red-400',     bg: 'bg-red-50 dark:bg-red-950/40' },
          { label: i18n.accounting.ip_to_pay[lang],          value: balance,  color: balance >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400', bg: balance >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-red-50 dark:bg-red-950/40' },
        ].map(kpi => (
          <div key={kpi.label} className={`${kpi.bg} rounded-lg p-3 text-center`}>
            <p className="text-xs text-gray-400 dark:text-gray-400 mb-1">{kpi.label}</p>
            <p className={`text-lg font-bold ${kpi.color}`}>
              {kpi.value >= 0 ? '+' : ''}{fmtEur(kpi.value)}
            </p>
          </div>
        ))}
      </div>

      {/* Lessons */}
      <div>
        <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">{i18n.accounting.ip_lessons_header[lang]}</p>
        {lessons.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-400 italic">{i18n.accounting.ip_no_lessons[lang]}</p>
        ) : (
          <div className="space-y-1">
            {lessons.map(l => {
              const baseRate = l.type === 'private' ? instructor.rate_private
                : l.type === 'group' ? instructor.rate_group
                : instructor.rate_supervision
              const override = data.lessonRateOverrides.find(o => o.lesson_id === l.id)
              const effectiveRate = getInstructorRate(l, instructor, data.lessonRateOverrides)
              const total = effectiveRate * l.duration_hours
              const isOverriding = overridingLesson === l.id
              const clientNames = (l.participant_ids ?? [])
                .map(id => data.bookingParticipants.find(p => p.id === id)?.first_name)
                .filter(Boolean)
                .join(', ')

              return (
                <div key={l.id} className="rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <div className="flex items-center gap-3 text-sm flex-wrap">
                      <span className="text-gray-400 dark:text-gray-400 text-xs w-24 flex-shrink-0">{fmtDate(l.date)}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        l.type === 'private'    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                        l.type === 'group'      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                        'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                      }`}>{l.type}</span>
                      <span className="text-gray-500 dark:text-gray-400">{l.duration_hours}h</span>
                      {clientNames && (
                        <span className="text-gray-600 dark:text-gray-400 text-xs font-medium">{clientNames}</span>
                      )}
                      {override ? (
                        <span className="text-amber-600 dark:text-amber-400 text-xs">
                          {fmtEur(effectiveRate)}/h <span className="line-through text-gray-400 dark:text-gray-400">{fmtEur(baseRate)}</span>
                          <span className="ml-1 italic text-gray-400 dark:text-gray-400">({override.note})</span>
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-400 text-xs">{fmtEur(effectiveRate)}/h</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{fmtEur(total)}</span>
                      <button
                        onClick={() => setOverridingLesson(isOverriding ? null : l.id)}
                        className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                          override
                            ? 'border-amber-300 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                            : 'border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-400 hover:border-amber-300 dark:hover:border-amber-800 hover:text-amber-600 dark:hover:text-amber-400'
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
            <div className="flex justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm font-semibold">
              <span className="text-gray-600 dark:text-gray-400">{i18n.accounting.ip_total_lessons[lang]}</span>
              <span className="text-emerald-700 dark:text-emerald-400">{fmtEur(earned)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Debts */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">{i18n.accounting.ip_debts_advances_header[lang]}</p>
          {!showAddDebt && (
            <button onClick={() => setShowAddDebt(true)}
              className="text-xs px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 font-medium">
              {i18n.accounting.ip_add_debt_btn[lang]}
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
          <p className="text-sm text-gray-400 dark:text-gray-400 italic">{i18n.accounting.ip_no_debts[lang]}</p>
        ) : (
          <div className="space-y-1 mt-2">
            {iDebts.map(d => (
              <div key={d.id} className="flex items-center justify-between bg-red-50 dark:bg-red-950/40 rounded-lg px-4 py-2 text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 dark:text-gray-400 text-xs">{fmtDate(d.date)}</span>
                  <span className="text-gray-700 dark:text-gray-300">{d.description}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-red-700 dark:text-red-400">− {fmtEur(d.amount)}</span>
                  <button onClick={() => handlers.deleteInstructorDebt(d.id)}
                    className="text-gray-300 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 text-xs">✕</button>
                </div>
              </div>
            ))}
            <div className="flex justify-between px-4 py-2 bg-red-50 dark:bg-red-950/40 rounded-lg text-sm font-semibold border-t border-red-100 dark:border-red-900">
              <span className="text-gray-600 dark:text-gray-400">{i18n.accounting.ip_total_debts[lang]}</span>
              <span className="text-red-700 dark:text-red-400">− {fmtEur(debts)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Dining charges */}
      {dining > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">{i18n.accounting.ip_dining_charges_header[lang]}</p>
          <div className="space-y-1">
            {data.diningEvents.filter(ev =>
              ev.price_per_person > 0 &&
              (ev.attendees ?? []).some(a => a.is_attending && a.person_type === 'instructor' && a.person_id === instructor.id)
            ).map(ev => {
              const attending = (ev.attendees ?? []).filter(
                a => a.is_attending && a.person_type === 'instructor' && a.person_id === instructor.id
              )
              const evCharge = attending.reduce((s, a) => s + (a.price_override ?? ev.price_per_person), 0)
              return (
                <div key={ev.id} className="flex items-center justify-between bg-rose-50 dark:bg-rose-950/40 rounded-lg px-4 py-2 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 dark:text-gray-400 text-xs">{fmtDate(ev.date)}</span>
                    <span className="text-gray-700 dark:text-gray-300">{ev.name || '(unnamed)'}</span>
                  </div>
                  <span className="font-semibold text-rose-700 dark:text-rose-400">− {fmtEur(evCharge)}</span>
                </div>
              )
            })}
            <div className="flex justify-between px-4 py-2 bg-rose-50 dark:bg-rose-950/40 rounded-lg text-sm font-semibold border-t border-rose-100 dark:border-rose-900">
              <span className="text-gray-600 dark:text-gray-400">{i18n.accounting.ip_total_dining[lang]}</span>
              <span className="text-rose-700 dark:text-rose-400">− {fmtEur(dining)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Payments */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">{i18n.accounting.ip_payments_made[lang]}</p>
          {!showAddPayment && balance > 0 && (
            <button onClick={() => setShowAddPayment(true)}
              className="text-xs px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-800 font-medium">
              {i18n.accounting.ip_pay_amount_btn[lang].replace('{amount}', fmtEur(balance))}
            </button>
          )}
          {!showAddPayment && balance <= 0 && (
            <button onClick={() => setShowAddPayment(true)}
              className="text-xs px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 font-medium">
              {i18n.accounting.ip_add_payment_btn[lang]}
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
          <p className="text-sm text-gray-400 dark:text-gray-400 italic">{i18n.accounting.ip_no_payments_yet[lang]}</p>
        ) : (
          <div className="space-y-1 mt-2">
            {iPayments.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/40 rounded-lg px-4 py-2 text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 dark:text-gray-400 text-xs">{fmtDate(p.date)}</span>
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                    {methodLabels(lang)[p.method]}
                  </span>
                  {p.notes && <span className="text-gray-400 dark:text-gray-400 text-xs italic">{p.notes}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">− {fmtEur(p.amount)}</span>
                  <button onClick={() => handlers.deleteInstructorPayment(p.id)}
                    className="text-gray-300 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 text-xs">✕</button>
                </div>
              </div>
            ))}
            <div className="flex justify-between px-4 py-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-sm font-semibold border-t border-emerald-100 dark:border-emerald-900">
              <span className="text-gray-600 dark:text-gray-400">{i18n.accounting.ip_total_paid[lang]}</span>
              <span className="text-emerald-700 dark:text-emerald-400">− {fmtEur(paid)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Final balance */}
      <div className={`flex justify-between items-center px-5 py-3 rounded-xl text-base font-bold ${
        balance >= 0 ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
      }`}>
        <span>{i18n.accounting.ip_balance_to_pay[lang]}</span>
        <span>{fmtEur(balance)}</span>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function InstructorPayroll({ data, handlers }: Props) {
  const { lang } = useLanguage()
  const { instructors } = data
  const [activeId, setActiveId] = useState<string>(instructors[0]?.id ?? '')

  const rows = instructors.map(i => ({
    instructor: i,
    earned:  computeInstructorEarned(i.id, data),
    debts:   computeInstructorDebts(i.id, data),
    paid:    computeInstructorPaid(i.id, data),
    balance: computeInstructorBalance(i.id, data),
  }))

  const totalOwed = rows.reduce((s, r) => s + Math.max(0, r.balance), 0)
  const activeRow = rows.find(r => r.instructor.id === activeId)

  if (instructors.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-400 italic p-4">{i18n.accounting.ip_no_instructors[lang]}</p>
  }

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-5 py-4">
          <p className="text-xs text-gray-400 dark:text-gray-400 uppercase tracking-wide mb-1">{i18n.accounting.ip_total_lessons_kpi[lang]}</p>
          <p className="text-xl font-bold text-gray-800 dark:text-gray-200">{fmtEur(rows.reduce((s, r) => s + r.earned, 0))}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-5 py-4">
          <p className="text-xs text-gray-400 dark:text-gray-400 uppercase tracking-wide mb-1">{i18n.accounting.ip_already_paid[lang]}</p>
          <p className="text-xl font-bold text-gray-800 dark:text-gray-200">{fmtEur(rows.reduce((s, r) => s + r.paid, 0))}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900 px-5 py-4">
          <p className="text-xs text-amber-500 dark:text-amber-400 uppercase tracking-wide mb-1">{i18n.accounting.ip_to_pay_total[lang]}</p>
          <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{fmtEur(totalOwed)}</p>
        </div>
      </div>

      {/* Instructor tabs */}
      <div className="flex gap-1 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-1 overflow-x-auto">
        {rows.map(({ instructor: i, balance }) => (
          <button
            key={i.id}
            onClick={() => setActiveId(i.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap transition-colors flex-1 justify-center ${
              activeId === i.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <span>{i.first_name} {i.last_name}</span>
            {balance > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                activeId === i.id ? 'bg-white dark:bg-gray-900/20 text-white' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
              }`}>
                {fmtEur(balance)}
              </span>
            )}
            {balance === 0 && (
              <span className={`text-xs ${activeId === i.id ? 'text-white/70' : 'text-emerald-500 dark:text-emerald-400'}`}>✓</span>
            )}
          </button>
        ))}
      </div>

      {/* Active instructor detail */}
      {activeRow && (
        <InstructorDetailPanel
          instructor={activeRow.instructor}
          data={data}
          handlers={handlers}
        />
      )}
    </div>
  )
}
