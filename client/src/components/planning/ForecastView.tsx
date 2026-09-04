import { useState, useRef } from 'react'
import type { Lesson, LessonType, EquipmentRental, Instructor, Client, Equipment, Booking, Agency, AgencyBillingLine } from '../../types/database'
import { currentInstructorRate, reFreezeInstructorRate, agencyMarker } from '../accounting/utils'
import { toISODate as dateToISO, addDays } from '../../utils/dates'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'

// ─── Constants ────────────────────────────────────────────────────────────────

const SLOT_H = 36        // px per 30-min slot
const END_HOUR = 19      // grid always ends at 19:00
const TIME_COL_W = 48    // px for the time label column

const LESSON_CFG: Record<LessonType, { bg: string; border: string; text: string; badge: string }> = {
  private:    { bg: 'bg-purple-100 dark:bg-purple-900/30', border: 'border-purple-400 dark:border-purple-700', text: 'text-purple-900 dark:text-purple-400', badge: 'bg-purple-500 text-white' },
  group:      { bg: 'bg-green-100 dark:bg-green-900/30',  border: 'border-green-400 dark:border-green-700',  text: 'text-green-900 dark:text-green-400',  badge: 'bg-green-500 text-white'  },
  supervision:{ bg: 'bg-blue-100 dark:bg-blue-900/30',   border: 'border-blue-400 dark:border-blue-700',   text: 'text-blue-900 dark:text-blue-400',   badge: 'bg-blue-500 text-white'   },
}

