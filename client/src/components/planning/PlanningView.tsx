import { useState, useCallback, useRef, useMemo, useEffect, type JSX } from 'react'
import PlanningRow from './PlanningRow'
import TotalsRow from './TotalsRow'
import LessonWeekView from './LessonWeekView'
import NowView from './NowView'
import ForecastView from './ForecastView'
import type { Booking, BookingRoom, Lesson, DayActivity, EquipmentRental, HouseRental, PriceItem, BookingParticipant, Room, Accommodation } from '../../types/database'
import { useBookingDrag, CELL_W, type DragMode } from '../../hooks/useBookingDrag'
import { useAccommodations, useRooms } from '../../hooks/useAccommodations'
import { useTable } from '../../hooks/useSupabase'
import { useBookings, useBookingRooms, useBookingParticipants } from '../../hooks/useBookings'
import { useLessons, useDayActivities } from '../../hooks/useLessons'
import { useInstructors } from '../../hooks/useInstructors'
import { useClients } from '../../hooks/useClients'
import { useEquipment, useEquipmentRentals } from '../../hooks/useEquipment'
import { supabase } from '../../lib/supabase'

// ── Booking quick view modal ───────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = { confirmed: 'Confirmed', provisional: 'Provisional', cancelled: 'Cancelled' }
const STATUS_COLOR: Record<string, string> = { confirmed: 'bg-emerald-100 text-emerald-800', provisional: 'bg-amber-100 text-amber-800', cancelled: 'bg-gray-100 text-gray-500' }

interface BookingQuickViewProps {
  booking: Booking
  rooms: Room[]
  accommodations: Accommodation[]
  bookingRooms: BookingRoom[]
  participants: BookingParticipant[]
  onClose: () => void
  onEdit: () => void
}

