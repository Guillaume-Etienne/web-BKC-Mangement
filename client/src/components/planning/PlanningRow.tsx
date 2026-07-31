import type { Booking, BookingParticipant } from '../../types/database'
import type { DragState, DragMode } from '../../hooks/useBookingDrag'
import { CELL_W } from '../../hooks/useBookingDrag'

// Bar fill + the text that sits on it. The guest name used to be white on every
// bar, which is the least readable choice these fills allow: 2.5:1 on emerald,
// 1.7:1 on amber — unreadable on a phone in the sun, which is where this screen
// is actually used. Dark text on the same fills reads at 7:1 and 10:1, so the
// colour language (emerald = confirmed, amber = provisional) is untouched.
const statusColors: Record<string, string> = {
  confirmed:   'bg-emerald-500 text-gray-900',
  provisional: 'bg-amber-400 text-gray-900',
  // The cancelled bar is the one that flips with the theme, so its text does too.
  cancelled:   'bg-gray-300 text-gray-900 dark:bg-gray-600 dark:text-gray-100',
}

interface PlanningRowProps {
  roomId: string
  label: string
  totalDays: number
  seasonStart: Date
  bookings: Booking[]
  bookingParticipants: BookingParticipant[]
  dragState: DragState | null
  onPointerDown: (e: React.PointerEvent, bookingId: string, roomId: string, mode: DragMode) => void
  unavailableDays?: Set<number>
}

export default function PlanningRow({ roomId, label, totalDays, seasonStart, bookings, bookingParticipants, dragState, onPointerDown, unavailableDays }: PlanningRowProps) {
  const isDropTarget = dragState && dragState.targetRoomId === roomId && dragState.roomId !== roomId

  function dateToIdx(dateStr: string): number {
    const [y, m, d] = dateStr.split('-').map(Number)
    return Math.round(
      (Date.UTC(y, m - 1, d) - Date.UTC(seasonStart.getFullYear(), seasonStart.getMonth(), seasonStart.getDate()))
      / 86400000
    )
  }

  const segments = bookings.map((b) => {
    const startOffset = Math.max(0, dateToIdx(b.check_in))
    const endOffset = Math.min(totalDays, dateToIdx(b.check_out))
    const clientName = b.client ? `${b.client.first_name} ${b.client.last_name}` : '?'
    const guestCount = bookingParticipants.filter(p => p.booking_id === b.id).length
    const label = [
      clientName,
      guestCount > 0 ? `${guestCount}G` : null,
      b.num_lessons > 0 ? `${b.num_lessons}LK` : null,
      b.num_equipment_rentals > 0 ? `${b.num_equipment_rentals}R` : null,
      b.num_wing_lessons > 0 ? `${b.num_wing_lessons}LW` : null,
      b.num_center_access > 0 ? `${b.num_center_access}C` : null,
      b.notes || null,
    ].filter(Boolean).join(' · ')
    return { booking: b, startOffset, endOffset, label }
  }).filter(s => s.endOffset > 0 && s.startOffset < totalDays)

  return (
    <div
      className={`flex min-w-max border-b border-gray-200 dark:border-gray-800 ${isDropTarget ? 'bg-blue-100 dark:bg-blue-900/30' : ''}`}
      data-room-id={roomId}
    >
      {/* Label */}
      <div className="sticky left-0 z-10 shrink-0 w-20 px-2 py-2 text-xs font-medium bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-800 flex items-center truncate">
        {label}
      </div>
      {/* Days grid */}
      <div className="relative shrink-0" style={{ width: `${totalDays * CELL_W}px`, minHeight: '32px' }}>
        <div className="flex h-full">
          {Array.from({ length: totalDays }, (_, i) => {
            const d = new Date(seasonStart.getFullYear(), seasonStart.getMonth(), seasonStart.getDate() + i)
            const dow = d.getDay()
            const isUnavailable = unavailableDays?.has(i) ?? false
            const isWeekend = dow === 0 || dow === 6
            return (
              <div
                key={i}
                title={isUnavailable ? 'Not rented this period' : undefined}
                className={`shrink-0 border-r ${
                  dow === 0 ? 'border-r-gray-300' : 'border-r-gray-100'
                } ${isUnavailable ? 'bg-gray-200 dark:bg-gray-700' : isWeekend ? 'bg-blue-50 dark:bg-blue-950/40' : ''}`}
                style={{ width: CELL_W }}
              />
            )
          })}
        </div>
        {/* Booking bars */}
        {segments.map((seg) => {
          const isDragging = dragState?.bookingId === seg.booking.id
          let startOffset = seg.startOffset
          let endOffset = seg.endOffset

          if (isDragging && dragState) {
            if (dragState.mode === 'move') {
              startOffset += dragState.dayDelta
              endOffset += dragState.dayDelta
            } else if (dragState.mode === 'resize-left') {
              startOffset += dragState.dayDelta
            } else {
              endOffset += dragState.dayDelta
            }
          }

          const leftPx = startOffset * CELL_W + CELL_W / 2
          const widthPx = Math.max((endOffset - startOffset) * CELL_W, 0)

          return (
            <div
              key={seg.booking.id}
              className={`absolute top-0.5 h-6 rounded ${statusColors[seg.booking.status]} text-xs flex items-center overflow-hidden whitespace-nowrap ${
                isDragging ? 'opacity-70 shadow-lg z-10' : ''
              }`}
              style={{ left: `${leftPx}px`, width: `${widthPx}px`, cursor: isDragging ? 'grabbing' : 'grab' }}
              title={seg.label}
            >
              <div
                className="absolute left-0 top-0 w-2 h-full cursor-col-resize"
                onPointerDown={(e) => onPointerDown(e, seg.booking.id, roomId, 'resize-left')}
              />
              <div
                className="flex-1 px-1.5 truncate"
                onPointerDown={(e) => onPointerDown(e, seg.booking.id, roomId, 'move')}
              >
                {seg.label}
              </div>
              <div
                className="absolute right-0 top-0 w-2 h-full cursor-col-resize"
                onPointerDown={(e) => onPointerDown(e, seg.booking.id, roomId, 'resize-right')}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