const RENTAL_TYPE_LABELS: Record<string, { icon: string; label: string }> = {
  kite:      { icon: '🪁', label: 'Kite' },
  board:     { icon: '🏄', label: 'Board' },
  full:      { icon: '🪁🏄', label: 'Full' },
  surfboard: { icon: '🌊', label: 'Surfboard' },
  foilboard: { icon: '⬆️', label: 'Foilboard' },
  free:      { icon: '📦', label: 'Other' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Calendar-day helpers live in utils/dates — never `.toISOString()` on a date
// the user thinks of as a day (it shifts a day back east of Greenwich).

function timeToSlot(time: string, startHour: number): number {
  const [h, m] = time.split(':').map(Number)
  return (h - startHour) * 2 + (m >= 30 ? 1 : 0)
}

function slotToTime(slot: number, startHour: number): string {
  const total = startHour * 60 + slot * 30
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

// ─── Top-level modal: Add lesson ─────────────────────────────────────────────

interface AddLessonModalProps {
  date: string
  startHour: number
  totalSlots: number
  instructorId: string
  initialSlot: number
  clients: Client[]
  instructors: Instructor[]
  onConfirm: (lesson: Omit<Lesson, 'id'>) => void
  onClose: () => void
}

function AddLessonModal({ date, startHour, totalSlots, instructorId, initialSlot, clients, instructors, onConfirm, onClose }: AddLessonModalProps) {
  const { lang } = useLanguage()
  const [type, setType]           = useState<LessonType>('private')
  const [clientIds, setClientIds] = useState<string[]>([clients[0]?.id ?? ''])
  const [instrId, setInstrId]     = useState(instructorId)
  const [startSlot, setStartSlot] = useState(Math.max(0, Math.min(totalSlots - 1, initialSlot)))
  const [durSlots, setDurSlots]   = useState(2)
  const [notes, setNotes]         = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onConfirm({
      booking_id: '', // TODO: link to booking
      instructor_id: instrId,
      participant_ids: clientIds,
      date,
      start_time: slotToTime(startSlot, startHour),
      duration_hours: durSlots * 0.5,
      type,
      notes: notes || null,
      kite_id: null,
      board_id: null,
      // No price list in this view — null falls back to the current client rate
      price_per_hour: null,
      // The pay scale IS available here, so freeze it like the planning does
      instructor_rate: (() => {
        const instr = instructors.find(i => i.id === instrId)
        return instr ? currentInstructorRate({ type }, instr) : null
      })(),
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-sm">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold text-gray-800 dark:text-gray-200">{i18n.planning.title_new_lesson[lang]}</h3>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-bold text-lg">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type</label>
            <select value={type} onChange={e => setType(e.target.value as LessonType)} className="w-full text-sm border rounded px-2 py-1.5">
              <option value="private">{i18n.planning.lesson_type_private[lang]}</option>
              <option value="group">{i18n.planning.lesson_type_group[lang]}</option>
              <option value="supervision">Supervision</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{type === 'group' ? 'Clients' : 'Client'}</label>
            {type !== 'group' ? (
              <select value={clientIds[0] ?? ''} onChange={e => setClientIds([e.target.value])} className="w-full text-sm border rounded px-2 py-1.5">
                {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            ) : (
              <div className="space-y-1">
                {clientIds.map((cid, idx) => (
                  <div key={idx} className="flex gap-1">
                    <select value={cid} onChange={e => { const ids = [...clientIds]; ids[idx] = e.target.value; setClientIds(ids) }}
                      className="flex-1 text-sm border rounded px-2 py-1.5">
                      {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                    </select>
                    {clientIds.length > 1 && (
                      <button type="button" onClick={() => setClientIds(ids => ids.filter((_, i) => i !== idx))}
                        className="text-red-400 dark:text-red-300 hover:text-red-600 dark:hover:text-red-400 px-1 text-sm">✕</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setClientIds(ids => [...ids, clients[0]?.id ?? ''])}
                  className="text-xs text-green-700 dark:text-green-400 border border-dashed border-green-400 dark:border-green-700 rounded px-2 py-1 w-full hover:bg-green-50 dark:hover:bg-green-950/40">
                  + Add client
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Instructor</label>
            <select value={instrId} onChange={e => setInstrId(e.target.value)} className="w-full text-sm border rounded px-2 py-1.5">
              {instructors.map(i => <option key={i.id} value={i.id}>{i.first_name} {i.last_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{i18n.planning.label_start[lang]}</label>
              <select value={startSlot} onChange={e => setStartSlot(+e.target.value)} className="w-full text-sm border rounded px-2 py-1.5">
                {Array.from({ length: totalSlots }, (_, i) => (
                  <option key={i} value={i}>{slotToTime(i, startHour)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Duration</label>
              <select value={durSlots} onChange={e => setDurSlots(+e.target.value)} className="w-full text-sm border rounded px-2 py-1.5">
                {[1, 2, 3, 4, 5, 6].map(s => <option key={s} value={s}>{s * 0.5}h</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full text-sm border rounded px-2 py-1.5" placeholder="Optional" />
          </div>
          <div className="flex gap-2 pt-2 border-t">
            <button type="button" onClick={onClose}
              className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded font-medium text-sm">{i18n.common.btn_cancel[lang]}</button>
            <button type="submit"
              className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm">{i18n.common.btn_add[lang]}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Top-level modal: Edit lesson ─────────────────────────────────────────────

interface EditLessonModalProps {
  lesson: Lesson
  startHour: number
  totalSlots: number
  clients: Client[]
  instructors: Instructor[]
  onSave: (l: Lesson) => void
  onDelete: (id: string) => void
  onClose: () => void
}

function EditLessonModal({ lesson, startHour, totalSlots, clients, instructors, onSave, onDelete, onClose }: EditLessonModalProps) {
  const { lang } = useLanguage()
  const [type, setType]           = useState<LessonType>(lesson.type)
  const [clientIds, setClientIds] = useState<string[]>(lesson.participant_ids)
  const [instrId, setInstrId]     = useState(lesson.instructor_id)
  const [startSlot, setStartSlot] = useState(Math.max(0, timeToSlot(lesson.start_time, startHour)))
  const [durSlots, setDurSlots]   = useState(lesson.duration_hours * 2)
  const [notes, setNotes]         = useState(lesson.notes ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Re-freeze the payout when the lesson changes hands or type (see
    // reFreezeInstructorRate) — this modal can do both at once.
    onSave(reFreezeInstructorRate(
      { ...lesson, type, participant_ids: clientIds, instructor_id: instrId,
        start_time: slotToTime(startSlot, startHour), duration_hours: durSlots * 0.5, notes: notes || null },
      lesson, instructors))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-sm">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold text-gray-800 dark:text-gray-200">{i18n.planning.title_edit_lesson[lang]}</h3>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-bold text-lg">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type</label>
            <select value={type} onChange={e => setType(e.target.value as LessonType)} className="w-full text-sm border rounded px-2 py-1.5">
              <option value="private">{i18n.planning.lesson_type_private[lang]}</option>
              <option value="group">{i18n.planning.lesson_type_group[lang]}</option>
              <option value="supervision">Supervision</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{type === 'group' ? 'Clients' : 'Client'}</label>
            {type !== 'group' ? (
              <select value={clientIds[0] ?? ''} onChange={e => setClientIds([e.target.value])} className="w-full text-sm border rounded px-2 py-1.5">
                {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            ) : (
              <div className="space-y-1">
                {clientIds.map((cid, idx) => (
                  <div key={idx} className="flex gap-1">
                    <select value={cid} onChange={e => { const ids = [...clientIds]; ids[idx] = e.target.value; setClientIds(ids) }}
                      className="flex-1 text-sm border rounded px-2 py-1.5">
                      {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                    </select>
                    {clientIds.length > 1 && (
                      <button type="button" onClick={() => setClientIds(ids => ids.filter((_, i) => i !== idx))}
                        className="text-red-400 dark:text-red-300 hover:text-red-600 dark:hover:text-red-400 px-1">✕</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setClientIds(ids => [...ids, clients[0]?.id ?? ''])}
                  className="text-xs text-green-700 dark:text-green-400 border border-dashed border-green-400 dark:border-green-700 rounded px-2 py-1 w-full hover:bg-green-50 dark:hover:bg-green-950/40">
                  + Add client
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Instructor</label>
            <select value={instrId} onChange={e => setInstrId(e.target.value)} className="w-full text-sm border rounded px-2 py-1.5">
              {instructors.map(i => <option key={i.id} value={i.id}>{i.first_name} {i.last_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{i18n.planning.label_start[lang]}</label>
              <select value={startSlot} onChange={e => setStartSlot(+e.target.value)} className="w-full text-sm border rounded px-2 py-1.5">
                {Array.from({ length: totalSlots }, (_, i) => (
                  <option key={i} value={i}>{slotToTime(i, startHour)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Duration</label>
              <select value={durSlots} onChange={e => setDurSlots(+e.target.value)} className="w-full text-sm border rounded px-2 py-1.5">
                {[1, 2, 3, 4, 5, 6].map(s => <option key={s} value={s}>{s * 0.5}h</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full text-sm border rounded px-2 py-1.5" placeholder="Optional" />
          </div>
          <div className="flex gap-2 pt-2 border-t">
            <button type="button"
              onClick={() => { if (confirm(i18n.planning.msg_confirm_delete_lesson[lang])) { onDelete(lesson.id); onClose() } }}
              className="px-3 py-2 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded font-medium text-sm">{i18n.common.btn_delete[lang]}</button>
            <button type="button" onClick={onClose}
              className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded font-medium text-sm">{i18n.common.btn_cancel[lang]}</button>
            <button type="submit"
              className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm">{i18n.common.btn_save[lang]}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Top-level: Rentals panel ─────────────────────────────────────────────────

interface RentalsPanelProps {
  rentals: EquipmentRental[]
  clients: Client[]
  equipment: Equipment[]
  onDelete: (id: string) => void
  onAdd: (r: Omit<EquipmentRental, 'id'>) => void
  date: string
}

function RentalsPanel({ rentals, clients, equipment, onDelete, onAdd, date }: RentalsPanelProps) {
  const { lang } = useLanguage()
  const [showForm, setShowForm] = useState(false)
  const [clientId, setClientId] = useState(clients[0]?.id ?? '')
  const [equipType, setEquipType] = useState('kite')
  const [slot, setSlot] = useState<'morning' | 'afternoon' | 'full_day'>('full_day')
  const [price, setPrice] = useState(40)
  const [otherDesc, setOtherDesc] = useState('')

  const DEFAULT_PRICES: Record<string, number> = { kite: 40, board: 20, full: 55, surfboard: 25, foilboard: 35, free: 0 }

  const groups: { key: 'morning' | 'afternoon' | 'full_day'; label: string }[] = [
    { key: 'morning', label: i18n.planning.slot_morning[lang] },
    { key: 'afternoon', label: i18n.planning.slot_afternoon[lang] },
    { key: 'full_day', label: i18n.planning.slot_full_day[lang] },
  ]

  function submitRental(e: React.FormEvent) {
    e.preventDefault()
    const equip = equipment.find(eq => eq.category === equipType && eq.is_active)
    onAdd({
      equipment_id: equip?.id ?? equipType,
      booking_id: null,
      participant_id: null,
      date,
      slot,
      price,
      notes: equipType === 'free' ? (otherDesc || null) : null,
    })
    setOtherDesc('')
    setShowForm(false)
  }

  return (
    <div className="w-52 shrink-0 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">📦 {i18n.planning.section_rentals[lang]}</h3>
        <button
          onClick={() => setShowForm(v => !v)}
          className="text-xs px-2 py-0.5 rounded border border-dashed border-amber-400 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
        >+ {i18n.common.btn_add[lang]}</button>
      </div>

      {showForm && (
        <form onSubmit={submitRental} className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg p-2 space-y-1.5">
          <select value={clientId} onChange={e => setClientId(e.target.value)}
            className="w-full text-xs border rounded px-1 py-1">
            {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
          </select>
          <select value={equipType} onChange={e => { setEquipType(e.target.value); setPrice(DEFAULT_PRICES[e.target.value] ?? 0) }}
            className="w-full text-xs border rounded px-1 py-1">
            {Object.entries(RENTAL_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v.icon} {v.label}</option>
            ))}
          </select>
          {equipType === 'free' && (
            <input
              type="text"
              value={otherDesc}
              onChange={e => setOtherDesc(e.target.value)}
              placeholder="What is being rented?"
              className="w-full text-xs border rounded px-1 py-1"
            />
          )}
          <div className="flex gap-1">
            <select value={slot} onChange={e => setSlot(e.target.value as typeof slot)}
              className="flex-1 text-xs border rounded px-1 py-1">
              <option value="morning">{i18n.planning.slot_morning[lang]}</option>
              <option value="afternoon">{i18n.planning.slot_afternoon[lang]}</option>
              <option value="full_day">{i18n.planning.slot_full_day[lang]}</option>
            </select>
            <input type="number" value={price} onChange={e => setPrice(+e.target.value)}
              className="w-14 text-xs border rounded px-1 py-1 text-right" min={0} />
            <span className="text-xs text-gray-500 dark:text-gray-400 self-center">€</span>
          </div>
          <div className="flex gap-1">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 text-xs py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">{i18n.common.btn_cancel[lang]}</button>
            <button type="submit"
              className="flex-1 text-xs py-1 bg-amber-500 hover:bg-amber-600 text-white rounded font-medium">{i18n.common.btn_add[lang]}</button>
          </div>
        </form>
      )}

      {groups.map(g => {
        const items = rentals.filter(r => r.slot === g.key || (g.key === 'full_day' && r.slot === 'full_day'))
          .filter(r => g.key === 'full_day' ? r.slot === 'full_day' : r.slot === g.key)
        if (items.length === 0) return null
        return (
          <div key={g.key}>
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{g.label}</div>
            <div className="space-y-1">
              {items.map(r => {
                const client = clients.find(c => c.id === r.participant_id)
                const equip = equipment.find(e => e.id === r.equipment_id)
                const rt = RENTAL_TYPE_LABELS[equip?.category ?? r.equipment_id ?? ''] ?? RENTAL_TYPE_LABELS.free
                return (
                  <div key={r.id} className="group/r flex items-start justify-between bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded px-2 py-1.5 text-xs">
                    <div>
                      <div className="font-semibold text-amber-900 dark:text-amber-400">{rt.icon} {rt.label}</div>
                      {r.notes && <div className="text-amber-800 dark:text-amber-400 text-[10px] italic truncate">{r.notes}</div>}
                      <div className="text-amber-700 dark:text-amber-400 truncate">{client?.first_name} {client?.last_name}</div>
                      <div className="text-amber-600 dark:text-amber-400 font-medium">€{r.price}</div>
                    </div>
                    <button onClick={() => onDelete(r.id)}
                      className="opacity-0 group-hover/r:opacity-100 text-gray-400 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 ml-1 mt-0.5">✕</button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {rentals.length === 0 && !showForm && (
        <p className="text-xs text-gray-400 dark:text-gray-400 italic">{i18n.planning.msg_no_rentals_planned[lang]}</p>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ForecastViewProps {
  lessons: Lesson[]
  instructors: Instructor[]
  clients: Client[]
  equipment: Equipment[]
  rentals: EquipmentRental[]
  bookings: Booking[]
  agencies: Agency[]
  agencyBillingLines: AgencyBillingLine[]
  onAddLesson: (l: Omit<Lesson, 'id'>) => void
  onUpdateLesson: (l: Lesson) => void
  onDeleteLesson: (id: string) => void
  onAddRental: (r: Omit<EquipmentRental, 'id'>) => void
  onDeleteRental: (id: string) => void
}

export default function ForecastView({ lessons, instructors, clients, equipment, rentals, bookings, agencies, agencyBillingLines, onAddLesson, onUpdateLesson, onDeleteLesson, onAddRental, onDeleteRental }: ForecastViewProps) {
  const { lang } = useLanguage()
  const today = new Date()

  const [selectedDate, setSelectedDate]   = useState<Date>(() => addDays(today, 1))
  const [startHour, setStartHour]         = useState(8)
  const [dayClipboard, setDayClipboard]   = useState<Lesson[] | null>(null)
  const [mobileInstrIdx, setMobileInstrIdx] = useState(0)

  // Modals
  const [addModal, setAddModal]   = useState<{ instructorId: string; slot: number } | null>(null)
  const [editModal, setEditModal] = useState<Lesson | null>(null)

  // Drag state
  const [dragLesson, setDragLesson]   = useState<Lesson | null>(null)
  const [dragMode, setDragMode]       = useState<'move' | 'resize'>('move')
  const [dragPreview, setDragPreview] = useState<{ instructorId: string; startSlot: number; durationSlots: number } | null>(null)
  const dragStartY      = useRef(0)
  const dragStartX      = useRef(0)
  const dragStartSlot   = useRef(0)
  const dragStartDur    = useRef(0)
  const gridRef         = useRef<HTMLDivElement>(null)

  const iso = dateToISO(selectedDate)
  const dayLessons  = lessons.filter(l => l.date === iso)
  const dayRentals  = rentals.filter(r => r.date === iso)
  const totalSlots  = (END_HOUR - startHour) * 2
  const gridHeight  = totalSlots * SLOT_H

  // ── Drag ──────────────────────────────────────────────────────────────────

  function startDrag(e: React.PointerEvent, lesson: Lesson, mode: 'move' | 'resize') {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragStartY.current    = e.clientY
    dragStartX.current    = e.clientX
    dragStartSlot.current = Math.max(0, timeToSlot(lesson.start_time, startHour))
    dragStartDur.current  = lesson.duration_hours * 2
    setDragLesson(lesson)
    setDragMode(mode)
    setDragPreview({
      instructorId:  lesson.instructor_id,
      startSlot:     dragStartSlot.current,
      durationSlots: dragStartDur.current,
    })
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragLesson || !dragPreview) return
    const dSlots = Math.round((e.clientY - dragStartY.current) / SLOT_H)

    if (dragMode === 'resize') {
      const newDur = Math.max(1, Math.min(totalSlots - dragPreview.startSlot, dragStartDur.current + dSlots))
      if (newDur !== dragPreview.durationSlots)
        setDragPreview(p => p && { ...p, durationSlots: newDur })
    } else {
      const newStart = Math.max(0, Math.min(totalSlots - 1, dragStartSlot.current + dSlots))
      let newInstr = dragPreview.instructorId
      if (gridRef.current) {
        for (const col of gridRef.current.querySelectorAll('[data-instructor-id]')) {
          const r = col.getBoundingClientRect()
          if (e.clientX >= r.left && e.clientX <= r.right) {
            newInstr = col.getAttribute('data-instructor-id') ?? newInstr
            break
          }
        }
      }
      if (newStart !== dragPreview.startSlot || newInstr !== dragPreview.instructorId)
        setDragPreview(p => p && { ...p, startSlot: newStart, instructorId: newInstr })
    }
  }

  function onPointerUp() {
    if (!dragLesson || !dragPreview) { setDragLesson(null); return }
    // Dragging a lesson into another instructor's column reassigns it, so the
    // payout snapshot has to follow — the quietest way this could have gone
    // wrong, since it takes no form and no confirmation.
    onUpdateLesson(reFreezeInstructorRate({
      ...dragLesson,
      start_time:     slotToTime(dragPreview.startSlot, startHour),
      duration_hours: dragPreview.durationSlots * 0.5,
      instructor_id:  dragPreview.instructorId,
    }, dragLesson, instructors))
    setDragLesson(null)
    setDragPreview(null)
  }

  // ── Copy / paste day ──────────────────────────────────────────────────────

  function copyDay() { setDayClipboard([...dayLessons]) }

  function pasteDay() {
    if (!dayClipboard || dayClipboard.length === 0) return
    for (const l of dayClipboard) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, ...rest } = l
      onAddLesson({ ...rest, date: iso })
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col gap-4 select-none"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date navigation */}
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedDate(d => addDays(d, -1))}
            className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-bold">←</button>
          <span className="text-base font-semibold min-w-[200px] text-center text-gray-800 dark:text-gray-200">{formatDate(selectedDate)}</span>
          <button onClick={() => setSelectedDate(d => addDays(d, 1))}
            className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-bold">→</button>
          <button onClick={() => setSelectedDate(addDays(today, 1))}
            className="px-2.5 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-800">
            {i18n.planning.btn_tomorrow[lang]}
          </button>
        </div>

        {/* Start hour */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 dark:text-gray-400">{i18n.planning.label_start[lang]}</span>
          <select
            value={startHour}
            onChange={e => setStartHour(+e.target.value)}
            className="text-sm border rounded px-2 py-1 bg-white dark:bg-gray-900"
          >
            {[8, 9, 10, 11, 12, 13, 14, 15, 16].map(h => (
              <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
            ))}
          </select>
          <span className="text-xs text-gray-400 dark:text-gray-400">→ 19:00</span>
        </div>

        {/* Copy / paste */}
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={copyDay}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300">
            {i18n.planning.btn_copy_day[lang]}
          </button>
          {dayClipboard && dayClipboard.length > 0 && (
            <button onClick={pasteDay}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-800 text-sm font-medium text-amber-800 dark:text-amber-400">
              {i18n.planning.btn_paste_n_lessons[lang].replace('{count}', String(dayClipboard.length))}
            </button>
          )}
        </div>
      </div>

      {/* Mobile: instructor selector */}
      <div className="flex md:hidden items-center justify-between bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2">
        <button
          onClick={() => setMobileInstrIdx(i => Math.max(0, i - 1))}
          disabled={mobileInstrIdx === 0}
          className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-30 font-bold text-sm"
        >←</button>
        <div className="text-center">
          <div className="font-bold text-gray-800 dark:text-gray-200">{instructors[mobileInstrIdx]?.first_name} {instructors[mobileInstrIdx]?.last_name}</div>
          {(() => {
            const count = dayLessons.filter(l => l.instructor_id === instructors[mobileInstrIdx]?.id).length
            return count > 0 ? <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">{count} lesson{count > 1 ? 's' : ''}</div> : null
          })()}
        </div>
        <button
          onClick={() => setMobileInstrIdx(i => Math.min(instructors.length - 1, i + 1))}
          disabled={mobileInstrIdx === instructors.length - 1}
          className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-30 font-bold text-sm"
        >→</button>
      </div>

      {/* Main content — desktop: side by side | mobile: stacked */}
      <div className="flex flex-col md:flex-row gap-4 items-start">

        {/* Time grid */}
        <div className="flex-1 w-full overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
          {/* Instructor headers — desktop only (hidden on mobile, replaced by nav above) */}
          <div className="hidden md:flex border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-20">
            <div style={{ width: TIME_COL_W }} className="shrink-0 border-r border-gray-200 dark:border-gray-800" />
            {instructors.map(instr => (
              <div key={instr.id} className="flex-1 min-w-[130px] px-2 py-2 text-center border-r border-gray-200 dark:border-gray-800 last:border-r-0">
                <div className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{instr.first_name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{instr.last_name}</div>
                {(() => {
                  const count = dayLessons.filter(l => l.instructor_id === instr.id).length
                  return count > 0 ? (
                    <div className="mt-1 inline-block px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] font-semibold">
                      {count} lesson{count > 1 ? 's' : ''}
                    </div>
                  ) : null
                })()}
              </div>
            ))}
          </div>

          {/* Grid body */}
          <div ref={gridRef} className="overflow-y-auto" style={{ maxHeight: 520 }}>
            <div className="flex" style={{ height: gridHeight }}>

              {/* Time labels */}
              <div style={{ width: TIME_COL_W }} className="shrink-0 border-r border-gray-200 dark:border-gray-800 relative bg-gray-50 dark:bg-gray-800">
                {Array.from({ length: totalSlots }, (_, i) => {
                  const isHour = i % 2 === 0
                  return (
                    <div key={i}
                      className={`absolute w-full border-t flex items-start justify-end pr-1.5 ${isHour ? 'border-gray-300 dark:border-gray-700' : 'border-gray-100 dark:border-gray-800'}`}
                      style={{ top: i * SLOT_H, height: SLOT_H }}
                    >
                      {isHour && <span className="text-[10px] text-gray-400 dark:text-gray-400 font-medium -mt-1.5">{slotToTime(i, startHour)}</span>}
                    </div>
                  )
                })}
              </div>

              {/* Instructor columns — desktop: all | mobile: active one only */}
              {instructors.map((instr, idx) => {
                const isMobileHidden = idx !== mobileInstrIdx
                const instrLessons = dayLessons.filter(l => l.instructor_id === instr.id)

                return (
                  <div
                    key={instr.id}
                    data-instructor-id={instr.id}
                    className={`relative border-r border-gray-200 dark:border-gray-800 last:border-r-0
                      ${isMobileHidden ? 'hidden md:block' : ''}
                      flex-1 min-w-[130px] md:min-w-[130px]`}
                    onClick={e => {
                      if (dragLesson) return
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      const slot = Math.floor((e.clientY - rect.top) / SLOT_H)
                      setAddModal({ instructorId: instr.id, slot })
                    }}
                  >
                    {/* Slot lines */}
                    {Array.from({ length: totalSlots }, (_, i) => (
                      <div key={i}
                        className={`absolute w-full border-t ${i % 2 === 0 ? 'border-gray-200 dark:border-gray-800' : 'border-gray-100 dark:border-gray-800'}`}
                        style={{ top: i * SLOT_H, height: SLOT_H }}
                      />
                    ))}

                    {/* Lesson cards */}
                    {instrLessons.map(lesson => {
                      const isDragging = dragLesson?.id === lesson.id
                      const rawSlot    = timeToSlot(lesson.start_time, startHour)
                      const displaySlot = (isDragging && dragPreview?.instructorId === instr.id)
                        ? dragPreview.startSlot : rawSlot
                      const displayDur  = (isDragging && dragPreview?.instructorId === instr.id)
                        ? dragPreview.durationSlots : lesson.duration_hours * 2

                      if (isDragging && dragPreview && dragPreview.instructorId !== instr.id) return null

                      const top    = displaySlot * SLOT_H
                      const height = displayDur * SLOT_H
                      const cfg    = LESSON_CFG[lesson.type]
                      const lessonClients = lesson.participant_ids.map(id => clients.find(c => c.id === id)).filter(Boolean)
                      const firstClient = lessonClients[0]

                      return (
                        <div key={lesson.id}
                          className={`absolute left-0.5 right-0.5 rounded border-l-4 px-1.5 py-1 overflow-hidden cursor-grab active:cursor-grabbing z-10
                            ${cfg.bg} ${cfg.border} ${cfg.text}
                            ${isDragging ? 'opacity-70 shadow-lg ring-2 ring-blue-400' : 'shadow-sm hover:shadow-md'}`}
                          style={{ top: top + 1, height: height - 2 }}
                          onClick={e => { e.stopPropagation(); setEditModal(lesson) }}
                          onPointerDown={e => startDrag(e, lesson, 'move')}
                        >
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className="text-[10px] font-bold">{lesson.start_time}</span>
                            <span className={`text-[9px] px-1 rounded font-semibold ${cfg.badge}`}>
                              {lesson.type === 'private' ? 'P' : lesson.type === 'group' ? 'G' : 'S'}
                            </span>
                            {/* Sits on the top line rather than with the name: the
                                name row only renders on tall enough blocks, and an
                                agency lesson must be recognisable at any height. */}
                            {agencyMarker(lesson, { agencies, bookings, agencyBillingLines }) && (
                              <span className="text-[9px] font-bold shrink-0" title="Agency booking">
                                {agencyMarker(lesson, { agencies, bookings, agencyBillingLines })}
                              </span>
                            )}
                          </div>
                          {height >= SLOT_H * 2 && (
                            <div className="text-xs font-semibold truncate">
                              {firstClient?.first_name} {firstClient?.last_name}
                              {lessonClients.length > 1 && <span className="ml-1 font-normal opacity-70">+{lessonClients.length - 1}</span>}
                            </div>
                          )}
                          {height >= SLOT_H * 3 && lesson.notes && (
                            <div className="text-[10px] opacity-60 truncate">{lesson.notes}</div>
                          )}
                          {/* Resize handle */}
                          <div
                            className="absolute bottom-0 left-0 right-0 h-3 cursor-s-resize flex items-center justify-center opacity-0 hover:opacity-100 active:opacity-100"
                            onPointerDown={e => { e.stopPropagation(); startDrag(e, lesson, 'resize') }}
                          >
                            <div className="w-8 h-0.5 bg-current rounded opacity-40" />
                          </div>
                        </div>
                      )
                    })}

                    {/* Ghost card for cross-instructor drag */}
                    {dragLesson && dragPreview?.instructorId === instr.id && dragLesson.instructor_id !== instr.id && (
                      <div
                        className={`absolute left-0.5 right-0.5 rounded border-l-4 opacity-50 pointer-events-none z-10
                          ${LESSON_CFG[dragLesson.type].bg} ${LESSON_CFG[dragLesson.type].border}`}
                        style={{ top: dragPreview.startSlot * SLOT_H + 1, height: dragPreview.durationSlots * SLOT_H - 2 }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Rentals panel — desktop: right side | mobile: below grid */}
        <div className="w-full md:w-52 md:shrink-0">
          <RentalsPanel
            rentals={dayRentals}
            clients={clients}
            equipment={equipment}
            date={iso}
            onDelete={id => onDeleteRental(id)}
            onAdd={r => onAddRental(r)}
          />
        </div>
      </div>

      {/* Modals */}
      {addModal && (
        <AddLessonModal
          date={iso}
          startHour={startHour}
          totalSlots={totalSlots}
          instructorId={addModal.instructorId}
          initialSlot={addModal.slot}
          clients={clients}
          instructors={instructors}
          onConfirm={lesson => {
            onAddLesson(lesson)
            setAddModal(null)
          }}
          onClose={() => setAddModal(null)}
        />
      )}
      {editModal && (
        <EditLessonModal
          lesson={editModal}
          startHour={startHour}
          totalSlots={totalSlots}
          clients={clients}
          instructors={instructors}
          onSave={updated => {
            onUpdateLesson(updated)
            setEditModal(null)
          }}
          onDelete={id => {
            onDeleteLesson(id)
            setEditModal(null)
          }}
          onClose={() => setEditModal(null)}
        />
      )}
    </div>
  )
}
