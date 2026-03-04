import { useState, useMemo } from 'react'
import type { SharedAccountingData, AccountingHandlers } from './types'
import type { PalmeirasRent, PalmeirasReversal, PalmeirasEntry, PalmeirasSubLet } from '../../types/database'
import { fmtEur, fmtMonth } from './utils'

interface Props { data: SharedAccountingData; handlers: AccountingHandlers }

type PeriodMode = 'all' | 'season' | 'custom' | 'single'

// Navigate a YYYY-MM string by ±n months
function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ── Forms (module-scope) ──────────────────────────────────────────────────────

function RentForm({ existing, onSave, onCancel }: { existing?: PalmeirasRent; onSave: (r: PalmeirasRent) => void; onCancel: () => void }) {
  const [month,  setMonth]  = useState(existing?.month  ?? new Date().toISOString().slice(0, 7))
  const [amount, setAmount] = useState(String(existing?.amount ?? 850))
  const [notes,  setNotes]  = useState(existing?.notes  ?? '')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!parsed) return
    onSave({ id: existing?.id ?? `pr_${Date.now()}`, month, amount: parsed, notes: notes || null })
  }
  return (
    <form onSubmit={submit} className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
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
        <button type="button" onClick={onCancel} className="flex-1 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
        <button type="submit" className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded text-sm font-semibold hover:bg-red-700">Save</button>
      </div>
    </form>
  )
}

function ReversalForm({ existing, onSave, onCancel }: { existing?: PalmeirasReversal; onSave: (r: PalmeirasReversal) => void; onCancel: () => void }) {
  const [month,   setMonth]   = useState(existing?.month   ?? new Date().toISOString().slice(0, 7))
  const [gross,   setGross]   = useState(String(existing?.gross_amount ?? ''))
  const [percent, setPercent] = useState(String(existing?.percent      ?? 15))
  const [notes,   setNotes]   = useState(existing?.notes   ?? '')
  const grossNum  = parseFloat(gross)   || 0
  const pctNum    = parseFloat(percent) || 0
  const netAmount = Math.round(grossNum * pctNum / 100 * 100) / 100
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!grossNum || !pctNum) return
    onSave({ id: existing?.id ?? `prev_${Date.now()}`, month, gross_amount: grossNum, percent: pctNum, net_amount: netAmount, notes: notes || null })
  }
  return (
    <form onSubmit={submit} className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-3">
      <p className="text-sm font-semibold text-emerald-800">{existing ? 'Edit reversal' : 'Add reversal'}</p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Month</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Palmeiras gross (€)</label>
          <input type="number" min="0" step="0.01" value={gross} onChange={e => setGross(e.target.value)} placeholder="Total they collected"
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">% owed to us</label>
          <input type="number" min="0" max="100" step="0.1" value={percent} onChange={e => setPercent(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
      </div>
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
        <button type="button" onClick={onCancel} className="flex-1 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
        <button type="submit" className="flex-1 px-3 py-1.5 bg-emerald-600 text-white rounded text-sm font-semibold hover:bg-emerald-700">Save</button>
      </div>
    </form>
  )
}

function SubLetForm({ existing, onSave, onCancel }: { existing?: PalmeirasSubLet; onSave: (s: PalmeirasSubLet) => void; onCancel: () => void }) {
  const [bungalow,    setBungalow]    = useState(existing?.bungalow    ?? '')
  const [checkIn,     setCheckIn]     = useState(existing?.check_in    ?? '')
  const [checkOut,    setCheckOut]    = useState(existing?.check_out   ?? '')
  const [costPer,     setCostPer]     = useState(String(existing?.cost_per_night ?? ''))
  const [sellPer,     setSellPer]     = useState(String(existing?.sell_per_night ?? ''))
  const [bookingRef,  setBookingRef]  = useState(existing?.booking_ref ?? '')
  const [notes,       setNotes]       = useState(existing?.notes       ?? '')

  const nights = checkIn && checkOut
    ? Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
    : 0
  const cost   = parseFloat(costPer) || 0
  const sell   = parseFloat(sellPer) || 0
  const margin = (sell - cost) * nights

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!bungalow.trim() || !checkIn || !checkOut || nights <= 0 || !cost || !sell) return
    onSave({
      id:             existing?.id ?? `psl_${Date.now()}`,
      month:          checkIn.slice(0, 7),
      bungalow:       bungalow.trim(),
      check_in:       checkIn,
      check_out:      checkOut,
      nights,
      cost_per_night: cost,
      sell_per_night: sell,
      booking_ref:    bookingRef.trim() || null,
      notes:          notes.trim() || null,
    })
  }

  return (
    <form onSubmit={submit} className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
      <p className="text-sm font-semibold text-blue-800">{existing ? 'Edit sub-let' : 'Add bungalow sub-let'}</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Bungalow</label>
          <input type="text" value={bungalow} onChange={e => setBungalow(e.target.value)} placeholder="e.g. Bungalow 1"
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Check-in</label>
          <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Check-out</label>
          <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Cost / night (€)</label>
          <input type="number" min="0" step="0.01" value={costPer} onChange={e => setCostPer(e.target.value)} placeholder="We pay"
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Sell / night (€)</label>
          <input type="number" min="0" step="0.01" value={sellPer} onChange={e => setSellPer(e.target.value)} placeholder="Client pays"
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Booking ref</label>
          <input type="text" value={bookingRef} onChange={e => setBookingRef(e.target.value)} placeholder="Optional"
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
      </div>
      {nights > 0 && cost > 0 && sell > 0 && (
        <div className="bg-white rounded-lg px-4 py-2 flex flex-wrap gap-4 items-center border border-blue-200 text-sm">
          <span className="text-gray-500">{nights} night{nights !== 1 ? 's' : ''}</span>
          <span className="text-gray-500">Cost total: <strong className="text-red-600">{fmtEur(cost * nights)}</strong></span>
          <span className="text-gray-500">Revenue: <strong className="text-emerald-600">{fmtEur(sell * nights)}</strong></span>
          <span className="font-bold" style={{ color: margin >= 0 ? '#059669' : '#dc2626' }}>
            Margin: {margin >= 0 ? '+' : ''}{fmtEur(margin)}
          </span>
        </div>
      )}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Notes</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional"
          className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
        <button type="submit" className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700">Save</button>
      </div>
    </form>
  )
}

