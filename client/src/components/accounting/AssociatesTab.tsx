import { useMemo, useState } from 'react'
import type { SharedAccountingData, AccountingHandlers } from './types'
import type { Associate, AssociateTransfer, AssociateTransferDirection, Lang } from '../../types/database'
import { fmtEur } from './utils'
import { filterDataToSeason } from './seasonFilter'
import { computeAssociateSummaries, associateGap, totalDrawn } from './associateUtils'
import type { AssociateEntry, AssociateEntryKind, AssociateSummary } from './associateUtils'
import { todayISO, fmtDate } from '../../utils/dates'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'

interface Props {
  data:           SharedAccountingData
  handlers:       AccountingHandlers
  onOpenBooking?: (id: string) => void
}

type Period = 'all' | 'season'

function kindLabels(lang: Lang): Record<AssociateEntryKind, string> {
  return {
    client_payment: i18n.accounting.as_kind_client_payment[lang],
    transfer_out:   i18n.accounting.as_kind_transfer_out[lang],
    transfer_back:  i18n.accounting.as_kind_transfer_back[lang],
    expense:        i18n.accounting.as_kind_expense[lang],
  }
}

const KIND_COLORS: Record<AssociateEntryKind, string> = {
  client_payment: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400',
  transfer_out:   'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-400',
  transfer_back:  'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400',
  expense:        'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400',
}

/** The cents matter on an account two people reconcile against each other;
 *  `fmtEur` rounds to the euro, which is right for a dashboard and wrong here. */
