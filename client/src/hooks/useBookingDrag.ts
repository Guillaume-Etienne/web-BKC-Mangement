import { useState, useCallback, useRef } from 'react'

export type DragMode = 'move' | 'resize-left' | 'resize-right'

export interface DragState {
  bookingId: string
  roomId: string
  mode: DragMode
  dayDelta: number
  targetRoomId: string | null
}

interface UseBookingDragOptions {
  onBookingUpdate: (bookingId: string, dayDelta: number, mode: DragMode) => void
  onBookingMove: (bookingId: string, fromRoomId: string, toRoomId: string) => void
  gridRef: React.RefObject<HTMLDivElement | null>
  daysInMonth: number
  roomOrder: string[] // ordered room IDs for Y-based detection
}

export function useBookingDrag({ onBookingUpdate, onBookingMove, gridRef, daysInMonth, roomOrder }: UseBookingDragOptions) {
  const [dragState, setDragState] = useState<DragState | null>(null)
  const startX = useRef(0)
  const dayWidth = useRef(0)
  const startRoomIndex = useRef(0)

  const onPointerDown = useCallback((e: React.PointerEvent, bookingId: string, roomId: string, mode: DragMode) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

    const grid = gridRef.current
    if (!grid) return

    // Calculate day width from the grid container (minus the label column)
    const gridRect = grid.getBoundingClientRect()
    dayWidth.current = gridRect.width / daysInMonth
    startX.current = e.clientX
    startRoomIndex.current = roomOrder.indexOf(roomId)

    setDragState({ bookingId, roomId, mode, dayDelta: 0, targetRoomId: null })
  }, [gridRef, daysInMonth, roomOrder])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState) return

    const dx = e.clientX - startX.current
    const newDelta = Math.round(dx / dayWidth.current)

    // Detect target row via Y position
    const grid = gridRef.current
    let targetRoomId: string | null = null
    if (grid) {
      const rows = grid.querySelectorAll('[data-room-id]')
      for (const row of rows) {
        const rect = row.getBoundingClientRect()
        if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
          targetRoomId = row.getAttribute('data-room-id')
          break
        }
      }
    }

    if (newDelta !== dragState.dayDelta || targetRoomId !== dragState.targetRoomId) {
      setDragState(prev => prev ? { ...prev, dayDelta: newDelta, targetRoomId } : null)
    }
  }, [dragState, gridRef])

  const onPointerUp = useCallback(() => {
    if (!dragState) return

    if (dragState.dayDelta !== 0) {
      onBookingUpdate(dragState.bookingId, dragState.dayDelta, dragState.mode)
    }

    if (dragState.targetRoomId && dragState.targetRoomId !== dragState.roomId) {
      onBookingMove(dragState.bookingId, dragState.roomId, dragState.targetRoomId)
    }

    setDragState(null)
  }, [dragState, onBookingUpdate, onBookingMove])

  return { dragState, onPointerDown, onPointerMove, onPointerUp }
}
