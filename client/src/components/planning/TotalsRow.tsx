import type { Booking, BookingParticipant } from '../../types/database'
import { CELL_W } from '../../hooks/useBookingDrag'

interface TotalsRowProps {
  label: string
  totalDays: number
  seasonStart: Date
  bookings: Booking[]
  bookingParticipants: BookingParticipant[]
  type: 'lessons' | 'equipment' | 'guests'
}

export default function TotalsRow({ label, totalDays, seasonStart, bookings, bookingParticipants, type }: TotalsRowProps) {
  const dailyTotals = new Array(totalDays).fill(0)

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
    const value = type === 'lessons'
      ? booking.num_lessons
      : type === 'equipment'
        ? booking.num_equipment_rentals
        : bookingParticipants.filter(p => p.booking_id === booking.id).length

    for (let i = startOffset; i < endOffset; i++) {
      dailyTotals[i] += value
    }
  }

  return (
    <div className="flex min-w-max border-b border-gray-200 bg-gray-50 text-xs">
      <div className="sticky left-0 z-10 shrink-0 w-20 px-2 py-2 text-xs font-bold bg-gray-100 border-r border-gray-200 flex items-center truncate">
        {label}
      </div>
      <div className="shrink-0" style={{ width: `${totalDays * CELL_W}px`, minHeight: '28px' }}>
        <div className="flex h-full">
          {Array.from({ length: totalDays }, (_, i) => {
            const d = new Date(seasonStart.getFullYear(), seasonStart.getMonth(), seasonStart.getDate() + i)
            const dow = d.getDay()
            const total = dailyTotals[i]
            return (
              <div
                key={i}
                className={`shrink-0 text-center py-1 border-r flex items-center justify-center ${
                  dow === 0 ? 'border-r-gray-300' : 'border-r-gray-100'
                } ${dow === 0 || dow === 6 ? 'bg-blue-50' : ''} ${
                  total > 0 ? 'text-emerald-700 font-semibold' : 'text-gray-300'
                }`}
                style={{ width: CELL_W }}
              >
                {total > 0 ? total : '·'}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
