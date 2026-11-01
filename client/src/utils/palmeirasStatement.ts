// The account between BKC and the Palmeiras, as one statement: who owes what
// to whom, line by line, month by month, minus the payments already made.
// Shared by the admin tab and the Palmeiras share page, so both show the same
// figures. The input is exactly what the `palmeiras_statement()` RPC returns;
// the admin side builds the same shape from its own data (palmeirasUtils).
//
// Sign convention: `toUs` = the Palmeiras owes BKC, `toPalmeiras` = BKC owes
// the Palmeiras. A positive balance means the Palmeiras owes us.
import { fmtDate, todayISO } from './dates'

/** Our share of what a guest paid the Palmeiras directly for a bungalow
 *  (gui, 2026-10-30). Small gaps from the metical rate are entered as the
 *  month's actual commission (palmeiras_reversals) and show as an adjustment. */
export const PALMEIRAS_COMMISSION_PCT = 15

/** The house is rented from the 15th to the 15th (gui, 2026-10-30). A rent row
 *  is keyed by the month its period starts: "2026-10" = 15/10 → 15/11. */
export const RENT_PERIOD_DAY = 15
/** First rent period: 15/09/2026 → 15/10/2026 (gui). Before it, no reminder. */
export const PALMEIRAS_RENT_START_MONTH = '2026-09'

export function rentPeriod(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number)
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
  const dd = String(RENT_PERIOD_DAY).padStart(2, '0')
  return { start: `${month}-${dd}`, end: `${next}-${dd}` }
}

export interface StatementStay {
  booking_number: number
  guest: string
  provisional: boolean
  bungalow: string
  check_in: string
  check_out: string
  paid_direct: boolean
  /** What the guest paid them per night — set only when paid_direct. */
  price_per_night: number | null
  /** What we owe them per night — set only when we collected. */
  cost_per_night: number | null
}

export interface StatementInput {
  eur_mzn_rate: number | null
  /** Every Palmeiras bungalow, so the timeline shows the empty ones too
   *  (2026-10-30c; absent from an older RPC → taken from the stays). */
  bungalows?: string[]
  stays: StatementStay[]
  rents: { month: string; amount: number; amount_mzn: number | null }[]
  adjustments: { month: string; gross_amount: number; percent: number; net_amount: number }[]
  /** `date` since 2026-10-30d (a free line can happen any day); older rows → the 1st of `month`. */
  entries: { month: string; date?: string | null; type: 'income' | 'expense'; description: string; amount: number }[]
  card_payments: { booking_number: number | null; guest: string; date: string; amount: number }[]
  /** `rent_month` (2026-10-30e): the rent period this payment settles. */
  settlements: { id?: string; date: string; direction: 'us_to_palmeiras' | 'palmeiras_to_us'; amount: number; method: string | null; rent_month?: string | null }[]
}

export type LineKind = 'stay_ours' | 'stay_direct' | 'adjustment' | 'rent' | 'card' | 'entry'

export interface StatementLine {
  key: string
  date: string        // sort key, YYYY-MM-DD
  kind: LineKind
  title: string
  detail: string
  toUs: number
  toPalmeiras: number
  provisional: boolean
  /** The real metical amount, when there is one (a rent). Otherwise the MZN
   *  shown is an equivalent at the current rate. */
  mzn?: number | null
}

export interface StatementMonth {
  month: string       // YYYY-MM
  lines: StatementLine[]
  toUs: number
  toPalmeiras: number
}