function BookingQuickView({ booking, rooms, accommodations, bookingRooms, participants, onClose, onEdit }: BookingQuickViewProps) {
  const clientName = booking.client ? `${booking.client.first_name} ${booking.client.last_name}` : '?'
  const roomLabels = bookingRooms
    .filter(br => br.booking_id === booking.id)
    .map(br => {
      const room = rooms.find(r => r.id === br.room_id)
      const acc  = room ? accommodations.find(a => a.id === room.accommodation_id) : null
      return acc && room ? `${acc.name} / ${room.name}` : '?'
    })

  const rows: [string, string][] = [
    ['Check-in',  booking.check_in],
    ['Check-out', booking.check_out],
    ['Status',    STATUS_LABEL[booking.status] ?? booking.status],
    ['Room(s)',   roomLabels.join(', ') || '—'],
    ['Guests',    participants.length > 0 ? participants.map(p => `${p.first_name}${p.last_name ? ` ${p.last_name}` : ''}`).join(', ') : '—'],
    ['Lessons',   String(booking.num_lessons)],
    ['Rentals',   String(booking.num_equipment_rentals)],
  ]
  if (booking.notes) rows.push(['Notes', booking.notes])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-800">
              #{String(booking.booking_number).padStart(3, '0')} — {clientName}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[booking.status]}`}>
              {STATUS_LABEL[booking.status]}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>
        <div className="px-4 py-3 space-y-1.5">
          {rows.map(([label, value]) => (
            <div key={label} className="flex gap-2 text-sm">
              <span className="text-gray-400 w-20 shrink-0">{label}</span>
              <span className="text-gray-800 font-medium">{value}</span>
            </div>
          ))}
        </div>
        <div className="px-4 pb-4">
          <button
            onClick={onEdit}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            ✏️ Edit booking
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Draft move types ──────────────────────────────────────────────────────────
interface RoomSwap { from: string; to: string }
interface DraftMove {
  checkIn: string
  checkOut: string
  originalCheckIn: string
  originalCheckOut: string
  roomSwaps: RoomSwap[]
}

// ── Validate modal (module scope) ─────────────────────────────────────────────
interface ValidateModalProps {
  draftMoves: Map<string, DraftMove>
  bookings: Booking[]
  rooms: { id: string; name: string; accommodation_id: string }[]
  accommodations: { id: string; name: string }[]
  onConfirm: () => Promise<void>
  onCancel: () => void
}
function ValidateModal({ draftMoves, bookings, rooms, accommodations, onConfirm, onCancel }: ValidateModalProps): JSX.Element {
  const [saving, setSaving] = useState(false)

  function roomLabel(roomId: string): string {
    const room = rooms.find(r => r.id === roomId)
    if (!room) return '?'
    const acc = accommodations.find(a => a.id === room.accommodation_id)
    return acc ? `${acc.name}/${room.name}` : room.name
  }

  async function handleConfirm() {
    setSaving(true)
    await onConfirm()
    setSaving(false)
  }

  const entries = Array.from(draftMoves.entries()).map(([bookingId, draft]) => {
    const booking = bookings.find(b => b.id === bookingId)
    const clientName = booking?.client
      ? `${booking.client.first_name} ${booking.client.last_name}`
      : '?'
    const bookingNum = booking ? `#${String(booking.booking_number).padStart(3, '0')}` : '?'
    const datesChanged = draft.checkIn !== draft.originalCheckIn || draft.checkOut !== draft.originalCheckOut
    return { bookingId, bookingNum, clientName, draft, datesChanged }
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold text-gray-800">Confirm {draftMoves.size} pending move{draftMoves.size > 1 ? 's' : ''}</h3>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-800 text-xl font-bold">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {entries.map(({ bookingId, bookingNum, clientName, draft, datesChanged }) => (
            <div key={bookingId} className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm space-y-1">
              <p className="font-semibold text-gray-800">{bookingNum} — {clientName}</p>
              {datesChanged && (
                <p className="text-gray-600">
                  📅 <span className="line-through text-gray-400">{draft.originalCheckIn} → {draft.originalCheckOut}</span>
                  {' '}→ <span className="font-medium text-blue-700">{draft.checkIn} → {draft.checkOut}</span>
                </p>
              )}
              {draft.roomSwaps.map((s, i) => (
                <p key={i} className="text-gray-600">
                  🏠 <span className="line-through text-gray-400">{roomLabel(s.from)}</span>
                  {' '}→ <span className="font-medium text-blue-700">{roomLabel(s.to)}</span>
                </p>
              ))}
            </div>
          ))}
        </div>
        <div className="flex gap-3 p-4 border-t">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium text-sm">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm disabled:opacity-60">
            {saving ? 'Saving…' : '✓ Confirm & Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d
}

/** Returns the September of the current kitesurf season (Sep–Mar). */
function getSeasonYear(today: Date): number {
  const m = today.getMonth()
  const y = today.getFullYear()
  if (m >= 8) return y       // Sep–Dec: season starts this year
  if (m <= 3) return y - 1   // Jan–Mar: season started last Sep
  return y                   // Apr–Aug: show upcoming season
}

export default function PlanningView({ onOpenBooking }: { onOpenBooking?: (id: string) => void } = {}) {
  const { data: accommodations } = useAccommodations()
  const { data: rooms } = useRooms()
  const { data: houseRentals } = useTable<HouseRental>('house_rentals')
  const { data: bookingsData } = useBookings()
  const { data: bookingRoomsData } = useBookingRooms()
  const { data: lessonsData } = useLessons()
  const { data: dayActivitiesData } = useDayActivities()
  const { data: instructors } = useInstructors()
  const { data: clients } = useClients()
  const { data: equipment } = useEquipment()
  const { data: rentalsData } = useEquipmentRentals()
  const { data: priceItems } = useTable<PriceItem>('price_items')
  const { data: bookingParticipants } = useBookingParticipants()
  const now = new Date()

  // ── Season (Sep → Mar) ──────────────────────────────────────────
  const [seasonYear, setSeasonYear] = useState(() => getSeasonYear(now))

  const seasonStart = useMemo(() => new Date(seasonYear, 8, 1), [seasonYear])
  const seasonEnd   = useMemo(() => new Date(seasonYear + 1, 2, 31), [seasonYear])

  const totalDays = useMemo(() =>
    Math.round((seasonEnd.getTime() - seasonStart.getTime()) / 86400000) + 1
  , [seasonStart, seasonEnd])

  // Month groups for the two-row header
  const monthGroups = useMemo(() => {
    const groups: { label: string; days: number; colStart: number }[] = []
    let col = 0
    let cursor = new Date(seasonStart)
    while (cursor <= seasonEnd) {
      const m = cursor.getMonth()
      const y = cursor.getFullYear()
      const days = new Date(y, m + 1, 0).getDate()
      groups.push({ label: `${MONTH_NAMES[m]} ${y}`, days, colStart: col })
      col += days
      cursor = new Date(y, m + 1, 1)
    }
    return groups
  }, [seasonStart, seasonEnd])

  // ── Month nav ────────────────────────────────────────────────────
  const currentMonthIdx = useMemo(() => {
    const m = now.getMonth()
    const y = now.getFullYear()
    // Iterate by calendar month to avoid DST millisecond drift
    const cursor = new Date(seasonStart.getFullYear(), seasonStart.getMonth(), 1)
    for (let i = 0; i < monthGroups.length; i++) {
      if (cursor.getMonth() === m && cursor.getFullYear() === y) return i
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return 0
  }, [monthGroups, seasonStart])

  const [navMonthIdx, setNavMonthIdx] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollToMonthIdx = useCallback((idx: number) => {
    if (scrollRef.current && monthGroups[idx]) {
      scrollRef.current.scrollLeft = monthGroups[idx].colStart * CELL_W
    }
  }, [monthGroups])

  const prevMonth = () => {
    const newIdx = Math.max(0, navMonthIdx - 1)
    setNavMonthIdx(newIdx)
    scrollToMonthIdx(newIdx)
  }
  const nextMonth = () => {
    const newIdx = Math.min(monthGroups.length - 1, navMonthIdx + 1)
    setNavMonthIdx(newIdx)
    scrollToMonthIdx(newIdx)
  }
  const goToNow = () => {
    setNavMonthIdx(currentMonthIdx)
    scrollToMonthIdx(currentMonthIdx)
  }

  const changeSeason = (delta: number) => {
    setSeasonYear(y => y + delta)
    setNavMonthIdx(0)
    // scroll to Sep (start of new season) after re-render
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollLeft = 0
    }, 0)
  }

  // ── Local state synced from hooks (needed for optimistic drag updates) ──────
  const [bookings, setBookings] = useState<Booking[]>([])
  const [bookingRooms, setBookingRooms] = useState<BookingRoom[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [dayActivities, setDayActivities] = useState<DayActivity[]>([])
  const [rentals, setRentals] = useState<EquipmentRental[]>([])

  useEffect(() => setBookings(bookingsData), [bookingsData])
  useEffect(() => setBookingRooms(bookingRoomsData), [bookingRoomsData])
  useEffect(() => setLessons(lessonsData), [lessonsData])
  useEffect(() => setDayActivities(dayActivitiesData), [dayActivitiesData])
  useEffect(() => setRentals(rentalsData), [rentalsData])

  // ── Booking quick view ──────────────────────────────────────────────────────
  const [quickViewBookingId, setQuickViewBookingId] = useState<string | null>(null)
  const quickViewBooking = quickViewBookingId ? bookings.find(b => b.id === quickViewBookingId) ?? null : null

  // ── Draft moves ────────────────────────────────────────────────────────────
  const [draftMoves, setDraftMoves] = useState<Map<string, DraftMove>>(new Map())
  const [showValidateModal, setShowValidateModal] = useState(false)

  // Ref so callbacks always see latest bookings without stale closure
  const bookingsRef = useRef(bookings)
  useEffect(() => { bookingsRef.current = bookings }, [bookings])

  // Visual positions merge draft changes on top of saved data
  const resolvedBookings = useMemo(() =>
    bookings.map(b => {
      const d = draftMoves.get(b.id)
      return d ? { ...b, check_in: d.checkIn, check_out: d.checkOut } : b
    }), [bookings, draftMoves])

  const resolvedBookingRooms = useMemo(() =>
    bookingRooms.map(br => {
      const d = draftMoves.get(br.booking_id)
      if (!d) return br
      const swap = d.roomSwaps.find(s => s.from === br.room_id)
      return swap ? { ...br, room_id: swap.to } : br
    }), [bookingRooms, draftMoves])

  // ── Tabs / lesson view ───────────────────────────────────────────
  const [planningTab, setPlanningTab] = useState<'accommodations' | 'lessons' | 'now' | 'forecast'>('accommodations')
  const [lessonView, setLessonView] = useState<'by-instructor' | 'by-client'>('by-instructor')
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOfWeek(new Date()))

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })
  const weekEnd = weekDays[6]
  const weekLabel = weekStart.getMonth() === weekEnd.getMonth()
    ? `${weekStart.getDate()} to ${weekEnd.getDate()} ${MONTH_SHORT[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`
    : `${weekStart.getDate()} ${MONTH_SHORT[weekStart.getMonth()]} – ${weekEnd.getDate()} ${MONTH_SHORT[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`

  const prevWeek = () => setWeekStart(d => { const nd = new Date(d); nd.setDate(nd.getDate() - 7); return nd })
  const nextWeek = () => setWeekStart(d => { const nd = new Date(d); nd.setDate(nd.getDate() + 7); return nd })
  const goToToday = () => setWeekStart(getMondayOfWeek(new Date()))

  // ── Accommodations ───────────────────────────────────────────────
  const activeAccommodations = accommodations.filter(a => a.is_active)
  const roomOrder: string[] = []
  for (const acc of activeAccommodations) {
    for (const room of rooms.filter(r => r.accommodation_id === acc.id)) {
      roomOrder.push(room.id)
    }
  }

  // Pre-compute unavailable day-index sets for house-type accommodations.
  // A day is unavailable if no house_rental period covers it.
  const unavailableByAccommodation = useMemo(() => {
    const map = new Map<string, Set<number>>()
    for (const acc of activeAccommodations) {
      if (acc.type !== 'house') continue
      const rentals = houseRentals.filter((r: HouseRental) => r.accommodation_id === acc.id)
      if (rentals.length === 0) {
        // No rentals at all → every day unavailable
        map.set(acc.id, new Set(Array.from({ length: totalDays }, (_, i) => i)))
        continue
      }
      const unavailable = new Set<number>()
      for (let i = 0; i < totalDays; i++) {
        // Compute local date for day i (avoids UTC drift)
        const d = new Date(seasonStart.getFullYear(), seasonStart.getMonth(), seasonStart.getDate() + i)
        const dayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const covered = rentals.some((r: HouseRental) => r.start_date <= dayStr && r.end_date >= dayStr)
        if (!covered) unavailable.add(i)
      }
      map.set(acc.id, unavailable)
    }
    return map
  }, [houseRentals, activeAccommodations, totalDays, seasonStart])

  function getBookingsForRoom(roomId: string): Booking[] {
    const ids = resolvedBookingRooms.filter(br => br.room_id === roomId).map(br => br.booking_id)
    return resolvedBookings.filter(b => ids.includes(b.id))
  }

  async function validateDrafts() {
    const bookingUpdates: { id: string; check_in: string; check_out: string }[] = []
    const roomUpdates:    { booking_id: string; from: string; to: string }[] = []

    for (const [bookingId, draft] of draftMoves) {
      const booking = bookings.find(b => b.id === bookingId)
      if (booking && (draft.checkIn !== booking.check_in || draft.checkOut !== booking.check_out)) {
        bookingUpdates.push({ id: bookingId, check_in: draft.checkIn, check_out: draft.checkOut })
      }
      for (const swap of draft.roomSwaps) {
        roomUpdates.push({ booking_id: bookingId, from: swap.from, to: swap.to })
      }
    }

    await Promise.all([
      ...bookingUpdates.map(u =>
        supabase.from('bookings').update({ check_in: u.check_in, check_out: u.check_out }).eq('id', u.id)
      ),
      ...roomUpdates.map(u =>
        supabase.from('booking_rooms').update({ room_id: u.to }).eq('booking_id', u.booking_id).eq('room_id', u.from)
      ),
    ])

    // Apply changes to local state so display stays consistent
    setBookings(prev => prev.map(b => {
      const upd = bookingUpdates.find(u => u.id === b.id)
      return upd ? { ...b, check_in: upd.check_in, check_out: upd.check_out } : b
    }))
    setBookingRooms(prev => prev.map(br => {
      const upd = roomUpdates.find(u => u.booking_id === br.booking_id && u.from === br.room_id)
      return upd ? { ...br, room_id: upd.to } : br
    }))

    setDraftMoves(new Map())
    setShowValidateModal(false)
  }

  function handleTabChange(newTab: typeof planningTab) {
    if (draftMoves.size > 0 && newTab !== planningTab) {
      if (!confirm(`You have ${draftMoves.size} unsaved move${draftMoves.size > 1 ? 's' : ''}. Leave without saving?`)) return
      setDraftMoves(new Map())
    }
    setPlanningTab(newTab)
  }

  const gridRef = useRef<HTMLDivElement>(null)

  const onBookingUpdate = useCallback((bookingId: string, dayDelta: number, mode: DragMode) => {
    setDraftMoves(prev => {
      const next = new Map(prev)
      const existing = next.get(bookingId)
      const booking = bookingsRef.current.find(b => b.id === bookingId)
      if (!booking) return prev
      const curIn  = existing?.checkIn  ?? booking.check_in
      const curOut = existing?.checkOut ?? booking.check_out
      let newIn = curIn, newOut = curOut
      if (mode === 'move')         { newIn = addDays(curIn, dayDelta); newOut = addDays(curOut, dayDelta) }
      else if (mode === 'resize-left')  { newIn = addDays(curIn, dayDelta) }
      else                              { newOut = addDays(curOut, dayDelta) }
      next.set(bookingId, {
        checkIn: newIn, checkOut: newOut,
        originalCheckIn:  booking.check_in,
        originalCheckOut: booking.check_out,
        roomSwaps: existing?.roomSwaps ?? [],
      })
      return next
    })
  }, [])

  const onBookingMove = useCallback((bookingId: string, fromRoomId: string, toRoomId: string) => {
    setDraftMoves(prev => {
      const next = new Map(prev)
      const existing = next.get(bookingId)
      const booking = bookingsRef.current.find(b => b.id === bookingId)
      if (!booking) return prev
      const newSwap: RoomSwap = { from: fromRoomId, to: toRoomId }
      const roomSwaps = existing
        ? existing.roomSwaps.filter(s => s.from !== fromRoomId).concat(newSwap)
        : [newSwap]
      next.set(bookingId, {
        checkIn:  existing?.checkIn  ?? booking.check_in,
        checkOut: existing?.checkOut ?? booking.check_out,
        originalCheckIn:  booking.check_in,
        originalCheckOut: booking.check_out,
        roomSwaps,
      })
      return next
    })
  }, [])

  // ── Lesson / Activity / Rental mutations ─────────────────────────
  const onAddLesson = useCallback(async (lesson: Omit<Lesson, 'id'>) => {
    const id = crypto.randomUUID()
    const l = { ...lesson, id }
    setLessons(prev => [...prev, l])
    // Strip virtual/relation fields before sending to DB
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { instructor: _i, clients: _c, ...row } = l
    const { error } = await supabase.from('lessons').insert([row])
    if (error) {
      console.error('Lesson save error:', error.message)
      setLessons(prev => prev.filter(x => x.id !== id))
      alert('Error saving lesson: ' + error.message)
    }
  }, [])

  const onUpdateLesson = useCallback(async (lesson: Lesson) => {
    setLessons(prev => prev.map(l => l.id === lesson.id ? lesson : l))
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, instructor: _i, clients: _c, ...fields } = lesson
    const { error } = await supabase.from('lessons').update(fields).eq('id', id)
    if (error) console.error('Lesson update error:', error.message)
  }, [])

  const onDeleteLesson = useCallback((id: string) => {
    setLessons(prev => prev.filter(l => l.id !== id))
    supabase.from('lessons').delete().eq('id', id)
  }, [])

  const onAddActivity = useCallback((activity: Omit<DayActivity, 'id'>) => {
    const id = crypto.randomUUID()
    const a = { ...activity, id }
    setDayActivities(prev => [...prev, a])
    supabase.from('day_activities').insert([a])
  }, [])

  const onDeleteActivity = useCallback((id: string) => {
    setDayActivities(prev => prev.filter(a => a.id !== id))
    supabase.from('day_activities').delete().eq('id', id)
  }, [])

  const onAddRental = useCallback(async (rental: Omit<EquipmentRental, 'id'>) => {
    const id = crypto.randomUUID()
    const r = { ...rental, id }
    setRentals(prev => [...prev, r])
    const { error } = await supabase.from('equipment_rentals').insert([r])
    if (error) {
      console.error('Rental save error:', error.message)
      setRentals(prev => prev.filter(x => x.id !== id))
      alert('Error saving rental: ' + error.message)
    }
  }, [])

  const onUpdateRental = useCallback(async (rental: EquipmentRental) => {
    setRentals(prev => prev.map(r => r.id === rental.id ? rental : r))
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...fields } = rental
    const { error } = await supabase.from('equipment_rentals').update(fields).eq('id', id)
    if (error) console.error('Rental update error:', error.message)
  }, [])

  const onDeleteRental = useCallback((id: string) => {
    setRentals(prev => prev.filter(r => r.id !== id))
    supabase.from('equipment_rentals').delete().eq('id', id)
  }, [])

  const onBookingTap = useCallback((bookingId: string) => {
    setQuickViewBookingId(bookingId)
  }, [])

  const { dragState, onPointerDown, onPointerMove, onPointerUp } = useBookingDrag({
    onBookingUpdate, onBookingMove, onBookingTap, gridRef,
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-full mx-auto px-4 py-6 md:py-8">

        {/* Page header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
            {planningTab === 'accommodations' ? 'Accommodation Planning'
              : planningTab === 'lessons' ? 'Daily Planning'
              : planningTab === 'forecast' ? 'Forecast'
              : 'Now'}
          </h1>

          {planningTab === 'accommodations' && (
            <div className="flex flex-col sm:flex-row items-center gap-2">
              {/* Season selector */}
              <div className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-lg px-1 py-1">
                <button onClick={() => changeSeason(-1)} className="px-2 py-1 rounded hover:bg-blue-100 text-sm text-blue-700">←</button>
                <span className="text-sm font-bold text-blue-800 min-w-[90px] text-center">
                  {seasonYear}/{String(seasonYear + 1).slice(2)}
                </span>
                <button onClick={() => changeSeason(+1)} className="px-2 py-1 rounded hover:bg-blue-100 text-sm text-blue-700">→</button>
              </div>
              {/* Month nav */}
              <div className="flex items-center gap-1">
                <button onClick={prevMonth} disabled={navMonthIdx === 0} className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-30 text-sm">←</button>
                <span className="text-sm font-semibold min-w-[130px] text-center text-gray-700">
                  {monthGroups[navMonthIdx]?.label ?? ''}
                </span>
                <button onClick={nextMonth} disabled={navMonthIdx === monthGroups.length - 1} className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-30 text-sm">→</button>
              </div>
              <button onClick={goToNow} className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">Now</button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          <button
            onClick={() => handleTabChange('accommodations')}
            className={`px-4 py-2 font-medium transition-colors ${planningTab === 'accommodations' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
          >
            🏠 Accommodations
          </button>
          <button
            onClick={() => handleTabChange('lessons')}
            className={`px-4 py-2 font-medium transition-colors ${planningTab === 'lessons' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
          >
            🗓️ Daily
          </button>
          <button
            onClick={() => handleTabChange('now')}
            className={`px-4 py-2 font-medium transition-colors ${planningTab === 'now' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
          >
            🍽️ Now
          </button>
          <button
            onClick={() => handleTabChange('forecast')}
            className={`px-4 py-2 font-medium transition-colors ${planningTab === 'forecast' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
          >
            📋 Forecast
          </button>
        </div>

        {/* ── ACCOMMODATIONS TAB ── */}
        {planningTab === 'accommodations' && (
          <>
            {/* Draft banner */}
            {draftMoves.size > 0 && (
              <div className="sticky top-0 z-30 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 mb-4 flex items-center justify-between shadow-sm">
                <span className="text-amber-800 font-medium text-sm">
                  ⚠️ {draftMoves.size} pending move{draftMoves.size > 1 ? 's' : ''} — not saved yet
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setShowValidateModal(true)}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold text-sm">
                    ✓ Validate changes
                  </button>
                  <button onClick={() => setDraftMoves(new Map())}
                    className="px-4 py-1.5 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 font-medium text-sm">
                    ↺ Reset to saved
                  </button>
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap gap-3 md:gap-4 mb-4 text-xs md:text-sm">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Confirmed</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400 inline-block" /> Provisional</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-300 inline-block" /> Cancelled</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200 border border-gray-300 inline-block" /> Not rented</span>
            </div>

            {/* Grid */}
            <div
              ref={scrollRef}
              className="border border-gray-200 rounded-lg overflow-x-auto select-none bg-white"
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              {/* Header row 1: month names */}
              <div className="flex min-w-max border-b border-gray-300 bg-gray-200">
                <div className="sticky left-0 z-20 shrink-0 w-20 bg-gray-200 border-r border-gray-300" />
                {monthGroups.map((mg) => (
                  <div
                    key={mg.colStart}
                    className="shrink-0 text-center text-xs font-bold py-1 border-r border-gray-300 text-gray-700"
                    style={{ width: mg.days * CELL_W }}
                  >
                    {mg.label}
                  </div>
                ))}
              </div>

              {/* Header row 2: day numbers */}
              <div className="flex min-w-max border-b border-gray-300 bg-gray-100">
                <div className="sticky left-0 z-20 shrink-0 w-20 px-2 py-1 text-xs font-semibold border-r border-gray-200 bg-gray-100">
                  Where
                </div>
                <div className="flex">
                  {Array.from({ length: totalDays }, (_, i) => {
                    const d = new Date(seasonStart.getFullYear(), seasonStart.getMonth(), seasonStart.getDate() + i)
                    const dow = d.getDay()
                    const isWeekend = dow === 0 || dow === 6
                    return (
                      <div
                        key={i}
                        className={`shrink-0 text-center text-xs py-1 border-r ${
                          dow === 0 ? 'border-r-gray-300' : 'border-r-gray-100'
                        } ${isWeekend ? 'bg-blue-50 font-semibold' : ''}`}
                        style={{ width: CELL_W }}
                      >
                        <div className="text-gray-400 hidden md:block leading-none">{DAY_NAMES[dow]}</div>
                        <div>{d.getDate()}</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Rows */}
              <div ref={gridRef}>
                {activeAccommodations.map((acc) => {
                  const accRooms = rooms.filter(r => r.accommodation_id === acc.id)
                  const unavailableDays = unavailableByAccommodation.get(acc.id)
                  return (
                    <div key={acc.id}>
                      {accRooms.map((room) => (
                        <PlanningRow
                          key={room.id}
                          roomId={room.id}
                          label={accRooms.length > 1 ? `${acc.name}/${room.name}` : acc.name}
                          totalDays={totalDays}
                          seasonStart={seasonStart}
                          bookings={getBookingsForRoom(room.id)}
                          bookingParticipants={bookingParticipants}
                          dragState={dragState}
                          onPointerDown={onPointerDown}
                          unavailableDays={unavailableDays}
                        />
                      ))}
                    </div>
                  )
                })}
                <TotalsRow label="Tot Guest" totalDays={totalDays} seasonStart={seasonStart} bookings={resolvedBookings} bookingParticipants={bookingParticipants} type="guests" />
                <TotalsRow label="Tot less" totalDays={totalDays} seasonStart={seasonStart} bookings={resolvedBookings} bookingParticipants={bookingParticipants} type="lessons" />
                <TotalsRow label="Tot rent" totalDays={totalDays} seasonStart={seasonStart} bookings={resolvedBookings} bookingParticipants={bookingParticipants} type="equipment" />
              </div>
            </div>
          </>
        )}

        {/* ── NOW TAB ── */}
        {planningTab === 'now' && (
          <NowView bookings={bookings} bookingParticipants={bookingParticipants} bookingRooms={bookingRooms} rooms={rooms} accommodations={accommodations} instructors={instructors} />
        )}

        {/* ── FORECAST TAB ── */}
        {planningTab === 'forecast' && (
          <ForecastView
            lessons={lessons}
            instructors={instructors}
            clients={clients}
            equipment={equipment}
            rentals={rentals}
            onAddLesson={onAddLesson}
            onUpdateLesson={onUpdateLesson}
            onDeleteLesson={onDeleteLesson}
            onAddRental={onAddRental}
            onDeleteRental={onDeleteRental}
          />
        )}

        {/* ── LESSONS TAB ── */}
        {planningTab === 'lessons' && (
          <>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-2">
                <button onClick={prevWeek} className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 text-sm">←</button>
                <span className="text-base font-semibold min-w-[220px] text-center">
                  Week of {weekLabel}
                </span>
                <button onClick={nextWeek} className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 text-sm">→</button>
                <button onClick={goToToday} className="px-3 py-1.5 rounded bg-blue-100 text-blue-700 text-sm font-medium hover:bg-blue-200">
                  Today
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setLessonView('by-instructor')}
                  className={`px-3 py-1.5 rounded font-medium text-sm transition-colors ${lessonView === 'by-instructor' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
                >
                  By instructor
                </button>
                <button
                  onClick={() => setLessonView('by-client')}
                  className={`px-3 py-1.5 rounded font-medium text-sm transition-colors ${lessonView === 'by-client' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
                >
                  By client
                </button>
              </div>
            </div>

            <LessonWeekView
              weekDays={weekDays}
              lessons={lessons}
              dayActivities={dayActivities}
              bookings={bookings}
              lessonView={lessonView}
              instructors={instructors}
              clients={clients}
              equipment={equipment}
              rentals={rentals}
              priceItems={priceItems}
              bookingParticipants={bookingParticipants}
              onAddLesson={onAddLesson}
              onUpdateLesson={onUpdateLesson}
              onDeleteLesson={onDeleteLesson}
              onAddActivity={onAddActivity}
              onDeleteActivity={onDeleteActivity}
              onAddRental={onAddRental}
              onUpdateRental={onUpdateRental}
              onDeleteRental={onDeleteRental}
            />
          </>
        )}
      </div>

      {/* Booking quick view */}
      {quickViewBooking && (
        <BookingQuickView
          booking={quickViewBooking}
          rooms={rooms}
          accommodations={accommodations}
          bookingRooms={bookingRooms}
          participants={bookingParticipants.filter(p => p.booking_id === quickViewBooking.id)}
          onClose={() => setQuickViewBookingId(null)}
          onEdit={() => { setQuickViewBookingId(null); onOpenBooking?.(quickViewBooking.id) }}
        />
      )}

      {/* Validate modal */}
      {showValidateModal && (
        <ValidateModal
          draftMoves={draftMoves}
          bookings={bookings}
          rooms={rooms}
          accommodations={accommodations}
          onConfirm={validateDrafts}
          onCancel={() => setShowValidateModal(false)}
        />
      )}
    </div>
  )
}
