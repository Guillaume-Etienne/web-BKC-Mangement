import type { Booking } from '../../types/database'
import type { DragState, DragMode } from '../../hooks/useBookingDrag'
import { CELL_W } from '../../hooks/useBookingDrag'

const statusColors: Record<string, string> = {
  confirmed: 'bg-emerald-500',
  provisional: 'bg-amber-400',
  cancelled: 'bg-gray-300',
}

interface PlanningRowProps {
  roomId: string
  label: string
  totalDays: number
  seasonStart: Date
  bookings: Booking[]
  dragState: DragState | null
  onPointerDown: (e: React.PointerEvent, bookingId: string, roomId: string, mode: DragMode) => void
}

export default function PlanningRow({ roomId, label, totalDays, seasonStart, bookings, dragState, onPointerDown }: PlanningRowProps) {
  const isDropTarget = dragState && dragState.targetRoomId === roomId && dragState.roomId !== roomId

  const segments = bookings.map((b) => {
    const bStart = new Date(b.check_in + 'T00:00:00')
    const bEnd = new Date(b.check_out + 'T00:00:00')
    const startOffset = Math.max(0, Math.round((bStart.getTime() - seasonStart.getTime()) / 86400000))
    const endOffset = Math.min(totalDays, Math.round((bEnd.getTime() - seasonStart.getTime()) / 86400000))
    const clientName = b.client ? `${b.client.first_name} ${b.client.last_name}` : '?'
    const label = [
      clientName,
      b.participants.length > 0 ? `${b.participants.length}P` : null,
      b.num_lessons > 0 ? `${b.num_lessons}L` : null,
      b.num_equipment_rentals > 0 ? `${b.num_equipment_rentals}R` : null,
      b.notes || null,
    ].filter(Boolean).join(' · ')
    return { booking: b, startOffset, endOffset, label }
  }).filter(s => s.endOffset > 0 && s.startOffset < totalDays)

  return (
    <div
      className={`flex min-w-max border-b border-gray-200 ${isDropTarget ? 'bg-blue-100' : ''}`}
      data-room-id={roomId}
    >
      {/* Label */}
      <div className="sticky left-0 z-10 shrink-0 w-20 px-2 py-2 text-xs font-medium bg-gray-50 border-r border-gray-200 flex items-center truncate">
        {label}
      </div>
      {/* Days grid */}
      <div className="relative shrink-0" style={{ width: `${totalDays * CELL_W}px`, minHeight: '32px' }}>
        <div className="flex h-full">
          {Array.from({ length: totalDays }, (_, i) => {
            const d = new Date(seasonStart.getTime() + i * 86400000)
            const dow = d.getDay()
            return (
              <div
                key={i}
                className={`shrink-0 border-r ${
                  dow === 0 ? 'border-r-gray-300' : 'border-r-gray-100'
                } ${dow === 0 || dow === 6 ? 'bg-blue-50' : ''}`}
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

          const leftPx = startOffset * CELL_W
          const widthPx = Math.max((endOffset - startOffset) * CELL_W, 0)

          return (
            <div
              key={seg.booking.id}
              className={`absolute top-0.5 h-6 rounded ${statusColors[seg.booking.status]} text-white text-xs flex items-center overflow-hidden whitespace-nowrap ${
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
