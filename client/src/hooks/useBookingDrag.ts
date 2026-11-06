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

// Touch only: a finger on a bar must first HOLD this long before the bar can be
// dragged. Anything faster is a tap (opens the booking) or a swipe (scrolls the
// grid) — before this, any swipe that started on a bar moved its dates.
const LONG_PRESS_MS = 350
// Finger travel during the hold beyond which the gesture is a scroll, not a press.
const SCROLL_SLOP_PX = 10

export function useBookingDrag({ onBookingUpdate, onBookingMove, onBookingTap, gridRef }: UseBookingDragOptions) {
  const [dragState, setDragState] = useState<DragState | null>(null)
  // Touch gesture waiting for its long press (not yet a drag).
  const pending = useRef<{ bookingId: string; timer: number } | null>(null)
  // True once the long press fired: the drag is live and the page must not scroll.
  const armed = useRef(false)
  const blockScroll = useRef((ev: TouchEvent) => {
    if (armed.current && ev.cancelable) ev.preventDefault()
  })
  const endTouchGesture = useCallback(() => {
    if (pending.current) window.clearTimeout(pending.current.timer)
    pending.current = null
    armed.current = false
    window.removeEventListener('touchmove', blockScroll.current)
  }, [])
  const startX = useRef(0)
  const startY = useRef(0)
  // Raw on-screen displacement, independent of the day-grid snapping in
  // dragState.dayDelta — a bar dragged up and released back over its own room
  // has dayDelta 0 and no room change, but the pointer clearly moved, so it
  // must not be read as a tap (see onPointerUp).
  const moved = useRef(false)

  const onPointerDown = useCallback((e: React.PointerEvent, bookingId: string, roomId: string, mode: DragMode) => {
    e.stopPropagation()
    startX.current = e.clientX
    startY.current = e.clientY
    moved.current = false

    if (e.pointerType === 'touch') {
      // No preventDefault, no capture yet: until the long press fires the
      // browser stays free to scroll the grid under the finger.
      endTouchGesture()
      const target = e.target as HTMLElement
      const pointerId = e.pointerId
      const timer = window.setTimeout(() => {
        armed.current = true
        try { target.setPointerCapture(pointerId) } catch { /* pointer already gone */ }
        navigator.vibrate?.(15)
        setDragState({ bookingId, roomId, mode, dayDelta: 0, targetRoomId: null })
      }, LONG_PRESS_MS)
      pending.current = { bookingId, timer }
      // Registered at touch start (before any touchmove) so it can veto the scroll
      // once the long press has fired.
      window.addEventListener('touchmove', blockScroll.current, { passive: false })
      return
    }

    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setDragState({ bookingId, roomId, mode, dayDelta: 0, targetRoomId: null })
  }, [endTouchGesture])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    // Waiting for the long press: too much travel = the user is scrolling.
    if (pending.current && !armed.current) {
      if (Math.abs(e.clientX - startX.current) > SCROLL_SLOP_PX || Math.abs(e.clientY - startY.current) > SCROLL_SLOP_PX) {
        endTouchGesture()
      }
      return
    }
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
  }, [dragState, gridRef, endTouchGesture])

  const onPointerUp = useCallback(() => {
    // Finger lifted before the long press fired and without scrolling: a tap.
    if (pending.current && !armed.current) {
      const tapped = pending.current.bookingId
      endTouchGesture()
      onBookingTap?.(tapped)
      return
    }
    const wasLongPress = armed.current
    endTouchGesture()
    if (!dragState) return
    const dayChanged = dragState.dayDelta !== 0
    const changedRoom = dragState.targetRoomId !== null && dragState.targetRoomId !== dragState.roomId
    if (dayChanged || changedRoom) {
      if (dayChanged) onBookingUpdate(dragState.bookingId, dragState.dayDelta, dragState.mode)
      if (changedRoom) onBookingMove(dragState.bookingId, dragState.roomId, dragState.targetRoomId!)
    } else if (!moved.current && !wasLongPress) {
      // Zero net change AND the pointer never really left its spot: a tap.
      // (A long press released in place is not a tap: it was a pick-up.)
      onBookingTap?.(dragState.bookingId)
    }
    // Otherwise: dragged around (e.g. up and back) but ended up producing no
    // change — silently snap back, do not open anything.
    setDragState(null)
  }, [dragState, onBookingUpdate, onBookingMove, onBookingTap, endTouchGesture])

  // The browser took the gesture over (scroll, system gesture): drop everything,
  // never commit a half-finished drag.
  const onPointerCancel = useCallback(() => {
    endTouchGesture()
    setDragState(null)
  }, [endTouchGesture])

  return { dragState, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }
}
