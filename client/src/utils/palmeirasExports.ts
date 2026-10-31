// Printable sheets for the Palmeiras, laid out the way they run their
// bungalows rather than the way our accounting does. Several formats on
// purpose (gui, 2026-10-31: « ça change souvent »): each one is an entry of
// EXPORT_FORMATS, so a new layout is one more entry, nothing else to wire.
//
// Built from the SAME input as the statement (`StatementInput`), which never
// holds our selling price — a sheet made from it cannot leak it.
// Output is plain HTML + inline CSS: previewed in an iframe, printed from it,
// saved as PDF by gui. English, like the Palmeiras page.
import {
  stayAmounts, stayNights, stayRef, fmtEurCents, fmtMonthLong, monthStart, monthEnd,
  PALMEIRAS_COMMISSION_PCT, type StatementInput, type StatementStay,
} from './palmeirasStatement'
import { fmtDate, addDaysISO } from './dates'

export type ExportFormatId = 'grid' | 'sheets' | 'list'

export interface ExportOptions {
  /** Print what each stay is worth between us. Off = pure occupancy sheet. */
  showAmounts: boolean
}

export interface ExportFormat {
  id: ExportFormatId
  label: string
  description: string
  orientation: 'portrait' | 'landscape'
  render: (input: StatementInput, month: string, opts: ExportOptions) => string
}

const PURPLE = '#7c3aed'   // paid to the Palmeiras — same colours as the timeline
const BLUE   = '#2563eb'   // paid to BKC

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Bungalow names in natural order (B2 before B10), empty ones included. */
export function exportBungalows(input: StatementInput): string[] {
  const names = new Set([...(input.bungalows ?? []), ...input.stays.map(s => s.bungalow)])
  return [...names].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
}

/** Stays with at least one night in the month, by arrival. */
export function staysOfMonth(input: StatementInput, month: string): StatementStay[] {
  const start = monthStart(month)
  const next = addDaysISO(monthEnd(month), 1)
  return input.stays
    .filter(s => s.check_in < next && s.check_out > start)
    .sort((a, b) => a.check_in.localeCompare(b.check_in) || a.bungalow.localeCompare(b.bungalow, 'en', { numeric: true }))
}

/** Nights of a stay that fall inside the month. */
export function nightsInMonth(s: Pick<StatementStay, 'check_in' | 'check_out'>, month: string): number {
  const start = monthStart(month)
  const next = addDaysISO(monthEnd(month), 1)
  return stayNights({
    check_in: s.check_in > start ? s.check_in : start,
    check_out: s.check_out < next ? s.check_out : next,
  })
}

/** What this stay means between us, in words the Palmeiras reads. Counted in
 *  the month of arrival (like the statement): a stay that began earlier says so. */
export function stayFigure(s: StatementStay, month: string): { text: string; side: 'palmeiras' | 'bkc' | 'none' } {
  if (s.check_in.slice(0, 7) !== month) return { text: `arrived ${fmtDate(s.check_in)}`, side: 'none' }
  const a = stayAmounts(s)
  if (s.paid_direct) {
    return {
      text: `guest paid you ${fmtEurCents(a.gross)} · BKC share ${PALMEIRAS_COMMISSION_PCT}% = ${fmtEurCents(a.toUs)}`,
      side: 'palmeiras',
    }
  }
  return { text: `BKC pays you ${fmtEurCents(a.toPalmeiras)}`, side: 'bkc' }
}

const stayColour = (s: StatementStay) => (s.paid_direct ? PURPLE : BLUE)

const paidBadge = (s: StatementStay) =>
  `<span class="badge" style="background:${stayColour(s)}">${s.paid_direct ? 'Paid to Palmeiras' : 'Paid to BKC'}</span>`

const legend = () => `
  <p class="legend">
    <span class="dot" style="background:${PURPLE}"></span> guest pays the Palmeiras
    &nbsp;&nbsp;<span class="dot" style="background:${BLUE}"></span> guest pays BKC
    &nbsp;&nbsp;<span class="dot hatch"></span> provisional
  </p>`

// ── 1. Month grid — bungalows × days, like a reservations notebook ──────────

