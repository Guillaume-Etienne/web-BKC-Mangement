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
  stays: StatementStay[]
  rents: { month: string; amount: number; amount_mzn: number | null }[]
  adjustments: { month: string; gross_amount: number; percent: number; net_amount: number }[]
  entries: { month: string; type: 'income' | 'expense'; description: string; amount: number }[]
  card_payments: { booking_number: number | null; guest: string; date: string; amount: number }[]
  settlements: { id?: string; date: string; direction: 'us_to_palmeiras' | 'palmeiras_to_us'; amount: number; method: string | null }[]
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
  settlements: (StatementInput['settlements'][number] & { key: string })[]  // most recent first
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

function stayRef(s: Pick<StatementStay, 'booking_number' | 'guest'>): string {
  return [s.booking_number ? `#${s.booking_number}` : null, s.guest || null].filter(Boolean).join(' · ')
}

export function monthStart(month: string): string {
  return `${month}-01`
}

export function buildStatement(input: StatementInput, today: string = todayISO()): Statement {
  const lines: StatementLine[] = []
  const autoCommission: Record<string, number> = {}

  input.stays.forEach((s, i) => {
    const nights = stayNights(s)
    const month = s.check_in.slice(0, 7)
    const period = `${s.bungalow} · ${fmtDate(s.check_in)} → ${fmtDate(s.check_out)}`
    if (s.paid_direct) {
      const price = s.price_per_night ?? 0
      const commission = r2(price * nights * PALMEIRAS_COMMISSION_PCT / 100)
      autoCommission[month] = (autoCommission[month] ?? 0) + commission
      lines.push({
        key: `stay-${i}`, date: s.check_in, kind: 'stay_direct', provisional: s.provisional,
        title: `Commission ${PALMEIRAS_COMMISSION_PCT}% — ${stayRef(s)}`,
        detail: `${period} · guest paid the Palmeiras ${nights} night${nights === 1 ? '' : 's'} × ${fmtEurCents(price)} = ${fmtEurCents(price * nights)}`,
        toUs: commission, toPalmeiras: 0,
      })
    } else {
      const cost = s.cost_per_night ?? 0
      lines.push({
        key: `stay-${i}`, date: s.check_in, kind: 'stay_ours', provisional: s.provisional,
        title: `Bungalow rented through BKC — ${stayRef(s)}`,
        detail: `${period} · ${nights} night${nights === 1 ? '' : 's'} × ${fmtEurCents(cost)}`,
        toUs: 0, toPalmeiras: r2(cost * nights),
      })
    }
  })

  // A month's actual commission, when entered, replaces the 15 % computed per
  // stay; only the difference is shown, so each stay keeps its own line.
  for (const a of input.adjustments) {
    const diff = r2(a.net_amount - (autoCommission[a.month] ?? 0))
    if (Math.abs(diff) < 0.01) continue
    lines.push({
      key: `adj-${a.month}`, date: monthStart(a.month), kind: 'adjustment', provisional: false,
      title: 'Commission adjustment (exchange rate)',
      detail: `Actual commission for the month: ${a.percent}% of ${fmtEurCents(a.gross_amount)} = ${fmtEurCents(a.net_amount)}`,
      toUs: diff > 0 ? diff : 0, toPalmeiras: diff < 0 ? -diff : 0,
    })
  }

  for (const r of input.rents) {
    lines.push({
      key: `rent-${r.month}`, date: monthStart(r.month), kind: 'rent', provisional: false,
      title: 'Monthly rent',
      detail: r.amount_mzn ? `${Math.round(r.amount_mzn).toLocaleString('en-US')} MZN` : '',
      toUs: 0, toPalmeiras: r2(r.amount),
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
      key: `entry-${i}`, date: monthStart(e.month), kind: 'entry', provisional: false,
      title: e.description, detail: '',
      toUs: e.type === 'income' ? r2(e.amount) : 0,
      toPalmeiras: e.type === 'expense' ? r2(e.amount) : 0,
    })
  })

  // A stay counts once it has begun, a rent once its month has come: a booking
  // for next month must not weigh on the balance settled today.
  const isUpcoming = (l: StatementLine) =>
    ((l.kind === 'stay_ours' || l.kind === 'stay_direct') && l.date > today)
    || (l.kind === 'rent' && l.date.slice(0, 7) > today.slice(0, 7))
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
      .map((s, i) => ({ ...s, key: `set-${i}` }))
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
