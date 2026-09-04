import { useState } from 'react'
import type { BookingStatus, Client } from '../../types/database'
import { fmtEur } from './utils'
import { todayISO, fmtDate } from '../../utils/dates'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'
import type { Tr } from '../../data/i18n/types'

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

const GROUPS: { key: GroupKey; label: Tr; hint: Tr; dot: string }[] = [
  { key: 'here',     label: i18n.accounting.cm_group_here,     hint: i18n.accounting.cm_hint_here,     dot: 'bg-red-500' },
  { key: 'departed', label: i18n.accounting.cm_group_departed, hint: i18n.accounting.cm_hint_departed, dot: 'bg-amber-500' },
  { key: 'upcoming', label: i18n.accounting.cm_group_upcoming, hint: i18n.accounting.cm_hint_upcoming, dot: 'bg-blue-400' },
]

const STATUS_COLORS: Record<BookingStatus, string> = {
  confirmed:   'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  provisional: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  cancelled:   'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
}

export default function CollectionsModal({ rows, clients, onClose, onOpenBooking }: Props) {
  const { lang } = useLanguage()
  const today = todayISO()

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
        className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b">
          <div>
            <h3 className="font-bold text-gray-800 dark:text-gray-200">{i18n.accounting.cm_title[lang]}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {i18n.accounting.cm_to_collect_across[lang].replace('{amount}', fmtEur(grandTotal)).replace('{count}', String(rows.length)).replace('{s}', rows.length !== 1 ? 's' : '')}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-xl font-bold">✕</button>
        </div>

        <div className="overflow-y-auto p-4 space-y-3">
          {GROUPS.map(g => {
            const list = groups[g.key]
            const subtotal = list.reduce((s, r) => s + r.due, 0)
            return (
              <div key={g.key} className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggle(g.key)}
                  className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-left"
                >
                  <span className="text-gray-400 dark:text-gray-400 text-xs w-3">{open[g.key] ? '▾' : '▸'}</span>
                  <span className={`w-2 h-2 rounded-full ${g.dot}`} />
                  <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">{g.label[lang]}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-400">— {g.hint[lang]}</span>
                  <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">{i18n.accounting.cm_booking_count[lang].replace('{count}', String(list.length))}</span>
                  <span className="font-bold text-sm text-amber-700 dark:text-amber-400 w-20 text-right">{fmtEur(subtotal)}</span>
                </button>

                {open[g.key] && (
                  list.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-gray-400 dark:text-gray-400">{i18n.accounting.cm_nothing_to_collect[lang]}</p>
                  ) : (
                    <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                      {list.map(r => {
                        const c = contact(r.client_id)
                        return (
                          <li key={r.id}>
                            <button
                              onClick={onOpenBooking ? () => { onOpenBooking(r.id); onClose() } : undefined}
                              className={`w-full px-4 py-2.5 flex items-center gap-3 text-left ${onOpenBooking ? 'hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer' : 'cursor-default'}`}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                                  {onOpenBooking && <span className="text-gray-300 dark:text-gray-500 mr-1">↗</span>}
                                  {r.client ? `${r.client.first_name} ${r.client.last_name}` : '—'}
                                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status]}`}>{r.status}</span>
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {fmtDate(r.check_in)} → {fmtDate(r.check_out)}
                                  {c?.phone && <span className="ml-2">📞 {c.phone}</span>}
                                  {c?.email && <span className="ml-2">✉️ {c.email}</span>}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-bold text-amber-700 dark:text-amber-400">{fmtEur(r.due)}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-400">{i18n.accounting.cm_paid_of_total[lang].replace('{paid}', fmtEur(r.paid)).replace('{total}', fmtEur(r.total))}</p>
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
