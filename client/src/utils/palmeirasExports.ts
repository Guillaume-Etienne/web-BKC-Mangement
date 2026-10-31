// Printable sheets for the Palmeiras, laid out the way they run their
// bungalows rather than the way our accounting does. Several formats on
// purpose (gui, 2026-10-31: « ça change souvent »): each one is an entry of
// EXPORT_FORMATS, so a new layout is one more entry, nothing else to wire.
//
// Built from the SAME input as the statement (`StatementInput`), which never
// holds our selling price — a sheet made from it cannot leak it.
// Output is plain HTML + inline CSS: previewed in an iframe, printed from it,
// saved as PDF by gui. Language chosen per export (EN / FR / ES / PT).
import {
  stayAmounts, stayNights, stayRef, fmtEurCents, monthStart, monthEnd,
  PALMEIRAS_COMMISSION_PCT, type StatementInput, type StatementStay,
} from './palmeirasStatement'
import { fmtDate, addDaysISO } from './dates'

export type ExportFormatId = 'grid' | 'sheets' | 'list'

/** Language of the printed sheet — chosen per export, independent of the screen
 *  language: the Palmeiras read Portuguese (the app's own i18n has no PT). */
export type ExportLang = 'en' | 'fr' | 'es' | 'pt'
export const EXPORT_LANGS: { id: ExportLang; label: string }[] = [
  { id: 'pt', label: 'Português' }, { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' }, { id: 'es', label: 'Español' },
]

interface Strings {
  locale: string
  /** First letter of each weekday, Sunday first. */
  dayLetters: string
  gridTitle: string; gridSub: string
  sheetsTitle: string; sheetsSub: string
  listTitle: string; listSub: (stays: number, nights: number) => string
  legendPalm: string; legendBkc: string; legendProv: string
  noStay: string; provisional: string
  guest: string; checkIn: string; checkOut: string; nights: string; bungalow: string; paidTo: string; betweenUs: string
  paidPalm: string; paidBkc: string
  occupied: (n: number, days: number) => string
  arrived: (date: string) => string
  guestPaid: (gross: string, pct: number, share: string) => string
  bkcPays: (amount: string) => string
}

const STRINGS: Record<ExportLang, Strings> = {
  en: {
    locale: 'en-GB', dayLetters: 'SMTWTFS',
    gridTitle: 'Bungalows', gridSub: 'Occupancy by night · the colour shows who is paid by the guest',
    sheetsTitle: 'Bungalow sheets', sheetsSub: 'One block per bungalow',
    listTitle: 'Stays', listSub: (s, n) => `${s} stay${s === 1 ? '' : 's'} · ${n} night${n === 1 ? '' : 's'} in the month`,
    legendPalm: 'guest pays the Palmeiras', legendBkc: 'guest pays BKC', legendProv: 'provisional',
    noStay: 'No stay this month.', provisional: 'provisional',
    guest: 'Guest', checkIn: 'In', checkOut: 'Out', nights: 'Nights', bungalow: 'Bungalow', paidTo: 'Paid to', betweenUs: 'Between us',
    paidPalm: 'Paid to Palmeiras', paidBkc: 'Paid to BKC',
    occupied: (n, d) => `${n} / ${d} nights occupied`,
    arrived: d => `arrived ${d}`,
    guestPaid: (g, p, sh) => `guest paid you ${g} · BKC share ${p}% = ${sh}`,
    bkcPays: a => `BKC pays you ${a}`,
  },
  fr: {
    locale: 'fr-FR', dayLetters: 'DLMMJVS',
    gridTitle: 'Bungalows', gridSub: 'Occupation par nuit · la couleur indique qui est payé par le client',
    sheetsTitle: 'Fiches par bungalow', sheetsSub: 'Un bloc par bungalow',
    listTitle: 'Séjours', listSub: (s, n) => `${s} séjour${s > 1 ? 's' : ''} · ${n} nuit${n > 1 ? 's' : ''} dans le mois`,
    legendPalm: 'le client paie le Palmeiras', legendBkc: 'le client paie BKC', legendProv: 'provisoire',
    noStay: 'Aucun séjour ce mois-ci.', provisional: 'provisoire',
    guest: 'Client', checkIn: 'Arrivée', checkOut: 'Départ', nights: 'Nuits', bungalow: 'Bungalow', paidTo: 'Payé à', betweenUs: 'Entre nous',
    paidPalm: 'Payé au Palmeiras', paidBkc: 'Payé à BKC',
    occupied: (n, d) => `${n} / ${d} nuits occupées`,
    arrived: d => `arrivé le ${d}`,
    guestPaid: (g, p, sh) => `le client vous a payé ${g} · part BKC ${p} % = ${sh}`,
    bkcPays: a => `BKC vous paie ${a}`,
  },
  es: {
    locale: 'es-ES', dayLetters: 'DLMXJVS',
    gridTitle: 'Bungalows', gridSub: 'Ocupación por noche · el color indica quién cobra al cliente',
    sheetsTitle: 'Fichas por bungalow', sheetsSub: 'Un bloque por bungalow',
    listTitle: 'Estancias', listSub: (s, n) => `${s} estancia${s > 1 ? 's' : ''} · ${n} noche${n > 1 ? 's' : ''} en el mes`,
    legendPalm: 'el cliente paga al Palmeiras', legendBkc: 'el cliente paga a BKC', legendProv: 'provisional',
    noStay: 'Ninguna estancia este mes.', provisional: 'provisional',
    guest: 'Cliente', checkIn: 'Entrada', checkOut: 'Salida', nights: 'Noches', bungalow: 'Bungalow', paidTo: 'Pagado a', betweenUs: 'Entre nosotros',
    paidPalm: 'Pagado al Palmeiras', paidBkc: 'Pagado a BKC',
    occupied: (n, d) => `${n} / ${d} noches ocupadas`,
    arrived: d => `llegó el ${d}`,
    guestPaid: (g, p, sh) => `el cliente le pagó ${g} · parte de BKC ${p} % = ${sh}`,
    bkcPays: a => `BKC le paga ${a}`,
  },
  pt: {
    locale: 'pt-PT', dayLetters: 'DSTQQSS',
    gridTitle: 'Bungalows', gridSub: 'Ocupação por noite · a cor indica quem é pago pelo hóspede',
    sheetsTitle: 'Fichas por bungalow', sheetsSub: 'Um bloco por bungalow',
    listTitle: 'Estadias', listSub: (s, n) => `${s} estadia${s > 1 ? 's' : ''} · ${n} noite${n > 1 ? 's' : ''} no mês`,
    legendPalm: 'o hóspede paga ao Palmeiras', legendBkc: 'o hóspede paga à BKC', legendProv: 'provisório',
    noStay: 'Nenhuma estadia este mês.', provisional: 'provisório',
    guest: 'Hóspede', checkIn: 'Entrada', checkOut: 'Saída', nights: 'Noites', bungalow: 'Bungalow', paidTo: 'Pago a', betweenUs: 'Entre nós',
    paidPalm: 'Pago ao Palmeiras', paidBkc: 'Pago à BKC',
    occupied: (n, d) => `${n} / ${d} noites ocupadas`,
    arrived: d => `chegou a ${d}`,
    guestPaid: (g, p, sh) => `o hóspede pagou-vos ${g} · parte da BKC ${p} % = ${sh}`,
    bkcPays: a => `a BKC paga-vos ${a}`,
  },
}

/** "October 2026" / "octobre 2026" / "outubro de 2026"… */
export function fmtMonthLabel(month: string, lang: ExportLang): string {
  const [y, m] = month.split('-').map(Number)
  const t = new Date(y, m - 1, 1).toLocaleDateString(STRINGS[lang].locale, { month: 'long', year: 'numeric' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export interface ExportOptions {
  lang: ExportLang
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
export function stayFigure(s: StatementStay, month: string, lang: ExportLang = 'en'): { text: string; side: 'palmeiras' | 'bkc' | 'none' } {
  const t = STRINGS[lang]
  if (s.check_in.slice(0, 7) !== month) return { text: t.arrived(fmtDate(s.check_in)), side: 'none' }
  const a = stayAmounts(s)
  if (s.paid_direct) {
    return { text: t.guestPaid(fmtEurCents(a.gross), PALMEIRAS_COMMISSION_PCT, fmtEurCents(a.toUs)), side: 'palmeiras' }
  }
  return { text: t.bkcPays(fmtEurCents(a.toPalmeiras)), side: 'bkc' }
}

const stayColour = (s: StatementStay) => (s.paid_direct ? PURPLE : BLUE)

const paidBadge = (s: StatementStay, t: Strings) =>
  `<span class="badge" style="background:${stayColour(s)}">${s.paid_direct ? t.paidPalm : t.paidBkc}</span>`

const legend = (t: Strings) => `
  <p class="legend">
    <span class="dot" style="background:${PURPLE}"></span> ${t.legendPalm}
    &nbsp;&nbsp;<span class="dot" style="background:${BLUE}"></span> ${t.legendBkc}
    &nbsp;&nbsp;<span class="dot hatch"></span> ${t.legendProv}
  </p>`

// ── 1. Month grid — bungalows × days, like a reservations notebook ──────────

function renderGrid(input: StatementInput, month: string, { lang }: ExportOptions): string {
  const t = STRINGS[lang]
  const [y, m] = month.split('-').map(Number)
  const days = new Date(y, m, 0).getDate()
  const next = addDaysISO(monthEnd(month), 1)
  const weekend = (d: number) => [0, 6].includes(new Date(y, m - 1, d).getDay())

  const head = Array.from({ length: days }, (_, i) => {
    const d = i + 1
    return `<th class="${weekend(d) ? 'we' : ''}">${d}<br><small>${t.dayLetters[new Date(y, m - 1, d).getDay()]}</small></th>`
  }).join('')

  const stays = staysOfMonth(input, month)
  const rows = exportBungalows(input).map(b => {
    const mine = stays.filter(s => s.bungalow === b)
    const cells: string[] = []
    let d = 1
    while (d <= days) {
      const iso = `${month}-${String(d).padStart(2, '0')}`
      // the night of day d belongs to the stay that is in by that day and out after it
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
    <h1>${t.gridTitle} — ${fmtMonthLabel(month, lang)}</h1>
    <p class="sub">${t.gridSub}</p>
    <table class="grid"><thead><tr><th class="bung"></th>${head}</tr></thead><tbody>${rows}</tbody></table>
    ${legend(t)}`
}

// ── 2. One card per bungalow ────────────────────────────────────────────────

function renderSheets(input: StatementInput, month: string, { lang, showAmounts }: ExportOptions): string {
  const t = STRINGS[lang]
  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()
  const stays = staysOfMonth(input, month)
  const cards = exportBungalows(input).map(b => {
    const mine = stays.filter(s => s.bungalow === b)
    const nights = mine.reduce((n, s) => n + nightsInMonth(s, month), 0)
    const body = mine.length === 0
      ? `<p class="empty">${t.noStay}</p>`
      : `<table class="rows"><thead><tr><th>${t.guest}</th><th>${t.checkIn}</th><th>${t.checkOut}</th><th class="r">${t.nights}</th><th>${t.paidTo}</th>${showAmounts ? `<th>${t.betweenUs}</th>` : ''}</tr></thead><tbody>${
        mine.map(s => {
          const f = stayFigure(s, month, lang)
          return `<tr${s.provisional ? ' class="prov-row"' : ''}>
            <td>${escapeHtml(s.guest || '—')}${s.provisional ? ` <small>(${t.provisional})</small>` : ''}</td>
            <td>${fmtDate(s.check_in)}</td><td>${fmtDate(s.check_out)}</td>
            <td class="r">${stayNights(s)}</td><td>${paidBadge(s, t)}</td>
            ${showAmounts ? `<td class="fig">${escapeHtml(f.text)}</td>` : ''}</tr>`
        }).join('')}</tbody></table>`
    return `<section class="card">
      <h2>${escapeHtml(b)} <small>${t.occupied(nights, days)}</small></h2>${body}</section>`
  }).join('')
  return `<h1>${t.sheetsTitle} — ${fmtMonthLabel(month, lang)}</h1><p class="sub">${t.sheetsSub}</p>${cards}`
}

// ── 3. Chronological list ───────────────────────────────────────────────────

function renderList(input: StatementInput, month: string, { lang, showAmounts }: ExportOptions): string {
  const t = STRINGS[lang]
  const stays = staysOfMonth(input, month)
  const nights = stays.reduce((n, s) => n + nightsInMonth(s, month), 0)
  const rows = stays.map(s => {
    const f = stayFigure(s, month, lang)
    return `<tr${s.provisional ? ' class="prov-row"' : ''}>
      <td>${fmtDate(s.check_in)}</td><td>${fmtDate(s.check_out)}</td>
      <td><b>${escapeHtml(s.bungalow)}</b></td>
      <td>${escapeHtml(s.guest || '—')}${s.provisional ? ` <small>(${t.provisional})</small>` : ''}</td>
      <td class="r">${stayNights(s)}</td><td>${paidBadge(s, t)}</td>
      ${showAmounts ? `<td class="fig">${escapeHtml(f.text)}</td>` : ''}</tr>`
  }).join('')
  return `
    <h1>${t.listTitle} — ${fmtMonthLabel(month, lang)}</h1>
    <p class="sub">${t.listSub(stays.length, nights)}</p>
    ${stays.length === 0 ? `<p class="empty">${t.noStay}</p>` : `
    <table class="rows"><thead><tr><th>${t.checkIn}</th><th>${t.checkOut}</th><th>${t.bungalow}</th><th>${t.guest}</th><th class="r">${t.nights}</th><th>${t.paidTo}</th>${showAmounts ? `<th>${t.betweenUs}</th>` : ''}</tr></thead>
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
  return `<!DOCTYPE html><html lang="${opts.lang}"><head><meta charset="utf-8">
<title>Palmeiras — ${f.label} — ${fmtMonthLabel(month, opts.lang)}</title>
<style>@page { size: A4 ${f.orientation}; margin: 12mm; }${CSS}</style></head>
<body>${f.render(input, month, opts)}</body></html>`
}
