import type { Booking } from '../../types/database'
import { CELL_W } from '../../hooks/useBookingDrag'

/** The pseudo-room the planning uses for bookings that have no `booking_rooms`
 *  row at all — the state every booking created by the public form starts in.
 *
 *  It is a drag SOURCE only. The rows under this header are rendered without a
 *  `data-room-id`, which is what useBookingDrag scans to pick a drop target: no
 *  drag can therefore land *on* this row, and this id can never reach the
 *  database as a room_id. Dropping a bar from here onto a real room is what
 *  assigns it — see the `roomSwaps` whose `from` is this id in PlanningView. */
export const UNASSIGNED_ROOM_ID = '__unassigned__'

interface UnassignedRowProps {
  label: string
  title: string
  totalDays: number
  seasonStart: Date
  /** Bookings with no room, already clipped to the displayed season. */
  bookings: Booking[]
  open: boolean
  onToggle: () => void
}

/** Collapsed header of the "no room" section: keeps the day columns so the row
 *  says *when* the gap falls, not just that it exists. Same per-day shape as
 *  TotalsRow — this is a count strip, read the same way as Tot Guest. */
export default function UnassignedRow({ label, title, totalDays, seasonStart, bookings, open, onToggle }: UnassignedRowProps) {
  const dailyCounts = new Array(totalDays).fill(0)

  function dateToIdx(dateStr: string): number {
    const [y, m, d] = dateStr.split('-').map(Number)
    return Math.round(
      (Date.UTC(y, m - 1, d) - Date.UTC(seasonStart.getFullYear(), seasonStart.getMonth(), seasonStart.getDate()))
      / 86400000
    )
  }

  for (const booking of bookings) {
    const startOffset = Math.max(0, dateToIdx(booking.check_in))
    const endOffset = Math.min(totalDays, dateToIdx(booking.check_out) + 1)
    for (let i = startOffset; i < endOffset; i++) dailyCounts[i]++
  }

  return (
    <div className="flex min-w-max border-b border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-xs">
      <button
        type="button"
        onClick={onToggle}
        title={title}
        aria-expanded={open}
        className="sticky left-0 z-20 shrink-0 w-20 px-1.5 py-2 text-[11px] font-bold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950 border-r border-amber-300 dark:border-amber-800 flex items-center gap-1 hover:bg-amber-200 dark:hover:bg-amber-900 text-left"
      >
        <span className="shrink-0">{open ? '▾' : '▸'}</span>
        <span className="truncate">{label}</span>
        <span className="ml-auto shrink-0 px-1 rounded bg-amber-500 text-gray-900">{bookings.length}</span>
      </button>
      <div className="shrink-0" style={{ width: `${totalDays * CELL_W}px`, minHeight: '28px' }}>
        <div className="flex h-full">
          {Array.from({ length: totalDays }, (_, i) => {
            const d = new Date(seasonStart.getFullYear(), seasonStart.getMonth(), seasonStart.getDate() + i)
            const dow = d.getDay()
            const count = dailyCounts[i]
            return (
              <div
                key={i}
                className={`shrink-0 text-center py-1 border-r flex items-center justify-center ${
                  dow === 0 ? 'border-r-amber-300 dark:border-r-amber-800' : 'border-r-amber-200/60 dark:border-r-amber-900/60'
                } ${count > 0
                  ? 'bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100 font-bold'
                  : dow === 0 || dow === 6 ? 'bg-amber-100/60 dark:bg-amber-950/60 text-amber-400 dark:text-amber-700' : 'text-amber-300 dark:text-amber-800'}`}
                style={{ width: CELL_W }}
              >
                {count > 0 ? count : '·'}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