export interface Statement {
  months: StatementMonth[]          // most recent first — only what is due today
  /** Stays not begun yet, rents of months to come: shown, not in the balance. */
  upcoming: StatementLine[]
  settlements: (StatementInput['settlements'][number] & { key: string; mzn?: number | null })[]  // most recent first
  toUs: number
  toPalmeiras: number
  paidByUs: number                  // settlements BKC → Palmeiras
  paidByThem: number                // settlements Palmeiras → BKC
  /** > 0: the Palmeiras owes BKC. < 0: BKC owes the Palmeiras. */
  balance: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function stayNights(s: Pick<StatementStay, 'check_in' | 'check_out'>): number {
  const ms = Date.parse(`${s.check_out}T00:00:00Z`) - Date.parse(`${s.check_in}T00:00:00Z`)
  return Math.max(0, Math.round(ms / 86_400_000))
}

/** "330 €", "49,50 €" — cents only when there are some: a statement must add up
 *  to the cent, where the rest of the app rounds to the euro. */
export function fmtEurCents(n: number): string {
  const v = r2(n) || 0
  const cents = Math.abs(v % 1) > 0.001
  return `${v.toLocaleString('fr-FR', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 })} €`
}

/** The current rate, or null when it is missing: never fall back on a made-up
 *  rate, the MZN is simply not shown. */
export function usableRate(rate: number | null | undefined): number | null {
  return rate && rate > 0 ? rate : null
}

/** "10,000 MZN" */
export function fmtMznExact(mzn: number): string {
  return `${Math.round(mzn).toLocaleString('en-US')} MZN`
}

/** "≈ 3,500 MZN" for an amount in euros, '' without a usable rate. */
export function fmtMznEquivalent(eur: number, rate: number | null | undefined): string {
  const r = usableRate(rate)
  return r ? `≈ ${fmtMznExact(Math.abs(eur) * r)}` : ''
}

/** What one stay weighs in the account — the single rule behind both the
 *  statement lines and the timeline bars. */
/** The payment that settled a rent period, if one was recorded against it. */
export function rentPayment(input: Pick<StatementInput, 'settlements'>, month: string) {
  return input.settlements.find(s => s.rent_month === month && s.direction === 'us_to_palmeiras') ?? null
}

export function stayAmounts(s: StatementStay): { nights: number; gross: number; toUs: number; toPalmeiras: number } {
  const nights = stayNights(s)
  if (s.paid_direct) {
    const gross = (s.price_per_night ?? 0) * nights
    return { nights, gross, toUs: r2(gross * PALMEIRAS_COMMISSION_PCT / 100), toPalmeiras: 0 }
  }
  return { nights, gross: 0, toUs: 0, toPalmeiras: r2((s.cost_per_night ?? 0) * nights) }
}

export function stayRef(s: Pick<StatementStay, 'booking_number' | 'guest'>): string {
  return [s.booking_number ? `#${s.booking_number}` : null, s.guest || null].filter(Boolean).join(' · ')
}

/** "October 2026" */
export function fmtMonthLong(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

export function monthStart(month: string): string {
  return `${month}-01`
}

export function monthEnd(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
}

export function buildStatement(input: StatementInput, today: string = todayISO()): Statement {
  const lines: StatementLine[] = []
  const mznNote = (eur: number) => {
    const t = fmtMznEquivalent(eur, input.eur_mzn_rate)
    return t ? ` (${t})` : ''
  }
  const autoCommission: Record<string, number> = {}

  input.stays.forEach((s, i) => {
    const { nights, gross, toUs, toPalmeiras } = stayAmounts(s)
    const month = s.check_in.slice(0, 7)
    const period = `${s.bungalow} · ${fmtDate(s.check_in)} → ${fmtDate(s.check_out)}`
    if (s.paid_direct) {
      autoCommission[month] = (autoCommission[month] ?? 0) + toUs
      lines.push({
        key: `stay-${i}`, date: s.check_in, kind: 'stay_direct', provisional: s.provisional,
        title: `Commission ${PALMEIRAS_COMMISSION_PCT}% — ${stayRef(s)}`,
        detail: `${period} · guest paid the Palmeiras ${nights} night${nights === 1 ? '' : 's'} × ${fmtEurCents(s.price_per_night ?? 0)} = ${fmtEurCents(gross)}${mznNote(gross)}`,
        toUs, toPalmeiras: 0,
      })
    } else {
      lines.push({
        key: `stay-${i}`, date: s.check_in, kind: 'stay_ours', provisional: s.provisional,
        title: `Bungalow rented through BKC — ${stayRef(s)}`,
        detail: `${period} · ${nights} night${nights === 1 ? '' : 's'} × ${fmtEurCents(s.cost_per_night ?? 0)}${mznNote(s.cost_per_night ?? 0)}`,
        toUs: 0, toPalmeiras,
      })
    }
  })

  // A month's actual commission, when entered, replaces the 15 % computed per
  // stay; only the difference is shown, so each stay keeps its own line.
  for (const a of input.adjustments) {
    const diff = r2(a.net_amount - (autoCommission[a.month] ?? 0))
    if (Math.abs(diff) < 0.01) continue
    lines.push({
      // dated at the end of its month: it corrects that month's stays
      key: `adj-${a.month}`, date: monthEnd(a.month), kind: 'adjustment', provisional: false,
      title: 'Commission adjustment (exchange rate)',
      detail: `Actual commission for the month: ${a.percent}% of ${fmtEurCents(a.gross_amount)} = ${fmtEurCents(a.net_amount)}`,
      toUs: diff > 0 ? diff : 0, toPalmeiras: diff < 0 ? -diff : 0,
    })
  }

  for (const r of input.rents) {
    const p = rentPeriod(r.month)
    lines.push({
      key: `rent-${r.month}`, date: p.start, kind: 'rent', provisional: false,
      title: `House rent ${fmtDate(p.start)} → ${fmtDate(p.end)}`,
      detail: r.amount_mzn ? fmtMznExact(r.amount_mzn) : '',
      toUs: 0, toPalmeiras: r2(r.amount), mzn: r.amount_mzn ?? null,
    })
  }

  input.card_payments.forEach((p, i) => {
    lines.push({
      key: `card-${i}`, date: p.date, kind: 'card', provisional: false,
      title: `Card payment on the Palmeiras terminal — ${stayRef({ booking_number: p.booking_number ?? 0, guest: p.guest })}`,
      detail: `${fmtDate(p.date)} · collected for BKC`,
      toUs: r2(p.amount), toPalmeiras: 0,
    })
  })

  input.entries.forEach((e, i) => {
    lines.push({
      key: `entry-${i}`, date: e.date ?? monthStart(e.month), kind: 'entry', provisional: false,
      title: e.description, detail: '',
      toUs: e.type === 'income' ? r2(e.amount) : 0,
      toPalmeiras: e.type === 'expense' ? r2(e.amount) : 0,
    })
  })

  // A stay counts once it has begun, a rent once its month has come: a booking
  // for next month must not weigh on the balance settled today.
  // (A rent is dated on the 15th its period starts, so the same rule covers it.)
  const isUpcoming = (l: StatementLine) =>
    (l.kind === 'stay_ours' || l.kind === 'stay_direct' || l.kind === 'rent') && l.date > today
  const upcoming = lines.filter(isUpcoming).sort((a, b) => a.date.localeCompare(b.date))
  const due = lines.filter(l => !isUpcoming(l))

  const byMonth: Record<string, StatementMonth> = {}
  for (const l of due) {
    const m = (byMonth[l.date.slice(0, 7)] ??= { month: l.date.slice(0, 7), lines: [], toUs: 0, toPalmeiras: 0 })
    m.lines.push(l)
    m.toUs = r2(m.toUs + l.toUs)
    m.toPalmeiras = r2(m.toPalmeiras + l.toPalmeiras)
  }
  const months = Object.values(byMonth).sort((a, b) => b.month.localeCompare(a.month))
  for (const m of months) m.lines.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key))

