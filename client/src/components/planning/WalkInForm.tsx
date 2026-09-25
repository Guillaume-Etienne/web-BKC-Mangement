import { useMemo, useState } from 'react'
import type { Booking, BookingParticipant, Client, Equipment, Instructor, Lesson, LessonType, PaymentMethod, PriceItem, PriceTier, RentalSlot } from '../../types/database'
import { rentalBillable } from '../../types/database'
import { currentInstructorRate, resolveLessonRate } from '../accounting/utils'
import { searchClients, suggestedLessonRate, visitsOf, findVisitOn } from '../../utils/dayVisitor'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'
import { RENTAL_TYPES, type RentalKind } from './rentalTypes'
import type { WalkInRequest } from './walkInSave'

/** The walk-in form (Daily tab → "🚶 Walk-in"): one screen to go from "a local
 *  just showed up" to a saved lesson or rental, in about 30 seconds.
 *
 *  Picks an existing client (search by name or WhatsApp digits) or creates one
 *  with the bare minimum. The booking behind the visit is never shown: it is
 *  created — or reused, if the same person already came earlier that day — by
 *  `saveWalkIn`. Design: `.claude/docs/WALK_INS.md`.
 *
 *  Defined at module scope (never inside a parent's render) so inputs keep
 *  their focus while typing. */

const PAYMENT_METHODS: PaymentMethod[] = ['cash_eur', 'cash_mzn', 'transfer', 'card_palmeiras']
const DURATION_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3]
/** Temporary id standing for the client in the tier lookup, so the official
 *  price already counts the hours of their earlier visits. Never saved. */
const PROBE_PARTICIPANT = '__walkin_probe__'

interface WalkInFormProps {
  date: string
  defaultTime: string
  defaultRentalSlot: RentalSlot
  clients: Client[]
  bookings: Booking[]
  bookingParticipants: BookingParticipant[]
  lessons: Lesson[]
  instructors: Instructor[]
  equipment: Equipment[]
  priceItems: PriceItem[]
  priceTiers: PriceTier[]
  onSubmit: (req: WalkInRequest) => Promise<boolean>
  onClose: () => void
}

const inputCls = 'w-full text-sm border rounded px-2 py-2 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700'
const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