function renderGrid(input: StatementInput, month: string): string {
  const [y, m] = month.split('-').map(Number)
  const days = new Date(y, m, 0).getDate()
  const next = addDaysISO(monthEnd(month), 1)
  const weekend = (d: number) => [0, 6].includes(new Date(y, m - 1, d).getDay())
  const dayLetters = 'SMTWTFS'

  const head = Array.from({ length: days }, (_, i) => {
    const d = i + 1
    return `<th class="${weekend(d) ? 'we' : ''}">${d}<br><small>${dayLetters[new Date(y, m - 1, d).getDay()]}</small></th>`
  }).join('')

  const stays = staysOfMonth(input, month)
  const rows = exportBungalows(input).map(b => {
    const mine = stays.filter(s => s.bungalow === b)
    const cells: string[] = []
    let d = 1
    while (d <= days) {
      const iso = `${month}-${String(d).padStart(2, '0')}`
      // the night of day d belongs to the stay that is in before the end of that day and out after
      const s = mine.find(x => x.check_in <= iso && x.check_out > iso)
      if (!s) { cells.push(`<td class="${weekend(d) ? 'we' : ''}"></td>`); d++; continue }
      const end = s.check_out < next ? s.check_out : next
      const span = Math.max(1, stayNights({ check_in: iso, check_out: end }))
      const label = span >= 3 ? escapeHtml(s.guest || stayRef(s)) : span === 2 ? escapeHtml((s.guest || '').split(' ')[0]) : ''
      cells.push(`<td colspan="${span}" class="stay${s.provisional ? ' prov' : ''}" style="background:${stayColour(s)}" title="${escapeHtml(stayRef(s))} · ${fmtDate(s.check_in)} → ${fmtDate(s.check_out)}">${label}</td>`)
      d += span
    }
    return `<tr><th class="bung">${escapeHtml(b)}</th>${cells.join('')}</tr>`
  }).join('')

  return `
    <h1>Bungalows — ${fmtMonthLong(month)}</h1>
    <p class="sub">Occupancy by night · the colour shows who is paid by the guest</p>
    <table class="grid"><thead><tr><th class="bung"></th>${head}</tr></thead><tbody>${rows}</tbody></table>
    ${legend()}`
}

// ── 2. One card per bungalow ────────────────────────────────────────────────

function renderSheets(input: StatementInput, month: string, opts: ExportOptions): string {
  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()
  const stays = staysOfMonth(input, month)
  const cards = exportBungalows(input).map(b => {
    const mine = stays.filter(s => s.bungalow === b)
    const nights = mine.reduce((t, s) => t + nightsInMonth(s, month), 0)
    const body = mine.length === 0
      ? '<p class="empty">No stay this month.</p>'
      : `<table class="rows"><thead><tr><th>Guest</th><th>In</th><th>Out</th><th class="r">Nights</th><th>Paid to</th>${opts.showAmounts ? '<th>Between us</th>' : ''}</tr></thead><tbody>${
        mine.map(s => {
          const f = stayFigure(s, month)
          return `<tr${s.provisional ? ' class="prov-row"' : ''}>
            <td>${escapeHtml(s.guest || '—')}${s.provisional ? ' <small>(provisional)</small>' : ''}</td>
            <td>${fmtDate(s.check_in)}</td><td>${fmtDate(s.check_out)}</td>
            <td class="r">${stayNights(s)}</td><td>${paidBadge(s)}</td>
            ${opts.showAmounts ? `<td class="fig">${escapeHtml(f.text)}</td>` : ''}</tr>`
        }).join('')}</tbody></table>`
    return `<section class="card">
      <h2>${escapeHtml(b)} <small>${nights} / ${days} nights occupied</small></h2>${body}</section>`
  }).join('')
  return `<h1>Bungalow sheets — ${fmtMonthLong(month)}</h1><p class="sub">One block per bungalow</p>${cards}`
}

// ── 3. Chronological list ───────────────────────────────────────────────────

