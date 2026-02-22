import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import PlanningRow from './PlanningRow'
import TotalsRow from './TotalsRow'
import LessonWeekView from './LessonWeekView'
import NowView from './NowView'
import ForecastView from './ForecastView'
import { mockAccommodations, mockRooms, mockBookings as initialBookings, mockBookingRooms as initialBookingRooms, mockLessons as initialLessons, mockDayActivities as initialActivities } from '../../data/mock'
import type { Booking, BookingRoom, Lesson, DayActivity } from '../../types/database'
import { useBookingDrag, CELL_W, type DragMode } from '../../hooks/useBookingDrag'

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

export default function PlanningView() {
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
  const [navMonthIdx, setNavMonthIdx] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollToMonthIdx = useCallback((idx: number) => {
    if (scrollRef.current && monthGroups[idx]) {
      scrollRef.current.scrollLeft = monthGroups[idx].colStart * CELL_W
    }
  }, [monthGroups])

  // On mount: scroll to current month
  useEffect(() => {
    const m = now.getMonth()
    const y = now.getFullYear()
    const idx = monthGroups.findIndex(g => {
      const d = new Date(seasonStart.getTime() + g.colStart * 86400000)
      return d.getMonth() === m && d.getFullYear() === y
    })
    const target = Math.max(0, idx)
    setNavMonthIdx(target)
    scrollToMonthIdx(target)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  const changeSeason = (delta: number) => {
    setSeasonYear(y => y + delta)
    setNavMonthIdx(0)
    // scroll to Sep (start of new season) after re-render
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollLeft = 0
    }, 0)
  }

  // ── Bookings data ────────────────────────────────────────────────
  const [bookings, setBookings] = useState<Booking[]>([...initialBookings])
  const [bookingRooms, setBookingRooms] = useState<BookingRoom[]>([...initialBookingRooms])
  const [lessons, setLessons] = useState<Lesson[]>([...initialLessons])
  const [dayActivities, setDayActivities] = useState<DayActivity[]>([...initialActivities])

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
  const activeAccommodations = mockAccommodations.filter(a => a.is_active)
  const roomOrder: string[] = []
  for (const acc of activeAccommodations) {
    for (const room of mockRooms.filter(r => r.accommodation_id === acc.id)) {
      roomOrder.push(room.id)
    }
  }

  function getBookingsForRoom(roomId: string): Booking[] {
    const ids = bookingRooms.filter(br => br.room_id === roomId).map(br => br.booking_id)
    return bookings.filter(b => ids.includes(b.id))
  }

  const gridRef = useRef<HTMLDivElement>(null)

  const onBookingUpdate = useCallback((bookingId: string, dayDelta: number, mode: DragMode) => {
    setBookings(prev => prev.map(b => {
      if (b.id !== bookingId) return b
      if (mode === 'move') return { ...b, check_in: addDays(b.check_in, dayDelta), check_out: addDays(b.check_out, dayDelta) }
      if (mode === 'resize-left') return { ...b, check_in: addDays(b.check_in, dayDelta) }
      return { ...b, check_out: addDays(b.check_out, dayDelta) }
    }))
  }, [])

  const onBookingMove = useCallback((bookingId: string, fromRoomId: string, toRoomId: string) => {
    setBookingRooms(prev => prev.map(br =>
      br.booking_id === bookingId && br.room_id === fromRoomId ? { ...br, room_id: toRoomId } : br
    ))
  }, [])

  const { dragState, onPointerDown, onPointerMove, onPointerUp } = useBookingDrag({
    onBookingUpdate, onBookingMove, gridRef,
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
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          <button
            onClick={() => setPlanningTab('accommodations')}
            className={`px-4 py-2 font-medium transition-colors ${planningTab === 'accommodations' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
          >
            🏠 Accommodations
          </button>
          <button
            onClick={() => setPlanningTab('lessons')}
            className={`px-4 py-2 font-medium transition-colors ${planningTab === 'lessons' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
          >
            🗓️ Daily
          </button>
          <button
            onClick={() => setPlanningTab('now')}
            className={`px-4 py-2 font-medium transition-colors ${planningTab === 'now' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
          >
            🍽️ Now
          </button>
          <button
            onClick={() => setPlanningTab('forecast')}
            className={`px-4 py-2 font-medium transition-colors ${planningTab === 'forecast' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
          >
            📋 Forecast
          </button>
        </div>

        {/* ── ACCOMMODATIONS TAB ── */}
        {planningTab === 'accommodations' && (
          <>
            {/* Legend */}
            <div className="flex flex-wrap gap-3 md:gap-4 mb-4 text-xs md:text-sm">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Confirmed</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400 inline-block" /> Provisional</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-300 inline-block" /> Cancelled</span>
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
                    const d = new Date(seasonStart.getTime() + i * 86400000)
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
                  const rooms = mockRooms.filter(r => r.accommodation_id === acc.id)
                  return (
                    <div key={acc.id}>
                      {rooms.map((room) => (
                        <PlanningRow
                          key={room.id}
                          roomId={room.id}
                          label={rooms.length > 1 ? `${acc.name}/${room.name}` : acc.name}
                          totalDays={totalDays}
                          seasonStart={seasonStart}
                          bookings={getBookingsForRoom(room.id)}
                          dragState={dragState}
                          onPointerDown={onPointerDown}
                        />
                      ))}
                    </div>
                  )
                })}
                <TotalsRow label="Tot Guest" totalDays={totalDays} seasonStart={seasonStart} bookings={bookings} type="guests" />
                <TotalsRow label="Tot less" totalDays={totalDays} seasonStart={seasonStart} bookings={bookings} type="lessons" />
                <TotalsRow label="Tot rent" totalDays={totalDays} seasonStart={seasonStart} bookings={bookings} type="equipment" />
              </div>
            </div>
          </>
        )}

        {/* ── NOW TAB ── */}
        {planningTab === 'now' && (
          <NowView bookings={bookings} bookingRooms={bookingRooms} />
        )}

        {/* ── FORECAST TAB ── */}
        {planningTab === 'forecast' && (
          <ForecastView
            lessons={lessons}
            onLessonsChange={setLessons}
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
              onLessonsChange={setLessons}
              onActivitiesChange={setDayActivities}
            />
          </>
        )}
      </div>
    </div>
  )
}