export default function WalkInForm(props: WalkInFormProps) {
  const { date, defaultTime, defaultRentalSlot, clients, bookings, bookingParticipants, lessons, instructors, equipment, priceItems, priceTiers, onSubmit, onClose } = props
  const { lang } = useLanguage()
  const t = i18n.planning

  // ── Who ────────────────────────────────────────────────────────────────────
  const [query, setQuery] = useState('')
  const [clientId, setClientId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newClient, setNewClient] = useState({ first_name: '', last_name: '', phone: '', email: '', rate: '' })
  const [waiverSigned, setWaiverSigned] = useState(false)

  const matches = useMemo(() => searchClients(clients, query), [clients, query])
  const client = clientId ? clients.find(c => c.id === clientId) : undefined
  const visitCount = client ? visitsOf(bookings, client.id).length : 0
  const sameDayVisit = client ? findVisitOn(bookings, bookingParticipants, client.id, date) : null

  // ── What ───────────────────────────────────────────────────────────────────
  const [what, setWhat] = useState<'lesson' | 'rental'>('lesson')
  const [type, setType] = useState<LessonType>('private')
  const [instructorId, setInstructorId] = useState(instructors[0]?.id ?? '')
  const [startTime, setStartTime] = useState(defaultTime)
  const [duration, setDuration] = useState(1)
  const [kiteId, setKiteId] = useState<string | null>(null)
  const [boardId, setBoardId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [rentalType, setRentalType] = useState<RentalKind>('kite')
  const [rentalSlot, setRentalSlot] = useState<RentalSlot>(defaultRentalSlot)
  const [rentalKiteId, setRentalKiteId] = useState<string | null>(null)
  const [rentalBoardId, setRentalBoardId] = useState<string | null>(null)

  // Prices are suggestions the moment they are shown, and typed values win
  // from then on: `null` here means "not touched, follow the suggestion".
  const [rateTyped, setRateTyped] = useState<string | null>(null)
  const [rentalPriceTyped, setRentalPriceTyped] = useState<string | null>(null)

  const [paidNow, setPaidNow] = useState(true)
  const [method, setMethod] = useState<PaymentMethod>('cash_eur')
  const [saving, setSaving] = useState(false)

  /** Official €/h, tier included: a regular's past visits count toward the
   *  thresholds exactly like a guest's earlier lessons do. */
  function officialRate(lessonType: LessonType): number | null {
    const probe = client
      ? [...bookingParticipants, { id: PROBE_PARTICIPANT, booking_id: '', client_id: client.id } as BookingParticipant]
      : bookingParticipants
    return resolveLessonRate(
      { id: '', type: lessonType, participant_ids: [PROBE_PARTICIPANT], price_per_hour: null },
      priceItems,
      { tiers: priceTiers, allLessons: lessons, bookingParticipants: probe },
    )
  }

  const typedNewRate = newClient.rate.trim() === '' ? null : parseFloat(newClient.rate)
  const mateRate = creating ? (typedNewRate != null && !isNaN(typedNewRate) ? typedNewRate : null) : client?.custom_lesson_rate ?? null
  const suggestedRate = suggestedLessonRate({ custom_lesson_rate: mateRate }, officialRate(type))
  const rate = rateTyped !== null ? (parseFloat(rateTyped) || 0) : suggestedRate

  function rentalSuggested(kind: RentalKind): number | null {
    if (kind === 'free') return 0
    return priceItems.find(p => p.billable_type === rentalBillable(kind))?.price ?? null
  }
  const rentalPrice = rentalPriceTyped !== null ? (parseFloat(rentalPriceTyped) || 0) : rentalSuggested(rentalType)

  const total = what === 'lesson' ? (rate ?? 0) * duration : (rentalPrice ?? 0)

  const haveClient = creating ? newClient.first_name.trim() !== '' : !!client
  const haveWhat = what === 'lesson' ? !!instructorId : true
  const canSave = haveClient && haveWhat && !saving

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    setSaving(true)
    const instr = instructors.find(i => i.id === instructorId)
    const rentalEquip = (
      rentalType === 'kite'  ? rentalKiteId :
      rentalType === 'board' ? rentalBoardId :
      rentalType === 'full'  ? (rentalKiteId ?? rentalBoardId) :
      null
    ) ?? null
    const ok = await onSubmit({
      date,
      client: creating
        ? { kind: 'new', first_name: newClient.first_name, last_name: newClient.last_name, phone: newClient.phone, email: newClient.email, custom_lesson_rate: mateRate }
        : { kind: 'existing', id: client!.id },
      waiverSigned,
      lesson: what === 'lesson' ? {
        type, instructor_id: instructorId, start_time: startTime, duration_hours: duration,
        // Frozen now, like every lesson: changing a price later must not
        // reprice this one (see LESSON_PRICING.md).
        price_per_hour: rate,
        instructor_rate: instr ? currentInstructorRate({ type }, instr) : null,
        notes: notes.trim() || null, kite_id: kiteId, board_id: boardId,
      } : undefined,
      rental: what === 'rental' ? {
        equipment_id: rentalEquip, slot: rentalSlot, price: rentalPrice ?? 0, notes: notes.trim() || null,
      } : undefined,
      payment: paidNow && total > 0 ? { amount: total, method } : undefined,
    })
    setSaving(false)
    if (ok) onClose()
  }

  const segBtn = (active: boolean) =>
    `flex-1 text-sm py-2 rounded border transition-colors ${active
      ? 'bg-blue-600 border-blue-600 text-white font-semibold'
      : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center sm:p-4 z-50" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-gray-900 w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-xl sm:rounded-xl shadow-xl"
      >
        <div className="sticky top-0 bg-white dark:bg-gray-900 flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h3 className="font-bold text-gray-800 dark:text-gray-200">{t.walkin_title[lang]}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{date}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-xl leading-none px-2">✕</button>
        </div>

        <div className="p-4 space-y-4">
          {/* ── Who ── */}
          <section className="space-y-2">
            {client && !creating ? (
              <div className="flex items-start justify-between gap-2 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 p-2.5">
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">{client.first_name} {client.last_name}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 flex flex-wrap gap-x-2">
                    {client.phone && <span>{client.phone}</span>}
                    <span>{t.walkin_visits[lang].replace('{count}', String(visitCount))}</span>
                    {client.custom_lesson_rate != null && <span className="font-medium text-emerald-700 dark:text-emerald-400">{t.walkin_rate_badge[lang].replace('{rate}', String(client.custom_lesson_rate))}</span>}
                  </div>
                  {sameDayVisit && <div className="text-xs text-amber-700 dark:text-amber-400 mt-1">{t.walkin_same_visit[lang]}</div>}
                </div>
                <button type="button" onClick={() => { setClientId(null); setRateTyped(null) }} className="text-xs text-blue-700 dark:text-blue-400 underline shrink-0">{t.walkin_change[lang]}</button>
              </div>
            ) : creating ? (
              <div className="space-y-2 rounded-lg border border-gray-200 dark:border-gray-800 p-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <input autoFocus className={inputCls} placeholder={t.walkin_first_name[lang]} value={newClient.first_name} onChange={e => setNewClient(n => ({ ...n, first_name: e.target.value }))} />
                  <input className={inputCls} placeholder={t.walkin_last_name[lang]} value={newClient.last_name} onChange={e => setNewClient(n => ({ ...n, last_name: e.target.value }))} />
                </div>
                <input className={inputCls} type="tel" placeholder={t.walkin_phone[lang]} value={newClient.phone} onChange={e => setNewClient(n => ({ ...n, phone: e.target.value }))} />
                <input className={inputCls} type="email" placeholder={t.walkin_email[lang]} value={newClient.email} onChange={e => setNewClient(n => ({ ...n, email: e.target.value }))} />
                <input className={inputCls} type="number" min={0} step="0.5" placeholder={t.walkin_mates_rate[lang]} value={newClient.rate} onChange={e => { setNewClient(n => ({ ...n, rate: e.target.value })); setRateTyped(null) }} />
                <button type="button" onClick={() => setCreating(false)} className="text-xs text-gray-500 dark:text-gray-400 underline">{i18n.common.btn_cancel[lang]}</button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <input autoFocus className={inputCls} placeholder={t.walkin_search_ph[lang]} value={query} onChange={e => setQuery(e.target.value)} />
                {matches.length > 0 && (
                  <ul className="border border-gray-200 dark:border-gray-800 rounded divide-y divide-gray-100 dark:divide-gray-800">
                    {matches.map(c => (
                      <li key={c.id}>
                        <button type="button" onClick={() => { setClientId(c.id); setRateTyped(null) }} className="w-full text-left px-2.5 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-950/40">
                          <span className="font-medium text-gray-900 dark:text-gray-100">{c.first_name} {c.last_name}</span>
                          {c.phone && <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">{c.phone}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {query.trim().length >= 2 && matches.length === 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">{t.walkin_no_match[lang]}</p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    // Seed the new file with what was typed: "Joao Mabunda" → first/last.
                    const [first, ...rest] = query.trim().split(/\s+/)
                    setNewClient(n => ({ ...n, first_name: /\d/.test(first ?? '') ? '' : (first ?? ''), last_name: /\d/.test(first ?? '') ? '' : rest.join(' '), phone: /\d/.test(query) ? query.trim() : n.phone }))
                    setCreating(true)
                  }}
                  className="text-sm text-blue-700 dark:text-blue-400 font-medium"
                >{t.walkin_new_client[lang]}</button>
              </div>
            )}

            {haveClient && (
              creating || !client?.waiver_signed_at ? (
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={waiverSigned} onChange={e => setWaiverSigned(e.target.checked)} />
                  {t.walkin_waiver_missing[lang]}
                </label>
              ) : (
                <p className="text-xs text-emerald-700 dark:text-emerald-400">{t.walkin_waiver_ok[lang]}</p>
              )
            )}
          </section>

          {/* ── What ── */}
          <section className="space-y-2">
            <span className={labelCls}>{t.walkin_what[lang]}</span>
            <div className="flex gap-1">
              <button type="button" className={segBtn(what === 'lesson')} onClick={() => setWhat('lesson')}>{t.walkin_lesson[lang]}</button>
              <button type="button" className={segBtn(what === 'rental')} onClick={() => setWhat('rental')}>{t.walkin_rental[lang]}</button>
            </div>

            {what === 'lesson' ? (
              <>
                <div className="flex gap-1">
                  {(['private', 'supervision', 'group'] as LessonType[]).map(lt => (
                    <button key={lt} type="button" className={segBtn(type === lt)} onClick={() => { setType(lt); setRateTyped(null) }}>
                      {lt === 'private' ? t.lesson_type_private[lang] : lt === 'group' ? t.lesson_type_group[lang] : t.lesson_type_supervision[lang]}
                    </button>
                  ))}
                </div>
                <select className={inputCls} value={instructorId} onChange={e => setInstructorId(e.target.value)}>
                  {instructors.map(i => <option key={i.id} value={i.id}>{i.first_name} {i.last_name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input type="time" className={inputCls} value={startTime} onChange={e => setStartTime(e.target.value)} />
                  <select className={inputCls} value={duration} onChange={e => setDuration(parseFloat(e.target.value))}>
                    {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d}h</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select className={inputCls} value={kiteId ?? ''} onChange={e => setKiteId(e.target.value || null)}>
                    <option value="">No kite</option>
                    {equipment.filter(e => e.category === 'kite' && e.is_active).map(e => <option key={e.id} value={e.id}>🪂 {e.name}</option>)}
                  </select>
                  <select className={inputCls} value={boardId ?? ''} onChange={e => setBoardId(e.target.value || null)}>
                    <option value="">No board</option>
                    {equipment.filter(e => e.category !== 'kite' && e.is_active).map(e => <option key={e.id} value={e.id}>🏄 {e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{t.walkin_price_per_hour[lang]}</label>
                  <input
                    type="number" min={0} step="0.5" className={inputCls}
                    value={rateTyped ?? (suggestedRate ?? '')}
                    onChange={e => setRateTyped(e.target.value)}
                  />
                  {rate === null && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{t.walkin_no_rate[lang]}</p>}
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-1">
                  {RENTAL_TYPES.map(rt => (
                    <button
                      key={rt.key} type="button"
                      onClick={() => { setRentalType(rt.key); setRentalPriceTyped(null) }}
                      className={`text-xs py-2 px-1 rounded border text-center leading-tight ${rentalType === rt.key
                        ? 'bg-amber-500 border-amber-600 text-white font-semibold'
                        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}
                    >
                      <div>{rt.icon}</div><div>{rt.label}</div>
                    </button>
                  ))}
                </div>
                {(rentalType === 'kite' || rentalType === 'full') && (
                  <select className={inputCls} value={rentalKiteId ?? ''} onChange={e => setRentalKiteId(e.target.value || null)}>
                    <option value="">🪂 Kite — not specified</option>
                    {equipment.filter(e => e.category === 'kite' && e.is_active).map(e => <option key={e.id} value={e.id}>🪂 {e.name}</option>)}
                  </select>
                )}
                {(rentalType === 'board' || rentalType === 'full') && (
                  <select className={inputCls} value={rentalBoardId ?? ''} onChange={e => setRentalBoardId(e.target.value || null)}>
                    <option value="">🏄 Board — not specified</option>
                    {equipment.filter(e => e.category === 'board' && e.is_active).map(e => <option key={e.id} value={e.id}>🏄 {e.name}</option>)}
                  </select>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <select className={inputCls} value={rentalSlot} onChange={e => setRentalSlot(e.target.value as RentalSlot)}>
                    <option value="morning">{t.slot_morning[lang]}</option>
                    <option value="afternoon">{t.slot_afternoon[lang]}</option>
                    <option value="full_day">{t.slot_full_day[lang]}</option>
                  </select>
                  <input
                    type="number" min={0} className={inputCls} aria-label={t.walkin_price[lang]}
                    value={rentalPriceTyped ?? (rentalPrice ?? '')}
                    onChange={e => setRentalPriceTyped(e.target.value)}
                  />
                </div>
                {rentalPrice === null && <p className="text-xs text-red-600 dark:text-red-400">{t.walkin_no_rate[lang]}</p>}
              </>
            )}
            <input className={inputCls} placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
          </section>

          {/* ── Money ── */}
          <section className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">{t.walkin_total[lang]}</span>
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">€{Math.round(total * 100) / 100}</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 shrink-0">
                <input type="checkbox" checked={paidNow} onChange={e => setPaidNow(e.target.checked)} />
                {t.walkin_paid_now[lang]}
              </label>
              {paidNow && (
                <select className={inputCls} value={method} onChange={e => setMethod(e.target.value as PaymentMethod)}>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{i18n.accounting[`method_${m}` as const][lang]}</option>)}
                </select>
              )}
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-gray-900 flex gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-800">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 font-medium text-sm">{i18n.common.btn_cancel[lang]}</button>
          <button type="submit" disabled={!canSave} className="flex-1 py-2.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm disabled:opacity-40">
            {saving ? t.walkin_saving[lang] : t.walkin_save[lang]}
          </button>
        </div>
      </form>
    </div>
  )
}