// ── Free entry form (module-scope) ───────────────────────────────────────────
function EntryForm({ month, type, onSave, onCancel }: {
  month: string; type: 'expense' | 'income'
  onSave: (e: PalmeirasEntry) => void; onCancel: () => void
}) {
  const [description, setDescription] = useState('')
  const [amount,      setAmount]      = useState('')
  const submit = (ev: React.FormEvent) => {
    ev.preventDefault()
    const amt = parseFloat(amount)
    if (!description.trim() || isNaN(amt) || amt <= 0) return
    onSave({ id: `pe_${Date.now()}`, month, type, description: description.trim(), amount: amt })
  }
  const color = type === 'expense' ? 'red' : 'emerald'
  return (
    <form onSubmit={submit} className={`bg-${color}-50 border border-${color}-200 rounded-lg p-3 space-y-2`}>
      <p className={`text-xs font-semibold text-${color}-800`}>
        {type === 'expense' ? '− New expense' : '+ New income'}
      </p>
      <div className="flex gap-2">
        <input type="text" value={description} onChange={e => setDescription(e.target.value)}
          placeholder="Description…" autoFocus
          className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
          placeholder="€" className="w-28 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        <button type="submit" className={`px-3 py-1.5 bg-${color}-600 text-white rounded text-sm font-semibold hover:bg-${color}-700`}>Add</button>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1">×</button>
      </div>
    </form>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PalmeirasTab({ data, handlers }: Props) {
  const { palmeirasRents, palmeirasReversals, palmeirasEntries, palmeirasSubLets, seasons } = data
  const currentSeason = seasons[seasons.length - 1]

  const [period,    setPeriod]    = useState<PeriodMode>('season')
  const [customFrom,setFrom]      = useState(currentSeason?.start_date.slice(0, 7) ?? '')
  const [customTo,  setTo]        = useState(currentSeason?.end_date.slice(0, 7)   ?? '')
  const [singleMonth, setSingle]  = useState(new Date().toISOString().slice(0, 7))

  const [addingEntry, setAddingEntry] = useState<'expense' | 'income' | null>(null)

  const [showAddRent,      setShowAddRent]      = useState(false)
  const [showAddReversal,  setShowAddReversal]  = useState(false)
  const [showAddSubLet,    setShowAddSubLet]    = useState(false)
  const [editingRent,      setEditingRent]      = useState<PalmeirasRent | null>(null)
  const [editingReversal,  setEditingReversal]  = useState<PalmeirasReversal | null>(null)
  const [editingSubLet,    setEditingSubLet]    = useState<PalmeirasSubLet | null>(null)

  const closeAll = () => {
    setShowAddRent(false); setShowAddReversal(false); setShowAddSubLet(false)
    setEditingRent(null);  setEditingReversal(null);  setEditingSubLet(null)
  }

  // ── Period filter ─────────────────────────────────────────────────────────
  const inRange = (month: string) => {
    if (period === 'single')  return month === singleMonth
    if (period === 'season' && currentSeason) {
      const from = currentSeason.start_date.slice(0, 7)
      const to   = currentSeason.end_date.slice(0, 7)
      return month >= from && month <= to
    }
    if (period === 'custom' && customFrom && customTo) return month >= customFrom && month <= customTo
    return true
  }

  const deps = [period, currentSeason, customFrom, customTo, singleMonth]
  const filteredRents      = useMemo(() => palmeirasRents.filter(r => inRange(r.month)),      [palmeirasRents, ...deps])
  const filteredReversals  = useMemo(() => palmeirasReversals.filter(r => inRange(r.month)),  [palmeirasReversals, ...deps])
  const filteredEntries    = useMemo(() => palmeirasEntries.filter(e => inRange(e.month)),    [palmeirasEntries, ...deps])
  const filteredSubLets    = useMemo(() => palmeirasSubLets.filter(s => inRange(s.month)),    [palmeirasSubLets, ...deps])

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalRent      = filteredRents.reduce((s, r) => s + r.amount, 0)
  const totalReversals = filteredReversals.reduce((s, r) => s + r.net_amount, 0)
  const totalSubMargin = filteredSubLets.reduce((s, sl) => s + (sl.sell_per_night - sl.cost_per_night) * sl.nights, 0)
  const totalFreeInc   = filteredEntries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0)
  const totalFreeExp   = filteredEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0)
  const net            = totalReversals + totalSubMargin + totalFreeInc - totalRent - totalFreeExp

  // ── Month list for table ──────────────────────────────────────────────────
  const allMonths = useMemo(() => [...new Set([
    ...filteredRents.map(r => r.month),
    ...filteredReversals.map(r => r.month),
    ...filteredEntries.map(e => e.month),
    ...filteredSubLets.map(s => s.month),
    ...(period === 'single' ? [singleMonth] : []),
  ])].sort().reverse(), [filteredRents, filteredReversals, filteredEntries, filteredSubLets, period, singleMonth])

  // ── Print / export ────────────────────────────────────────────────────────
  const handlePrint = () => {
    const subLetRows = filteredSubLets.map(sl => `
      <tr>
        <td>${sl.month}</td>
        <td>${sl.bungalow}</td>
        <td>${sl.check_in} → ${sl.check_out}</td>
        <td class="right">${sl.nights}</td>
        <td class="right">${fmtEur(sl.cost_per_night)}</td>
        <td class="right">${fmtEur(sl.sell_per_night)}</td>
        <td class="right pos">+ ${fmtEur((sl.sell_per_night - sl.cost_per_night) * sl.nights)}</td>
        <td>${sl.booking_ref ?? ''}</td>
      </tr>`).join('')

    const mainRows = allMonths.map(month => {
      const rent     = filteredRents.find(r => r.month === month)
      const reversal = filteredReversals.find(r => r.month === month)
      const subLetsM = filteredSubLets.filter(s => s.month === month)
      const subMargin = subLetsM.reduce((s, sl) => s + (sl.sell_per_night - sl.cost_per_night) * sl.nights, 0)
      const monthNet  = (reversal?.net_amount ?? 0) + subMargin - (rent?.amount ?? 0)
      return `<tr>
        <td>${fmtMonth(month)}</td>
        <td class="right neg">${rent ? `− ${fmtEur(rent.amount)}` : '–'}</td>
        <td class="right">${reversal ? fmtEur(reversal.gross_amount) : '–'}</td>
        <td class="right">${reversal ? `${reversal.percent}%` : ''}</td>
        <td class="right pos">${reversal ? `+ ${fmtEur(reversal.net_amount)}` : '–'}</td>
        <td class="right ${subMargin > 0 ? 'pos' : ''}">${subMargin ? `+ ${fmtEur(subMargin)}` : '–'}</td>
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
        <th class="right">Reversal</th><th class="right">Sub-let margin</th><th class="right">Net</th>
      </tr></thead>
      <tbody>${mainRows}</tbody>
      <tfoot><tr>
        <td>Total</td>
        <td class="right neg">− ${fmtEur(totalRent)}</td>
        <td class="right">${fmtEur(filteredReversals.reduce((s, r) => s + r.gross_amount, 0))}</td>
        <td></td>
        <td class="right pos">+ ${fmtEur(totalReversals)}</td>
        <td class="right pos">+ ${fmtEur(totalSubMargin)}</td>
        <td class="right ${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '+' : ''}${fmtEur(net)}</td>
      </tr></tfoot>
    </table>

    ${filteredSubLets.length > 0 ? `
    <h2>Bungalow sub-lets detail</h2>
    <table>
      <thead><tr>
        <th>Month</th><th>Bungalow</th><th>Period</th><th class="right">Nights</th>
        <th class="right">Cost/n</th><th class="right">Sell/n</th><th class="right">Margin</th><th>Ref</th>
      </tr></thead>
      <tbody>${subLetRows}</tbody>
    </table>` : ''}

    </body></html>`

    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }

  const anyForm = showAddRent || showAddReversal || showAddSubLet || editingRent || editingReversal || editingSubLet

  return (
    <div className="space-y-6">

      {/* Period selector */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1">
          {([
            { id: 'all',    label: 'All time' },
            { id: 'season', label: `Season ${currentSeason?.label ?? ''}` },
            { id: 'custom', label: 'Custom' },
            { id: 'single', label: '← Month →' },
          ] as { id: PeriodMode; label: string }[]).map(opt => (
            <button key={opt.id} onClick={() => setPeriod(opt.id)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                period === opt.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex items-center gap-2 text-sm">
            <input type="month" value={customFrom} onChange={e => setFrom(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <span className="text-gray-400">→</span>
            <input type="month" value={customTo} onChange={e => setTo(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
        )}
        {period === 'single' && (
          <div className="flex items-center gap-1">
            <button onClick={() => setSingle(m => shiftMonth(m, -1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 text-lg">‹</button>
            <span className="px-4 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 min-w-[120px] text-center">
              {fmtMonth(singleMonth)}
            </span>
            <button onClick={() => setSingle(m => shiftMonth(m, +1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 text-lg">›</button>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-400 mb-1">Rent</p>
          <p className="text-lg font-bold text-red-700">− {fmtEur(totalRent)}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400 mb-1">Reversals</p>
          <p className="text-lg font-bold text-emerald-700">+ {fmtEur(totalReversals)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-400 mb-1">Sub-lets</p>
          <p className="text-lg font-bold text-blue-700">+ {fmtEur(totalSubMargin)}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400 mb-1">Free income</p>
          <p className="text-lg font-bold text-emerald-700">+ {fmtEur(totalFreeInc)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-400 mb-1">Free expenses</p>
          <p className="text-lg font-bold text-red-700">− {fmtEur(totalFreeExp)}</p>
        </div>
        <div className={`border rounded-xl p-4 ${net >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>Net</p>
          <p className={`text-lg font-bold ${net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{net >= 0 ? '+' : ''}{fmtEur(net)}</p>
        </div>
      </div>

      {/* Monthly table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex flex-wrap justify-between items-center px-5 py-4 border-b gap-2">
          <h2 className="font-semibold text-gray-800">Monthly breakdown</h2>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => { closeAll(); setShowAddRent(true) }}
              className="text-xs px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium">+ Rent</button>
            <button onClick={() => { closeAll(); setShowAddReversal(true) }}
              className="text-xs px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 font-medium">+ Reversal</button>
            <button onClick={() => { closeAll(); setShowAddSubLet(true) }}
              className="text-xs px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium">+ Sub-let</button>
            <button onClick={() => { closeAll(); setAddingEntry('income') }}
              className="text-xs px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 font-medium">+ Income</button>
            <button onClick={() => { closeAll(); setAddingEntry('expense') }}
              className="text-xs px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 font-medium">+ Expense</button>
            <button onClick={handlePrint}
              className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 font-medium">🖨 Export</button>
          </div>
        </div>

        {(anyForm || addingEntry) && (
          <div className="px-5 py-4 border-b bg-gray-50 space-y-3">
            {showAddRent      && <RentForm     onSave={r => { handlers.addPalmeirasRent(r);      closeAll() }} onCancel={closeAll} />}
            {showAddReversal  && <ReversalForm onSave={r => { handlers.addPalmeirasReversal(r);  closeAll() }} onCancel={closeAll} />}
            {showAddSubLet    && <SubLetForm   onSave={s => { handlers.addPalmeirasSubLet(s);    closeAll() }} onCancel={closeAll} />}
            {editingRent      && <RentForm     existing={editingRent}     onSave={r => { handlers.updatePalmeirasRent(r);      closeAll() }} onCancel={closeAll} />}
            {editingReversal  && <ReversalForm existing={editingReversal} onSave={r => { handlers.updatePalmeirasReversal(r);  closeAll() }} onCancel={closeAll} />}
            {editingSubLet    && <SubLetForm   existing={editingSubLet}   onSave={s => { handlers.updatePalmeirasSubLet(s);    closeAll() }} onCancel={closeAll} />}
            {addingEntry && (
              <EntryForm
                month={period === 'single' ? singleMonth : new Date().toISOString().slice(0, 7)}
                type={addingEntry}
                onSave={e => { handlers.addPalmeirasEntry(e); setAddingEntry(null) }}
                onCancel={() => setAddingEntry(null)}
              />
            )}
          </div>
        )}

        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Month</th>
              <th className="px-4 py-3 text-right font-semibold text-red-500">Rent</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-500">Gross (Palm.)</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-400">%</th>
              <th className="px-4 py-3 text-right font-semibold text-emerald-600">Reversal</th>
              <th className="px-4 py-3 text-right font-semibold text-blue-600">Sub-lets</th>
              <th className="px-4 py-3 text-right font-semibold text-emerald-500">+ Free</th>
              <th className="px-4 py-3 text-right font-semibold text-orange-500">− Free</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Net</th>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {allMonths.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">No data for this period.</td></tr>
            )}
            {allMonths.map(month => {
              const rent      = filteredRents.find(r => r.month === month)
              const reversal  = filteredReversals.find(r => r.month === month)
              const subLetsM  = filteredSubLets.filter(s => s.month === month)
              const subMargin = subLetsM.reduce((s, sl) => s + (sl.sell_per_night - sl.cost_per_night) * sl.nights, 0)
              const mEntries  = filteredEntries.filter(e => e.month === month)
              const mInc      = mEntries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0)
              const mExp      = mEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0)
              const monthNet  = (reversal?.net_amount ?? 0) + subMargin + mInc - (rent?.amount ?? 0) - mExp
              return (
                <tr key={month} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{fmtMonth(month)}</td>
                  <td className="px-4 py-3 text-right">
                    {rent ? <span className="text-red-600 font-medium">− {fmtEur(rent.amount)}</span> : <span className="text-gray-300">–</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{reversal ? fmtEur(reversal.gross_amount) : <span className="text-gray-300">–</span>}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{reversal ? `${reversal.percent}%` : ''}</td>
                  <td className="px-4 py-3 text-right">
                    {reversal ? <span className="text-emerald-700 font-medium">+ {fmtEur(reversal.net_amount)}</span> : <span className="text-gray-300">–</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {subMargin > 0 ? <span className="text-blue-700 font-medium">+ {fmtEur(subMargin)}</span> : <span className="text-gray-300">–</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {mInc > 0 ? <span className="text-emerald-600 font-medium">+ {fmtEur(mInc)}</span> : <span className="text-gray-300">–</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {mExp > 0 ? <span className="text-orange-600 font-medium">− {fmtEur(mExp)}</span> : <span className="text-gray-300">–</span>}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold ${monthNet > 0 ? 'text-emerald-700' : monthNet < 0 ? 'text-red-700' : 'text-gray-400'}`}>
                    {(rent || reversal || subMargin || mInc || mExp) ? `${monthNet >= 0 ? '+' : ''}${fmtEur(monthNet)}` : '–'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      {rent     && <button onClick={() => { closeAll(); setEditingRent(rent) }}     title="Edit rent"     className="text-gray-300 hover:text-red-500 transition-colors text-sm px-1">✏</button>}
                      {reversal && <button onClick={() => { closeAll(); setEditingReversal(reversal) }} title="Edit reversal" className="text-gray-300 hover:text-emerald-600 transition-colors text-sm px-1">✏</button>}
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
              <td className="px-4 py-3 text-right font-semibold text-gray-600">{fmtEur(filteredReversals.reduce((s, r) => s + r.gross_amount, 0))}</td>
              <td />
              <td className="px-4 py-3 text-right font-semibold text-emerald-700">+ {fmtEur(totalReversals)}</td>
              <td className="px-4 py-3 text-right font-semibold text-blue-700">+ {fmtEur(totalSubMargin)}</td>
              <td className="px-4 py-3 text-right font-semibold text-emerald-600">+ {fmtEur(totalFreeInc)}</td>
              <td className="px-4 py-3 text-right font-semibold text-orange-600">− {fmtEur(totalFreeExp)}</td>
              <td className={`px-4 py-3 text-right font-bold ${net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{net >= 0 ? '+' : ''}{fmtEur(net)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Sub-lets detail */}
      {filteredSubLets.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold text-gray-800">Bungalow sub-lets detail</h2>
          </div>
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Bungalow</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Period</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-400">Nights</th>
                <th className="px-4 py-3 text-right font-semibold text-red-500">Cost/n</th>
                <th className="px-4 py-3 text-right font-semibold text-emerald-600">Sell/n</th>
                <th className="px-4 py-3 text-right font-semibold text-blue-600">Margin</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-400">Ref</th>
                <th className="px-4 py-3 w-16" />
              </tr>
            </thead>
            <tbody>
              {[...filteredSubLets].sort((a, b) => b.check_in.localeCompare(a.check_in)).map(sl => {
                const margin = (sl.sell_per_night - sl.cost_per_night) * sl.nights
                return (
                  <tr key={sl.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{sl.bungalow}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{sl.check_in} → {sl.check_out}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{sl.nights}</td>
                    <td className="px-4 py-3 text-right text-red-500">{fmtEur(sl.cost_per_night)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{fmtEur(sl.sell_per_night)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${margin >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                      {margin >= 0 ? '+' : ''}{fmtEur(margin)}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{sl.booking_ref ?? ''}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => { closeAll(); setEditingSubLet(sl) }} className="text-gray-300 hover:text-blue-500 transition-colors text-sm px-1">✏</button>
                        <button onClick={() => handlers.deletePalmeirasSubLet(sl.id)} className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none">×</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Free entries detail */}
      {filteredEntries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold text-gray-800">Free entries detail</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Month</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Description</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Amount</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {[...filteredEntries].sort((a, b) => b.month.localeCompare(a.month)).map(e => (
                <tr key={e.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtMonth(e.month)}</td>
                  <td className="px-4 py-3">
                    {e.type === 'income'
                      ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">+ Income</span>
                      : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">− Expense</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-800">{e.description}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${e.type === 'income' ? 'text-emerald-700' : 'text-orange-700'}`}>
                    {e.type === 'income' ? '+ ' : '− '}{fmtEur(e.amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handlers.deletePalmeirasEntry(e.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800 space-y-1">
        <p className="font-semibold">💡 About Palmeiras accounting</p>
        <p>All figures reflect the selected period and are included in the global dashboard totals.</p>
        <p><strong>Reversal</strong> = % of Palmeiras' own bookings they owe us · <strong>Rent</strong> = monthly lease · <strong>Sub-let margin</strong> = sell − cost on bungalows re-rented to our clients · <strong>Free entries</strong> = any misc income or expense tied to the Palmeiras relationship.</p>
      </div>
    </div>
  )
}
