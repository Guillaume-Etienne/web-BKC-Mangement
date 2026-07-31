import { useState } from 'react'
import type { Lesson, DayActivity, DaySlot, LessonType, RentalType, Booking, BookingParticipant, EquipmentRental, Instructor, Client, Equipment, PriceItem } from '../../types/database'
import { lessonBillable, rentalBillable } from '../../types/database'
import { currentInstructorRate } from '../accounting/utils'
import { toISODate as dateToISO } from '../../utils/dates'

// ─── Config ──────────────────────────────────────────────────────────────────

type Slot = DaySlot

const SLOTS: Slot[] = ['morning', 'afternoon', 'evening']

const SLOT_CONFIG: Record<Slot, { label: string; icon: string; defaultTime: string }> = {
  morning:   { label: 'Morning',   icon: '🌅', defaultTime: '09:00' },
  afternoon: { label: 'Afternoon', icon: '☀️', defaultTime: '14:00' },
  evening:   { label: 'Evening',   icon: '🌙', defaultTime: '19:00' },
}

const LESSON_TYPE_CFG: Record<LessonType, { label: string; icon: string; card: string; badge: string; dot: string }> = {
  private:    { label: 'Private', icon: '🧑‍🏫', card: 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-400', badge: 'bg-purple-500 text-white', dot: 'bg-purple-500' },
  group:      { label: 'Group',   icon: '👥', card: 'bg-green-50 dark:bg-green-950/40  border-green-300 dark:border-green-800  text-green-900 dark:text-green-400',  badge: 'bg-green-500  text-white', dot: 'bg-green-500'  },
  supervision:{ label: 'Superv.', icon: '🎓', card: 'bg-blue-50 dark:bg-blue-950/40   border-blue-300 dark:border-blue-800   text-blue-900 dark:text-blue-400',   badge: 'bg-blue-500   text-white', dot: 'bg-blue-500'   },
}

const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DURATION_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3]

/** What the picker offers: every billable type, plus "Other" which is free by
 *  definition. There is deliberately no fallback price table here — a rate lives
 *  in Options → Pricing or nowhere, so it can never be silently different from
 *  what the screen shows. */
type RentalKind = RentalType | 'free'

