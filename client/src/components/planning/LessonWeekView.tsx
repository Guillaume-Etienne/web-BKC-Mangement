import { useState } from 'react'
import type { Lesson, DayActivity, DaySlot, LessonType, LessonDiscipline, Booking, BookingParticipant, EquipmentRental, RentalSlot, Instructor, Client, Equipment, PriceItem, PriceTier, Agency, AgencyBillingLine, DiningEvent, DiningEventCost, Lang } from '../../types/database'
import { useTable } from '../../hooks/useSupabase'
import { eventDailyContribution } from '../../utils/diningEventCosts'
import { rentalBillable, lessonDiscipline } from '../../types/database'
import { currentInstructorRate, reFreezeInstructorRate, resolveLessonRate, agencyMarker, getLessonClientRate } from '../accounting/utils'
import { toISODate as dateToISO, localeTag } from '../../utils/dates'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'
import { RENTAL_TYPES, boardPickerCategory, rentalGear, rentalKind, rentalLabel, showsKitePicker, type RentalKind } from './rentalTypes'
import WalkInForm from './WalkInForm'
import type { WalkInRequest } from './walkInSave'
import { isDayVisitor, isOnSiteOn } from '../../utils/dayVisitor'
import type { BillActivityRequest } from '../../utils/billedActivities'

// ─── Config ──────────────────────────────────────────────────────────────────

type Slot = DaySlot

const SLOTS: Slot[] = ['morning', 'afternoon', 'evening']

function slotConfig(lang: Lang): Record<Slot, { label: string; icon: string; defaultTime: string }> {
  return {
    morning:   { label: i18n.planning.slot_morning[lang],   icon: '🌅', defaultTime: '09:00' },
    afternoon: { label: i18n.planning.slot_afternoon[lang], icon: '☀️', defaultTime: '14:00' },
    evening:   { label: i18n.planning.slot_evening[lang],   icon: '🌙', defaultTime: '19:00' },
  }
}

function lessonTypeCfg(lang: Lang): Record<LessonType, { label: string; icon: string; card: string; badge: string; dot: string }> {
  return {
    private:    { label: i18n.planning.lesson_type_private[lang],     icon: '🧑‍🏫', card: 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-400', badge: 'bg-purple-500 text-white', dot: 'bg-purple-500' },
    group:      { label: i18n.planning.lesson_type_group[lang],       icon: '👥', card: 'bg-green-50 dark:bg-green-950/40  border-green-300 dark:border-green-800  text-green-900 dark:text-green-400',  badge: 'bg-green-500  text-white', dot: 'bg-green-500'  },
    supervision:{ label: i18n.planning.lesson_type_supervision[lang], icon: '🎓', card: 'bg-blue-50 dark:bg-blue-950/40   border-blue-300 dark:border-blue-800   text-blue-900 dark:text-blue-400',   badge: 'bg-blue-500   text-white', dot: 'bg-blue-500'   },
  }
}

const DURATION_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3]

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

/** One rider's kite (or wing sail) and board in a lesson. */
type GearPick = { kite_id: string | null; board_id: string | null }

