import { useState } from 'react'
import type { SharedAccountingData, AccountingHandlers } from './types'
import type { Booking, AgencyBillingLine, AgencyRateItem } from '../../types/database'
import { AGENCY_RATE_CATEGORIES, compareRateItems } from '../../types/database'
import {
  computeAgencyTotals, agencyLineHoursUsed, agencyPackageHours, agencyHoursPool, getRoomNightlyRate, getLessonClientRate,
  countNights, fmtEur, nextInvoiceNumber, buildAgencyInvoiceDoc,
} from './utils'
import { printAgencyInvoice } from '../../utils/printAgencyInvoice'
import AgencyHoursGauge from '../common/AgencyHoursGauge'
import { rentalKind, rentalLabel } from '../planning/rentalTypes'
import { fmtDateShort, todayISO } from '../../utils/dates'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'

/** One thing the centre delivered, which is billed either to the guest or to the
 *  agency that sent them. The four sources (lessons, rentals, transfers, rooms)
 *  live in four tables with four different keys, so they are normalised here —
 *  the panel below only ever deals with this shape. */
interface ServiceRow {
  key: string
  icon: string
  label: string
  detail: string
  clientAmount: number       // what the guest would be charged, for context
  lineId: string | null
  assign: (lineId: string | null) => void
}

/** `invoiced_at`/`paid_at` are timestamps, and come back from Postgres with a
 *  time part; the day is all this screen shows. Slicing first keeps fmtDateShort
 *  on the plain YYYY-MM-DD it is documented to take. */
const stampDate = (ts: string) => fmtDateShort(ts.slice(0, 10))

interface Props {
  booking: Booking
  data: SharedAccountingData
  handlers: AccountingHandlers
}

