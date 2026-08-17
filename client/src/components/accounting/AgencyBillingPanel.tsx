import { useState } from 'react'
import type { SharedAccountingData, AccountingHandlers } from './types'
import type { Booking, AgencyBillingLine, AgencyRateItem } from '../../types/database'
import {
  computeAgencyTotals, agencyLineHoursUsed, getRoomNightlyRate, getLessonClientRate,
  countNights, fmtEur,
} from './utils'
import { fmtDateShort, todayISO } from '../../utils/dates'

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
  const [adding, setAdding] = useState(false)

  // Untagged booking → nothing to bill an agency for. The tag is set in the
  // booking wizard ("Referred by"), Phase 2.
  const agency = data.agencies.find(a => a.id === b.agency_id)
  if (!agency) return null
  // Bound here rather than reaching for `agency` inside the callbacks below:
  // narrowing from the guard above does not survive into a closure that runs
  // later, and a non-null assertion would only silence the compiler.
  const agencyId = agency.id

  const lines = data.agencyBillingLines
    .filter(l => l.booking_id === b.id)
    .sort((x, y) => x.id.localeCompare(y.id))
  const totals    = computeAgencyTotals(data, { bookingId: b.id })
  const rateItems = data.agencyRateItems.filter(r => r.agency_id === agency.id && r.is_active)
  const parts     = data.bookingParticipants.filter(p => p.booking_id === b.id)
  const nights    = countNights(b.check_in, b.check_out)

  const partName = (id: string | null) => {
    const p = parts.find(p => p.id === id)
    return p ? `${p.first_name} ${p.last_name ?? ''}`.trim() : null
  }

  const lineLabel = (l: AgencyBillingLine) => {
    const item = data.agencyRateItems.find(r => r.id === l.agency_rate_item_id)
    return item?.label ?? l.notes ?? 'Custom line'
  }

  // ── Every billable service on this booking, in one list ───────────────────
  const services: ServiceRow[] = [
    ...data.lessons.filter(l => l.booking_id === b.id).map(l => ({
      key: `lesson:${l.id}`,
      icon: '🪁',
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
      label: `Rental ${r.slot.replace('_', ' ')}`,
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
      invoiced_at: null,
      paid_at: null,
      notes: note.trim() || null,
    })
    setAdding(false)
  }

  const toggleStamp = (l: AgencyBillingLine, field: 'invoiced_at' | 'paid_at') =>
    handlers.updateAgencyBillingLine({ ...l, [field]: l[field] ? null : todayISO() })

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

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button onClick={() => toggleStamp(l, 'invoiced_at')}
                    className={`px-2 py-0.5 rounded text-xs font-medium ${l.invoiced_at
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                    {l.invoiced_at ? `✓ Invoiced ${stampDate(l.invoiced_at)}` : 'Mark invoiced'}
                  </button>
                  <button onClick={() => toggleStamp(l, 'paid_at')}
                    className={`px-2 py-0.5 rounded text-xs font-medium ${l.paid_at
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                    {l.paid_at ? `✓ Paid ${stampDate(l.paid_at)}` : 'Mark paid'}
                  </button>
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
          + Add billing line
        </button>
      )}

      {/* Who pays for what */}
      {services.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
            Services on this booking
            <span className="font-normal"> — {assignedCount} of {services.length} billed to {agency.name}</span>
          </p>
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
                  {lines.map(l => <option key={l.id} value={l.id}>{lineLabel(l)}{partName(l.participant_id) ? ` — ${partName(l.participant_id)}` : ''}</option>)}
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
  const [itemId, setItemId] = useState('')
  const [partId, setPartId] = useState('')
  const [price,  setPrice]  = useState('')
  const [hours,  setHours]  = useState('')
  const [note,   setNote]   = useState('')

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
    onAdd(item, partId || null, parseFloat(price) || 0, hours !== '' ? parseFloat(hours) : null, note)
  }

  return (
    <form onSubmit={submit} className="rounded-lg bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-900 p-3 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="text-xs text-gray-600 dark:text-gray-400">
          Rate card item
          <select value={itemId} onChange={e => pickItem(e.target.value)}
            className="mt-0.5 w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200">
            <option value="">— custom line —</option>
            {rateItems.map(r => (
              <option key={r.id} value={r.id}>
                {r.label} · {r.price} €{r.unit_hours != null ? ` · ${r.unit_hours}h` : ''}
              </option>
            ))}
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
          Price billed to the agency (€)
          <input type="number" min="0" step="1" required value={price} onChange={e => setPrice(e.target.value)}
            className="mt-0.5 w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200" />
        </label>
        <label className="text-xs text-gray-600 dark:text-gray-400">
          Package hours (lessons only)
          <input type="number" min="0" step="0.5" value={hours} onChange={e => setHours(e.target.value)}
            placeholder="e.g. 20 — leave empty for a transfer"
            className="mt-0.5 w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200" />
        </label>
      </div>
      <input type="text" value={note} onChange={e => setNote(e.target.value)}
        placeholder="Note (optional) — e.g. what the agency's invoice calls this line"
        className="w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200" />
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="px-3 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium">Cancel</button>
        <button type="submit"
          className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700">Add line</button>
      </div>
    </form>
  )
}