const RENTAL_TYPES: { key: RentalKind; label: string; icon: string; sub?: string }[] = [
  { key: 'kite',      label: 'Kite',            icon: '🪁' },
  { key: 'board',     label: 'Board',           icon: '🏄' },
  { key: 'full',      label: 'Full',            icon: '🪁🏄', sub: 'Kite + Board' },
  { key: 'surfboard', label: 'Surfboard',       icon: '🌊' },
  { key: 'foilboard', label: 'Foilboard',       icon: '⬆️' },
  { key: 'free',      label: 'Other',           icon: '📦' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Calendar-day helpers live in utils/dates — never `.toISOString()` on a date
// the user thinks of as a day (it shifts a day back east of Greenwich).

function getSlotForTime(time: string): Slot {
  if (time < '12:00') return 'morning'
  if (time < '18:00') return 'afternoon'
  return 'evening'
}

// Stable per-person color + initials for the little avatar circle, so the same
// participant looks the same everywhere (picker and card) without needing a
// color stored anywhere — just hashed from their id.
const AVATAR_COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-pink-500', 'bg-cyan-600', 'bg-orange-500', 'bg-teal-500']
function avatarColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
function participantInitials(p: { first_name: string; last_name?: string | null }): string {
  const a = p.first_name?.[0] ?? ''
  const b = p.last_name?.[0] ?? ''
  return (a + b).toUpperCase() || '?'
}
function Avatar({ id, first_name, last_name }: { id: string; first_name: string; last_name?: string | null }) {
  return (
    <span className={`w-5 h-5 rounded-full ${avatarColor(id)} text-white text-[10px] font-bold flex items-center justify-center shrink-0`}>
      {participantInitials({ first_name, last_name })}
    </span>
  )
}


// ─── Types ───────────────────────────────────────────────────────────────────

interface AddForm {
  date: string
  slot: Slot
  kind: 'lesson' | 'activity' | 'rental'
  // lesson fields
  type: LessonType
  participant_ids: string[]
  instructor_id: string
  start_time: string
  duration_hours: number
  notes: string
  kite_id: string | null
  board_id: string | null
  // activity fields
  name: string
  actNotes: string
  // rental fields
  rental_participant_id: string
  rental_slot: 'morning' | 'afternoon' | 'full_day'
  rental_type: RentalKind
  rental_price: number
  rental_kite_id: string | null
  rental_board_id: string | null
  rental_notes: string
}

type MoveItem =
  | { kind: 'lesson'; item: Lesson }
  | { kind: 'rental'; item: EquipmentRental }

interface LessonWeekViewProps {
  days: Date[]
  lessons: Lesson[]
  dayActivities: DayActivity[]
  bookings: Booking[]
  instructors: Instructor[]
  clients: Client[]
  bookingParticipants: BookingParticipant[]
  equipment: Equipment[]
  rentals: EquipmentRental[]
  priceItems: PriceItem[]
  onAddLesson: (l: Omit<Lesson, 'id'>) => void
  onUpdateLesson: (l: Lesson) => void
  onDeleteLesson: (id: string) => void
  onAddActivity: (a: Omit<DayActivity, 'id'>) => void
  onDeleteActivity: (id: string) => void
  onAddRental: (r: Omit<EquipmentRental, 'id'>) => void
  onUpdateRental: (r: EquipmentRental) => void
  onDeleteRental: (id: string) => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LessonWeekView({
  days, lessons, dayActivities,
  bookings, instructors, clients, bookingParticipants, equipment, rentals, priceItems,
  onAddLesson, onUpdateLesson, onDeleteLesson,
  onAddActivity, onDeleteActivity,
  onAddRental, onUpdateRental, onDeleteRental,
}: LessonWeekViewProps) {
  const today = dateToISO(new Date())

  // ── Inline add form ────────────────────────────────────────────────────────
  const emptyForm = (date: string, slot: Slot, kind: 'lesson' | 'activity' | 'rental'): AddForm => {
    const firstParticipant = activeParticipantsForDate(date)[0]?.id ?? ''
    return {
    date, slot, kind,
    type: 'private', participant_ids: [firstParticipant], instructor_id: instructors[0]?.id ?? '',
    start_time: SLOT_CONFIG[slot].defaultTime, duration_hours: 1, notes: '', kite_id: null, board_id: null,
    name: '', actNotes: '',
    rental_participant_id: firstParticipant,
    rental_slot: slot === 'morning' ? 'morning' : slot === 'afternoon' ? 'afternoon' : 'full_day',
    rental_type: 'kite' as RentalKind,
    rental_price: rentalPrice('kite') ?? 0,
    rental_kite_id: null,
    rental_board_id: null,
    rental_notes: '',
  }}

  const [addForm, setAddForm] = useState<AddForm | null>(null)
  // Off by default: only guests checked in that day. Escape hatch for edge
  // cases (early arrivals, data not quite in sync) — reset on each new form.
  const [showAllGuests, setShowAllGuests] = useState(false)

  // ── Edit modal ─────────────────────────────────────────────────────────────
  const [editLesson, setEditLesson] = useState<Lesson | null>(null)
  const [editData, setEditData] = useState<Partial<Lesson>>({})

  // ── Rental edit ────────────────────────────────────────────────────────────
  const [editRental, setEditRental] = useState<EquipmentRental | null>(null)
  const [editRentalPrice, setEditRentalPrice] = useState('')
  const [editRentalSlot, setEditRentalSlot] = useState<'morning' | 'afternoon' | 'full_day'>('morning')
  const [editRentalParticipantId, setEditRentalParticipantId] = useState('')
  const [editRentalType, setEditRentalType] = useState<RentalKind>('kite')
  const [editRentalKiteId, setEditRentalKiteId] = useState<string | null>(null)
  const [editRentalBoardId, setEditRentalBoardId] = useState<string | null>(null)
  const [editRentalNotes, setEditRentalNotes] = useState('')

  // ── Clipboard ─────────────────────────────────────────────────────────────
  const [clipboard, setClipboard] = useState<Lesson | null>(null)

  // ── Mobile action sheet: kebab button → labeled actions (bigger targets than
  // 4 tiny adjacent icons, which invited mis-taps). Desktop keeps the hover icons.
  const [actionSheetItem, setActionSheetItem] = useState<MoveItem | null>(null)

  // ── Move (replaces drag & drop, which has no touch support) ───────────────
  const [moveItem, setMoveItem] = useState<MoveItem | null>(null)
  const [moveDate, setMoveDate] = useState('')
  const [moveLessonSlot, setMoveLessonSlot] = useState<Slot>('morning')
  const [moveRentalSlot, setMoveRentalSlot] = useState<'morning' | 'afternoon' | 'full_day'>('morning')

  // ── Pricing lookup ────────────────────────────────────────────────────────
  /** Rate from Options → Pricing, keyed by what it bills (never by name).
   *  null = nothing configured for that type; 'free' is 0 by definition. */
  function rentalPrice(type: RentalKind): number | null {
    if (type === 'free') return 0
    return priceItems.find(p => p.billable_type === rentalBillable(type))?.price ?? null
  }

  /** What the instructor is paid, frozen onto the lesson at creation. A different
   *  scale from what the client pays — Options → Instructors, not Pricing. */
  function instructorPay(instructorId: string, type: LessonType): number | null {
    const instr = instructors.find(i => i.id === instructorId)
    return instr ? currentInstructorRate({ type }, instr) : null
  }

  /** Client price €/h from Options → Pricing, keyed by what it bills (never by name). */
  function lessonPrice(type: LessonType): number | null {
    return priceItems.find(p => p.billable_type === lessonBillable(type))?.price ?? null
  }

  // ── Booking lookup ────────────────────────────────────────────────────────
  function bookingForParticipant(participantId: string): string {
    return bookingParticipants.find(p => p.id === participantId)?.booking_id ?? ''
  }

  function activeParticipantsForDate(date: string): BookingParticipant[] {
    const activeIds = new Set(
      bookings.filter(b => b.status !== 'cancelled' && b.check_in <= date && b.check_out >= date).map(b => b.id)
    )
    // No silent fallback to "everyone" here — an empty result genuinely means
    // no one is checked in that day. Callers that want to override this (the
    // "Show all guests" checkbox) pass `bookingParticipants` directly instead.
    return bookingParticipants.filter(p => activeIds.has(p.booking_id))
  }

  // ── Fallback name lookup (from booking's client when no participant) ─────────
  function bookingClient(bookingId: string | null): Client | undefined {
    const bid = bookingId ?? ''
    const clientId = bookings.find(b => b.id === bid)?.client_id
    return clients.find(c => c.id === clientId)
  }

  // ── Participant picker: tappable chips grouped by booking, instead of a
  // native <select> (can't show a colored avatar inside an <option>). Add-forms
  // pass only currently-active participants; edit-forms pass everyone, so an
  // already-assigned person still shows up even if their booking isn't active
  // today anymore — same distinction the old selects made.
  function renderParticipantChips(opts: {
    candidates: BookingParticipant[]
    selectedIds: string[]
    onToggle: (id: string) => void
  }) {
    const { candidates, selectedIds, onToggle } = opts
    if (candidates.length === 0) {
      return (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic px-0.5">
          No guests checked in that day.
        </p>
      )
    }
    const byBooking = new Map<string, BookingParticipant[]>()
    for (const p of candidates) {
      const arr = byBooking.get(p.booking_id) ?? []
      arr.push(p)
      byBooking.set(p.booking_id, arr)
    }
    return (
      <div className="space-y-1.5">
        {[...byBooking.entries()].map(([bookingId, people]) => {
          const primary = bookingClient(bookingId)
          return (
            <div key={bookingId} className="border border-gray-100 dark:border-gray-800 rounded-lg p-1.5 bg-gray-50/50 dark:bg-gray-800/30">
              <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1 px-0.5">
                {primary ? `${primary.first_name} ${primary.last_name ?? ''}` : 'Booking'}
              </div>
              <div className="flex flex-wrap gap-1">
                {people.map(p => {
                  const selected = selectedIds.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onToggle(p.id)}
                      className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border text-sm transition-colors ${
                        selected
                          ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-300 ring-1 ring-blue-300 dark:ring-blue-700'
                          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <Avatar id={p.id} first_name={p.first_name} last_name={p.last_name} />
                      {p.first_name}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Data helpers ──────────────────────────────────────────────────────────
  function lessonsForSlot(date: string, slot: Slot): Lesson[] {
    return lessons
      .filter(l => l.date === date && getSlotForTime(l.start_time) === slot)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }

  function activitiesForSlot(date: string, slot: Slot): DayActivity[] {
    return dayActivities.filter(a => a.date === date && a.slot === slot)
  }

  function rentalsForSlot(date: string, slot: 'morning' | 'afternoon' | 'full_day') {
    return rentals.filter(r => r.date === date && (r.slot === slot || r.slot === 'full_day'))
  }

  function deleteRental(id: string) {
    if (confirm('Delete this rental?')) {
      if (editRental?.id === id) setEditRental(null)
      onDeleteRental(id)
    }
  }

  function openEditRental(r: EquipmentRental) {
    const equip = equipment.find(e => e.id === r.equipment_id)
    const type = (RENTAL_TYPES.find(t => t.key === (equip?.category ?? r.equipment_id))?.key ?? 'free') as RentalKind
    setEditRental(r)
    setEditRentalPrice(String(r.price))
    setEditRentalSlot(r.slot as 'morning' | 'afternoon' | 'full_day')
    setEditRentalParticipantId(r.participant_id ?? '')
    setEditRentalType(type)
    setEditRentalKiteId(equip?.category === 'kite' ? r.equipment_id : null)
    setEditRentalBoardId(equip?.category !== 'kite' && equip ? r.equipment_id : null)
    setEditRentalNotes(r.notes ?? '')
  }

  function submitEditRental(e: React.FormEvent) {
    e.preventDefault()
    if (!editRental) return
    const price = parseFloat(editRentalPrice)
    if (isNaN(price) || price < 0) return
    const equipId = (
      editRentalType === 'kite'  ? editRentalKiteId :
      editRentalType === 'board' ? editRentalBoardId :
      editRentalType === 'full'  ? (editRentalKiteId ?? editRentalBoardId) :
      null
    ) ?? null
    onUpdateRental({
      ...editRental,
      price,
      slot: editRentalSlot,
      participant_id: editRentalParticipantId || null,
      booking_id: editRentalParticipantId ? bookingForParticipant(editRentalParticipantId) || editRental.booking_id : editRental.booking_id,
      equipment_id: equipId,
      notes: editRentalNotes || null,
    })
    setEditRental(null)
  }

  // ── Add handlers ──────────────────────────────────────────────────────────
  function openAdd(date: string, slot: Slot, kind: 'lesson' | 'activity' | 'rental') {
    setAddForm(emptyForm(date, slot, kind))
    setShowAllGuests(false)
  }

  function submitAdd() {
    if (!addForm) return
    if (addForm.kind === 'lesson') {
      onAddLesson({
        booking_id: bookingForParticipant(addForm.participant_ids[0] ?? ''),
        instructor_id: addForm.instructor_id,
        participant_ids: addForm.participant_ids,
        date: addForm.date,
        start_time: addForm.start_time,
        duration_hours: addForm.duration_hours,
        type: addForm.type,
        notes: addForm.notes || null,
        kite_id: addForm.kite_id,
        board_id: addForm.board_id,
        // Freeze BOTH of today's scales: changing the price list or someone's pay
        // later must not reprice this lesson (same rule as booking_room_prices).
        price_per_hour: lessonPrice(addForm.type),
        instructor_rate: instructorPay(addForm.instructor_id, addForm.type),
      })
    } else if (addForm.kind === 'activity') {
      onAddActivity({
        date: addForm.date,
        slot: addForm.slot,
        name: addForm.name,
        notes: addForm.actNotes || null,
      })
    } else {
      // Use specific equipment id if chosen, otherwise fall back to the type key as virtual id
      const equipId = (
        addForm.rental_type === 'kite'  ? addForm.rental_kite_id  :
        addForm.rental_type === 'board' ? addForm.rental_board_id :
        addForm.rental_type === 'full'  ? (addForm.rental_kite_id ?? addForm.rental_board_id) :
        null
      ) ?? null
      onAddRental({
        equipment_id: equipId,
        booking_id: bookingForParticipant(addForm.rental_participant_id) || null,
        participant_id: addForm.rental_participant_id || null,
        date: addForm.date,
        slot: addForm.rental_slot,
        price: addForm.rental_price,
        notes: addForm.rental_notes || null,
      })
    }
    setAddForm(null)
  }

  // ── Edit handlers ─────────────────────────────────────────────────────────
  function openEdit(lesson: Lesson) {
    setEditLesson(lesson)
    setEditData({ ...lesson })
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editLesson) return
    onUpdateLesson({ ...editLesson, ...editData } as Lesson)
    setEditLesson(null)
  }

  function deleteLesson(id: string) {
    if (confirm('Delete this lesson?')) {
      onDeleteLesson(id)
      if (editLesson?.id === id) setEditLesson(null)
    }
  }

  function deleteActivity(id: string) {
    onDeleteActivity(id)
  }

  // ── Copy / paste ──────────────────────────────────────────────────────────
  function copyLesson(lesson: Lesson) {
    setClipboard(lesson)
  }

  function pasteLesson(date: string, slot: Slot) {
    if (!clipboard) return
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...rest } = clipboard
    onAddLesson({ ...rest, date, start_time: SLOT_CONFIG[slot].defaultTime })
  }

  // ── Move handlers (lesson or rental → new date/slot) ──────────────────────
  function openMoveLesson(lesson: Lesson) {
    setMoveItem({ kind: 'lesson', item: lesson })
    setMoveDate(lesson.date)
    setMoveLessonSlot(getSlotForTime(lesson.start_time))
  }

  function openMoveRental(rental: EquipmentRental) {
    setMoveItem({ kind: 'rental', item: rental })
    setMoveDate(rental.date)
    setMoveRentalSlot(rental.slot as 'morning' | 'afternoon' | 'full_day')
  }

  function submitMove() {
    if (!moveItem) return
    if (moveItem.kind === 'lesson') {
      const lesson = moveItem.item
      const slotChanged = getSlotForTime(lesson.start_time) !== moveLessonSlot
      const newTime = slotChanged ? SLOT_CONFIG[moveLessonSlot].defaultTime : lesson.start_time
      onUpdateLesson({ ...lesson, date: moveDate, start_time: newTime })
    } else {
      onUpdateRental({ ...moveItem.item, date: moveDate, slot: moveRentalSlot })
    }
    setMoveItem(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Clipboard banner */}
      {clipboard && (
        <div className="mb-4 flex items-center gap-3 px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg text-sm">
          <span>📋 Lesson copied:</span>
          <span className="font-semibold">
            {bookingParticipants.find(p => p.id === clipboard.participant_ids[0])?.first_name}{' '}
            {bookingParticipants.find(p => p.id === clipboard.participant_ids[0])?.last_name}
            {clipboard.participant_ids.length > 1 && ` +${clipboard.participant_ids.length - 1}`}
            {' · '}{LESSON_TYPE_CFG[clipboard.type].label}{' · '}{clipboard.start_time}
          </span>
          <span className="text-gray-500 dark:text-gray-400 text-xs">→ Click "Paste" in a slot</span>
          <button
            onClick={() => setClipboard(null)}
            className="ml-auto text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-bold"
          >✕</button>
        </div>
      )}

      {/* Day cards: layout depends on how many days are shown (1 / 3 / Week button).
          "3" fits all three columns on screen at once on mobile (equal thirds,
          shrinking as needed) instead of a swipe-to-peek carousel; desktop gets
          a comfortable fixed width since there's room to spare. */}
      <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-3">
        {days.map((day) => {
          const iso = dateToISO(day)
          const isToday = iso === today
          const isWeekend = day.getDay() === 0 || day.getDay() === 6
          const cardWidthClass =
            days.length === 1 ? 'w-full' :
            days.length === 3 ? 'flex-1 min-w-0 md:flex-none md:w-80' :
            'min-w-[200px] flex-1'

          return (
            <div
              key={iso}
              className={`${cardWidthClass} rounded-lg shadow-sm border flex flex-col ${
                isToday ? 'border-blue-400 dark:border-blue-700 ring-2 ring-blue-200' : 'border-gray-200 dark:border-gray-800'
              } bg-white dark:bg-gray-900`}
            >
              {/* Card header */}
              <div className={`px-3 py-2 rounded-t-lg border-b ${
                isToday ? 'bg-blue-600 text-white' : isWeekend ? 'bg-blue-50 dark:bg-blue-950/40' : 'bg-gray-50 dark:bg-gray-800'
              }`}>
                <div className={`text-xs font-medium ${isToday ? 'text-blue-100 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}>
                  {DAY_FULL[day.getDay()]}
                </div>
                <div className={`text-lg font-bold leading-tight ${isToday ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>
                  {day.getDate()} {MONTH_SHORT[day.getMonth()]}
                </div>
              </div>

              {/* Slots */}
              <div className="flex-1 flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
                {SLOTS.map(slot => {
                  const slotLessons = lessonsForSlot(iso, slot)
                  const slotActivities = activitiesForSlot(iso, slot)
                  const slotRentals = slot !== 'evening' ? rentalsForSlot(iso, slot === 'morning' ? 'morning' : 'afternoon') : []
                  const cfg = SLOT_CONFIG[slot]
                  const isAddOpen = addForm?.date === iso && addForm?.slot === slot

                  return (
                    <div
                      key={slot}
                      className="p-2 transition-colors"
                    >
                      {/* Slot header */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm md:text-xs font-semibold text-gray-500 dark:text-gray-400">
                          {cfg.icon} {cfg.label}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                        </div>
                      </div>

                      {/* Lessons */}
                      {slotLessons.map(lesson => {
                        const lessonClients = lesson.participant_ids.map(id => bookingParticipants.find(p => p.id === id)).filter(Boolean)
                        const firstClient = lessonClients[0] ?? bookingClient(lesson.booking_id)
                        const instructor = instructors.find(i => i.id === lesson.instructor_id)
                        const tc = LESSON_TYPE_CFG[lesson.type]

                        return (
                          <div
                            key={lesson.id}
                            className={`group/lesson relative rounded border p-2.5 md:p-1.5 text-sm md:text-xs mb-1 ${tc.card}`}
                          >
                            {/* Mobile: single kebab → action sheet (bigger, unambiguous targets) */}
                            <button
                              onClick={() => setActionSheetItem({ kind: 'lesson', item: lesson })}
                              className="absolute top-0.5 right-0.5 flex md:hidden items-center justify-center w-8 h-8 rounded-full bg-white dark:bg-gray-900/90 text-gray-600 dark:text-gray-400 shadow-sm text-lg leading-none"
                              title="Actions"
                            >⋮</button>
                            {/* Desktop: hover-reveal icon cluster */}
                            <div className="absolute top-1 right-1 hidden md:group-hover/lesson:flex items-center gap-0.5 bg-white dark:bg-gray-900/90 rounded px-0.5 py-0.5 shadow-sm">
                              <button
                                onClick={() => copyLesson(lesson)}
                                className="text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 text-xs px-1"
                                title="Copy"
                              >⎘</button>
                              <button
                                onClick={() => openMoveLesson(lesson)}
                                className="text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 text-xs px-1"
                                title="Move"
                              >↔</button>
                              <button
                                onClick={() => openEdit(lesson)}
                                className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 text-xs px-1"
                                title="Edit"
                              >✏️</button>
                              <button
                                onClick={() => deleteLesson(lesson.id)}
                                className="text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 text-xs px-1"
                                title="Delete"
                              >✕</button>
                            </div>

                            {/* Content */}
                            <div className="flex items-center justify-between mb-0.5 pr-9 md:pr-16">
                              <span className="font-bold">{lesson.start_time}</span>
                              <div className="flex items-center gap-1">
                                <span className="opacity-60">{lesson.duration_hours}h</span>
                                <span className={`px-1 rounded text-xs font-medium ${tc.badge}`}>{tc.label}</span>
                              </div>
                            </div>
                            <div className="font-semibold truncate flex items-center gap-1">
                              {firstClient && <Avatar id={firstClient.id} first_name={firstClient.first_name} last_name={firstClient.last_name} />}
                              <span className="truncate">{firstClient?.first_name} {firstClient?.last_name}</span>
                              {lessonClients.length > 1 && <span className="ml-1 text-[10px] font-normal opacity-70 shrink-0">+{lessonClients.length - 1}</span>}
                            </div>
                            <div className="opacity-60 truncate">↳ {instructor?.first_name} {instructor?.last_name}</div>
                          </div>
                        )
                      })}

                      {/* Activities */}
                      {slotActivities.map(act => (
                        <div
                          key={act.id}
                          className="group/act relative rounded border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/40 text-orange-900 dark:text-orange-400 p-2.5 md:p-1.5 text-sm md:text-xs mb-1"
                        >
                          <div className="absolute top-1 right-1 flex md:hidden md:group-hover/act:flex">
                            <button
                              onClick={() => deleteActivity(act.id)}
                              className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 text-sm md:text-xs p-1.5 md:px-1 md:py-0"
                              title="Delete"
                            >✕</button>
                          </div>
                          <span className="font-medium pr-4">🎯 {act.name}</span>
                          {act.notes && <div className="opacity-60 text-xs">{act.notes}</div>}
                        </div>
                      ))}

                      {/* Rentals */}
                      {slotRentals.map(r => {
                        const client = bookingParticipants.find(p => p.id === r.participant_id) ?? bookingClient(r.booking_id ?? null)
                        const equip = equipment.find(e => e.id === r.equipment_id)
                        // Resolve display type: specific equip category → rental type key or fallback
                        const rt = RENTAL_TYPES.find(t => t.key === (equip?.category ?? r.equipment_id))
                        return (
                          <div
                            key={r.id}
                            className="group/rental relative rounded border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-400 p-2.5 md:p-1.5 text-sm md:text-xs mb-1"
                          >
                            {/* Mobile: single kebab → action sheet */}
                            <button
                              onClick={() => setActionSheetItem({ kind: 'rental', item: r })}
                              className="absolute top-0.5 right-0.5 flex md:hidden items-center justify-center w-8 h-8 rounded-full bg-white dark:bg-gray-900/90 text-gray-600 dark:text-gray-400 shadow-sm text-lg leading-none"
                              title="Actions"
                            >⋮</button>
                            {/* Desktop: hover-reveal icon cluster */}
                            <div className="absolute top-1 right-1 hidden md:group-hover/rental:flex gap-0.5 bg-white dark:bg-gray-900/90 rounded px-0.5 shadow-sm">
                              <button
                                onClick={() => openMoveRental(r)}
                                className="text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 text-xs px-1"
                                title="Move"
                              >↔</button>
                              <button
                                onClick={() => openEditRental(r)}
                                className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 text-xs px-1"
                                title="Edit"
                              >✏️</button>
                              <button
                                onClick={() => deleteRental(r.id)}
                                className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 text-xs px-1"
                                title="Delete"
                              >✕</button>
                            </div>
                            <div className="flex items-center justify-between pr-9 md:pr-4">
                              <span className="font-semibold">{rt?.icon ?? '📦'} {rt?.label ?? equip?.name ?? r.equipment_id}</span>
                              <span className="text-amber-700 dark:text-amber-400 font-semibold">€{r.price}</span>
                            </div>
                            {equip && <div className="text-[11px] opacity-60 truncate">{equip.name}</div>}
                            <div className="opacity-70 truncate flex items-center gap-1">
                              {client && <Avatar id={client.id} first_name={client.first_name} last_name={client.last_name} />}
                              <span className="truncate">{client?.first_name} {client?.last_name}</span>
                            </div>
                          </div>
                        )
                      })}

                      {/* Inline add form */}
                      {isAddOpen ? (
                        <div className="mt-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 p-2 space-y-1.5 shadow-sm">
                          {addForm?.kind === 'rental' ? (
                            <>
                              {/* Rental form */}
                              {renderParticipantChips({
                                candidates: showAllGuests ? bookingParticipants : activeParticipantsForDate(addForm?.date ?? ''),
                                selectedIds: addForm?.rental_participant_id ? [addForm.rental_participant_id] : [],
                                onToggle: id => setAddForm(f => f && { ...f, rental_participant_id: f.rental_participant_id === id ? '' : id }),
                              })}
                              <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 px-0.5">
                                <input type="checkbox" checked={showAllGuests} onChange={e => setShowAllGuests(e.target.checked)} />
                                Show all guests
                              </label>
                              {/* Type buttons */}
                              <div className="grid grid-cols-3 gap-1">
                                {RENTAL_TYPES.map(rt => (
                                  <button
                                    key={rt.key}
                                    type="button"
                                    onClick={() => setAddForm(f => f && {
                                      ...f,
                                      rental_type: rt.key,
                                      rental_price: rentalPrice(rt.key) ?? 0,
                                    })}
                                    className={`text-sm md:text-xs py-2 px-1 md:py-1 rounded border transition-colors text-center leading-tight ${
                                      addForm?.rental_type === rt.key
                                        ? 'bg-amber-500 border-amber-600 dark:border-amber-500 text-white font-semibold'
                                        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-amber-300 dark:hover:border-amber-800'
                                    }`}
                                  >
                                    <div>{rt.icon}</div>
                                    <div>{rt.label}</div>
                                    {rt.sub && <div className="text-[10px] opacity-70">{rt.sub}</div>}
                                  </button>
                                ))}
                              </div>
                              {/* Optional equipment selection */}
                              {(addForm?.rental_type === 'kite' || addForm?.rental_type === 'full') && (
                                <select
                                  value={addForm?.rental_kite_id ?? ''}
                                  onChange={e => setAddForm(f => f && { ...f, rental_kite_id: e.target.value || null })}
                                  className="w-full text-sm md:text-xs border rounded px-2 py-2 md:px-1 md:py-1"
                                >
                                  <option value="">🪁 Kite — not specified</option>
                                  {equipment.filter(e => e.category === 'kite' && e.is_active).map(e => (
                                    <option key={e.id} value={e.id}>🪁 {e.name}</option>
                                  ))}
                                </select>
                              )}
                              {(addForm?.rental_type === 'board' || addForm?.rental_type === 'full') && (
                                <select
                                  value={addForm?.rental_board_id ?? ''}
                                  onChange={e => setAddForm(f => f && { ...f, rental_board_id: e.target.value || null })}
                                  className="w-full text-sm md:text-xs border rounded px-2 py-2 md:px-1 md:py-1"
                                >
                                  <option value="">🏄 Board — not specified</option>
                                  {equipment.filter(e => e.category === 'board' && e.is_active).map(e => (
                                    <option key={e.id} value={e.id}>🏄 {e.name}</option>
                                  ))}
                                </select>
                              )}
                              {/* Slot + Price */}
                              <div className="flex gap-1 items-center">
                                <select
                                  value={addForm?.rental_slot}
                                  onChange={e => setAddForm(f => f && { ...f, rental_slot: e.target.value as 'morning' | 'afternoon' | 'full_day' })}
                                  className="flex-1 text-sm md:text-xs border rounded px-2 py-2 md:px-1 md:py-1"
                                >
                                  <option value="morning">Morning</option>
                                  <option value="afternoon">Afternoon</option>
                                  <option value="full_day">Full day</option>
                                </select>
                                <input
                                  type="number"
                                  value={addForm?.rental_price ?? 0}
                                  onChange={e => setAddForm(f => f && { ...f, rental_price: parseFloat(e.target.value) || 0 })}
                                  className="w-16 text-sm md:text-xs border rounded px-2 py-2 md:px-1 md:py-1 text-right"
                                  min={0}
                                />
                                <span className="text-xs text-gray-500 dark:text-gray-400">€</span>
                              </div>
                              {addForm && rentalPrice(addForm.rental_type) === null && (
                                <p className="text-[10px] text-red-500 dark:text-red-400 leading-tight">
                                  No rate set for this type — see Options → Pricing. Type the price here to bill this one.
                                </p>
                              )}
                              <input
                                type="text"
                                placeholder="Notes (optional)"
                                value={addForm?.rental_notes}
                                onChange={e => setAddForm(f => f && { ...f, rental_notes: e.target.value })}
                                className="w-full text-sm md:text-xs border rounded px-2 py-2 md:px-1 md:py-1"
                              />
                            </>
                          ) : addForm?.kind === 'lesson' ? (
                            <>
                              {/* Lesson form */}
                              <div className="grid grid-cols-3 gap-1">
                                {(['private', 'group', 'supervision'] as LessonType[]).map(t => (
                                  <button
                                    key={t}
                                    type="button"
                                    onClick={() => setAddForm(f => f && {
                                      ...f,
                                      type: t,
                                      participant_ids: [f.participant_ids[0] ?? activeParticipantsForDate(f.date)[0]?.id ?? ''],
                                    })}
                                    className={`text-sm md:text-xs py-2 px-1 md:py-1 rounded border transition-colors text-center leading-tight ${
                                      addForm?.type === t
                                        ? `${LESSON_TYPE_CFG[t].card} font-semibold ring-1 ring-inset ring-current`
                                        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400'
                                    }`}
                                  >
                                    <div>{LESSON_TYPE_CFG[t].icon}</div>
                                    <div>{LESSON_TYPE_CFG[t].label}</div>
                                  </button>
                                ))}
                              </div>
                              {/* Participant(s) — single for private/supervision, multi-toggle for group */}
                              {renderParticipantChips({
                                candidates: showAllGuests ? bookingParticipants : activeParticipantsForDate(addForm?.date ?? ''),
                                selectedIds: addForm?.participant_ids ?? [],
                                onToggle: id => setAddForm(f => {
                                  if (!f) return f
                                  if (f.type !== 'group') return { ...f, participant_ids: [id] }
                                  const has = f.participant_ids.includes(id)
                                  if (has) {
                                    if (f.participant_ids.length <= 1) return f
                                    return { ...f, participant_ids: f.participant_ids.filter(x => x !== id) }
                                  }
                                  return { ...f, participant_ids: [...f.participant_ids, id] }
                                }),
                              })}
                              <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 px-0.5">
                                <input type="checkbox" checked={showAllGuests} onChange={e => setShowAllGuests(e.target.checked)} />
                                Show all guests
                              </label>
                              <select
                                value={addForm?.instructor_id}
                                onChange={e => setAddForm(f => f && { ...f, instructor_id: e.target.value })}
                                className="w-full text-sm md:text-xs border rounded px-2 py-2 md:px-1 md:py-1"
                              >
                                {instructors.map(i => (
                                  <option key={i.id} value={i.id}>{i.first_name} {i.last_name}</option>
                                ))}
                              </select>
                              <input
                                type="time"
                                value={addForm?.start_time}
                                onChange={e => setAddForm(f => f && { ...f, start_time: e.target.value })}
                                className="w-full text-sm md:text-xs border rounded px-2 py-2 md:px-1 md:py-1"
                              />
                              <div className="grid grid-cols-3 gap-1">
                                {DURATION_OPTIONS.map(d => (
                                  <button
                                    key={d}
                                    type="button"
                                    onClick={() => setAddForm(f => f && { ...f, duration_hours: d })}
                                    className={`text-sm md:text-xs py-2 md:py-1 rounded border transition-colors ${
                                      addForm?.duration_hours === d
                                        ? 'bg-blue-600 border-blue-600 text-white font-semibold'
                                        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400'
                                    }`}
                                  >{d}h</button>
                                ))}
                              </div>
                              <input
                                type="text"
                                placeholder="Notes (optional)"
                                value={addForm?.notes}
                                onChange={e => setAddForm(f => f && { ...f, notes: e.target.value })}
                                className="w-full text-sm md:text-xs border rounded px-2 py-2 md:px-1 md:py-1"
                              />
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Equipment (optional)</label>
                                <select
                                  value={addForm?.kite_id || ''}
                                  onChange={e => setAddForm(f => f && { ...f, kite_id: e.target.value || null })}
                                  className="w-full text-sm md:text-xs border rounded px-2 py-2 md:px-1 md:py-1"
                                >
                                  <option value="">No kite</option>
                                  {equipment.filter(e => e.category === 'kite' && e.is_active).map(e => (
                                    <option key={e.id} value={e.id}>🪁 {e.name}</option>
                                  ))}
                                </select>
                                <select
                                  value={addForm?.board_id || ''}
                                  onChange={e => setAddForm(f => f && { ...f, board_id: e.target.value || null })}
                                  className="w-full text-sm md:text-xs border rounded px-2 py-2 md:px-1 md:py-1"
                                >
                                  <option value="">No board</option>
                                  {equipment.filter(e => e.category !== 'kite' && e.is_active).map(e => (
                                    <option key={e.id} value={e.id}>🏄 {e.name}</option>
                                  ))}
                                </select>
                              </div>
                            </>
                          ) : (
                            <>
                              {/* Activity form */}
                              <input
                                type="text"
                                placeholder="Activity name *"
                                value={addForm?.name}
                                onChange={e => setAddForm(f => f && { ...f, name: e.target.value })}
                                className="w-full text-sm md:text-xs border rounded px-2 py-2 md:px-1 md:py-1"
                                autoFocus
                              />
                              <input
                                type="text"
                                placeholder="Notes (optional)"
                                value={addForm?.actNotes}
                                onChange={e => setAddForm(f => f && { ...f, actNotes: e.target.value })}
                                className="w-full text-sm md:text-xs border rounded px-2 py-2 md:px-1 md:py-1"
                              />
                            </>
                          )}
                          <div className="flex gap-1 pt-0.5">
                            <button
                              onClick={() => setAddForm(null)}
                              className="flex-1 text-sm md:text-xs py-2 md:py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded font-medium"
                            >Cancel</button>
                            <button
                              onClick={submitAdd}
                              disabled={
                                (addForm?.kind === 'activity' && !addForm?.name) ||
                                (addForm?.kind === 'lesson' && !addForm?.participant_ids[0]) ||
                                (addForm?.kind === 'rental' && !addForm?.rental_participant_id)
                              }
                              className="flex-1 text-sm md:text-xs py-2 md:py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium disabled:opacity-40"
                            >Add</button>
                          </div>
                        </div>
                      ) : (
                        /* Add / paste buttons */
                        <div className="flex flex-wrap gap-1 mt-1">
                          <button
                            onClick={() => openAdd(iso, slot, 'lesson')}
                            className="text-sm md:text-xs text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 px-2.5 py-2 md:px-1.5 md:py-0.5 rounded border border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
                          >+ Lesson</button>
                          <button
                            onClick={() => openAdd(iso, slot, 'activity')}
                            className="text-sm md:text-xs text-gray-400 dark:text-gray-500 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 px-2.5 py-2 md:px-1.5 md:py-0.5 rounded border border-dashed border-gray-300 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-800 transition-colors"
                          >+ Activity</button>
                          <button
                            onClick={() => openAdd(iso, slot, 'rental')}
                            className="text-sm md:text-xs text-gray-400 dark:text-gray-500 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 px-2.5 py-2 md:px-1.5 md:py-0.5 rounded border border-dashed border-gray-300 dark:border-gray-700 hover:border-amber-400 dark:hover:border-amber-700 transition-colors"
                          >+ Rental</button>
                          {clipboard && (
                            <button
                              onClick={() => pasteLesson(iso, slot)}
                              className="text-sm md:text-xs text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 px-2.5 py-2 md:px-1.5 md:py-0.5 rounded border border-amber-300 dark:border-amber-800 transition-colors font-medium"
                            >📋 Paste</button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Daily total footer */}
              {(() => {
                const dayLessons = lessons.filter(l => l.date === iso)
                const dayRentals = rentals.filter(r => r.date === iso)
                const lessonTotal = dayLessons.reduce((sum, l) => {
                  const instr = instructors.find(i => i.id === l.instructor_id)
                  const rate = l.type === 'private' ? (instr?.rate_private ?? 0)
                             : l.type === 'group'   ? (instr?.rate_group ?? 0)
                             : (instr?.rate_supervision ?? 0)
                  return sum + rate * l.duration_hours
                }, 0)
                const rentalTotal = dayRentals.reduce((sum, r) => sum + r.price, 0)
                const total = lessonTotal + rentalTotal
                if (total === 0 && dayLessons.length === 0) return null
                return (
                  <div className="border-t px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-b-lg flex items-center justify-between">
                    <div className="flex gap-2 text-xs text-gray-400 dark:text-gray-500">
                      {dayLessons.length > 0 && <span>{dayLessons.length} lesson{dayLessons.length > 1 ? 's' : ''}</span>}
                      {dayRentals.length > 0 && <span>{dayRentals.length} rental{dayRentals.length > 1 ? 's' : ''}</span>}
                    </div>
                    <span className={`text-sm font-bold ${total > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
                      €{total}
                    </span>
                  </div>
                )
              })()}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 text-xs text-gray-500 dark:text-gray-400">
        {(['private', 'group', 'supervision'] as LessonType[]).map(t => (
          <span key={t} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm ${LESSON_TYPE_CFG[t].dot}`} />
            {LESSON_TYPE_CFG[t].label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-orange-400" /> Activity
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> Rental
        </span>
        <span className="text-gray-400 dark:text-gray-500 ml-2">· ↔ to move · ⎘ to copy</span>
      </div>

      {/* Edit modal */}
      {editLesson && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-bold text-gray-800 dark:text-gray-200">Edit lesson</h3>
              <button onClick={() => setEditLesson(null)} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-bold">✕</button>
            </div>
            <form onSubmit={submitEdit} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type</label>
                <div className="grid grid-cols-3 gap-1">
                  {(['private', 'group', 'supervision'] as LessonType[]).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEditData(d => ({ ...d, type: t }))}
                      className={`text-sm py-1.5 px-1 rounded border transition-colors text-center leading-tight ${
                        editData.type === t
                          ? `${LESSON_TYPE_CFG[t].card} font-semibold ring-1 ring-inset ring-current`
                          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <div>{LESSON_TYPE_CFG[t].icon}</div>
                      <div>{LESSON_TYPE_CFG[t].label}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date</label>
                <input
                  type="date"
                  value={editData.date || ''}
                  onChange={e => setEditData(d => ({ ...d, date: e.target.value }))}
                  className="w-full text-sm border rounded px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {editData.type === 'group' ? 'Participants' : 'Participant'}
                </label>
                {renderParticipantChips({
                  candidates: bookingParticipants,
                  selectedIds: editData.participant_ids ?? [],
                  onToggle: id => setEditData(d => {
                    if (d.type !== 'group') return { ...d, participant_ids: [id] }
                    const ids = d.participant_ids ?? []
                    const has = ids.includes(id)
                    if (has) {
                      if (ids.length <= 1) return d
                      return { ...d, participant_ids: ids.filter(x => x !== id) }
                    }
                    return { ...d, participant_ids: [...ids, id] }
                  }),
                })}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Instructor</label>
                <select
                  value={editData.instructor_id || ''}
                  onChange={e => setEditData(d => ({ ...d, instructor_id: e.target.value }))}
                  className="w-full text-sm border rounded px-2 py-1.5"
                >
                  {instructors.map(i => (
                    <option key={i.id} value={i.id}>{i.first_name} {i.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Time</label>
                <input
                  type="time"
                  value={editData.start_time || ''}
                  onChange={e => setEditData(d => ({ ...d, start_time: e.target.value }))}
                  className="w-full text-sm border rounded px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Duration</label>
                <div className="grid grid-cols-3 gap-1">
                  {DURATION_OPTIONS.map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setEditData(ed => ({ ...ed, duration_hours: d }))}
                      className={`text-sm py-1.5 rounded border transition-colors ${
                        (editData.duration_hours || 1) === d
                          ? 'bg-blue-600 border-blue-600 text-white font-semibold'
                          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400'
                      }`}
                    >{d}h</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
                <input
                  type="text"
                  value={editData.notes ?? ''}
                  onChange={e => setEditData(d => ({ ...d, notes: e.target.value || null }))}
                  className="w-full text-sm border rounded px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Kite (optional)</label>
                <select
                  value={editData.kite_id || ''}
                  onChange={e => setEditData(d => ({ ...d, kite_id: e.target.value || null }))}
                  className="w-full text-sm border rounded px-2 py-1.5"
                >
                  <option value="">None</option>
                  {equipment.filter(e => e.category === 'kite' && e.is_active).map(e => (
                    <option key={e.id} value={e.id}>🪁 {e.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Board (optional)</label>
                <select
                  value={editData.board_id || ''}
                  onChange={e => setEditData(d => ({ ...d, board_id: e.target.value || null }))}
                  className="w-full text-sm border rounded px-2 py-1.5"
                >
                  <option value="">None</option>
                  {equipment.filter(e => e.category !== 'kite' && e.is_active).map(e => (
                    <option key={e.id} value={e.id}>🏄 {e.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => deleteLesson(editLesson.id)}
                  className="px-3 py-2 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded font-medium text-sm"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setEditLesson(null)}
                  className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Rental edit modal ── */}
      {editRental && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditRental(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-bold text-gray-800 dark:text-gray-200">Edit rental</h3>
              <button onClick={() => setEditRental(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">✕</button>
            </div>
            <form onSubmit={submitEditRental} className="p-4 space-y-3">
              {/* Participant */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Guest (tap again to clear)</label>
                {renderParticipantChips({
                  candidates: bookingParticipants,
                  selectedIds: editRentalParticipantId ? [editRentalParticipantId] : [],
                  onToggle: id => setEditRentalParticipantId(prev => prev === id ? '' : id),
                })}
              </div>
              {/* Type */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type</label>
                <div className="grid grid-cols-3 gap-1">
                  {RENTAL_TYPES.map(rt => (
                    <button key={rt.key} type="button"
                      onClick={() => setEditRentalType(rt.key)}
                      className={`text-xs py-1.5 px-1 rounded border text-center leading-tight transition-colors ${editRentalType === rt.key ? 'bg-amber-500 border-amber-600 dark:border-amber-500 text-white font-semibold' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-amber-300 dark:hover:border-amber-800'}`}>
                      <div>{rt.icon}</div>
                      <div>{rt.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              {/* Equipment */}
              {(editRentalType === 'kite' || editRentalType === 'full') && (
                <select value={editRentalKiteId ?? ''} onChange={e => setEditRentalKiteId(e.target.value || null)}
                  className="w-full text-sm border rounded px-2 py-1.5">
                  <option value="">🪁 Kite — not specified</option>
                  {equipment.filter(e => e.category === 'kite' && e.is_active).map(e => (
                    <option key={e.id} value={e.id}>🪁 {e.name}</option>
                  ))}
                </select>
              )}
              {(editRentalType === 'board' || editRentalType === 'full') && (
                <select value={editRentalBoardId ?? ''} onChange={e => setEditRentalBoardId(e.target.value || null)}
                  className="w-full text-sm border rounded px-2 py-1.5">
                  <option value="">🏄 Board — not specified</option>
                  {equipment.filter(e => e.category === 'board' && e.is_active).map(e => (
                    <option key={e.id} value={e.id}>🏄 {e.name}</option>
                  ))}
                </select>
              )}
              {/* Slot + Price */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Slot</label>
                  <select value={editRentalSlot} onChange={e => setEditRentalSlot(e.target.value as 'morning' | 'afternoon' | 'full_day')}
                    className="w-full text-sm border rounded px-2 py-1.5">
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="full_day">Full day</option>
                  </select>
                </div>
                <div className="w-24">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Price (€)</label>
                  <input type="number" min="0" step="0.5"
                    value={editRentalPrice} onChange={e => setEditRentalPrice(e.target.value)}
                    className="w-full text-sm border rounded px-2 py-1.5 text-right font-semibold" />
                </div>
              </div>
              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
                <input type="text" value={editRentalNotes} onChange={e => setEditRentalNotes(e.target.value)}
                  placeholder="Optional" className="w-full text-sm border rounded px-2 py-1.5" />
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <button type="button" onClick={() => deleteRental(editRental.id)}
                  className="px-3 py-2 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded font-medium text-sm">Delete</button>
                <button type="button" onClick={() => setEditRental(null)}
                  className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded font-medium text-sm">Cancel</button>
                <button type="submit"
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Mobile action sheet: labeled Copy/Move/Edit/Delete instead of tiny icons ── */}
      {actionSheetItem && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center md:hidden"
          onClick={() => setActionSheetItem(null)}
        >
          <div className="bg-white dark:bg-gray-900 rounded-t-xl shadow-xl w-full p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]" onClick={e => e.stopPropagation()}>
            {actionSheetItem.kind === 'lesson' && (
              <button
                onClick={() => { copyLesson(actionSheetItem.item); setActionSheetItem(null) }}
                className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-base font-medium text-gray-800 dark:text-gray-200"
              >⎘ Copy</button>
            )}
            <button
              onClick={() => {
                if (actionSheetItem.kind === 'lesson') openMoveLesson(actionSheetItem.item)
                else openMoveRental(actionSheetItem.item)
                setActionSheetItem(null)
              }}
              className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-base font-medium text-gray-800 dark:text-gray-200"
            >↔ Move</button>
            <button
              onClick={() => {
                if (actionSheetItem.kind === 'lesson') openEdit(actionSheetItem.item)
                else openEditRental(actionSheetItem.item)
                setActionSheetItem(null)
              }}
              className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-base font-medium text-gray-800 dark:text-gray-200"
            >✏️ Edit</button>
            <button
              onClick={() => {
                if (actionSheetItem.kind === 'lesson') deleteLesson(actionSheetItem.item.id)
                else deleteRental(actionSheetItem.item.id)
                setActionSheetItem(null)
              }}
              className="w-full text-left px-4 py-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-base font-medium text-red-600 dark:text-red-400"
            >✕ Delete</button>
            <button
              onClick={() => setActionSheetItem(null)}
              className="w-full text-center px-4 py-3 mt-1 border-t text-gray-500 dark:text-gray-400 font-medium"
            >Cancel</button>
          </div>
        </div>
      )}

      {/* ── Move modal (lesson or rental → new date/slot) ── */}
      {moveItem && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setMoveItem(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-bold text-gray-800 dark:text-gray-200">Move {moveItem.kind}</h3>
              <button onClick={() => setMoveItem(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date</label>
                <input
                  type="date"
                  value={moveDate}
                  onChange={e => setMoveDate(e.target.value)}
                  className="w-full text-sm border rounded px-2 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Slot</label>
                {moveItem.kind === 'lesson' ? (
                  <div className="grid grid-cols-3 gap-1">
                    {SLOTS.map(slot => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setMoveLessonSlot(slot)}
                        className={`text-sm py-2 px-1 rounded border text-center transition-colors ${
                          moveLessonSlot === slot
                            ? 'bg-emerald-500 border-emerald-600 dark:border-emerald-500 text-white font-semibold'
                            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-emerald-300 dark:hover:border-emerald-800'
                        }`}
                      >
                        {SLOT_CONFIG[slot].icon} {SLOT_CONFIG[slot].label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1">
                    {(['morning', 'afternoon', 'full_day'] as const).map(slot => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setMoveRentalSlot(slot)}
                        className={`text-sm py-2 px-1 rounded border text-center transition-colors ${
                          moveRentalSlot === slot
                            ? 'bg-emerald-500 border-emerald-600 dark:border-emerald-500 text-white font-semibold'
                            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-emerald-300 dark:hover:border-emerald-800'
                        }`}
                      >
                        {slot === 'morning' ? 'Morning' : slot === 'afternoon' ? 'Afternoon' : 'Full day'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <button type="button" onClick={() => setMoveItem(null)}
                  className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded font-medium text-sm">Cancel</button>
                <button type="button" onClick={submitMove}
                  className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium text-sm">Move</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