function fmtEurExact(amount: number): string {
  return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

// ── Add transfer form (module-scope) ─────────────────────────────────────────
interface TransferFormProps {
  associates: Associate[]
  onAdd:      (t: AssociateTransfer) => void
  onCancel:   () => void
}
function TransferForm({ associates, onAdd, onCancel }: TransferFormProps) {
  const { lang } = useLanguage()
  const [associateId, setAssociateId] = useState(associates[0]?.id ?? '')
  const [date,        setDate]        = useState(todayISO())
  const [amount,      setAmount]      = useState('')
  const [direction,   setDirection]   = useState<AssociateTransferDirection>('to_associate')
  const [notes,       setNotes]       = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!associateId || !date || isNaN(amt) || amt <= 0) return
    onAdd({
      id: crypto.randomUUID(), associate_id: associateId, date, amount: amt, direction,
      notes: notes.trim() || null,
    })
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-900 dark:text-gray-200'
  const labelCls = 'block text-xs text-gray-500 dark:text-gray-400 mb-1'

  return (
    <form onSubmit={submit} className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl p-5 space-y-4">
      <p className="font-semibold text-blue-800 dark:text-blue-400">{i18n.accounting.as_new_transfer[lang]}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className={labelCls}>{i18n.accounting.as_associate[lang]}</label>
          <select value={associateId} onChange={e => setAssociateId(e.target.value)} className={inputCls}>
            {associates.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>{i18n.accounting.as_direction[lang]}</label>
          <select value={direction} onChange={e => setDirection(e.target.value as AssociateTransferDirection)} className={inputCls}>
            <option value="to_associate">{i18n.accounting.as_dir_to_associate[lang]}</option>
            <option value="to_centre">{i18n.accounting.as_dir_to_centre[lang]}</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>{i18n.common.label_date[lang]}</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{i18n.accounting.bf_amount_eur[lang]}</label>
          <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0.00" autoFocus className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>{i18n.common.label_notes[lang]}</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder={i18n.common.msg_optional[lang]} className={inputCls} />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
          {i18n.common.btn_cancel[lang]}
        </button>
        <button type="submit"
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
          {i18n.accounting.as_save_transfer[lang]}
        </button>
      </div>
    </form>
  )
}

// ── One associate's account (module-scope) ───────────────────────────────────
interface AccountCardProps {
  summary:        AssociateSummary
  bookingLabel:   (id: string) => string
  onOpenBooking?: (id: string) => void
  onDeleteTransfer: (id: string) => void
}
function AccountCard({ summary, bookingLabel, onOpenBooking, onDeleteTransfer }: AccountCardProps) {
  const { lang } = useLanguage()
  const labels = kindLabels(lang)
  const { associate, balance, entries } = summary
  const owed = balance < 0

  const lines: [string, number, 1 | -1][] = [
    [i18n.accounting.as_received[lang],          summary.received,          1],
    [i18n.accounting.as_transfers_out[lang],     summary.transfersOut,      1],
    [i18n.accounting.as_transfers_back[lang],    summary.transfersBack,    -1],
    [i18n.accounting.as_expenses_advanced[lang], summary.expensesAdvanced, -1],
  ]

  const detail = (e: AssociateEntry) => {
    if (e.kind !== 'client_payment' || !e.bookingId) return e.label
    const ref = bookingLabel(e.bookingId)
    return (
      <>
        {onOpenBooking
          ? <button onClick={() => onOpenBooking(e.bookingId!)} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">{ref}</button>
          : <span className="font-medium">{ref}</span>}
        {e.label && <span className="text-gray-400 dark:text-gray-500"> · {e.label}</span>}
      </>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="p-5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{associate.name}</h3>
          <div className="text-right">
            <p className={`text-2xl font-bold tabular-nums ${owed ? 'text-amber-600 dark:text-amber-400' : 'text-gray-800 dark:text-gray-200'}`}>
              {fmtEurExact(balance)}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {i18n.accounting.as_balance[lang]} · {owed ? i18n.accounting.as_balance_hint_neg[lang] : i18n.accounting.as_balance_hint_pos[lang]}
            </p>
          </div>
        </div>
        <dl className="mt-4 space-y-1 text-sm">
          {lines.map(([label, value, sign]) => (
            <div key={label} className="flex justify-between gap-3 text-gray-600 dark:text-gray-400">
              <dt>{label}</dt>
              <dd className="tabular-nums">{value === 0 ? '–' : `${sign > 0 ? '+' : '−'} ${fmtEurExact(value)}`}</dd>
            </div>
          ))}
        </dl>
      </div>

      {entries.length === 0 ? (
        <p className="px-5 py-6 text-sm text-center text-gray-400 dark:text-gray-500">{i18n.accounting.as_no_entries[lang]}</p>
      ) : (
        // One layout for every width: a row wraps instead of needing a second,
        // mobile-only rendering that would have to be kept in step.
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {entries.map(e => (
            <li key={e.key} className="px-5 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtDate(e.date)}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${KIND_COLORS[e.kind]}`}>{labels[e.kind]}</span>
              {e.unverified && (
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                  {i18n.accounting.as_unverified[lang]}
                </span>
              )}
              <span className="flex-1 min-w-[8rem] text-gray-800 dark:text-gray-200">{detail(e)}</span>
              <span className={`font-semibold tabular-nums whitespace-nowrap ${e.amount < 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-800 dark:text-gray-200'}`}>
                {e.amount < 0 ? '−' : '+'} {fmtEurExact(Math.abs(e.amount))}
              </span>
              {/* Only a transfer lives here. A guest payment or an expense is
                  edited where it was entered, so there is one place to change it. */}
              {e.kind === 'transfer_out' || e.kind === 'transfer_back' ? (
                <button onClick={() => onDeleteTransfer(e.sourceId)}
                  className="text-gray-300 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors text-lg leading-none">×</button>
              ) : (
                <span className="w-[0.6rem] text-center text-gray-300 dark:text-gray-600 cursor-help"
                  title={e.kind === 'expense' ? i18n.accounting.as_edit_in_expenses[lang] : i18n.accounting.as_edit_in_bookings[lang]}>·</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function AssociatesTab({ data, handlers, onOpenBooking }: Props) {
  const { lang } = useLanguage()
  const { seasons, associates } = data
  const currentSeason = seasons[seasons.length - 1]

  // All time by default: an account between two people is a running balance,
  // and a season view that hides last year's drawings would read as "level".
  const [period,  setPeriod]  = useState<Period>('all')
  const [showAdd, setShowAdd] = useState(false)

  const scoped = useMemo(
    () => period === 'season' && currentSeason ? filterDataToSeason(data, currentSeason, seasons) : data,
    [data, period, currentSeason, seasons])
  const summaries = useMemo(() => computeAssociateSummaries(scoped), [scoped])
  const gap = associateGap(summaries)

  const bookingLabel = (id: string) => {
    const b = data.bookings.find(x => x.id === id)
    if (!b) return '—'
    const c = data.clients.find(x => x.id === b.client_id)
    const name = c ? [c.first_name, c.last_name].filter(Boolean).join(' ') : ''
    return `#${String(b.booking_number).padStart(3, '0')}${name ? ` ${name}` : ''}`
  }

  if (associates.length === 0) {
    return (
      <p className="text-sm text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl px-4 py-3">
        {i18n.accounting.as_not_migrated[lang]}
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">{i18n.accounting.as_title[lang]}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-3xl">{i18n.accounting.as_intro[lang]}</p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-1">
          {([
            { id: 'all',    label: i18n.common.period_all_time[lang] },
            { id: 'season', label: i18n.accounting.palm_season_label[lang].replace('{label}', currentSeason?.label ?? '') },
          ] as { id: Period; label: string }[]).map(opt => (
            <button key={opt.id} onClick={() => setPeriod(opt.id)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                period === opt.id ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <button onClick={() => setShowAdd(v => !v)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            {i18n.accounting.as_add_transfer[lang]}
          </button>
        </div>
      </div>

      {showAdd && (
        <TransferForm associates={summaries.map(s => s.associate)}
          onAdd={t => { handlers.addAssociateTransfer(t); setShowAdd(false) }}
          onCancel={() => setShowAdd(false)} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {gap
            ? i18n.accounting.as_gap[lang]
                .replace('{ahead}', gap.ahead.name)
                .replace('{behind}', gap.behind.name)
                .replace('{amount}', fmtEurExact(gap.amount))
            : i18n.accounting.as_level[lang]}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {i18n.accounting.as_total_drawn[lang]} : <span className="font-semibold text-gray-800 dark:text-gray-200">{fmtEur(totalDrawn(summaries))}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {summaries.map(s => (
          <AccountCard key={s.associate.id} summary={s} bookingLabel={bookingLabel}
            onOpenBooking={onOpenBooking} onDeleteTransfer={handlers.deleteAssociateTransfer} />
        ))}
      </div>
    </div>
  )
}
