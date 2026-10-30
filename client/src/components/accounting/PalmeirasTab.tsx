import { useState, useMemo, useCallback } from 'react'
import type { SharedAccountingData, AccountingHandlers } from './types'
import type { PalmeirasRent, PalmeirasReversal, PalmeirasEntry, PalmeirasSettlement, SharedLink } from '../../types/database'
import { fmtEur, fmtMonth } from './utils'
import { buildBungalowRows, computePalmeirasTotals, monthlyCommission, statementInputFromData } from './palmeirasUtils'
import { thisMonthISO, todayISO, addDaysISO, fmtDate } from '../../utils/dates'
import { supabase } from '../../lib/supabase'
import { useTable } from '../../hooks/useSupabase'
import { buildStatement, rentPeriod, PALMEIRAS_COMMISSION_PCT } from '../../utils/palmeirasStatement'
import PalmeirasStatementView from '../palmeiras/PalmeirasStatementView'
import MonthInput from '../common/MonthInput'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'

interface Props { data: SharedAccountingData; handlers: AccountingHandlers }

type PeriodMode = 'all' | 'season' | 'custom' | 'single'

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ── Forms (module-scope) ──────────────────────────────────────────────────────

// The rent is set in meticals (10 000 MZN, gui 2026-10-30). The € amount is
// what every total counts; it is proposed from the MZN at the current rate and
// can be corrected to what was really paid.
const DEFAULT_RENT_MZN = 10000

function RentForm({ existing, eurMznRate, onSave, onCancel }: { existing?: PalmeirasRent; eurMznRate: number; onSave: (r: PalmeirasRent) => void; onCancel: () => void }) {
  const { lang } = useLanguage()
  const rate = eurMznRate > 0 ? eurMznRate : 1
  const toEur = (mzn: string) => { const n = parseFloat(mzn); return n ? String(Math.round(n / rate * 100) / 100) : '' }
  const initialMzn = existing ? (existing.amount_mzn != null ? String(existing.amount_mzn) : '') : String(DEFAULT_RENT_MZN)
  const [month,  setMonth]  = useState(existing?.month  ?? thisMonthISO())
  const [mzn,    setMzn]    = useState(initialMzn)
  const [amount, setAmount] = useState(existing ? String(existing.amount) : toEur(initialMzn))
  const [notes,  setNotes]  = useState(existing?.notes  ?? '')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!parsed) return
    onSave({ id: existing?.id ?? crypto.randomUUID(), month, amount: parsed, notes: notes || null, amount_mzn: parseFloat(mzn) || null })
  }
  return (
    <form onSubmit={submit} className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg p-3 sm:p-4 space-y-3">
      <p className="text-sm font-semibold text-red-800 dark:text-red-400">{existing ? i18n.accounting.palm_edit_rent[lang] : i18n.accounting.palm_add_rent[lang]}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{i18n.accounting.label_month[lang]}</label>
          <MonthInput value={month} onChange={setMonth} className="w-full" focusRing="focus:ring-red-300" />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{i18n.accounting.palm_rent_mzn[lang]}</label>
          <input type="number" min="0" step="1" value={mzn} onChange={e => { setMzn(e.target.value); setAmount(toEur(e.target.value)) }}
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{i18n.accounting.bf_amount_eur[lang]}</label>
          <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{i18n.accounting.palm_rent_rate_hint[lang].replace('{rate}', String(rate))}</p>
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{i18n.common.label_notes[lang]}</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional"
          className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">{i18n.common.btn_cancel[lang]}</button>
        <button type="submit" className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded text-sm font-semibold hover:bg-red-700">{i18n.common.btn_save[lang]}</button>
      </div>
    </form>
  )
}

function ReversalForm({ existing, directGross, onSave, onCancel }: {
  existing?: PalmeirasReversal
  /** What guests paid the Palmeiras directly, per month — the gross to start from. */
  directGross: Record<string, number>
  onSave: (r: PalmeirasReversal) => void; onCancel: () => void
}) {
  const { lang } = useLanguage()
  const startMonth = existing?.month ?? thisMonthISO()
  const [month,   setMonthRaw] = useState(startMonth)
  const [gross,   setGross]   = useState(String(existing?.gross_amount ?? directGross[startMonth] ?? ''))
  const [percent, setPercent] = useState(String(existing?.percent      ?? PALMEIRAS_COMMISSION_PCT))
  const setMonth = (m: string) => { setMonthRaw(m); if (!existing) setGross(String(directGross[m] ?? '')) }
  const [notes,   setNotes]   = useState(existing?.notes   ?? '')
  const grossNum  = parseFloat(gross)   || 0
  const pctNum    = parseFloat(percent) || 0
  const netAmount = Math.round(grossNum * pctNum / 100 * 100) / 100
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!grossNum || !pctNum) return
    onSave({ id: existing?.id ?? crypto.randomUUID(), month, gross_amount: grossNum, percent: pctNum, net_amount: netAmount, notes: notes || null })
  }
  return (
    <form onSubmit={submit} className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3 sm:p-4 space-y-3">
      <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">{existing ? i18n.accounting.palm_edit_reversal[lang] : i18n.accounting.palm_add_reversal[lang]}</p>
      <p className="text-xs text-emerald-900/70 dark:text-emerald-300/80">{i18n.accounting.palm_reversal_hint[lang].replace('{pct}', String(PALMEIRAS_COMMISSION_PCT))}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{i18n.accounting.label_month[lang]}</label>
          <MonthInput value={month} onChange={setMonth} className="w-full" focusRing="focus:ring-emerald-400" />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{i18n.accounting.palm_gross_eur[lang]}</label>
          <input type="number" min="0" step="0.01" value={gross} onChange={e => setGross(e.target.value)} placeholder="Total they collected"
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{i18n.accounting.palm_percent_owed[lang]}</label>
          <input type="number" min="0" max="100" step="0.1" value={percent} onChange={e => setPercent(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
      </div>
      {grossNum > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-lg px-4 py-2 flex justify-between items-center border border-emerald-200 dark:border-emerald-900">
          <span className="text-sm text-gray-600 dark:text-gray-400">{i18n.accounting.palm_we_receive[lang]}</span>
          <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{fmtEur(netAmount)}</span>
          <span className="text-xs text-gray-400 dark:text-gray-400">({pctNum}% of {fmtEur(grossNum)})</span>
        </div>
      )}
      <div>
        <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{i18n.common.label_notes[lang]}</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional"
          className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">{i18n.common.btn_cancel[lang]}</button>
        <button type="submit" className="flex-1 px-3 py-1.5 bg-emerald-600 text-white rounded text-sm font-semibold hover:bg-emerald-700">{i18n.common.btn_save[lang]}</button>
      </div>
    </form>
  )
}