export default function AgencyBillingPanel({ booking: b, data, handlers }: Props) {
  const { lang } = useLanguage()
  const [adding, setAdding] = useState(false)
  const [fillNote, setFillNote] = useState<string | null>(null)

  // Untagged booking → nothing to bill an agency for. The tag is set in the
  // booking wizard ("Referred by"), Phase 2.
  const agency = data.agencies.find(a => a.id === b.agency_id)
  if (!agency) return null
  // Bound here rather than reaching for `agency` inside the callbacks below:
  // narrowing from the guard above does not survive into a closure that runs
  // later, and a non-null assertion would only silence the compiler.
  const agencyId = agency.id
  const agencyShortCode = agency.short_code

  const lines = data.agencyBillingLines
    .filter(l => l.booking_id === b.id)
    .sort((x, y) => x.id.localeCompare(y.id))
  const totals    = computeAgencyTotals(data, { bookingId: b.id })
  // One invoice per booking (gui). If a second ever exists — a service added
  // after the first went out — the most recent one is the one being worked on.
  const invoice = data.agencyInvoices
    .filter(i => i.booking_id === b.id && i.agency_id === agencyId)
    .sort((x, y) => y.invoice_number.localeCompare(x.invoice_number))[0] ?? null
  const invoicedLines = invoice ? lines.filter(l => l.agency_invoice_id === invoice.id) : []
  const rateItems = data.agencyRateItems.filter(r => r.agency_id === agency.id && r.is_active)
  const parts     = data.bookingParticipants.filter(p => p.booking_id === b.id)
  const nights    = countNights(b.check_in, b.check_out)

  const partName = (id: string | null) => {
    const p = parts.find(p => p.id === id)
    return p ? `${p.first_name} ${p.last_name ?? ''}`.trim() : null
  }

  const lineLabel = (l: AgencyBillingLine) => {
    const item = data.agencyRateItems.find(r => r.id === l.agency_rate_item_id)
    return item?.label ?? l.notes ?? i18n.accounting.abp_custom_line[lang]
  }

  // ── Every billable service on this booking, in one list ───────────────────
  const services: ServiceRow[] = [
    ...data.lessons.filter(l => l.booking_id === b.id).map(l => ({
      key: `lesson:${l.id}`,
      icon: '🪂',
      label: `${l.type} ${l.duration_hours}h`,
      detail: `${fmtDateShort(l.date)} · ${l.participant_ids.map(partName).filter(Boolean).join(', ') || '—'}`,
      clientAmount: getLessonClientRate(l, data.priceItems, {
        tiers: data.priceTiers, allLessons: data.lessons, bookingParticipants: data.bookingParticipants,
      }) * l.duration_hours * (l.type === 'group' ? l.participant_ids.length : 1),
      lineId: l.agency_billing_line_id ?? null,
      assign: (lineId: string | null) => handlers.setLessonAgencyLine(l.id, lineId),
    })),
    ...data.equipmentRentals.filter(r => r.booking_id === b.id).map(r => ({
      key: `rental:${r.id}`,
      icon: '🎿',
      label: `${rentalLabel(rentalKind(r, data.equipment), 'staff')} ${r.slot.replace('_', ' ')}`,
      detail: `${fmtDateShort(r.date)} · ${partName(r.participant_id) ?? '—'}`,
      clientAmount: r.price,
      lineId: r.agency_billing_line_id ?? null,
      assign: (lineId: string | null) => handlers.setRentalAgencyLine(r.id, lineId),
    })),
    ...data.taxiTrips.filter(t => t.booking_id === b.id).map(t => ({
      key: `taxi:${t.id}`,
      icon: '🚕',
      label: t.type.replace(/-/g, ' '),
      detail: `${fmtDateShort(t.date)} · ${t.nb_persons} pax`,
      clientAmount: t.price_eur,
      lineId: t.agency_billing_line_id ?? null,
      assign: (lineId: string | null) => handlers.setTaxiAgencyLine(t.id, lineId),
    })),
    ...data.bookingRooms.filter(br => br.booking_id === b.id).map(br => {
      const room = data.rooms.find(r => r.id === br.room_id)
      const acc  = room ? data.accommodations.find(a => a.id === room.accommodation_id) : null
      const snap = data.bookingRoomPrices.find(p => p.booking_id === b.id && p.room_id === br.room_id)
      return {
        key: `room:${br.room_id}`,
        icon: '🏠',
        label: acc ? `${acc.name}/${room?.name}` : (room?.name ?? br.room_id),
        detail: `${nights} nights`,
        clientAmount: getRoomNightlyRate(b.id, br.room_id, data) * nights,
        lineId: snap?.agency_billing_line_id ?? null,
        assign: (lineId: string | null) => handlers.setRoomAgencyLine(b.id, br.room_id, lineId),
      }
    }),
  ]

  const assignedCount = services.filter(s => s.lineId).length

  // ── Lesson packages as one pool of hours (gui, 2026-10-23) ───────────────
  // "2× 4h" sold by the agency = 8h, whoever takes them and whatever the
  // discipline; past that, the guest pays. Filled in date order.
  const packageLines = lines.filter(l => l.unit_hours != null)
  const pool = agencyHoursPool(b.id, agencyPackageHours(b.id, lines), data.lessons)
  const hoursLeft = (l: AgencyBillingLine) => (l.unit_hours ?? 0) - agencyLineHoursUsed(l.id, data.lessons)
  const pendingLessons = data.lessons
    .filter(l => l.booking_id === b.id && !l.agency_billing_line_id)
    .sort((x, y) => `${x.date} ${x.start_time}`.localeCompare(`${y.date} ${y.start_time}`))

  function fillPackages() {
    const left = new Map(packageLines.map(l => [l.id, hoursLeft(l)]))
    let moved = 0
    for (const lesson of pendingLessons) {
      const target = packageLines.find(l => (left.get(l.id) ?? 0) >= lesson.duration_hours)
      // Stop at the first lesson that does not fit rather than skip it: a later,
      // shorter lesson jumping the queue would bill the guest out of order.
      // A lesson straddling the limit cannot be split — gui decides by hand.
      if (!target) {
        const remaining = [...left.values()].reduce((s, h) => s + h, 0)
        setFillNote(remaining > 0
          ? `${moved} lesson(s) moved. Next one (${fmtDateShort(lesson.date)}, ${lesson.duration_hours}h) does not fit in the ${remaining}h left — assign it by hand, or leave it to the guest.`
          : `${moved} lesson(s) moved. Packages are full: the rest is billed to the guest.`)
        return
      }
      left.set(target.id, (left.get(target.id) ?? 0) - lesson.duration_hours)
      handlers.setLessonAgencyLine(lesson.id, target.id)
      moved++
    }
    setFillNote(`${moved} lesson(s) moved onto the packages.`)
  }

  function addLine(item: AgencyRateItem | null, participantId: string | null, price: number, hours: number | null, note: string) {
    handlers.addAgencyBillingLine({
      id: crypto.randomUUID(),
      booking_id: b.id,
      agency_id: agencyId,
      participant_id: participantId,
      agency_rate_item_id: item?.id ?? null,
      // Frozen at creation, like every other price snapshot in the app: retouching
      // the agency's catalogue next season must not re-price an old invoice.
      price,
      unit_hours: hours,
      // Straight onto the invoice when one is already open, so a service added
      // after the fact is not silently left off the document. Onto nothing when
      // there is no invoice yet — the normal case when lines are entered first.
      agency_invoice_id: invoice && !invoice.invoiced_at ? invoice.id : null,
      invoiced_at: null,
      paid_at: null,
      notes: note.trim() || null,
    })
    setAdding(false)
  }

  const toggleInvoiceStamp = (field: 'invoiced_at' | 'paid_at') => {
    if (!invoice) return
    handlers.updateAgencyInvoice({ ...invoice, [field]: invoice[field] ? null : todayISO() })
  }

  /** Draw up the invoice: a number, today's date, and every line of this booking
   *  swept onto it. One invoice per booking is gui's rule, so there is nothing to
   *  choose here — the only decision left is the agency's own reference, typed in
   *  afterwards when they give it. */
  function createInvoice() {
    const issued = todayISO()
    // One call: the handler inserts the invoice, THEN attaches the lines. Doing it
    // as two calls here raced the foreign key and failed (see createAgencyInvoice).
    handlers.createAgencyInvoice({
      id: crypto.randomUUID(),
      agency_id: agencyId,
      booking_id: b.id,
      invoice_number: nextInvoiceNumber(issued, data.agencyInvoices.map(i => i.invoice_number)),
      agency_ref: null,
      issued_on: issued,
      invoiced_at: null,
      paid_at: null,
      notes: null,
    }, lines.filter(l => !l.agency_invoice_id).map(l => l.id))
  }

  function removeInvoice() {
    if (!invoice) return
    if (confirm(
      `Delete invoice ${invoice.invoice_number}?\n\n` +
      `Its ${invoicedLines.length} line${invoicedLines.length > 1 ? 's' : ''} stay — they go back to ` +
      `"not invoiced". What the agency owes is not cancelled.`
    )) handlers.deleteAgencyInvoice(invoice.id)
  }

  /** Printed from the freshly built document, never from what the screen happens
   *  to be showing — the labels and the commission come from the tested builder. */
  function printInvoice() {
    if (!invoice) return
    const doc = buildAgencyInvoiceDoc(invoice.id, data)
    if (!doc) { alert('This invoice carries no line yet — nothing to print.'); return }
    printAgencyInvoice(doc, agencyShortCode)
  }

  function removeLine(l: AgencyBillingLine) {
    const attached = services.filter(s => s.lineId === l.id).length
    const warning = attached > 0
      ? `\n\n${attached} service${attached > 1 ? 's' : ''} attached to it will go back to being billed to the client.`
      : ''
    if (confirm(`Delete "${lineLabel(l)}" (${fmtEur(l.price)})?${warning}`)) handlers.deleteAgencyBillingLine(l.id)
  }

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 space-y-4">

      {/* Header */}
      <div className="flex flex-wrap justify-between items-baseline gap-2">
        <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">
          🤝 Agency billing — {agency.name}
          <span className="font-normal text-indigo-500 dark:text-indigo-400"> · {agency.commission_percent}% commission</span>
        </p>
        <p className="text-xs text-indigo-600 dark:text-indigo-400">
          Gross {fmtEur(totals.gross)} · Commission −{fmtEur(totals.commission)} · <span className="font-semibold">Net {fmtEur(totals.net)}</span>
        </p>
      </div>

      {/* Lesson packages as one pool (2026-10-24) — what the guest sees on their page too */}
      {pool && (
        <div className="rounded-lg bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-900 px-3 py-2 space-y-1.5">
          <AgencyHoursGauge pool={pool} agencyName={agency.name} />
          {pool.extra > 0 && pool.left > 0 && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400">
              ⚠️ {pool.extra} h of lessons are billed to the guest while the package still has {pool.left} h left —
              use ⚡ Fill packages below, or attach them by hand.
            </p>
          )}
        </div>
      )}

      {/* ── The invoice document (2026-08-19) ────────────────────────────────
          Lines say what is owed; this says what was sent. Creating it stamps a
          number and sweeps every line of this booking onto it — one invoice per
          booking, gui's rule. */}
      {lines.length > 0 && (
        <div className="rounded-lg bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-900 px-3 py-2 space-y-2">
          {!invoice ? (
            <button onClick={createInvoice}
              className="text-xs font-medium px-2.5 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700">
              🧾 Create the invoice
            </button>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  🧾 Invoice {invoice.invoice_number}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  issued {fmtDateShort(invoice.issued_on)}
                </span>
                <button onClick={() => printInvoice()}
                  className="ml-auto text-xs font-medium px-2.5 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700">
                  🖨️ Print (FR)
                </button>
              </div>

              {/* The agency's own reference — Fun & Fly hands it to us and expects
                  to read it back on the invoice ("ref F&Fly : 134606"). */}
              <label className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                Agency ref
                <input
                  type="text"
                  defaultValue={invoice.agency_ref ?? ''}
                  placeholder="e.g. 134606"
                  onBlur={e => {
                    const v = e.target.value.trim()
                    if (v !== (invoice.agency_ref ?? '')) {
                      handlers.updateAgencyInvoice({ ...invoice, agency_ref: v || null })
                    }
                  }}
                  className="px-2 py-1 w-32 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200"
                />
                {!invoice.agency_ref && (
                  <span className="text-amber-600 dark:text-amber-400">not provided yet</span>
                )}
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => toggleInvoiceStamp('invoiced_at')}
                  className={`px-2 py-0.5 rounded text-xs font-medium ${invoice.invoiced_at
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                  {invoice.invoiced_at ? `✓ Sent ${stampDate(invoice.invoiced_at)}` : i18n.accounting.abp_mark_sent[lang]}
                </button>
                <button onClick={() => toggleInvoiceStamp('paid_at')}
                  className={`px-2 py-0.5 rounded text-xs font-medium ${invoice.paid_at
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                  {invoice.paid_at ? `✓ Paid ${stampDate(invoice.paid_at)}` : i18n.accounting.abp_mark_paid[lang]}
                </button>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {invoicedLines.length} of {lines.length} line{lines.length > 1 ? 's' : ''} on it
                </span>
                <button onClick={removeInvoice}
                  className="ml-auto text-xs text-gray-400 hover:text-red-500"
                  title="Delete this invoice — the lines stay, they simply go back to 'not invoiced'">🗑</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Invoice lines */}
      {lines.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 italic">
          No invoice line yet — everything below is billed to the guest. Add a line from {agency.name}'s
          rate card to move services onto their invoice.
        </p>
      ) : (
        <div className="space-y-2">
          {lines.map(l => {
            const used = agencyLineHoursUsed(l.id, data.lessons)
            const pct  = l.unit_hours ? Math.min(100, Math.round(used / l.unit_hours * 100)) : 0
            const over = l.unit_hours != null && used > l.unit_hours
            return (
              <div key={l.id} className="rounded-lg bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900/60 px-3 py-2">
                <div className="flex flex-wrap justify-between items-baseline gap-x-3 gap-y-1">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {lineLabel(l)}
                    {partName(l.participant_id) && (
                      <span className="font-normal text-gray-500 dark:text-gray-400"> — {partName(l.participant_id)}</span>
                    )}
                  </span>
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{fmtEur(l.price)}</span>
                </div>

                {/* Package progress — hours only exist on lesson packages */}
                {l.unit_hours != null && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                      <div className={`h-full rounded-full ${over ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={`text-xs tabular-nums ${over ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                      {used}h / {l.unit_hours}h{over ? ' ⚠' : ''}
                    </span>
                  </div>
                )}

                {/* Stamps live on the invoice now, not here (2026-08-19): one
                    settles an invoice. All a line says is whether it is on one. */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {invoice && l.agency_invoice_id === invoice.id ? (
                    <button onClick={() => handlers.updateAgencyBillingLine({ ...l, agency_invoice_id: null })}
                      title="Take this line off the invoice"
                      className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                      🧾 on invoice {invoice.invoice_number}
                    </button>
                  ) : invoice ? (
                    <button onClick={() => handlers.updateAgencyBillingLine({ ...l, agency_invoice_id: invoice.id })}
                      className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700">
                      + add to invoice {invoice.invoice_number}
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-gray-500 italic">{i18n.accounting.abp_not_invoiced_yet[lang]}</span>
                  )}
                  {l.notes && <span className="text-xs text-gray-400 dark:text-gray-500 italic">{l.notes}</span>}
                  <button onClick={() => removeLine(l)}
                    className="ml-auto text-xs text-gray-400 hover:text-red-500" title="Delete this line">🗑</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add a line */}
      {adding ? (
        <AddLineForm rateItems={rateItems} participants={parts} onAdd={addLine} onCancel={() => setAdding(false)} />
      ) : (
        <button onClick={() => setAdding(true)}
          className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium">
          {i18n.accounting.abp_add_billing_line[lang]}
        </button>
      )}

      {/* Who pays for what */}
      {services.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
            Services on this booking
            <span className="font-normal"> — {assignedCount} of {services.length} billed to {agency.name}</span>
          </p>
          {packageLines.length > 0 && pendingLessons.length > 0 && (
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <button onClick={fillPackages}
                title="Moves the guest's lessons, oldest first, onto the lesson packages until their hours run out"
                className="text-xs px-2.5 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 font-medium">
                ⚡ Fill packages ({packageLines.reduce((s, l) => s + hoursLeft(l), 0)}h left)
              </button>
            </div>
          )}
          {fillNote && <p className="mb-1.5 text-xs text-indigo-600 dark:text-indigo-400">{fillNote}</p>}
          <div className="space-y-1">
            {services.map(s => (
              <div key={s.key} className={`flex flex-wrap items-center gap-2 px-2 py-1 rounded text-xs ${
                s.lineId ? 'bg-indigo-100/60 dark:bg-indigo-900/30' : 'bg-white dark:bg-gray-900'}`}>
                <span>{s.icon}</span>
                <span className="text-gray-700 dark:text-gray-300 capitalize">{s.label}</span>
                <span className="text-gray-400 dark:text-gray-500">{s.detail}</span>
                <span className={`ml-auto tabular-nums ${s.lineId ? 'text-gray-400 line-through' : 'text-gray-600 dark:text-gray-400'}`}>
                  {fmtEur(s.clientAmount)}
                </span>
                <select
                  value={s.lineId ?? ''}
                  onChange={e => s.assign(e.target.value || null)}
                  disabled={lines.length === 0}
                  className="px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs text-gray-700 dark:text-gray-300 disabled:opacity-50 max-w-[14rem]"
                >
                  <option value="">— billed to guest —</option>
                  {lines.map(l => <option key={l.id} value={l.id}>{lineLabel(l)}{partName(l.participant_id) ? ` — ${partName(l.participant_id)}` : ''}{l.unit_hours != null ? ` · ${hoursLeft(l)}h left` : ''}</option>)}
                </select>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 italic">
            A service moved onto an invoice line stops being charged to the guest — its price
            disappears from the breakdown above, and the agency's own catalogue price applies instead.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Add line form ───────────────────────────────────────────────────────────

interface AddLineFormProps {
  rateItems: AgencyRateItem[]
  participants: { id: string; first_name: string; last_name: string | null }[]
  onAdd: (item: AgencyRateItem | null, participantId: string | null, price: number, hours: number | null, note: string) => void
  onCancel: () => void
}

function AddLineForm({ rateItems, participants, onAdd, onCancel }: AddLineFormProps) {
  const { lang } = useLanguage()
  const [itemId, setItemId] = useState('')
  const [partId, setPartId] = useState('')
  const [price,  setPrice]  = useState('')
  const [hours,  setHours]  = useState('')
  const [note,   setNote]   = useState('')
  // Rate-card items priced "per person per day" (storage): the line stores the
  // total, and the note — printed as the invoice label — says how it was reached.
  const [qty,    setQty]    = useState('1')

  // Picking from the rate card prefills price and package size; both stay
  // editable, because a real invoice sometimes departs from the catalogue.
  function pickItem(id: string) {
    setItemId(id)
    const item = rateItems.find(r => r.id === id)
    if (item) {
      setPrice(String(item.price))
      setHours(item.unit_hours != null ? String(item.unit_hours) : '')
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const item = rateItems.find(r => r.id === itemId) ?? null
    const unit = parseFloat(price) || 0
    const n = parseFloat(qty) || 1
    const label = note.trim() || (n !== 1 ? `${item?.label ?? 'Prestation'} — ${n} × ${unit} €` : '')
    onAdd(item, partId || null, unit * n, hours !== '' ? parseFloat(hours) : null, label)
  }

  const total = (parseFloat(price) || 0) * (parseFloat(qty) || 1)

  return (
    <form onSubmit={submit} className="rounded-lg bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-900 p-3 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="text-xs text-gray-600 dark:text-gray-400">
          Rate card item
          <select value={itemId} onChange={e => pickItem(e.target.value)}
            className="mt-0.5 w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200">
            <option value="">— custom line —</option>
            {/* Grouped: a full rate card runs to 30+ rows, and picking one from a
                flat list means scrolling past every other category. A service the
                catalogue does not cover still goes in as a custom line above. */}
            {AGENCY_RATE_CATEGORIES.map(cat => {
              const rows = rateItems.filter(r => r.category === cat.key).sort(compareRateItems)
              if (rows.length === 0) return null
              return (
                <optgroup key={cat.key} label={`${cat.icon} ${cat.label}`}>
                  {rows.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.label} · {r.price} €{r.unit_hours != null ? ` · ${r.unit_hours}h` : ''}
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </select>
        </label>
        <label className="text-xs text-gray-600 dark:text-gray-400">
          For whom (optional)
          <select value={partId} onChange={e => setPartId(e.target.value)}
            className="mt-0.5 w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200">
            <option value="">— whole booking —</option>
            {participants.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name ?? ''}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-600 dark:text-gray-400">
          Unit price billed to the agency (€)
          <input type="number" min="0" step="0.01" required value={price} onChange={e => setPrice(e.target.value)}
            className="mt-0.5 w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200" />
        </label>
        <label className="text-xs text-gray-600 dark:text-gray-400">
          Quantity (e.g. days of storage)
          <input type="number" min="0.5" step="0.5" required value={qty} onChange={e => setQty(e.target.value)}
            className="mt-0.5 w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200" />
          {qty !== '1' && <span className="block mt-0.5 text-indigo-600 dark:text-indigo-400">= {fmtEur(total)}</span>}
        </label>
        <label className="text-xs text-gray-600 dark:text-gray-400">
          Package hours (lessons only)
          <input type="number" min="0" step="0.5" value={hours} onChange={e => setHours(e.target.value)}
            placeholder="e.g. 20 — leave empty for a transfer"
            className="mt-0.5 w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200" />
        </label>
      </div>
      <input type="text" value={note} onChange={e => setNote(e.target.value)}
        placeholder="Invoice label (optional) — replaces the rate-card label on the printed invoice"
        className="w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200" />
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="px-3 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium">{i18n.common.btn_cancel[lang]}</button>
        <button type="submit"
          className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700">{i18n.accounting.abp_add_line_btn[lang]}</button>
      </div>
    </form>
  )
}