function renderList(input: StatementInput, month: string, opts: ExportOptions): string {
  const stays = staysOfMonth(input, month)
  const nights = stays.reduce((t, s) => t + nightsInMonth(s, month), 0)
  const rows = stays.map(s => {
    const f = stayFigure(s, month)
    return `<tr${s.provisional ? ' class="prov-row"' : ''}>
      <td>${fmtDate(s.check_in)}</td><td>${fmtDate(s.check_out)}</td>
      <td><b>${escapeHtml(s.bungalow)}</b></td>
      <td>${escapeHtml(s.guest || '—')}${s.provisional ? ' <small>(provisional)</small>' : ''}</td>
      <td class="r">${stayNights(s)}</td><td>${paidBadge(s)}</td>
      ${opts.showAmounts ? `<td class="fig">${escapeHtml(f.text)}</td>` : ''}</tr>`
  }).join('')
  return `
    <h1>Stays — ${fmtMonthLong(month)}</h1>
    <p class="sub">${stays.length} stay${stays.length === 1 ? '' : 's'} · ${nights} night${nights === 1 ? '' : 's'} in the month</p>
    ${stays.length === 0 ? '<p class="empty">No stay this month.</p>' : `
    <table class="rows"><thead><tr><th>In</th><th>Out</th><th>Bungalow</th><th>Guest</th><th class="r">Nights</th><th>Paid to</th>${opts.showAmounts ? '<th>Between us</th>' : ''}</tr></thead>
    <tbody>${rows}</tbody></table>`}`
}

export const EXPORT_FORMATS: ExportFormat[] = [
  { id: 'grid',   label: 'Month grid',      orientation: 'landscape', render: renderGrid,
    description: 'Bungalows in rows, days in columns — a reservations notebook page.' },
  { id: 'sheets', label: 'Bungalow sheets', orientation: 'portrait',  render: renderSheets,
    description: 'One block per bungalow with its stays of the month.' },
  { id: 'list',   label: 'Stay list',       orientation: 'portrait',  render: renderList,
    description: 'All stays in date order, one line each.' },
]

const CSS = `
  * { box-sizing: border-box; }
  body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1a1a1a; margin: 0; padding: 18px 26px; }
  h1 { font-size: 18pt; margin: 0 0 2px; } h2 { font-size: 12pt; margin: 0 0 6px; } h2 small, h1 small { font-weight: normal; color: #6b7280; font-size: 9pt; margin-left: 8px; }
  .sub { color: #6b7280; margin: 0 0 14px; font-size: 10pt; } .empty { color: #9ca3af; font-style: italic; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  .grid { table-layout: fixed; font-size: 8pt; text-align: center; }
  .grid th, .grid td { border: 0.5pt solid #d1d5db; height: 30px; padding: 0; }
  .grid th small { color: #9ca3af; font-weight: normal; } .grid th { background: #f3f4f6; font-weight: 600; }
  .grid .bung { width: 74px; text-align: left; padding: 0 6px; font-size: 10pt; background: #f9fafb; }
  .grid .we { background: #f3f4f6; } .grid th.we { background: #e5e7eb; }
  .grid .stay { color: #fff; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 3px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .prov, .hatch { background-image: repeating-linear-gradient(45deg, rgba(255,255,255,.55) 0 4px, transparent 4px 8px) !important; }
  .legend { margin: 12px 0 0; font-size: 9pt; color: #4b5563; }
  .dot { display: inline-block; width: 11px; height: 11px; border-radius: 2px; vertical-align: -1px; margin-right: 3px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .hatch { background-color: #9ca3af; }
  .card { border: 0.5pt solid #d1d5db; border-radius: 6px; padding: 10px 12px; margin-bottom: 10px; break-inside: avoid; }
  .rows { font-size: 10pt; } .rows th { text-align: left; font-size: 8.5pt; text-transform: uppercase; color: #6b7280; border-bottom: 1pt solid #d1d5db; padding: 4px 6px; }
  .rows td { padding: 5px 6px; border-bottom: 0.5pt solid #e5e7eb; } .r { text-align: right !important; }
  .prov-row td { color: #6b7280; } .fig { font-size: 9.5pt; color: #374151; }
  .badge { color: #fff; border-radius: 9px; padding: 1px 8px; font-size: 8.5pt; white-space: nowrap; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`

/** The full document for one format and month, ready for an iframe `srcDoc`. */
export function buildExportDocument(
  formatId: ExportFormatId, input: StatementInput, month: string, opts: ExportOptions,
): string {
  const f = EXPORT_FORMATS.find(x => x.id === formatId) ?? EXPORT_FORMATS[0]
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Palmeiras — ${f.label} — ${fmtMonthLong(month)}</title>
<style>@page { size: A4 ${f.orientation}; margin: 12mm; }${CSS}</style></head>
<body>${f.render(input, month, opts)}</body></html>`
}