interface AddForm {
  date: string
  slot: Slot
  kind: 'lesson' | 'activity' | 'rental'
  // lesson fields
  type: LessonType
  discipline: LessonDiscipline   // 'kite' unless the Wing box is ticked
  participant_ids: string[]
  instructor_id: string
  start_time: string
  duration_hours: number
  notes: string
  kite_id: string | null
  board_id: string | null
  rider_gear: Record<string, GearPick>   // per rider, group lessons only (key = participant id)
  // activity fields
  name: string
  actNotes: string
  act_bill: boolean          // "Bill to guests" ticked
  act_participant_ids: string[]
  act_price_pp: string       // € per guest, as typed
  act_cost: string           // € total cost to us, optional
  // rental fields
  rental_participant_id: string
  rental_slot: RentalSlot
  rental_type: RentalKind
  rental_price: number
  rental_kite_id: string | null
  rental_board_id: string | null
  rental_notes: string          // internal
  rental_client_note: string    // the guest can read this one
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
  priceTiers: PriceTier[]
  agencies: Agency[]
  agencyBillingLines: AgencyBillingLine[]
  onAddLesson: (l: Omit<Lesson, 'id'>) => void
  onUpdateLesson: (l: Lesson) => void
  onDeleteLesson: (id: string) => void
  onAddActivity: (a: Omit<DayActivity, 'id'>) => void
  /** "Bill to guests" on an activity: adds it to each involved booking's bill */
  onBillActivity: (req: BillActivityRequest) => void
  onDeleteActivity: (id: string) => void
  onAddRental: (r: Omit<EquipmentRental, 'id'>) => void
  onUpdateRental: (r: EquipmentRental) => void
  onDeleteRental: (id: string) => void
  /** Walk-in: creates (or reuses) the visit behind the scenes — see walkInSave.
   *  Resolves true once saved, so the form can close. */
  onAddWalkIn: (req: WalkInRequest) => Promise<boolean>
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LessonWeekView({
  days, lessons, dayActivities,
  bookings, instructors, clients, bookingParticipants, equipment, rentals, priceItems, priceTiers,
  agencies, agencyBillingLines,
  onAddLesson, onUpdateLesson, onDeleteLesson,
  onAddActivity, onBillActivity, onDeleteActivity,
  onAddRental, onUpdateRental, onDeleteRental,
  onAddWalkIn,
}: LessonWeekViewProps) {
  const { lang } = useLanguage()
  const SLOT_CONFIG = slotConfig(lang)
  const LESSON_TYPE_CFG = lessonTypeCfg(lang)
  const today = dateToISO(new Date())

  // Events of the Now tab ticked "count in the day's figure" (trip, excursion…) add
  // their revenue net of the provider cost to the day's total, below.
  const { data: diningEvents } = useTable<DiningEvent>('dining_events')
  const { data: eventCosts } = useTable<DiningEventCost>('dining_event_costs')

  // ── Inline add form ────────────────────────────────────────────────────────
  const emptyForm = (date: string, slot: Slot, kind: 'lesson' | 'activity' | 'rental'): AddForm => {
    const firstParticipant = activeParticipantsForDate(date)[0]?.id ?? ''
    const rentalSlot: RentalSlot = slot === 'morning' ? 'morning' : slot === 'afternoon' ? 'afternoon' : 'full_day'
    return {
    date, slot, kind,
    type: 'private', discipline: 'kite', participant_ids: [firstParticipant], instructor_id: instructors[0]?.id ?? '',
    start_time: SLOT_CONFIG[slot].defaultTime, duration_hours: 1, notes: '', kite_id: null, board_id: null, rider_gear: {},
    name: '', actNotes: '', act_bill: false, act_participant_ids: [], act_price_pp: '', act_cost: '',
    rental_participant_id: firstParticipant,
    rental_slot: rentalSlot,
    rental_type: 'kite' as RentalKind,
    rental_price: rentalPrice('kite', rentalSlot) ?? 0,
    rental_kite_id: null,
    rental_board_id: null,
    rental_notes: '',
    rental_client_note: '',
  }}

  const [addForm, setAddForm] = useState<AddForm | null>(null)
  // Walk-in form (modal): the day and slot it was opened from.
  const [walkIn, setWalkIn] = useState<{ date: string; slot: Slot } | null>(null)
  // Off by default: only guests checked in that day. Escape hatch for edge
  // cases (early arrivals, data not quite in sync) — reset on each new form.
  const [showAllGuests, setShowAllGuests] = useState(false)

  // ── Edit modal ─────────────────────────────────────────────────────────────
  const [editLesson, setEditLesson] = useState<Lesson | null>(null)
  const [editData, setEditData] = useState<Partial<Lesson>>({})
  const [editRiderGear, setEditRiderGear] = useState<Record<string, GearPick>>({})
  // Same escape hatch as the add-form's, reset on each open — see candidatesForEdit.
  const [showAllGuestsEditLesson, setShowAllGuestsEditLesson] = useState(false)

  // ── Rental edit ────────────────────────────────────────────────────────────
  const [editRental, setEditRental] = useState<EquipmentRental | null>(null)
  const [showAllGuestsEditRental, setShowAllGuestsEditRental] = useState(false)
  const [editRentalPrice, setEditRentalPrice] = useState('')
  const [editRentalSlot, setEditRentalSlot] = useState<'morning' | 'afternoon' | 'full_day'>('morning')
  const [editRentalParticipantId, setEditRentalParticipantId] = useState('')
  const [editRentalType, setEditRentalType] = useState<RentalKind>('kite')
  const [editRentalKiteId, setEditRentalKiteId] = useState<string | null>(null)
  const [editRentalBoardId, setEditRentalBoardId] = useState<string | null>(null)
  const [editRentalNotes, setEditRentalNotes] = useState('')
  const [editRentalClientNote, setEditRentalClientNote] = useState('')

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
  function rentalPrice(type: RentalKind, slot: RentalSlot): number | null {
    if (type === 'free') return 0
    return priceItems.find(p => p.billable_type === rentalBillable(type, slot))?.price ?? null
  }

  /** Gear lists follow the lesson's discipline, so there is less to sort through:
   *  a wing lesson offers only wing-category gear (sails, foilboards, paddles) in
   *  both slots; every other lesson offers kites and the regular boards. Bars have
   *  no slot on a lesson. */
  function gearOptions(discipline: LessonDiscipline) {
    const active = equipment.filter(e => e.is_active)
    if (discipline !== 'kite') {
      const wing = active.filter(e => e.category === 'wing')
      return { sails: wing, boards: wing }
    }
    return {
      sails: active.filter(e => e.category === 'kite'),
      boards: active.filter(e => e.category === 'board' || e.category === 'surfboard' || e.category === 'foilboard'),
    }
  }

  /** The equipment pickers of the lesson forms. One pair for the lesson, or one
   *  pair PER RIDER when a group lesson has several riders. */
  function renderGearSection(o: {
    compact: boolean
    type: LessonType
    discipline: LessonDiscipline
    participantIds: string[]
    solo: GearPick
    riders: Record<string, GearPick>
    onSolo: (g: GearPick) => void
    onRider: (participantId: string, g: GearPick) => void
  }) {
    const { sails, boards } = gearOptions(o.discipline)
    const wing = o.discipline !== 'kite'
    const selCls = o.compact
      ? 'w-full text-sm md:text-xs border rounded px-2 py-2 md:px-1 md:py-1'
      : 'w-full text-sm border rounded px-2 py-1.5'
    const pair = (value: GearPick, onChange: (g: GearPick) => void) => (
      <>
        <select value={value.kite_id || ''} onChange={e => onChange({ ...value, kite_id: e.target.value || null })} className={selCls}>
          <option value="">{wing ? 'No wing' : 'No kite'}</option>
          {sails.map(e => <option key={e.id} value={e.id}>{wing ? '🌬️' : '🪂'} {e.name}</option>)}
        </select>
        <select value={value.board_id || ''} onChange={e => onChange({ ...value, board_id: e.target.value || null })} className={selCls}>
          <option value="">No board</option>
          {boards.map(e => <option key={e.id} value={e.id}>🏄 {e.name}</option>)}
        </select>
      </>
    )
    const perRider = o.type === 'group' && o.participantIds.length > 1
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {perRider ? 'Equipment per rider (optional)' : 'Equipment (optional)'}
        </label>
        {perRider
          ? o.participantIds.map(pid => {
              const person = bookingParticipants.find(bp => bp.id === pid)
              // A legacy group lesson holds ONE kite/board on the lesson itself: show it
              // on the first rider until the lesson is saved with per-rider rows.
              const value = o.riders[pid] ?? (pid === o.participantIds[0] ? o.solo : { kite_id: null, board_id: null })
              return (
                <div key={pid} className="rounded border border-gray-200 dark:border-gray-800 p-1.5 space-y-1">
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">{person?.first_name} {person?.last_name}</div>
                  {pair(value, g => o.onRider(pid, g))}
                </div>
              )
            })
          : pair(o.solo, o.onSolo)}
      </div>
    )
  }

  /** Per-rider rows to save, from the form's picks. Empty when the lesson is not a
   *  multi-rider group (then the lesson's own kite_id/board_id are the whole story). */
  function riderGearRows(type: LessonType, participantIds: string[], riders: Record<string, GearPick>, solo: GearPick) {
    if (!(type === 'group' && participantIds.length > 1)) return []
    return participantIds.flatMap(pid => {
      const g = riders[pid] ?? (pid === participantIds[0] ? solo : undefined)
      return g && (g.kite_id || g.board_id)
        ? [{ lesson_id: '', participant_id: pid, kite_id: g.kite_id, board_id: g.board_id }]
        : []
    })
  }

