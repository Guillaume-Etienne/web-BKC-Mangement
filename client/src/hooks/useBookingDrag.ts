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
  onBookingTap?: (bookingId: string) => void
  gridRef: React.RefObject<HTMLDivElement | null>
}

export const CELL_W = 32 // px — matches w-8 in Tailwind, shared by all planning components

// Below this many pixels of on-screen movement, a gesture is a tap, not a
// drag — matches typical touch/mouse "click slop" (iOS/Android use ~8-10px).
const TAP_SLOP_PX = 5

export function useBookingDrag({ onBookingUpdate, onBookingMove, onBookingTap, gridRef }: UseBookingDragOptions) {
  const [dragState, setDragState] = useState<DragState | null>(null)
  const startX = useRef(0)
  const startY = useRef(0)
  // Raw on-screen displacement, independent of the day-grid snapping in
  // dragState.dayDelta — a bar dragged up and released back over its own room
  // has dayDelta 0 and no room change, but the pointer clearly moved, so it
  // must not be read as a tap (see onPointerUp).
  const moved = useRef(false)

  const onPointerDown = useCallback((e: React.PointerEvent, bookingId: string, roomId: string, mode: DragMode) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    startX.current = e.clientX
    startY.current = e.clientY
    moved.current = false
    setDragState({ bookingId, roomId, mode, dayDelta: 0, targetRoomId: null })
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState) return

    const dx = e.clientX - startX.current
    const dy = e.clientY - startY.current
    if (Math.abs(dx) > TAP_SLOP_PX || Math.abs(dy) > TAP_SLOP_PX) moved.current = true
    const newDelta = Math.round(dx / CELL_W)

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
    const dayChanged = dragState.dayDelta !== 0
    const changedRoom = dragState.targetRoomId !== null && dragState.targetRoomId !== dragState.roomId
    if (dayChanged || changedRoom) {
      if (dayChanged) onBookingUpdate(dragState.bookingId, dragState.dayDelta, dragState.mode)
      if (changedRoom) onBookingMove(dragState.bookingId, dragState.roomId, dragState.targetRoomId!)
    } else if (!moved.current) {
      // Zero net change AND the pointer never really left its spot: a tap.
      onBookingTap?.(dragState.bookingId)
    }
    // Otherwise: dragged around (e.g. up and back) but ended up producing no
    // change — silently snap back, do not open anything.
    setDragState(null)
  }, [dragState, onBookingUpdate, onBookingMove, onBookingTap])

  return { dragState, onPointerDown, onPointerMove, onPointerUp }
}
