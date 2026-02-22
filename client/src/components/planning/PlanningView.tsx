import { useState, useCallback, useRef } from 'react'
import PlanningRow from './PlanningRow'
import TotalsRow from './TotalsRow'
import LessonWeekView from './LessonWeekView'
import { mockAccommodations, mockRooms, mockBookings as initialBookings, mockBookingRooms as initialBookingRooms, mockLessons as initialLessons, mockDayActivities as initialActivities } from '../../data/mock'
import type { Booking, BookingRoom, Lesson, DayActivity } from '../../types/database'
import { useBookingDrag, type DragMode } from '../../hooks/useBookingDrag'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}


export default function PlanningView() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [bookings, setBookings] = useState<Booking[]>([...initialBookings])
  const [bookingRooms, setBookingRooms] = useState<BookingRoom[]>([...initialBookingRooms])
  const [lessons, setLessons] = useState<Lesson[]>([...initialLessons])
  const [dayActivities, setDayActivities] = useState<DayActivity[]>([...initialActivities])
  const [planningTab, setPlanningTab] = useState<'accommodations' | 'lessons'>('accommodations')
  const [lessonView, setLessonView] = useState<'by-instructor' | 'by-client'>('by-instructor')
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOfWeek(new Date()))
  const gridRef = useRef<HTMLDivElement>(null)

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })
  const weekEnd = weekDays[6]
  const weekLabel = weekStart.getMonth() === weekEnd.getMonth()
    ? `${weekStart.getDate()} au ${weekEnd.getDate()} ${MONTH_SHORT[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`
    : `${weekStart.getDate()} ${MONTH_SHORT[weekStart.getMonth()]} – ${weekEnd.getDate()} ${MONTH_SHORT[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`

  const prevWeek = () => setWeekStart(d => { const nd = new Date(d); nd.setDate(nd.getDate() - 7); return nd })
  const nextWeek = () => setWeekStart(d => { const nd = new Date(d); nd.setDate(nd.getDate() + 7); return nd })
  const goToToday = () => setWeekStart(getMondayOfWeek(new Date()))


  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthStart = new Date(year, month, 1)

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const activeAccommodations = mockAccommodations.filter(a => a.is_active)

  // Build ordered room list
  const roomOrder: string[] = []
  for (const acc of activeAccommodations) {
    for (const room of mockRooms.filter(r => r.accommodation_id === acc.id)) {
      roomOrder.push(room.id)
    }
  }

  function getBookingsForRoom(roomId: string): Booking[] {
    const bookingIds = bookingRooms
      .filter((br) => br.room_id === roomId)
      .map((br) => br.booking_id)
    return bookings.filter((b) => bookingIds.includes(b.id))
  }

  const onBookingUpdate = useCallback((bookingId: string, dayDelta: number, mode: DragMode) => {
    setBookings(prev => prev.map(b => {
      if (b.id !== bookingId) return b
      if (mode === 'move') {
        return { ...b, check_in: addDays(b.check_in, dayDelta), check_out: addDays(b.check_out, dayDelta) }
      } else if (mode === 'resize-left') {
        return { ...b, check_in: addDays(b.check_in, dayDelta) }
      } else {
        return { ...b, check_out: addDays(b.check_out, dayDelta) }
      }
    }))
  }, [])

  const onBookingMove = useCallback((bookingId: string, fromRoomId: string, toRoomId: string) => {
    setBookingRooms(prev => prev.map(br => {
      if (br.booking_id === bookingId && br.room_id === fromRoomId) {
        return { ...br, room_id: toRoomId }
      }
      return br
    }))
  }, [])

  const { dragState, onPointerDown, onPointerMove, onPointerUp } = useBookingDrag({
    onBookingUpdate,
    onBookingMove,
    gridRef,
    daysInMonth,
    roomOrder,
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-full mx-auto px-4 py-6 md:py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
            {planningTab === 'accommodations' ? 'Accommodation Planning' : 'Lesson Planning'}
          </h1>
          {planningTab === 'accommodations' && (
            <div className="flex items-center gap-2 md:gap-3">
              <button onClick={prevMonth} className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 text-sm">←</button>
              <span className="text-base md:text-lg font-semibold min-w-[150px] md:min-w-[180px] text-center">
                {MONTH_NAMES[month]} {year}
              </span>
              <button onClick={nextMonth} className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 text-sm">→</button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          <button
            onClick={() => setPlanningTab('accommodations')}
            className={`px-4 py-2 font-medium transition-colors ${
              planningTab === 'accommodations'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            🏠 Accommodations
          </button>
          <button
            onClick={() => setPlanningTab('lessons')}
            className={`px-4 py-2 font-medium transition-colors ${
              planningTab === 'lessons'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            🏄 Lessons
          </button>
        </div>

        {planningTab === 'accommodations' && (
          <>
            {/* Legend */}
            <div className="flex flex-wrap gap-3 md:gap-4 mb-4 md:mb-6 text-xs md:text-sm">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Confirmed</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400 inline-block" /> Provisional</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-300 inline-block" /> Cancelled</span>
            </div>

            {/* Grid */}
            <div
              className="border border-gray-200 rounded-lg overflow-x-auto select-none bg-white"
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              {/* Day headers */}
              <div className="flex border-b border-gray-300 bg-gray-100">
                <div className="sticky left-0 z-20 w-20 min-w-[80px] px-2 py-2 md:py-1 text-xs font-semibold border-r border-gray-200 bg-gray-100">
                  Where
                </div>
                <div className="flex flex-1">
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const d = new Date(year, month, i + 1)
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6
                    return (
                      <div
                        key={i}
                        className={`flex-1 min-w-[32px] md:min-w-[36px] text-center text-xs py-1 border-r border-gray-100 ${
                          isWeekend ? 'bg-blue-50 font-semibold' : ''
                        }`}
                      >
                        <div className="text-gray-500 hidden md:block">{DAY_NAMES[d.getDay()]}</div>
                        <div>{i + 1}</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Rows per accommodation + room */}
              <div ref={gridRef}>
                {activeAccommodations.map((acc) => {
                  const rooms = mockRooms.filter(r => r.accommodation_id === acc.id)
                  return (
                    <div key={acc.id}>
                      {rooms.map((room) => (
                        <PlanningRow
                          key={room.id}
                          roomId={room.id}
                          label={rooms.length > 1 ? `${acc.name} — ${room.name}` : acc.name}
                          daysInMonth={daysInMonth}
                          bookings={getBookingsForRoom(room.id)}
                          monthStart={monthStart}
                          dragState={dragState}
                          onPointerDown={onPointerDown}
                        />
                      ))}
                    </div>
                  )
                })}
                {/* Totals rows */}
                <TotalsRow
                  label="Tot Guest"
                  daysInMonth={daysInMonth}
                  bookings={bookings}
                  monthStart={monthStart}
                  type="guests"
                />
                <TotalsRow
                  label="Tot less"
                  daysInMonth={daysInMonth}
                  bookings={bookings}
                  monthStart={monthStart}
                  type="lessons"
                />
                <TotalsRow
                  label="Tot rent"
                  daysInMonth={daysInMonth}
                  bookings={bookings}
                  monthStart={monthStart}
                  type="equipment"
                />
              </div>
            </div>
          </>
        )}

        {planningTab === 'lessons' && (
          <>
            {/* Week navigation + view toggle */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-2">
                <button onClick={prevWeek} className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 text-sm">←</button>
                <span className="text-base font-semibold min-w-[220px] text-center">
                  Semaine du {weekLabel}
                </span>
                <button onClick={nextWeek} className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 text-sm">→</button>
                <button
                  onClick={goToToday}
                  className="px-3 py-1.5 rounded bg-blue-100 text-blue-700 text-sm font-medium hover:bg-blue-200"
                >
                  Aujourd'hui
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setLessonView('by-instructor')}
                  className={`px-3 py-1.5 rounded font-medium text-sm transition-colors ${
                    lessonView === 'by-instructor'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  Par moniteur
                </button>
                <button
                  onClick={() => setLessonView('by-client')}
                  className={`px-3 py-1.5 rounded font-medium text-sm transition-colors ${
                    lessonView === 'by-client'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  Par client
                </button>
              </div>
            </div>

            <LessonWeekView
              weekDays={weekDays}
              lessons={lessons}
              dayActivities={dayActivities}
              bookings={bookings}
              lessonView={lessonView}
              onLessonsChange={setLessons}
              onActivitiesChange={setDayActivities}
            />
          </>
        )}
      </div>
    </div>
  )
}