// The free lines: anything between us that is neither a stay, the rent nor a
// payment. The description is shown as is on the Palmeiras page.
function EntryForm({ month: initialMonth, type, onSave, onCancel }: {
  month: string; type: 'expense' | 'income'
  onSave: (e: PalmeirasEntry) => void; onCancel: () => void
}) {
  const { lang } = useLanguage()
  // A free line happens on a given day (gui, 2026-10-30): today, or the 1st
  // of the month being browsed; `month` is derived from it.
  const [date,        setDate]        = useState(initialMonth === todayISO().slice(0, 7) ? todayISO() : `${initialMonth}-01`)
  const [description, setDescription] = useState('')
  const [amount,      setAmount]      = useState('')
  const submit = (ev: React.FormEvent) => {
    ev.preventDefault()
    const amt = parseFloat(amount)
    if (!description.trim() || isNaN(amt) || amt <= 0) return
    if (!date) return
    onSave({ id: crypto.randomUUID(), month: date.slice(0, 7), date, type, description: description.trim(), amount: amt })
  }
  const expense = type === 'expense'
  const input = 'px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400'
  return (
    <form onSubmit={submit} className={`rounded-lg p-3 space-y-2 border ${expense
      ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900'
      : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900'}`}>
      <p className={`text-xs font-semibold ${expense ? 'text-orange-800 dark:text-orange-300' : 'text-emerald-800 dark:text-emerald-300'}`}>
        {expense ? i18n.accounting.palm_new_expense[lang] : i18n.accounting.palm_new_income[lang]}
        <span className="font-normal text-gray-500 dark:text-gray-400"> · {expense ? 'owed to the Palmeiras' : 'owed to BKC'} · shown on the Palmeiras page</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} required className={input} />
        <input type="text" value={description} onChange={e => setDescription(e.target.value)}
          placeholder="Description…" autoFocus className={`flex-1 min-w-[12rem] ${input}`} />
        <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
          placeholder="€" className={`w-28 ${input}`} />
        <button type="submit" className={`px-3 py-1.5 text-white rounded text-sm font-semibold ${expense ? 'bg-orange-600 hover:bg-orange-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{i18n.common.btn_add[lang]}</button>
        <button type="button" onClick={onCancel} className="text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none px-1">×</button>
      </div>
    </form>
  )
}

/** A dated payment between us. Pre-filled to settle the current balance in
 *  the right direction, since that is what a monthly point usually ends with. */
function SettlementForm({ balance, rentMonth, rentAmount, onSave, onCancel }: {
  balance: number
  /** Paying one rent period (« Mark paid » on the timeline): amount and
   *  direction preset, and the payment is linked to the period. */
  rentMonth?: string; rentAmount?: number
  onSave: (s: PalmeirasSettlement) => void; onCancel: () => void
}) {
  const { lang } = useLanguage()
  const [date,      setDate]      = useState(todayISO())
  const [direction, setDirection] = useState<PalmeirasSettlement['direction']>(rentMonth ? 'us_to_palmeiras' : balance >= 0 ? 'palmeiras_to_us' : 'us_to_palmeiras')
  const [amount,    setAmount]    = useState(rentMonth ? String(rentAmount ?? '') : balance ? String(Math.abs(balance)) : '')
  const [method,    setMethod]    = useState('')
  const [notes,     setNotes]     = useState('')
  const period = rentMonth ? rentPeriod(rentMonth) : null
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return
    onSave({ id: crypto.randomUUID(), date, direction, amount: Math.round(amt * 100) / 100, method: method.trim() || null, notes: notes.trim() || null,
      ...(rentMonth ? { rent_month: rentMonth } : {}) })
  }
  const input = 'w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-400'
  return (
    <form onSubmit={submit} className="m-3 sm:m-4 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900 rounded-lg p-3 sm:p-4 space-y-3">
      <p className="text-sm font-semibold text-teal-800 dark:text-teal-300">
        {period ? `🏠 House rent ${fmtDate(period.start)} → ${fmtDate(period.end)} — payment` : i18n.accounting.palm_settlement_title[lang]}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={input} required />
        <select value={direction} onChange={e => setDirection(e.target.value as PalmeirasSettlement['direction'])} className={input}>
          <option value="palmeiras_to_us">{i18n.accounting.palm_settle_them[lang]}</option>
          <option value="us_to_palmeiras">{i18n.accounting.palm_settle_us[lang]}</option>
        </select>
        <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="€" className={input} required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input type="text" value={method} onChange={e => setMethod(e.target.value)} placeholder={i18n.accounting.palm_settle_method[lang]} className={input} />
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder={`${i18n.common.label_notes[lang]} (internal)`} className={input} />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">{i18n.common.btn_cancel[lang]}</button>
        <button type="submit" className="flex-1 px-3 py-1.5 bg-teal-600 text-white rounded text-sm font-semibold hover:bg-teal-700">{i18n.common.btn_save[lang]}</button>
      </div>
    </form>
  )
}

function reportDb(action: string, error: { message: string } | null): boolean {
  if (!error) return true
  console.error(`${action} failed:`, error.message)
  alert(`Could not ${action}.\n\n${error.message}`)
  return false
}

// ── Bungalow margin row (computed from bookings) ─────────────────────────────
// ── Main component ────────────────────────────────────────────────────────────
export default function PalmeirasTab({ data, handlers }: Props) {
  const { lang } = useLanguage()
  const { palmeirasRents, palmeirasReversals, palmeirasEntries, seasons } = data
  const currentSeason = seasons[seasons.length - 1]

  // ── Statement (what the Palmeiras sees) vs internal result ────────────────
  const [view, setView] = useState<'statement' | 'internal'>('statement')
  const { data: settlements, refresh: refreshSettlements } =
    useTable<PalmeirasSettlement>('palmeiras_settlements', { order: 'date', ascending: false })
  const { data: sharedLinks, refresh: refreshLinks } = useTable<SharedLink>('shared_links')
  const [addingSettlement, setAddingSettlement] = useState(false)
  // Set by « Mark paid » on a rent bar: the payment form opens on that period.
  const [payingRent, setPayingRent] = useState<{ month: string; amount: number } | null>(null)
  const [copied, setCopied] = useState(false)

  const statementInput = useMemo(() => statementInputFromData(data, settlements), [data, settlements])
  const statement = useMemo(() => buildStatement(statementInput), [statementInput])
  const shareLink = sharedLinks.find(l => l.type === 'palmeiras' && l.is_active
    && (!l.expires_at || l.expires_at >= todayISO()))
  const shareUrl = shareLink ? `${window.location.protocol}//${window.location.host}?share=${shareLink.token}` : null

  async function createLink() {
    const { error } = await supabase.from('shared_links').insert([{
      token: `palmeiras_${crypto.randomUUID()}`, type: 'palmeiras', label: 'Palmeiras account',
      params: {}, created_at: todayISO(), expires_at: addDaysISO(todayISO(), 365), is_active: true,
    }])
    if (reportDb('create the share link', error)) refreshLinks()
  }
  function copyLink() {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }
  async function addSettlement(s: PalmeirasSettlement) {
    const { error } = await supabase.from('palmeiras_settlements').insert([s])
    if (reportDb('record the payment', error)) { setAddingSettlement(false); setPayingRent(null); refreshSettlements() }
  }
  async function deleteSettlement(id: string) {
    if (!confirm(i18n.accounting.confirm_delete_line[lang])) return
    const { error } = await supabase.from('palmeiras_settlements').delete().eq('id', id)
    if (reportDb('delete the payment', error)) refreshSettlements()
  }

  const [period,    setPeriod]    = useState<PeriodMode>('season')
  const [customFrom,setFrom]      = useState(currentSeason?.start_date.slice(0, 7) ?? '')
  const [customTo,  setTo]        = useState(currentSeason?.end_date.slice(0, 7)   ?? '')
  const [singleMonth, setSingle]  = useState(thisMonthISO())

  const [addingEntry, setAddingEntry] = useState<'expense' | 'income' | null>(null)

  const [showAddRent,      setShowAddRent]      = useState(false)
  const [showAddReversal,  setShowAddReversal]  = useState(false)
  const [editingRent,      setEditingRent]      = useState<PalmeirasRent | null>(null)
  const [editingReversal,  setEditingReversal]  = useState<PalmeirasReversal | null>(null)

  const closeAll = () => {
    setShowAddRent(false); setShowAddReversal(false)
    setEditingRent(null);  setEditingReversal(null)
    setAddingSettlement(false); setPayingRent(null)
  }

  // ── Auto-computed bungalow margin from bookings ──────────────────────────
  const bungalowRows = useMemo(() => buildBungalowRows(data), [data])

  // ── Period filter ─────────────────────────────────────────────────────────
  const inRange = useCallback((month: string) => {
    if (period === 'single')  return month === singleMonth
    if (period === 'season' && currentSeason) {
      const from = currentSeason.start_date.slice(0, 7)
      const to   = currentSeason.end_date.slice(0, 7)
      return month >= from && month <= to
    }
    if (period === 'custom' && customFrom && customTo) return month >= customFrom && month <= customTo
    return true
  }, [period, currentSeason, customFrom, customTo, singleMonth])

  const filteredRents      = useMemo(() => palmeirasRents.filter(r => inRange(r.month)),      [palmeirasRents, inRange])
  const filteredReversals  = useMemo(() => palmeirasReversals.filter(r => inRange(r.month)),  [palmeirasReversals, inRange])
  const filteredEntries    = useMemo(() => palmeirasEntries.filter(e => inRange(e.month)),    [palmeirasEntries, inRange])
  const filteredBungalows  = useMemo(() => bungalowRows.filter(b => inRange(b.month)),       [bungalowRows, inRange])

  // ── Totals ────────────────────────────────────────────────────────────────
  // Pure and unit-tested. Note that this `net` includes the bungalow margin,
  // unlike the dashboard's Palmeiras KPI — see computePalmeirasTotals for why
  // both are right and must not be aligned.
  const totals = computePalmeirasTotals(filteredRents, filteredReversals, filteredEntries, filteredBungalows)
  const { rent: totalRent, reversals: totalReversals, grossReversals: totalGross, bungalowMargin: totalBungMargin,
          freeIncome: totalFreeInc, freeExpenses: totalFreeExp, net } = totals
  // Our commission per month: 15 % per stay, or the actual figure when entered.
  const commission  = useMemo(() => monthlyCommission(filteredBungalows, filteredReversals), [filteredBungalows, filteredReversals])
  const directGross = useMemo(() => Object.fromEntries(
    Object.entries(monthlyCommission(bungalowRows, [])).map(([m, c]) => [m, Math.round(c.gross * 100) / 100]),
  ), [bungalowRows])

  // ── Month list for table ──────────────────────────────────────────────────
  const allMonths = useMemo(() => [...new Set([
    ...filteredRents.map(r => r.month),
    ...filteredReversals.map(r => r.month),
    ...filteredEntries.map(e => e.month),
    ...filteredBungalows.map(b => b.month),
    ...(period === 'single' ? [singleMonth] : []),
  ])].sort().reverse(), [filteredRents, filteredReversals, filteredEntries, filteredBungalows, period, singleMonth])

  // ── Print / export ────────────────────────────────────────────────────────
  const handlePrint = () => {
    const bungRows = filteredBungalows.map(b => `
      <tr>
        <td>${b.month}</td>
        <td>${b.bungalow}</td>
        <td>${b.checkIn} → ${b.checkOut}</td>
        <td class="right">${b.nights}</td>
        <td class="right">${fmtEur(b.costRate)}</td>
        <td class="right">${fmtEur(b.sellRate)}</td>
        <td class="right pos">+ ${fmtEur(b.margin)}</td>
        <td>${b.bookingRef}</td>
      </tr>`).join('')

    const mainRows = allMonths.map(month => {
      const rent     = filteredRents.find(r => r.month === month)
      const comm     = commission[month]
      const bungM    = filteredBungalows.filter(b => b.month === month)
      const bungMargin = bungM.reduce((s, b) => s + b.margin, 0)
      const mEntries = filteredEntries.filter(e => e.month === month)
      const mInc     = mEntries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0)
      const mExp     = mEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0)
      const monthNet = (comm?.net ?? 0) + bungMargin + mInc - (rent?.amount ?? 0) - mExp
      return `<tr>
        <td>${fmtMonth(month)}</td>
        <td class="right neg">${rent ? `− ${fmtEur(rent.amount)}` : '–'}</td>
        <td class="right">${comm ? fmtEur(comm.gross) : '–'}</td>
        <td class="right">${comm ? `${comm.percent}%` : ''}</td>
        <td class="right pos">${comm ? `+ ${fmtEur(comm.net)}` : '–'}</td>
        <td class="right ${bungMargin > 0 ? 'pos' : ''}">${bungMargin ? `+ ${fmtEur(bungMargin)}` : '–'}</td>
        <td class="right ${mInc > 0 ? 'pos' : ''}">${mInc ? `+ ${fmtEur(mInc)}` : '–'}</td>
        <td class="right ${mExp > 0 ? 'neg' : ''}">${mExp ? `− ${fmtEur(mExp)}` : '–'}</td>
        <td class="right ${monthNet >= 0 ? 'pos' : 'neg'}">${monthNet >= 0 ? '+' : ''}${fmtEur(monthNet)}</td>
      </tr>`
    }).join('')

    const periodLabel = period === 'season' ? `Season ${currentSeason?.label ?? ''}` : period === 'custom' ? `${customFrom} → ${customTo}` : 'All time'

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Palmeiras — Report</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 13px; padding: 24px; color: #1f2937; }
      h1 { font-size: 20px; margin-bottom: 4px; } h2 { font-size: 15px; margin: 24px 0 8px; }
      p.sub { color: #6b7280; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
      th { background: #f3f4f6; padding: 7px 10px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; }
      td { padding: 7px 10px; border-bottom: 1px solid #f3f4f6; }
      tfoot td { background: #f9fafb; font-weight: bold; border-top: 2px solid #e5e7eb; }
      .pos { color: #059669; } .neg { color: #dc2626; } .right { text-align: right; }
    </style></head><body>
    <h1>Palmeiras — Financial Report</h1>
    <p class="sub">${periodLabel} · Generated ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>

    <h2>Monthly summary</h2>
    <table>
      <thead><tr>
        <th>Month</th><th class="right">Rent paid</th>
        <th class="right">Gross (Palm.)</th><th class="right">%</th>
        <th class="right">Reversal</th><th class="right">Bungalow margin</th>
        <th class="right">Free income</th><th class="right">Free expense</th><th class="right">Net</th>
      </tr></thead>
      <tbody>${mainRows}</tbody>
      <tfoot><tr>
        <td>Total</td>
        <td class="right neg">− ${fmtEur(totalRent)}</td>
        <td class="right">${fmtEur(totalGross)}</td>
        <td></td>
        <td class="right pos">+ ${fmtEur(totalReversals)}</td>
        <td class="right pos">+ ${fmtEur(totalBungMargin)}</td>
        <td class="right pos">+ ${fmtEur(totalFreeInc)}</td>
        <td class="right neg">− ${fmtEur(totalFreeExp)}</td>
        <td class="right ${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '+' : ''}${fmtEur(net)}</td>
      </tr></tfoot>
    </table>

    ${filteredBungalows.length > 0 ? `
    <h2>Bungalow bookings detail</h2>
    <table>
      <thead><tr>
        <th>Month</th><th>Bungalow</th><th>Period</th><th class="right">Nights</th>
        <th class="right">Cost/n</th><th class="right">Sell/n</th><th class="right">Margin</th><th>Client</th>
      </tr></thead>
      <tbody>${bungRows}</tbody>
    </table>` : ''}

    </body></html>`

    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }

  const anyForm = showAddRent || showAddReversal || editingRent || editingReversal

  const toolbarBtn = 'text-xs px-3 py-1.5 rounded-lg font-medium'

  return (
    <div className="space-y-6">

      {/* View: the statement both sides read, or our internal result */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-1">
          {(['statement', 'internal'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${view === v
                ? 'bg-teal-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              {v === 'statement' ? i18n.accounting.palm_view_statement[lang] : i18n.accounting.palm_view_internal[lang]}
            </button>
          ))}
        </div>
        {shareUrl ? (
          <button onClick={copyLink}
            className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
            {copied ? i18n.accounting.palm_link_copied[lang] : i18n.accounting.palm_copy_link[lang]}
          </button>
        ) : (
          <button onClick={createLink}
            className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
            {i18n.accounting.palm_create_link[lang]}
          </button>
        )}
      </div>

      {/* Entries — the same in both views */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => { closeAll(); setShowAddRent(true) }}
          className={`${toolbarBtn} bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800`}>{i18n.accounting.palm_add_rent_btn[lang]}</button>
        <button onClick={() => { closeAll(); setAddingSettlement(true) }}
          className={`${toolbarBtn} bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 hover:bg-teal-200 dark:hover:bg-teal-800`}>{i18n.accounting.palm_add_settlement_btn[lang]}</button>
        <button onClick={() => { closeAll(); setAddingEntry('income') }}
          className={`${toolbarBtn} bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-800`}>{i18n.accounting.palm_add_income_btn[lang]}</button>
        <button onClick={() => { closeAll(); setAddingEntry('expense') }}
          className={`${toolbarBtn} bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-800`}>{i18n.accounting.palm_add_expense_btn[lang]}</button>
        <button onClick={() => { closeAll(); setShowAddReversal(true) }}
          className={`${toolbarBtn} bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700`}>{i18n.accounting.palm_add_reversal_btn[lang]}</button>
      </div>

      {(anyForm || addingEntry) && (
        <div className="space-y-3">
          {showAddRent      && <RentForm     eurMznRate={data.eurMznRate} onSave={r => { handlers.addPalmeirasRent(r);      closeAll() }} onCancel={closeAll} />}
          {showAddReversal  && <ReversalForm directGross={directGross} onSave={r => { handlers.addPalmeirasReversal(r);  closeAll() }} onCancel={closeAll} />}
          {editingRent      && <RentForm     eurMznRate={data.eurMznRate} existing={editingRent}     onSave={r => { handlers.updatePalmeirasRent(r);      closeAll() }} onCancel={closeAll} />}
          {editingReversal  && <ReversalForm directGross={directGross} existing={editingReversal} onSave={r => { handlers.updatePalmeirasReversal(r);  closeAll() }} onCancel={closeAll} />}
          {addingEntry && (
            <EntryForm
              month={view === 'internal' && period === 'single' ? singleMonth : thisMonthISO()}
              type={addingEntry}
              onSave={e => { handlers.addPalmeirasEntry(e); setAddingEntry(null) }}
              onCancel={() => setAddingEntry(null)}
            />
          )}
        </div>
      )}

      {view === 'statement' && (
        <PalmeirasStatementView
          statement={statement}
          input={statementInput}
          eurMznRate={data.eurMznRate}
          defaultRentMzn={DEFAULT_RENT_MZN}
          // One click from the timeline: the usual 10 000 MZN at today's rate.
          // A different amount is still corrected through ✏ in Internal result.
          onAddRent={month => handlers.addPalmeirasRent({
            id: crypto.randomUUID(), month, notes: null, amount_mzn: DEFAULT_RENT_MZN,
            amount: Math.round(DEFAULT_RENT_MZN / (data.eurMznRate > 0 ? data.eurMznRate : 1) * 100) / 100,
          })}
          onPayRent={(month, amount) => { closeAll(); setPayingRent({ month, amount }); setAddingSettlement(true) }}
          settlementControls={addingSettlement && (
            // keyed so « Mark paid » on another period starts a fresh form
            <SettlementForm key={payingRent?.month ?? 'free'} balance={statement.balance}
              rentMonth={payingRent?.month} rentAmount={payingRent?.amount}
              onSave={addSettlement} onCancel={() => { setAddingSettlement(false); setPayingRent(null) }} />
          )}
          settlementAction={id => (
            <button onClick={() => deleteSettlement(id)} aria-label="Delete"
              className="p-1 text-gray-400 hover:text-red-500 text-lg leading-none">×</button>
          )}
        />
      )}

      {view === 'internal' && (<>
      <p className="text-xs text-gray-500 dark:text-gray-400">{i18n.accounting.palm_internal_hint[lang]}</p>

      {/* Period selector */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-1">
          {([
            { id: 'all',    label: i18n.common.period_all_time[lang] },
            { id: 'season', label: i18n.accounting.palm_season_label[lang].replace('{label}', currentSeason?.label ?? '') },
            { id: 'custom', label: i18n.accounting.palm_custom[lang] },
            { id: 'single', label: i18n.accounting.palm_month_nav[lang] },
          ] as { id: PeriodMode; label: string }[]).map(opt => (
            <button key={opt.id} onClick={() => setPeriod(opt.id)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                period === opt.id ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex items-center gap-2 text-sm">
            <MonthInput value={customFrom} onChange={setFrom} allowEmpty />
            <span className="text-gray-400 dark:text-gray-400">→</span>
            <MonthInput value={customTo} onChange={setTo} allowEmpty />
          </div>
        )}
        {period === 'single' && (
          <div className="flex items-center gap-1">
            <button onClick={() => setSingle(m => shiftMonth(m, -1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 text-lg">‹</button>
            <span className="px-4 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-[120px] text-center">
              {fmtMonth(singleMonth)}
            </span>
            <button onClick={() => setSingle(m => shiftMonth(m, +1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 text-lg">›</button>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-400 dark:text-red-300 mb-1">{i18n.accounting.palm_rent[lang]}</p>
          <p className="text-lg font-bold text-red-700 dark:text-red-400">− {fmtEur(totalRent)}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400 dark:text-emerald-300 mb-1">{i18n.accounting.palm_reversals[lang]}</p>
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">+ {fmtEur(totalReversals)}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-400 dark:text-blue-300 mb-1">{i18n.accounting.label_bungalows[lang]}</p>
          <p className="text-lg font-bold text-blue-700 dark:text-blue-400">+ {fmtEur(totalBungMargin)}</p>
          <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">{i18n.accounting.palm_booking_count[lang].replace('{count}', String(filteredBungalows.length))}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400 dark:text-emerald-300 mb-1">{i18n.accounting.palm_free_income[lang]}</p>
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">+ {fmtEur(totalFreeInc)}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-400 dark:text-red-300 mb-1">{i18n.accounting.palm_free_expenses[lang]}</p>
          <p className="text-lg font-bold text-red-700 dark:text-red-400">− {fmtEur(totalFreeExp)}</p>
        </div>
        <div className={`border rounded-xl p-4 ${net >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900' : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${net >= 0 ? 'text-emerald-400 dark:text-emerald-300' : 'text-red-400 dark:text-red-300'}`}>{i18n.accounting.label_net[lang]}</p>
          <p className={`text-lg font-bold ${net >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>{net >= 0 ? '+' : ''}{fmtEur(net)}</p>
        </div>
      </div>

      {/* Why this Net is not the dashboard's Palmeiras figure */}
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
        <span className="font-semibold text-gray-700 dark:text-gray-300">Reading this Net.</span>{' '}
        It answers <em>what does the Palmeiras partnership bring in?</em> — reversals
        + bungalow margin + free income, minus rent and free expenses.
        It is <span className="font-semibold">not</span> the smaller “Palmeiras” figure on the
        accounting dashboard, and it should not be: there, what a bungalow is sold for is already
        counted in accommodation revenue and what it costs is subtracted on its own line, so adding
        the margin again would count it twice. Each figure is right for its own scope.
      </div>

      {/* Monthly table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto">
        <div className="flex flex-wrap justify-between items-center px-3 sm:px-5 py-3 sm:py-4 border-b gap-2">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200">{i18n.accounting.palm_monthly_breakdown[lang]}</h2>
          <button onClick={handlePrint}
            className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 font-medium">{i18n.accounting.palm_export_btn[lang]}</button>
        </div>

        {/* Mobile: one card per month */}
        <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
          {allMonths.length === 0 && (
            <p className="px-4 py-8 text-center text-gray-400 dark:text-gray-400 text-sm">{i18n.accounting.palm_no_data_period[lang]}</p>
          )}
          {allMonths.map(month => {
            const rent       = filteredRents.find(r => r.month === month)
            const comm       = commission[month]
            const reversal   = filteredReversals.find(r => r.month === month)
            const bungMargin = filteredBungalows.filter(b => b.month === month).reduce((s, b) => s + b.margin, 0)
            const mEntries   = filteredEntries.filter(e => e.month === month)
            const mInc       = mEntries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0)
            const mExp       = mEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0)
            const monthNet   = (comm?.net ?? 0) + bungMargin + mInc - (rent?.amount ?? 0) - mExp
            const hasAny     = !!(rent || comm || bungMargin || mInc || mExp)
            const line = (label: string, value: React.ReactNode) => (
              <div className="flex justify-between gap-3 text-sm py-0.5">
                <span className="text-gray-500 dark:text-gray-400">{label}</span>
                <span>{value}</span>
              </div>
            )
            return (
              <div key={month} className="px-3 py-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{fmtMonth(month)}</span>
                  <div className="flex items-center gap-1">
                    {rent     && <button onClick={() => { closeAll(); setEditingRent(rent) }}     title={i18n.accounting.palm_edit_rent[lang]}     className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-red-500 text-sm">✏ {i18n.accounting.palm_rent[lang]}</button>}
                    {reversal && <button onClick={() => { closeAll(); setEditingReversal(reversal) }} title={i18n.accounting.palm_edit_reversal[lang]} className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-emerald-600 text-sm">✏ {i18n.accounting.palm_reversal_col[lang]}</button>}
                    <span className={`font-bold ${monthNet > 0 ? 'text-emerald-700 dark:text-emerald-400' : monthNet < 0 ? 'text-red-700 dark:text-red-400' : 'text-gray-400 dark:text-gray-400'}`}>
                      {hasAny ? `${monthNet >= 0 ? '+' : ''}${fmtEur(monthNet)}` : '–'}
                    </span>
                  </div>
                </div>
                {rent && line(i18n.accounting.palm_rent[lang], <span className="text-red-600 dark:text-red-400 font-medium">− {fmtEur(rent.amount)}</span>)}
                {comm && line(
                  `${i18n.accounting.palm_reversal_col[lang]} (${comm.percent}% of ${fmtEur(comm.gross)})`,
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">+ {fmtEur(comm.net)}</span>)}
                {bungMargin > 0 && line(i18n.accounting.label_bungalows[lang], <span className="text-blue-700 dark:text-blue-400 font-medium">+ {fmtEur(bungMargin)}</span>)}
                {mInc > 0 && line(i18n.accounting.palm_free_plus_col[lang], <span className="text-emerald-600 dark:text-emerald-400 font-medium">+ {fmtEur(mInc)}</span>)}
                {mExp > 0 && line(i18n.accounting.palm_free_minus_col[lang], <span className="text-orange-600 dark:text-orange-400 font-medium">− {fmtEur(mExp)}</span>)}
              </div>
            )
          })}
          {allMonths.length > 0 && (
            <div className="px-3 py-3 bg-gray-50 dark:bg-gray-800 flex justify-between items-center">
              <span className="font-semibold text-gray-700 dark:text-gray-300">{i18n.common.label_total[lang]}</span>
              <span className={`font-bold ${net >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>{net >= 0 ? '+' : ''}{fmtEur(net)}</span>
            </div>
          )}
        </div>

        <table className="hidden md:table w-full text-sm min-w-[700px]">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">{i18n.accounting.label_month[lang]}</th>
              <th className="px-4 py-3 text-right font-semibold text-red-500 dark:text-red-400">{i18n.accounting.palm_rent[lang]}</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-500 dark:text-gray-400">{i18n.accounting.palm_gross_palm_col[lang]}</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-400 dark:text-gray-400">%</th>
              <th className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{i18n.accounting.palm_reversal_col[lang]}</th>
              <th className="px-4 py-3 text-right font-semibold text-blue-600 dark:text-blue-400">{i18n.accounting.label_bungalows[lang]}</th>
              <th className="px-4 py-3 text-right font-semibold text-emerald-500 dark:text-emerald-400">{i18n.accounting.palm_free_plus_col[lang]}</th>
              <th className="px-4 py-3 text-right font-semibold text-orange-500 dark:text-orange-400">{i18n.accounting.palm_free_minus_col[lang]}</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">{i18n.accounting.label_net[lang]}</th>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {allMonths.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400 dark:text-gray-400 text-sm">{i18n.accounting.palm_no_data_period[lang]}</td></tr>
            )}
            {allMonths.map(month => {
              const rent      = filteredRents.find(r => r.month === month)
              const comm      = commission[month]
              const reversal  = filteredReversals.find(r => r.month === month)
              const bungM     = filteredBungalows.filter(b => b.month === month)
              const bungMargin = bungM.reduce((s, b) => s + b.margin, 0)
              const mEntries  = filteredEntries.filter(e => e.month === month)
              const mInc      = mEntries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0)
              const mExp      = mEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0)
              const monthNet  = (comm?.net ?? 0) + bungMargin + mInc - (rent?.amount ?? 0) - mExp
              return (
                <tr key={month} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{fmtMonth(month)}</td>
                  <td className="px-4 py-3 text-right">
                    {rent ? <span className="text-red-600 dark:text-red-400 font-medium">− {fmtEur(rent.amount)}</span> : <span className="text-gray-300 dark:text-gray-500">–</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{comm ? fmtEur(comm.gross) : <span className="text-gray-300 dark:text-gray-500">–</span>}</td>
                  <td className="px-4 py-3 text-right text-gray-400 dark:text-gray-400">{comm ? `${comm.percent}%` : ''}</td>
                  <td className="px-4 py-3 text-right">
                    {comm ? <span className="text-emerald-700 dark:text-emerald-400 font-medium">+ {fmtEur(comm.net)}</span> : <span className="text-gray-300 dark:text-gray-500">–</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {bungMargin > 0 ? <span className="text-blue-700 dark:text-blue-400 font-medium">+ {fmtEur(bungMargin)}</span> : <span className="text-gray-300 dark:text-gray-500">–</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {mInc > 0 ? <span className="text-emerald-600 dark:text-emerald-400 font-medium">+ {fmtEur(mInc)}</span> : <span className="text-gray-300 dark:text-gray-500">–</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {mExp > 0 ? <span className="text-orange-600 dark:text-orange-400 font-medium">− {fmtEur(mExp)}</span> : <span className="text-gray-300 dark:text-gray-500">–</span>}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold ${monthNet > 0 ? 'text-emerald-700 dark:text-emerald-400' : monthNet < 0 ? 'text-red-700 dark:text-red-400' : 'text-gray-400 dark:text-gray-400'}`}>
                    {(rent || comm || bungMargin || mInc || mExp) ? `${monthNet >= 0 ? '+' : ''}${fmtEur(monthNet)}` : '–'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      {rent     && <button onClick={() => { closeAll(); setEditingRent(rent) }}     title={i18n.accounting.palm_edit_rent[lang]}     className="text-gray-300 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors text-sm px-1">✏</button>}
                      {reversal && <button onClick={() => { closeAll(); setEditingReversal(reversal) }} title={i18n.accounting.palm_edit_reversal[lang]} className="text-gray-300 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-sm px-1">✏</button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="bg-gray-50 dark:bg-gray-800 border-t">
            <tr>
              <td className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">{i18n.common.label_total[lang]}</td>
              <td className="px-4 py-3 text-right font-semibold text-red-700 dark:text-red-400">− {fmtEur(totalRent)}</td>
              <td className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">{fmtEur(totalGross)}</td>
              <td />
              <td className="px-4 py-3 text-right font-semibold text-emerald-700 dark:text-emerald-400">+ {fmtEur(totalReversals)}</td>
              <td className="px-4 py-3 text-right font-semibold text-blue-700 dark:text-blue-400">+ {fmtEur(totalBungMargin)}</td>
              <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">+ {fmtEur(totalFreeInc)}</td>
              <td className="px-4 py-3 text-right font-semibold text-orange-600 dark:text-orange-400">− {fmtEur(totalFreeExp)}</td>
              <td className={`px-4 py-3 text-right font-bold ${net >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>{net >= 0 ? '+' : ''}{fmtEur(net)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Bungalow bookings detail (auto-computed) */}
      {filteredBungalows.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-3 sm:px-5 py-3 sm:py-4 border-b">
            <h2 className="font-semibold text-gray-800 dark:text-gray-200">{i18n.accounting.palm_bungalow_detail[lang]}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Auto-calculated from bookings assigned to bungalow accommodations</p>
            {/* What guests paid Palmeiras directly — the base of our commission,
                to copy into a Reversal when settling the month with them. */}
            {(() => {
              const direct = filteredBungalows.filter(b => b.paidToOwner)
              if (direct.length === 0) return null
              const total = direct.reduce((s, b) => s + b.sellRate * b.nights, 0)
              return (
                <p className="text-xs text-purple-700 dark:text-purple-400 mt-2 font-medium">
                  {i18n.accounting.palm_paid_direct_summary[lang]
                    .replace('{total}', fmtEur(total))
                    .replace('{count}', String(direct.length))}
                </p>
              )
            })()}
          </div>
          {/* Mobile: one card per stay */}
          <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
            {[...filteredBungalows].sort((a, b) => b.checkIn.localeCompare(a.checkIn)).map((b, i) => (
              <div key={i} className="px-3 py-3 text-sm">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-800 dark:text-gray-200">{b.bungalow}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{b.checkIn} → {b.checkOut} · {b.nights} {i18n.accounting.palm_nights_col[lang]}</div>
                    {b.bookingRef && <div className="text-xs text-gray-400 dark:text-gray-400">{b.bookingRef}</div>}
                  </div>
                  {b.paidToOwner ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 shrink-0">
                      {i18n.accounting.palm_paid_direct_badge[lang]}
                    </span>
                  ) : (
                    <span className={`font-semibold shrink-0 ${b.margin >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-red-700 dark:text-red-400'}`}>
                      {b.margin >= 0 ? '+' : ''}{fmtEur(b.margin)}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex gap-4 text-xs">
                  <span className="text-red-500 dark:text-red-400">{i18n.accounting.palm_cost_col[lang]} {b.paidToOwner ? '–' : fmtEur(b.costRate)}</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{i18n.accounting.palm_sell_col[lang]} {fmtEur(b.sellRate)}</span>
                </div>
              </div>
            ))}
          </div>

          <table className="hidden md:table w-full text-sm min-w-[700px]">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">{i18n.accounting.label_bungalows[lang]}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">{i18n.accounting.palm_period_col[lang]}</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-400 dark:text-gray-400">{i18n.accounting.palm_nights_col[lang]}</th>
                <th className="px-4 py-3 text-right font-semibold text-red-500 dark:text-red-400">{i18n.accounting.palm_cost_col[lang]}</th>
                <th className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{i18n.accounting.palm_sell_col[lang]}</th>
                <th className="px-4 py-3 text-right font-semibold text-blue-600 dark:text-blue-400">{i18n.accounting.palm_margin_col[lang]}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-400 dark:text-gray-400">{i18n.accounting.palm_client_col[lang]}</th>
              </tr>
            </thead>
            <tbody>
              {[...filteredBungalows].sort((a, b) => b.checkIn.localeCompare(a.checkIn)).map((b, i) => (
                <tr key={i} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{b.bungalow}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{b.checkIn} → {b.checkOut}</td>
                  <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{b.nights}</td>
                  <td className="px-4 py-3 text-right text-red-500 dark:text-red-400">{b.paidToOwner ? <span className="text-gray-300 dark:text-gray-500">–</span> : fmtEur(b.costRate)}</td>
                  <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">{fmtEur(b.sellRate)}</td>
                  {b.paidToOwner ? (
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 whitespace-nowrap">
                        {i18n.accounting.palm_paid_direct_badge[lang]}
                      </span>
                    </td>
                  ) : (
                    <td className={`px-4 py-3 text-right font-semibold ${b.margin >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-red-700 dark:text-red-400'}`}>
                      {b.margin >= 0 ? '+' : ''}{fmtEur(b.margin)}
                    </td>
                  )}
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{b.bookingRef}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Free entries detail */}
      {filteredEntries.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-3 sm:px-5 py-3 sm:py-4 border-b">
            <h2 className="font-semibold text-gray-800 dark:text-gray-200">{i18n.accounting.palm_free_entries_detail[lang]}</h2>
          </div>
          {/* Mobile: one line per entry */}
          <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
            {[...filteredEntries].sort((a, b) => b.month.localeCompare(a.month)).map(e => (
              <div key={e.id} className="flex items-start justify-between gap-3 px-3 py-3 text-sm">
                <div className="min-w-0">
                  <div className="text-gray-800 dark:text-gray-200">{e.description}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {fmtMonth(e.month)} · {e.type === 'income' ? i18n.accounting.palm_income_badge[lang] : i18n.accounting.palm_expense_badge[lang]}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`font-semibold ${e.type === 'income' ? 'text-emerald-700 dark:text-emerald-400' : 'text-orange-700 dark:text-orange-400'}`}>
                    {e.type === 'income' ? '+ ' : '− '}{fmtEur(e.amount)}
                  </span>
                  <button onClick={() => handlers.deletePalmeirasEntry(e.id)} aria-label="Delete"
                    className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-red-500 text-lg leading-none">×</button>
                </div>
              </div>
            ))}
          </div>

          <table className="hidden md:table w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">{i18n.accounting.label_month[lang]}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">{i18n.accounting.bf_type[lang]}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">{i18n.accounting.palm_description_col[lang]}</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">{i18n.common.label_amount[lang]}</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {[...filteredEntries].sort((a, b) => b.month.localeCompare(a.month)).map(e => (
                <tr key={e.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtMonth(e.month)}</td>
                  <td className="px-4 py-3">
                    {e.type === 'income'
                      ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">{i18n.accounting.palm_income_badge[lang]}</span>
                      : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">{i18n.accounting.palm_expense_badge[lang]}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{e.description}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${e.type === 'income' ? 'text-emerald-700 dark:text-emerald-400' : 'text-orange-700 dark:text-orange-400'}`}>
                    {e.type === 'income' ? '+ ' : '− '}{fmtEur(e.amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handlers.deletePalmeirasEntry(e.id)}
                      className="text-gray-300 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors text-lg leading-none">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-5 text-sm text-amber-800 dark:text-amber-400 space-y-1">
        <p className="font-semibold">{i18n.accounting.palm_about_header[lang]}</p>
        <p>All figures reflect the selected period and are included in the global dashboard totals.</p>
        <p><strong>Commission</strong> = {PALMEIRAS_COMMISSION_PCT}% of what guests paid the Palmeiras directly, per stay (or the actual figure entered for the month) · <strong>Rent</strong> = monthly lease · <strong>Bungalow margin</strong> = sell − cost, auto-calculated from bookings assigned to bungalow accommodations · <strong>Free entries</strong> = any misc income or expense.</p>
      </div>
      </>)}
    </div>
  )
}