  /** The Wing / Discovery boxes of the lesson forms. Hidden for supervision (no wing rate).
   *  Discovery = wing without the foil board: a cheaper hourly rate. */
  function renderWingToggle(type: LessonType, discipline: LessonDiscipline, onChange: (d: LessonDiscipline) => void) {
    if (type === 'supervision') return null
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm md:text-xs text-gray-700 dark:text-gray-300">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={discipline !== 'kite'} onChange={e => onChange(e.target.checked ? 'wing' : 'kite')} />
          Wing
        </label>
        {discipline !== 'kite' && (
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={discipline === 'wing_discovery'} onChange={e => onChange(e.target.checked ? 'wing_discovery' : 'wing')} />
            Discovery (no foil board)
          </label>
        )}
      </div>
    )
  }

  /** What the instructor is paid, frozen onto the lesson at creation. A different
   *  scale from what the client pays — Options → Instructors, not Pricing. */
  function instructorPay(instructorId: string, type: LessonType): number | null {
    const instr = instructors.find(i => i.id === instructorId)
    return instr ? currentInstructorRate({ type }, instr) : null
  }

  /** Client price €/h from Options → Pricing, keyed by what it bills (never by
   *  name) — tiered for private/group when the participant's cumulative hours
   *  reach a configured threshold (see resolveLessonRate). `null` when nothing
   *  is configured at all, so the lesson freezes with an unresolved price
   *  rather than a wrong zero. */
  function lessonPrice(type: LessonType, participantIds: string[], discipline: LessonDiscipline = 'kite'): number | null {
    return resolveLessonRate(
      { id: '', type, discipline, participant_ids: participantIds, price_per_hour: null },
      priceItems,
      { tiers: priceTiers, allLessons: lessons, bookingParticipants }
    )
  }

  /** "(FF)" for anything attached to a partner agency — the booking's own tag,
   *  or the invoice line this very service is billed on. One helper for lessons
   *  and rentals alike, so the two can never disagree on the same card. */
  function markerFor(row: { booking_id?: string | null; agency_billing_line_id?: string | null }): string | null {
    return agencyMarker(row, { agencies, bookings, agencyBillingLines })
  }

  /** 🚶 on a card whose booking is a walk-in visit — the only place a visit
   *  shows up in the planning, so it has to read as one. */
  function isWalkIn(bookingId: string | null | undefined): boolean {
    const b = bookingId ? bookings.find(x => x.id === bookingId) : undefined
    return !!b && isDayVisitor(b)
  }

  // ── Booking lookup ────────────────────────────────────────────────────────
  function bookingForParticipant(participantId: string): string {
    return bookingParticipants.find(p => p.id === participantId)?.booking_id ?? ''
  }

  /** "Bill to guests" is complete: at least one guest and a valid price. */
  function activityBillReady(f: AddForm): boolean {
    const p = parseFloat(f.act_price_pp)
    const c = f.act_cost.trim() === '' ? 0 : parseFloat(f.act_cost)
    return f.act_bill && f.act_participant_ids.length > 0 && !isNaN(p) && p >= 0 && !isNaN(c) && c >= 0
  }

  function activeParticipantsForDate(date: string): BookingParticipant[] {
    // isOnSiteOn: a walk-in visit counts on its own day only, although its
    // check_out is the next day (utils/dayVisitor.ts).
    const activeIds = new Set(bookings.filter(b => isOnSiteOn(b, date)).map(b => b.id))
    // No silent fallback to "everyone" here — an empty result genuinely means
    // no one is checked in that day. Callers that want to override this (the
    // "Show all guests" checkbox) pass `bookingParticipants` directly instead.
    return bookingParticipants.filter(p => activeIds.has(p.booking_id))
  }

  // Edit modals default to this instead of the full guest list (illegible on
  // a base with many bookings): active-on-that-day, plus whoever is already
  // picked even if their booking isn't active anymore — so an edit never
  // silently hides the person it's about. "Show all guests" still escapes to
  // the full list for the rare case of picking someone else entirely.
  function candidatesForEdit(date: string, selectedIds: string[]): BookingParticipant[] {
    const active = activeParticipantsForDate(date)
    const missing = bookingParticipants.filter(p => selectedIds.includes(p.id) && !active.some(a => a.id === p.id))
    return missing.length ? [...active, ...missing] : active
  }

  // ── Fallback name lookup (from booking's client when no participant) ─────────
  function bookingClient(bookingId: string | null): Client | undefined {
    const bid = bookingId ?? ''
    const clientId = bookings.find(b => b.id === bid)?.client_id
    return clients.find(c => c.id === clientId)
  }

  // ── Participant picker: tappable chips grouped by booking, instead of a
  // native <select> (can't show a colored avatar inside an <option>). Both
  // add- and edit-forms default to activeParticipantsForDate / candidatesForEdit
  // and offer a "show all guests" checkbox to escape to the full list.
  function renderParticipantChips(opts: {
    candidates: BookingParticipant[]
    selectedIds: string[]
    onToggle: (id: string) => void
  }) {
    const { candidates, selectedIds, onToggle } = opts
    if (candidates.length === 0) {
      return (
        <p className="text-xs text-gray-400 dark:text-gray-400 italic px-0.5">
          {i18n.planning.msg_no_guests_checked_in[lang]}
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
              <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-400 uppercase tracking-wide mb-1 px-0.5">
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
    if (confirm(i18n.planning.msg_confirm_delete_rental[lang])) {
      if (editRental?.id === id) setEditRental(null)
      onDeleteRental(id)
    }
  }

  function openEditRental(r: EquipmentRental) {
    const type = rentalKind(r, equipment) ?? 'free'
    setEditRental(r)
    setEditRentalPrice(String(r.price))
    setEditRentalSlot(r.slot)
    setEditRentalParticipantId(r.participant_id ?? '')
    setEditRentalType(type)
    // The inverse of rentalGear. Older rows hold one piece of gear and their type
    // was deduced from its category, so the same rule sorts it into the right slot.
    setEditRentalKiteId(showsKitePicker(type) ? r.equipment_id : null)
    setEditRentalBoardId(type === 'full' ? r.board_equipment_id ?? null : boardPickerCategory(type) ? r.equipment_id : null)
    setEditRentalNotes(r.notes ?? '')
    setEditRentalClientNote(r.client_note ?? '')
    setShowAllGuestsEditRental(false)
  }

  function submitEditRental(e: React.FormEvent) {
    e.preventDefault()
    if (!editRental) return
    const price = parseFloat(editRentalPrice)
    if (isNaN(price) || price < 0) return
    // The frozen grid price only moves when what is rented changes (or was never
    // recorded): editing a note or a discount must not re-grid an old rental.
    const sameProduct = editRental.rental_type === editRentalType && editRental.slot === editRentalSlot
    onUpdateRental({
      ...editRental,
      price,
      slot: editRentalSlot,
      participant_id: editRentalParticipantId || null,
      booking_id: editRentalParticipantId ? bookingForParticipant(editRentalParticipantId) || editRental.booking_id : editRental.booking_id,
      ...rentalGear(editRentalType, editRentalKiteId, editRentalBoardId),
      rental_type: editRentalType,
      list_price: sameProduct && editRental.list_price != null ? editRental.list_price : rentalPrice(editRentalType, editRentalSlot),
      notes: editRentalNotes || null,
      client_note: editRentalClientNote || null,
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
      // Supervision has no wing rate, so it stays a kite row whatever the box says.
      const discipline: LessonDiscipline = addForm.type === 'supervision' ? 'kite' : addForm.discipline
      const gearRows = riderGearRows(addForm.type, addForm.participant_ids, addForm.rider_gear, { kite_id: addForm.kite_id, board_id: addForm.board_id })
      const perRider = addForm.type === 'group' && addForm.participant_ids.length > 1
      onAddLesson({
        booking_id: bookingForParticipant(addForm.participant_ids[0] ?? ''),
        instructor_id: addForm.instructor_id,
        participant_ids: addForm.participant_ids,
        date: addForm.date,
        start_time: addForm.start_time,
        duration_hours: addForm.duration_hours,
        type: addForm.type,
        // Only sent for wing: a kite row omits the column, so saving a kite lesson
        // keeps working on a database the migration has not reached yet.
        ...(discipline !== 'kite' && { discipline }),
        notes: addForm.notes || null,
        // With per-rider rows the lesson keeps the FIRST rider's gear, so any screen
        // that only reads these two columns stays coherent.
        kite_id: perRider ? (gearRows[0]?.kite_id ?? null) : addForm.kite_id,
        board_id: perRider ? (gearRows[0]?.board_id ?? null) : addForm.board_id,
        ...(gearRows.length > 0 && { rider_gear: gearRows }),
        // Freeze BOTH of today's scales: changing the price list or someone's pay
        // later must not reprice this lesson (same rule as booking_room_prices).
        price_per_hour: lessonPrice(addForm.type, addForm.participant_ids, discipline),
        instructor_rate: instructorPay(addForm.instructor_id, addForm.type),
      })
    } else if (addForm.kind === 'activity') {
      onAddActivity({
        date: addForm.date,
        slot: addForm.slot,
        name: addForm.name,
        notes: addForm.actNotes || null,
      })
      if (activityBillReady(addForm)) {
        onBillActivity({
          date: addForm.date,
          label: addForm.name,
          pricePerPerson: parseFloat(addForm.act_price_pp),
          totalCost: parseFloat(addForm.act_cost) || 0,
          notes: addForm.actNotes || null,
          guests: addForm.act_participant_ids.map(id => ({ participantId: id, bookingId: bookingForParticipant(id) }))
            .filter(g => g.bookingId),
        })
      }
    } else {
      onAddRental({
        ...rentalGear(addForm.rental_type, addForm.rental_kite_id, addForm.rental_board_id),
        booking_id: bookingForParticipant(addForm.rental_participant_id) || null,
        participant_id: addForm.rental_participant_id || null,
        date: addForm.date,
        slot: addForm.rental_slot,
        rental_type: addForm.rental_type,
        price: addForm.rental_price,
        // Frozen now, like every price: a later grid change must not rewrite it.
        list_price: rentalPrice(addForm.rental_type, addForm.rental_slot),
        notes: addForm.rental_notes || null,
        client_note: addForm.rental_client_note || null,
      })
    }
    setAddForm(null)
  }

  // ── Edit handlers ─────────────────────────────────────────────────────────
  function openEdit(lesson: Lesson) {
    setEditLesson(lesson)
    setEditData({ ...lesson })
    setEditRiderGear(Object.fromEntries((lesson.rider_gear ?? []).map(g => [g.participant_id, { kite_id: g.kite_id, board_id: g.board_id }])))
    setShowAllGuestsEditLesson(false)
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editLesson) return
    // Re-freeze the payout if this lesson just changed instructor or type —
    // see reFreezeInstructorRate. The client price is deliberately NOT touched:
    // it can be overridden by hand from Accounting, and recomputing it here
    // would quietly undo that decision.
    const merged = { ...editLesson, ...editData } as Lesson
    // A lesson belongs to its guests' booking, exactly as when it is created
    // (see the add handler). Changing the guests has to move it with them —
    // otherwise it stays on the old booking: billed and shown in the accounting
    // under someone else, and absent from the guests' own booking.
    const firstGuestId = merged.participant_ids?.[0]
    const bookingId = (firstGuestId && bookingForParticipant(firstGuestId)) || editLesson.booking_id
    // Switching kite ↔ wing ↔ discovery is a deliberate change of product, so
    // unlike every other edit it re-freezes the client price at the new rate.
    const disciplineNow: LessonDiscipline = merged.type === 'supervision' ? 'kite' : lessonDiscipline(merged)
    const disciplineChanged = disciplineNow !== lessonDiscipline(editLesson)
    const gearRows = riderGearRows(merged.type, merged.participant_ids, editRiderGear, { kite_id: merged.kite_id, board_id: merged.board_id })
    const perRider = merged.type === 'group' && merged.participant_ids.length > 1
    const withDiscipline: Lesson = {
      ...merged, booking_id: bookingId,
      kite_id: perRider ? (gearRows[0]?.kite_id ?? null) : merged.kite_id,
      board_id: perRider ? (gearRows[0]?.board_id ?? null) : merged.board_id,
      rider_gear: gearRows,
      ...(disciplineChanged && {
        discipline: disciplineNow,
        price_per_hour: lessonPrice(merged.type, merged.participant_ids, disciplineNow),
      }),
    }
    onUpdateLesson(reFreezeInstructorRate(withDiscipline, editLesson, instructors))
    setEditLesson(null)
  }

  function deleteLesson(id: string) {
    if (confirm(i18n.planning.msg_confirm_delete_lesson[lang])) {
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
          <span>📋 {i18n.planning.msg_lesson_copied[lang]}</span>
          <span className="font-semibold">
            {bookingParticipants.find(p => p.id === clipboard.participant_ids[0])?.first_name}{' '}
            {bookingParticipants.find(p => p.id === clipboard.participant_ids[0])?.last_name}
            {clipboard.participant_ids.length > 1 && ` +${clipboard.participant_ids.length - 1}`}
            {' · '}{LESSON_TYPE_CFG[clipboard.type].label}{' · '}{clipboard.start_time}
          </span>
          <span className="text-gray-500 dark:text-gray-400 text-xs">{i18n.planning.hint_click_paste[lang]}</span>
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
                  {day.toLocaleDateString(localeTag(lang), { weekday: 'long' })}
                </div>
                <div className={`text-lg font-bold leading-tight ${isToday ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>
                  {day.toLocaleDateString(localeTag(lang), { day: 'numeric', month: 'short' })}
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
                                {lessonDiscipline(lesson) !== 'kite' && (
                                  <span className="px-1 rounded text-xs font-medium bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300">
                                    {lessonDiscipline(lesson) === 'wing_discovery' ? 'Wing · Discovery' : 'Wing'}
                                  </span>
                                )}
                                <span className={`px-1 rounded text-xs font-medium ${tc.badge}`}>{tc.label}</span>
                              </div>
                            </div>
                            <div className="font-semibold truncate flex items-center gap-1">
                              {firstClient && <Avatar id={firstClient.id} first_name={firstClient.first_name} last_name={firstClient.last_name} />}
                              {/* "(FF)" — the booking came through an agency, or this
                                  very lesson sits on one of their packages. Before the
                                  name and non-shrinking: on a narrow column the name
                                  gives way first. */}
                              {isWalkIn(lesson.booking_id) && (
                                <span className="shrink-0" title={i18n.planning.walkin_badge[lang]}>🚶</span>
                              )}
                              {markerFor(lesson) && (
                                <span className="shrink-0" title="Agency booking">{markerFor(lesson)}</span>
                              )}
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
                              className="text-gray-400 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 text-sm md:text-xs p-1.5 md:px-1 md:py-0"
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
                        // What it is comes from the stored type (older rows: the gear's category).
                        const rt = RENTAL_TYPES.find(t => t.key === rentalKind(r, equipment))
                        const gearNames = [equip?.name, equipment.find(e => e.id === r.board_equipment_id)?.name].filter(Boolean).join(' + ')
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
                                className="text-gray-400 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 text-xs px-1"
                                title="Move"
                              >↔</button>
                              <button
                                onClick={() => openEditRental(r)}
                                className="text-gray-400 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 text-xs px-1"
                                title="Edit"
                              >✏️</button>
                              <button
                                onClick={() => deleteRental(r.id)}
                                className="text-gray-400 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 text-xs px-1"
                                title="Delete"
                              >✕</button>
                            </div>
                            <div className="flex items-center justify-between pr-9 md:pr-4">
                              <span className="font-semibold">{rt?.icon ?? '📦'} {rentalLabel(rt?.key ?? null, 'staff')}</span>
                              <span className="text-amber-700 dark:text-amber-400 font-semibold">
                                {r.list_price != null && r.list_price > r.price && (
                                  <span className="font-normal line-through opacity-60 mr-1" title="Grid price">€{r.list_price}</span>
                                )}
                                €{r.price}
                              </span>
                            </div>
                            {gearNames && <div className="text-[11px] opacity-60 truncate">{gearNames}</div>}
                            <div className="opacity-70 truncate flex items-center gap-1">
                              {client && <Avatar id={client.id} first_name={client.first_name} last_name={client.last_name} />}
                              {isWalkIn(r.booking_id) && (
                                <span className="shrink-0" title={i18n.planning.walkin_badge[lang]}>🚶</span>
                              )}
                              {markerFor(r) && (
                                <span className="shrink-0 font-semibold" title="Agency booking">{markerFor(r)}</span>
                              )}
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
                                {i18n.planning.label_show_all_guests[lang]}
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
                                      rental_price: rentalPrice(rt.key, f.rental_slot) ?? 0,
                                      // A board picked for one category is wrong for another.
                                      rental_board_id: boardPickerCategory(rt.key) === boardPickerCategory(f.rental_type) ? f.rental_board_id : null,
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
                              {addForm && showsKitePicker(addForm.rental_type) && (
                                <select
                                  value={addForm?.rental_kite_id ?? ''}
                                  onChange={e => setAddForm(f => f && { ...f, rental_kite_id: e.target.value || null })}
                                  className="w-full text-sm md:text-xs border rounded px-2 py-2 md:px-1 md:py-1"
                                >
                                  <option value="">🪂 Kite — not specified</option>
                                  {equipment.filter(e => e.category === 'kite' && e.is_active).map(e => (
                                    <option key={e.id} value={e.id}>🪂 {e.name}</option>
                                  ))}
                                </select>
                              )}
                              {addForm && boardPickerCategory(addForm.rental_type) && (
                                <select
                                  value={addForm.rental_board_id ?? ''}
                                  onChange={e => setAddForm(f => f && { ...f, rental_board_id: e.target.value || null })}
                                  className="w-full text-sm md:text-xs border rounded px-2 py-2 md:px-1 md:py-1"
                                >
                                  <option value="">🏄 {rentalLabel(addForm.rental_type === 'full' ? 'board' : addForm.rental_type, 'staff')} — not specified</option>
                                  {equipment.filter(e => e.category === boardPickerCategory(addForm.rental_type) && e.is_active).map(e => (
                                    <option key={e.id} value={e.id}>🏄 {e.name}</option>
                                  ))}
                                </select>
                              )}
                              {/* Slot + Price */}
                              <div className="flex gap-1 items-center">
                                <select
                                  value={addForm?.rental_slot}
                                  onChange={e => setAddForm(f => {
                                    if (!f) return f
                                    const slot = e.target.value as RentalSlot
                                    // The price follows the slot's rate unless it was typed by hand.
                                    const untouched = f.rental_price === (rentalPrice(f.rental_type, f.rental_slot) ?? 0)
                                    return { ...f, rental_slot: slot, rental_price: untouched ? rentalPrice(f.rental_type, slot) ?? 0 : f.rental_price }
                                  })}
                                  className="flex-1 text-sm md:text-xs border rounded px-2 py-2 md:px-1 md:py-1"
                                >
                                  <option value="morning">{i18n.planning.slot_morning[lang]}</option>
                                  <option value="afternoon">{i18n.planning.slot_afternoon[lang]}</option>
                                  <option value="full_day">{i18n.planning.slot_full_day[lang]}</option>
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
                              {addForm && rentalPrice(addForm.rental_type, addForm.rental_slot) === null && (
                                <p className="text-[10px] text-red-500 dark:text-red-400 leading-tight">
                                  No rate set for this type — see Options → Pricing. Type the price here to bill this one.
                                </p>
                              )}
                              {addForm && (rentalPrice(addForm.rental_type, addForm.rental_slot) ?? 0) > addForm.rental_price && (
                                <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-tight">
                                  Discount: grid price is €{rentalPrice(addForm.rental_type, addForm.rental_slot)}.
                                </p>
                              )}
                              <input
                                type="text"
                                placeholder="Note for us (internal)"
                                value={addForm?.rental_notes}
                                onChange={e => setAddForm(f => f && { ...f, rental_notes: e.target.value })}
                                className="w-full text-sm md:text-xs border rounded px-2 py-2 md:px-1 md:py-1"
                              />
                              <input
                                type="text"
                                placeholder="Note for the guest (visible on their page)"
                                value={addForm?.rental_client_note}
                                onChange={e => setAddForm(f => f && { ...f, rental_client_note: e.target.value })}
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
                              {renderWingToggle(addForm?.type ?? 'private', addForm?.discipline ?? 'kite', d => setAddForm(f => f && { ...f, discipline: d }))}
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
                                {i18n.planning.label_show_all_guests[lang]}
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
                              {renderGearSection({
                                compact: true,
                                type: addForm?.type ?? 'private',
                                discipline: addForm?.discipline ?? 'kite',
                                participantIds: addForm?.participant_ids ?? [],
                                solo: { kite_id: addForm?.kite_id ?? null, board_id: addForm?.board_id ?? null },
                                riders: addForm?.rider_gear ?? {},
                                onSolo: g => setAddForm(f => f && { ...f, ...g }),
                                onRider: (pid, g) => setAddForm(f => f && { ...f, rider_gear: { ...f.rider_gear, [pid]: g } }),
                              })}
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
                              {/* Bill to guests — optional: adds it to each guest's booking bill */}
                              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 px-0.5 cursor-pointer">
                                <input type="checkbox" checked={!!addForm?.act_bill}
                                  onChange={e => setAddForm(f => f && { ...f, act_bill: e.target.checked })} />
                                {i18n.planning.label_bill_guests[lang]}
                              </label>
                              {addForm?.act_bill && (
                                <>
                                  {renderParticipantChips({
                                    candidates: showAllGuests ? bookingParticipants : activeParticipantsForDate(addForm?.date ?? ''),
                                    selectedIds: addForm?.act_participant_ids ?? [],
                                    onToggle: id => setAddForm(f => f && {
                                      ...f,
                                      act_participant_ids: f.act_participant_ids.includes(id)
                                        ? f.act_participant_ids.filter(x => x !== id)
                                        : [...f.act_participant_ids, id],
                                    }),
                                  })}
                                  <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 px-0.5">
                                    <input type="checkbox" checked={showAllGuests} onChange={e => setShowAllGuests(e.target.checked)} />
                                    {i18n.planning.label_show_all_guests[lang]}
                                  </label>
                                  <div className="grid grid-cols-2 gap-1">
                                    <input type="number" min="0" step="0.01" inputMode="decimal"
                                      placeholder={i18n.planning.ph_price_per_guest[lang]}
                                      value={addForm?.act_price_pp}
                                      onChange={e => setAddForm(f => f && { ...f, act_price_pp: e.target.value })}
                                      className="w-full text-sm md:text-xs border rounded px-2 py-2 md:px-1 md:py-1" />
                                    <input type="number" min="0" step="0.01" inputMode="decimal"
                                      placeholder={i18n.planning.ph_our_cost[lang]}
                                      value={addForm?.act_cost}
                                      onChange={e => setAddForm(f => f && { ...f, act_cost: e.target.value })}
                                      className="w-full text-sm md:text-xs border rounded px-2 py-2 md:px-1 md:py-1" />
                                  </div>
                                  {addForm && activityBillReady(addForm) && (
                                    <p className="text-xs text-blue-600 dark:text-blue-400 px-0.5">
                                      {i18n.planning.msg_bill_total[lang]
                                        .replace('{count}', String(addForm.act_participant_ids.length))
                                        .replace('{total}', `${Math.round(parseFloat(addForm.act_price_pp) * addForm.act_participant_ids.length * 100) / 100} €`)}
                                    </p>
                                  )}
                                </>
                              )}
                            </>
                          )}
                          <div className="flex gap-1 pt-0.5">
                            <button
                              onClick={() => setAddForm(null)}
                              className="flex-1 text-sm md:text-xs py-2 md:py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded font-medium"
                            >{i18n.common.btn_cancel[lang]}</button>
                            <button
                              onClick={submitAdd}
                              disabled={
                                (addForm?.kind === 'activity' && !addForm?.name) ||
                                (addForm?.kind === 'activity' && !!addForm?.act_bill && !activityBillReady(addForm)) ||
                                (addForm?.kind === 'lesson' && !addForm?.participant_ids[0]) ||
                                (addForm?.kind === 'rental' && !addForm?.rental_participant_id)
                              }
                              className="flex-1 text-sm md:text-xs py-2 md:py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium disabled:opacity-40"
                            >{i18n.common.btn_add[lang]}</button>
                          </div>
                        </div>
                      ) : (
                        /* Add / paste buttons */
                        <div className="flex flex-wrap gap-1 mt-1">
                          <button
                            onClick={() => openAdd(iso, slot, 'lesson')}
                            className="text-sm md:text-xs text-gray-400 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 px-2.5 py-2 md:px-1.5 md:py-0.5 rounded border border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
                          >{i18n.planning.btn_add_lesson[lang]}</button>
                          <button
                            onClick={() => openAdd(iso, slot, 'activity')}
                            className="text-sm md:text-xs text-gray-400 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 px-2.5 py-2 md:px-1.5 md:py-0.5 rounded border border-dashed border-gray-300 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-800 transition-colors"
                          >{i18n.planning.btn_add_activity[lang]}</button>
                          <button
                            onClick={() => openAdd(iso, slot, 'rental')}
                            className="text-sm md:text-xs text-gray-400 dark:text-gray-400 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 px-2.5 py-2 md:px-1.5 md:py-0.5 rounded border border-dashed border-gray-300 dark:border-gray-700 hover:border-amber-400 dark:hover:border-amber-700 transition-colors"
                          >{i18n.planning.btn_add_rental[lang]}</button>
                          <button
                            onClick={() => setWalkIn({ date: iso, slot })}
                            className="text-sm md:text-xs text-gray-400 dark:text-gray-400 hover:text-teal-700 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 px-2.5 py-2 md:px-1.5 md:py-0.5 rounded border border-dashed border-gray-300 dark:border-gray-700 hover:border-teal-400 dark:hover:border-teal-700 transition-colors"
                          >{i18n.planning.btn_add_walkin[lang]}</button>
                          {clipboard && (
                            <button
                              onClick={() => pasteLesson(iso, slot)}
                              className="text-sm md:text-xs text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 px-2.5 py-2 md:px-1.5 md:py-0.5 rounded border border-amber-300 dark:border-amber-800 transition-colors font-medium"
                            >{i18n.planning.btn_paste[lang]}</button>
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
                // Everything the day GENERATED, whoever pays it: frozen client
                // price, group billed per head. Prepaid / agency-billed lines are
                // counted too (unlike computeLessonsRevenue, which is what the
                // CLIENT owes). It used to sum the instructors' PAY rates, which
                // is a different number altogether.
                const tierCtx = { tiers: priceTiers, allLessons: lessons, bookingParticipants }
                const lessonTotal = dayLessons.reduce((sum, l) => {
                  const base = getLessonClientRate(l, priceItems, tierCtx) * l.duration_hours
                  return sum + (l.type === 'group' ? base * l.participant_ids.length : base)
                }, 0)
                const rentalTotal = dayRentals.reduce((sum, r) => sum + r.price, 0)
                const dayEvents = diningEvents.filter(ev =>
                  ev.date === iso && eventCosts.some(c => c.dining_event_id === ev.id && c.count_in_daily))
                const eventTotal = dayEvents.reduce((sum, ev) =>
                  sum + eventDailyContribution(ev, eventCosts.find(c => c.dining_event_id === ev.id)), 0)
                const total = Math.round((lessonTotal + rentalTotal + eventTotal) * 100) / 100
                if (total === 0 && dayLessons.length === 0 && dayEvents.length === 0) return null
                return (
                  <div className="border-t px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-b-lg flex items-center justify-between">
                    <div className="flex gap-2 text-xs text-gray-400 dark:text-gray-400">
                      {dayLessons.length > 0 && <span>{dayLessons.length} lesson{dayLessons.length > 1 ? 's' : ''}</span>}
                      {dayRentals.length > 0 && <span>{dayRentals.length} rental{dayRentals.length > 1 ? 's' : ''}</span>}
                      {dayEvents.length > 0 && <span>{dayEvents.length} event{dayEvents.length > 1 ? 's' : ''}</span>}
                    </div>
                    <span className={`text-sm font-bold ${total > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-400'}`}>
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
          <span className="w-2.5 h-2.5 rounded-sm bg-orange-400" /> {i18n.planning.legend_activity[lang]}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> {i18n.planning.legend_rental[lang]}
        </span>
        <span className="flex items-center gap-1.5">🚶 {i18n.planning.legend_walkin[lang]}</span>
        <span className="text-gray-400 dark:text-gray-400 ml-2">{i18n.planning.legend_move_copy_hint[lang]}</span>
      </div>

      {/* Walk-in modal */}
      {walkIn && (
        <WalkInForm
          date={walkIn.date}
          defaultTime={SLOT_CONFIG[walkIn.slot].defaultTime}
          defaultRentalSlot={walkIn.slot === 'afternoon' ? 'afternoon' : walkIn.slot === 'morning' ? 'morning' : 'full_day'}
          clients={clients}
          bookings={bookings}
          bookingParticipants={bookingParticipants}
          lessons={lessons}
          instructors={instructors}
          equipment={equipment}
          priceItems={priceItems}
          priceTiers={priceTiers}
          onSubmit={onAddWalkIn}
          onClose={() => setWalkIn(null)}
        />
      )}

      {/* Edit modal */}
      {editLesson && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b shrink-0">
              <h3 className="font-bold text-gray-800 dark:text-gray-200">{i18n.planning.title_edit_lesson[lang]}</h3>
              <button onClick={() => setEditLesson(null)} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-bold">✕</button>
            </div>
            {/* Participant chips below list every guest in the booking data (no
                date filter here) — can run long, so this has to scroll inside
                the modal or the page behind it scrolls instead and Save/Cancel
                become unreachable. */}
            <form onSubmit={submitEdit} className="p-4 space-y-3 overflow-y-auto min-h-0 flex-1">
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
              {renderWingToggle(editData.type ?? editLesson.type, lessonDiscipline(editData), d => setEditData(prev => ({ ...prev, discipline: d })))}
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
                  candidates: showAllGuestsEditLesson
                    ? bookingParticipants
                    : candidatesForEdit(editData.date ?? editLesson.date, editData.participant_ids ?? []),
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
                <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 px-0.5 mt-1">
                  <input type="checkbox" checked={showAllGuestsEditLesson} onChange={e => setShowAllGuestsEditLesson(e.target.checked)} />
                  {i18n.planning.label_show_all_guests[lang]}
                </label>
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
              {renderGearSection({
                compact: false,
                type: editData.type ?? editLesson.type,
                discipline: lessonDiscipline(editData),
                participantIds: editData.participant_ids ?? editLesson.participant_ids,
                solo: { kite_id: editData.kite_id ?? null, board_id: editData.board_id ?? null },
                riders: editRiderGear,
                onSolo: g => setEditData(d => ({ ...d, ...g })),
                onRider: (pid, g) => setEditRiderGear(r => ({ ...r, [pid]: g })),
              })}
              <div className="flex gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => deleteLesson(editLesson.id)}
                  className="px-3 py-2 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded font-medium text-sm"
                >
                  {i18n.common.btn_delete[lang]}
                </button>
                <button
                  type="button"
                  onClick={() => setEditLesson(null)}
                  className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded font-medium text-sm"
                >
                  {i18n.common.btn_cancel[lang]}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm"
                >
                  {i18n.common.btn_save[lang]}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Rental edit modal ── */}
      {editRental && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditRental(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-sm max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <h3 className="font-bold text-gray-800 dark:text-gray-200">{i18n.planning.title_edit_rental[lang]}</h3>
              <button onClick={() => setEditRental(null)} className="text-gray-400 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">✕</button>
            </div>
            <form onSubmit={submitEditRental} className="p-4 space-y-3 overflow-y-auto min-h-0 flex-1">
              {/* Participant */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Guest (tap again to clear)</label>
                {renderParticipantChips({
                  candidates: showAllGuestsEditRental
                    ? bookingParticipants
                    : candidatesForEdit(editRental.date, editRentalParticipantId ? [editRentalParticipantId] : []),
                  selectedIds: editRentalParticipantId ? [editRentalParticipantId] : [],
                  onToggle: id => setEditRentalParticipantId(prev => prev === id ? '' : id),
                })}
                <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 px-0.5 mt-1">
                  <input type="checkbox" checked={showAllGuestsEditRental} onChange={e => setShowAllGuestsEditRental(e.target.checked)} />
                  {i18n.planning.label_show_all_guests[lang]}
                </label>
              </div>
              {/* Type */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type</label>
                <div className="grid grid-cols-3 gap-1">
                  {RENTAL_TYPES.map(rt => (
                    <button key={rt.key} type="button"
                      onClick={() => {
                        // Same rule as the slot: a price that still equals the old rate follows the new type.
                        if (editRentalPrice === String(rentalPrice(editRentalType, editRentalSlot) ?? 0)) {
                          setEditRentalPrice(String(rentalPrice(rt.key, editRentalSlot) ?? 0))
                        }
                        if (boardPickerCategory(rt.key) !== boardPickerCategory(editRentalType)) setEditRentalBoardId(null)
                        setEditRentalType(rt.key)
                      }}
                      className={`text-xs py-1.5 px-1 rounded border text-center leading-tight transition-colors ${editRentalType === rt.key ? 'bg-amber-500 border-amber-600 dark:border-amber-500 text-white font-semibold' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-amber-300 dark:hover:border-amber-800'}`}>
                      <div>{rt.icon}</div>
                      <div>{rt.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              {/* Equipment */}
              {showsKitePicker(editRentalType) && (
                <select value={editRentalKiteId ?? ''} onChange={e => setEditRentalKiteId(e.target.value || null)}
                  className="w-full text-sm border rounded px-2 py-1.5">
                  <option value="">🪂 Kite — not specified</option>
                  {equipment.filter(e => e.category === 'kite' && e.is_active).map(e => (
                    <option key={e.id} value={e.id}>🪂 {e.name}</option>
                  ))}
                </select>
              )}
              {boardPickerCategory(editRentalType) && (
                <select value={editRentalBoardId ?? ''} onChange={e => setEditRentalBoardId(e.target.value || null)}
                  className="w-full text-sm border rounded px-2 py-1.5">
                  <option value="">🏄 {rentalLabel(editRentalType === 'full' ? 'board' : editRentalType, 'staff')} — not specified</option>
                  {equipment.filter(e => e.category === boardPickerCategory(editRentalType) && e.is_active).map(e => (
                    <option key={e.id} value={e.id}>🏄 {e.name}</option>
                  ))}
                </select>
              )}
              {/* Slot + Price */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Slot</label>
                  <select value={editRentalSlot} onChange={e => {
                    const slot = e.target.value as RentalSlot
                    // The price follows the slot's rate unless it was typed by hand.
                    if (editRentalPrice === String(rentalPrice(editRentalType, editRentalSlot) ?? 0)) {
                      setEditRentalPrice(String(rentalPrice(editRentalType, slot) ?? 0))
                    }
                    setEditRentalSlot(slot)
                  }}
                    className="w-full text-sm border rounded px-2 py-1.5">
                    <option value="morning">{i18n.planning.slot_morning[lang]}</option>
                    <option value="afternoon">{i18n.planning.slot_afternoon[lang]}</option>
                    <option value="full_day">{i18n.planning.slot_full_day[lang]}</option>
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
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Note for us (internal)</label>
                <input type="text" value={editRentalNotes} onChange={e => setEditRentalNotes(e.target.value)}
                  placeholder="Optional" className="w-full text-sm border rounded px-2 py-1.5" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Note for the guest (visible on their page)</label>
                <input type="text" value={editRentalClientNote} onChange={e => setEditRentalClientNote(e.target.value)}
                  placeholder="Optional" className="w-full text-sm border rounded px-2 py-1.5" />
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <button type="button" onClick={() => deleteRental(editRental.id)}
                  className="px-3 py-2 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded font-medium text-sm">{i18n.common.btn_delete[lang]}</button>
                <button type="button" onClick={() => setEditRental(null)}
                  className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded font-medium text-sm">{i18n.common.btn_cancel[lang]}</button>
                <button type="submit"
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm">{i18n.common.btn_save[lang]}</button>
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
              >⎘ {i18n.common.btn_copy[lang]}</button>
            )}
            <button
              onClick={() => {
                if (actionSheetItem.kind === 'lesson') openMoveLesson(actionSheetItem.item)
                else openMoveRental(actionSheetItem.item)
                setActionSheetItem(null)
              }}
              className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-base font-medium text-gray-800 dark:text-gray-200"
            >↔ {i18n.common.btn_move[lang]}</button>
            <button
              onClick={() => {
                if (actionSheetItem.kind === 'lesson') openEdit(actionSheetItem.item)
                else openEditRental(actionSheetItem.item)
                setActionSheetItem(null)
              }}
              className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-base font-medium text-gray-800 dark:text-gray-200"
            >✏️ {i18n.common.btn_edit[lang]}</button>
            <button
              onClick={() => {
                if (actionSheetItem.kind === 'lesson') deleteLesson(actionSheetItem.item.id)
                else deleteRental(actionSheetItem.item.id)
                setActionSheetItem(null)
              }}
              className="w-full text-left px-4 py-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-base font-medium text-red-600 dark:text-red-400"
            >✕ {i18n.common.btn_delete[lang]}</button>
            <button
              onClick={() => setActionSheetItem(null)}
              className="w-full text-center px-4 py-3 mt-1 border-t text-gray-500 dark:text-gray-400 font-medium"
            >{i18n.common.btn_cancel[lang]}</button>
          </div>
        </div>
      )}

      {/* ── Move modal (lesson or rental → new date/slot) ── */}
      {moveItem && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setMoveItem(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-bold text-gray-800 dark:text-gray-200">{i18n.planning.title_move[lang]} {moveItem.kind}</h3>
              <button onClick={() => setMoveItem(null)} className="text-gray-400 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">✕</button>
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
                        {slot === 'morning' ? i18n.planning.slot_morning[lang] : slot === 'afternoon' ? i18n.planning.slot_afternoon[lang] : i18n.planning.slot_full_day[lang]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <button type="button" onClick={() => setMoveItem(null)}
                  className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded font-medium text-sm">{i18n.common.btn_cancel[lang]}</button>
                <button type="button" onClick={submitMove}
                  className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium text-sm">{i18n.common.btn_move[lang]}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