  const toUs        = r2(due.reduce((s, l) => s + l.toUs, 0))
  const toPalmeiras = r2(due.reduce((s, l) => s + l.toPalmeiras, 0))
  const paidByUs    = r2(input.settlements.filter(s => s.direction === 'us_to_palmeiras').reduce((s, x) => s + x.amount, 0))
  const paidByThem  = r2(input.settlements.filter(s => s.direction === 'palmeiras_to_us').reduce((s, x) => s + x.amount, 0))

  return {
    months,
    upcoming,
    settlements: input.settlements
      .map((s, i) => {
        // A rent paid in full is those same meticals, whatever the rate became.
        const rent = s.rent_month ? input.rents.find(r => r.month === s.rent_month) : undefined
        const mzn = rent?.amount_mzn && Math.abs(rent.amount - s.amount) < 0.01 ? rent.amount_mzn : null
        return { ...s, key: `set-${i}`, mzn }
      })
      .sort((a, b) => b.date.localeCompare(a.date)),
    toUs, toPalmeiras, paidByUs, paidByThem,
    balance: r2(toUs - toPalmeiras + paidByUs - paidByThem),
  }
}

/** "The Palmeiras owes BKC 224,15 €" — the one sentence both sides read first. */
export function balanceSentence(balance: number): string {
  if (Math.abs(balance) < 0.01) return 'All settled'
  return balance > 0
    ? `The Palmeiras owes BKC ${fmtEurCents(balance)}`
    : `BKC owes the Palmeiras ${fmtEurCents(-balance)}`
}

// ── Chronological ledger (the « Table » view) ───────────────────────────────
// Like a bank statement: one row per movement in date order, a running
// balance, a subtotal per month. A payment between us is a row too: a payment
// by BKC reduces what is owed to the Palmeiras (negative in that column), a
// payment by the Palmeiras reduces what is owed to BKC — so the running
// balance (owed to BKC − owed to the Palmeiras) walks back towards zero.

export type LedgerKind = LineKind | 'settlement'

export interface LedgerRow extends Omit<StatementLine, 'kind'> {
  kind: LedgerKind
  /** Balance once this row is counted; null for a row not due yet. */
  balance: number | null
  /** The settlement's id, so the admin can delete it from the table. */
  settlementId?: string
}

export interface LedgerMonth {
  month: string
  rows: LedgerRow[]
  toUs: number
  toPalmeiras: number
  /** Running balance at the end of the month. */
  closing: number
}

// Same day: what happened before what was paid for it.
const KIND_ORDER: Record<LedgerKind, number> = {
  rent: 0, stay_ours: 1, stay_direct: 2, card: 3, entry: 4, adjustment: 5, settlement: 6,
}

