import type { Booking } from '../../types/database'
import type { DragState, DragMode } from '../../hooks/useBookingDrag'

const statusColors: Record<string, string> = {
  confirmed: 'bg-emerald-500',
  provisional: 'bg-amber-400',
  cancelled: 'bg-gray-300',
}

interface PlanningRowProps {
  roomId: string
  label: string
  daysInMonth: number
  bookings: Booking[]
  monthStart: Date
  dragState: DragState | null
  onPointerDown: (e: React.PointerEvent, bookingId: string, roomId: string, mode: DragMode) => void
}

export default function PlanningRow({ roomId, label, daysInMonth, bookings, monthStart, dragState, onPointerDown }: PlanningRowProps) {
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)

  const isDropTarget = dragState && dragState.targetRoomId === roomId && dragState.roomId !== roomId

  const segments = bookings.map((b) => {
    const bStart = new Date(b.check_in + 'T00:00:00')
    const bEnd = new Date(b.check_out + 'T00:00:00')
    const visStart = bStart < monthStart ? monthStart : bStart
    const visEnd = bEnd > monthEnd ? new Date(monthEnd.getTime() + 86400000) : bEnd
    const startOffset = Math.floor((visStart.getTime() - monthStart.getTime()) / 86400000)
    const endOffset = Math.floor((visEnd.getTime() - monthStart.getTime()) / 86400000)
    const clientName = b.client ? `${b.client.first_name} ${b.client.last_name}` : '?'
    return { booking: b, startOffset, endOffset: Math.min(endOffset, daysInMonth), clientName }
  }).filter(s => s.endOffset > 0 && s.startOffset < daysInMonth)

  return (
    <div
      className={`flex border-b border-gray-200 ${isDropTarget ? 'bg-blue-100' : ''}`}
      data-room-id={roomId}
    >
      {/* Label */}
      <div className="w-32 md:w-40 min-w-[128px] md:min-w-40 px-2 py-2 text-xs md:text-sm font-medium bg-gray-50 border-r border-gray-200 flex items-center truncate">
        {label}
      </div>
      {/* Days grid */}
      <div className="flex-1 relative" style={{ minHeight: '32px' }}>
        <div className="flex h-full">
          {Array.from({ length: daysInMonth }, (_, i) => (
            <div
              key={i}
              className={`flex-1 border-r border-gray-100 min-w-[32px] md:min-w-[36px] ${
                new Date(monthStart.getFullYear(), monthStart.getMonth(), i + 1).getDay() === 0
                  ? 'bg-blue-50'
                  : ''
              }`}
            />
          ))}
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

          const leftPct = (startOffset / daysInMonth) * 100
          const widthPct = ((endOffset - startOffset) / daysInMonth) * 100

          return (
            <div
              key={seg.booking.id}
              className={`absolute top-0.5 md:top-1 h-6 md:h-7 rounded ${statusColors[seg.booking.status]} text-white text-xs flex items-center overflow-hidden whitespace-nowrap ${
                isDragging ? 'opacity-70 shadow-lg z-10' : ''
              }`}
              style={{
                left: `${leftPct}%`,
                width: `${Math.max(widthPct, 0)}%`,
                cursor: isDragging ? 'grabbing' : 'grab',
              }}
              title={`${seg.clientName}\n${seg.booking.check_in} → ${seg.booking.check_out}\n${seg.booking.status}`}
            >
              {/* Resize handle left */}
              <div
                className="absolute left-0 top-0 w-2 h-full cursor-col-resize"
                onPointerDown={(e) => onPointerDown(e, seg.booking.id, roomId, 'resize-left')}
              />
              {/* Center drag area */}
              <div
                className="flex-1 px-1.5 truncate"
                onPointerDown={(e) => onPointerDown(e, seg.booking.id, roomId, 'move')}
              >
                {seg.clientName}
              </div>
              {/* Resize handle right */}
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
