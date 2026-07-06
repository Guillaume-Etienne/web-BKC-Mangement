import { useState } from 'react'
import type { BookingStatus, Client } from '../../types/database'
import { fmtEur } from './utils'

// Row shape produced by AccountingDashboard's bookingFinances (booking + finance fields)
export interface UnpaidRow {
  id: string
  check_in: string
  check_out: string
  status: BookingStatus
  client_id: string | null
  client?: { first_name: string; last_name: string } | null
  total: number
  paid: number
  due: number
}

interface Props {
  rows: UnpaidRow[]        // all bookings with due > 0
  clients: Client[]        // full table (admin) — phone/email lookup
  onClose: () => void
  onOpenBooking?: (id: string) => void
}

type GroupKey = 'here' | 'departed' | 'upcoming'

const GROUPS: { key: GroupKey; label: string; hint: string; dot: string }[] = [
  { key: 'here',     label: 'Currently here', hint: 'collect before checkout', dot: 'bg-red-500' },
  { key: 'departed', label: 'Departed',       hint: 'to chase',                dot: 'bg-amber-500' },
  { key: 'upcoming', label: 'Upcoming',       hint: 'not due yet',             dot: 'bg-blue-400' },
]

const STATUS_COLORS: Record<BookingStatus, string> = {
  confirmed:   'bg-emerald-100 text-emerald-700',
  provisional: 'bg-amber-100 text-amber-700',
  cancelled:   'bg-gray-100 text-gray-500',
}

export default function CollectionsModal({ rows, clients, onClose, onOpenBooking }: Props) {
  const today = new Date().toISOString().slice(0, 10)

  const groups: Record<GroupKey, UnpaidRow[]> = {
    // most urgent first: leaving soonest / departed longest ago / arriving soonest
    here:     rows.filter(r => r.check_in <= today && r.check_out >= today)
                  .sort((a, b) => a.check_out.localeCompare(b.check_out)),
    departed: rows.filter(r => r.check_out < today)
                  .sort((a, b) => a.check_out.localeCompare(b.check_out)),
    upcoming: rows.filter(r => r.check_in > today)
                  .sort((a, b) => a.check_in.localeCompare(b.check_in)),
  }

  // Upcoming collapsed by default: no action needed there yet
  const [open, setOpen] = useState<Record<GroupKey, boolean>>({ here: true, departed: true, upcoming: false })
  const toggle = (k: GroupKey) => setOpen(o => ({ ...o, [k]: !o[k] }))

  const grandTotal = rows.reduce((s, r) => s + r.due, 0)
  const contact = (clientId: string | null) => clients.find(c => c.id === clientId)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b">
          <div>
            <h3 className="font-bold text-gray-800">Outstanding collections</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {fmtEur(grandTotal)} to collect across {rows.length} booking{rows.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-xl font-bold">✕</button>
        </div>

        <div className="overflow-y-auto p-4 space-y-3">
          {GROUPS.map(g => {
            const list = groups[g.key]
            const subtotal = list.reduce((s, r) => s + r.due, 0)
            return (
              <div key={g.key} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggle(g.key)}
                  className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left"
                >
                  <span className="text-gray-400 text-xs w-3">{open[g.key] ? '▾' : '▸'}</span>
                  <span className={`w-2 h-2 rounded-full ${g.dot}`} />
                  <span className="font-semibold text-sm text-gray-800">{g.label}</span>
                  <span className="text-xs text-gray-400">— {g.hint}</span>
                  <span className="ml-auto text-xs text-gray-500">{list.length} booking{list.length !== 1 ? 's' : ''}</span>
                  <span className="font-bold text-sm text-amber-700 w-20 text-right">{fmtEur(subtotal)}</span>
                </button>

                {open[g.key] && (
                  list.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-gray-400">Nothing to collect here 🎉</p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {list.map(r => {
                        const c = contact(r.client_id)
                        return (
                          <li key={r.id}>
                            <button
                              onClick={onOpenBooking ? () => { onOpenBooking(r.id); onClose() } : undefined}
                              className={`w-full px-4 py-2.5 flex items-center gap-3 text-left ${onOpenBooking ? 'hover:bg-blue-50 cursor-pointer' : 'cursor-default'}`}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">
                                  {onOpenBooking && <span className="text-gray-300 mr-1">↗</span>}
                                  {r.client ? `${r.client.first_name} ${r.client.last_name}` : '—'}
                                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status]}`}>{r.status}</span>
                                </p>
                                <p className="text-xs text-gray-500 truncate">
                                  {r.check_in} → {r.check_out}
                                  {c?.phone && <span className="ml-2">📞 {c.phone}</span>}
                                  {c?.email && <span className="ml-2">✉️ {c.email}</span>}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-bold text-amber-700">{fmtEur(r.due)}</p>
                                <p className="text-xs text-gray-400">{fmtEur(r.paid)} / {fmtEur(r.total)} paid</p>
                              </div>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