export function buildLedger(st: Statement): { months: LedgerMonth[]; upcoming: LedgerRow[] } {
  const rows: LedgerRow[] = [
    ...st.months.flatMap(m => m.lines).map(l => ({ ...l, balance: null })),
    ...st.settlements.map(s => ({
      key: s.key, date: s.date, kind: 'settlement' as const, provisional: false, balance: null,
      settlementId: s.id, mzn: s.mzn ?? null,
      title: s.rent_month
        ? `House rent paid (${fmtDate(rentPeriod(s.rent_month).start)} → ${fmtDate(rentPeriod(s.rent_month).end)})`
        : s.direction === 'us_to_palmeiras' ? 'Payment BKC → the Palmeiras' : 'Payment the Palmeiras → BKC',
      detail: s.method ?? '',
      toUs: s.direction === 'palmeiras_to_us' ? -s.amount : 0,
      toPalmeiras: s.direction === 'us_to_palmeiras' ? -s.amount : 0,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.key.localeCompare(b.key))

  const months: LedgerMonth[] = []
  let running = 0
  for (const row of rows) {
    running = r2(running + row.toUs - row.toPalmeiras)
    row.balance = running
    const month = row.date.slice(0, 7)
    let m = months[months.length - 1]
    if (!m || m.month !== month) months.push(m = { month, rows: [], toUs: 0, toPalmeiras: 0, closing: 0 })
    m.rows.push(row)
    m.toUs = r2(m.toUs + row.toUs)
    m.toPalmeiras = r2(m.toPalmeiras + row.toPalmeiras)
    m.closing = running
  }
  return {
    months,
    upcoming: st.upcoming.map(l => ({ ...l, balance: null })),
  }
}

// ── Admin only: what BKC earns on a stay ────────────────────────────────────
// ⚠️ Never add any of this to StatementInput or to palmeiras_statement(): that
// separation is what keeps our selling price off the share page and the sheets
// sent to the Palmeiras. It travels on the side, built by the admin tab alone.

export interface StayInternal {
  bungalow: string
  /** The guest paid the Palmeiras: we billed nothing, our margin is the commission. */
  direct: boolean
  sellPerNight: number
  nights: number
  /** What BKC billed; 0 on a stay paid directly. */
  billed: number
  /** What the guest paid the Palmeiras; 0 on a stay we collected. */
  guestPaid: number
  margin: number
  /** Share of what the guest paid; null when nothing was. */
  marginPct: number | null
  /** Billed nothing: a forgotten price, or a bungalow we offered? */
  noPrice: boolean
  /** Below what a stay paid directly earns us (15 %). */
  lowMargin: boolean
}

/** By statement line key (`stay-<index in input.stays>`). */
export type StayInternals = Record<string, StayInternal>

export const stayLineKey = (index: number) => `stay-${index}`

export function stayInternal(s: StatementStay, sellPerNight: number): StayInternal {
  const nights = stayNights(s)
  if (s.paid_direct) {
    const { gross, toUs } = stayAmounts(s)
    return {
      bungalow: s.bungalow, direct: true, sellPerNight, nights, billed: 0, guestPaid: gross,
      margin: toUs, marginPct: gross > 0 ? PALMEIRAS_COMMISSION_PCT : null,
      noPrice: gross <= 0, lowMargin: false,
    }
  }
  const billed = r2(sellPerNight * nights)
  const margin = r2(billed - (s.cost_per_night ?? 0) * nights)
  const marginPct = billed > 0 ? Math.round(margin / billed * 1000) / 10 : null
  return {
    bungalow: s.bungalow, direct: false, sellPerNight, nights, billed, guestPaid: 0, margin, marginPct,
    noPrice: billed <= 0,
    lowMargin: marginPct !== null && marginPct < PALMEIRAS_COMMISSION_PCT,
  }
}

export interface InternalSummary {
  billed: number
  margin: number
  /** Margin over what BKC billed; null when a commission is in the sum: it was
   *  not earned on that billed amount, the percentage would mean nothing. */
  marginPct: number | null
  byBungalow: { bungalow: string; margin: number }[]
}

export function summarizeInternals(rows: (StayInternal | null | undefined)[]): InternalSummary {
  const real = rows.filter((r): r is StayInternal => !!r)
  const billed = r2(real.reduce((t, r) => t + r.billed, 0))
  const margin = r2(real.reduce((t, r) => t + r.margin, 0))
  const totals: Record<string, number> = {}
  for (const r of real) totals[r.bungalow] = r2((totals[r.bungalow] ?? 0) + r.margin)
  return {
    billed, margin,
    marginPct: billed > 0 && !real.some(r => r.direct) ? Math.round(margin / billed * 1000) / 10 : null,
    byBungalow: Object.entries(totals)
      .map(([bungalow, m]) => ({ bungalow, margin: m }))
      .sort((a, b) => a.bungalow.localeCompare(b.bungalow, 'en', { numeric: true })),
  }
}
